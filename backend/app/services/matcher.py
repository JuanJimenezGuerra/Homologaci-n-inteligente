import os
import json
import re
import logging
import difflib
from ..models import Cargo, Homologacion, MasterDescription, MasterCargo, Upload

logger = logging.getLogger(__name__)


def _get_db():
    """Crea una nueva sesion de DB para uso en background tasks."""
    from ..database import SessionLocal
    return SessionLocal()


def normalize_cargo_name(text):
    """Normaliza nombre de cargo: MAYUSCULAS, sin tildes, sin comas, sin espacios extra."""
    if not text:
        return ""
    t = str(text).strip().upper()
    # Quitar tildes
    t = t.replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
    # Qutar comas, puntos y comas, puntos
    t = t.replace(",", "").replace(";", "").replace(".", "").replace(":", "")
    # Quitar caracteres especiales pero mantener letras, numeros y espacios
    t = re.sub(r"[^A-Z0-9\s]", "", t)
    # Colapsar espacios multiples
    t = re.sub(r"\s+", " ", t).strip()
    return t


def find_exact_matches(cargos, masters):
    """
    Compara nombres normalizados de cargos contra maestros.
    Retorna (matched_cargos, unmatched_cargos).
    Solo match EXACTO del nombre normalizado.
    """
    masters_dict = {}
    for m in masters:
        norm_name = normalize_cargo_name(m["nombre"])
        if norm_name:
            masters_dict[norm_name] = m

    matched = []
    unmatched = []

    for cargo in cargos:
        norm_cargo = normalize_cargo_name(cargo.nombre_cargo)
        if norm_cargo in masters_dict:
            matched.append((cargo, masters_dict[norm_cargo]))
        else:
            unmatched.append(cargo)

    return matched, unmatched


def load_all_masters(db):
    """Carga todos los cargos maestros de ambas fuentes."""
    masters = []

    # Fuente 1: MasterDescription
    md_list = db.query(MasterDescription).all()
    for m in md_list:
        masters.append({
            "nombre": m.nombre_cargo or "",
            "descripcion": m.descripcion or "",
            "area": m.area or "",
            "fuente": "master_descriptions",
        })

    # Fuente 2: MasterCargo
    mc_list = db.query(MasterCargo).all()
    for m in mc_list:
        masters.append({
            "nombre": m.nombre or "",
            "descripcion": m.descripcion or "",
            "area": f"{m.area_general or ''} {m.area_especifica or ''}".strip(),
            "fuente": "master_cargos",
        })

    logger.info(f"Cargados {len(masters)} cargos maestros totales")
    return masters


def start_batch_processing(upload_id: int):
    """
    Procesa homologacion en 2 fases:
    1. Match EXACTO de nombres normalizados (mayusculas, sin tildes/comas)
    2. IA para los no encontrados: usa archivos opcionales + descripcion Excel
    """
    db = _get_db()
    try:
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            logger.error(f"Upload {upload_id} no encontrado")
            return

        upload.status = "procesando"
        db.commit()

        cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == "PENDIENTE").all()
        masters = load_all_masters(db)

        # FASE 1: Match exacto de nombres normalizados
        matched, unmatched = find_exact_matches(cargos, masters)

        for cargo, master in matched:
            homo = cargo.homologacion
            if homo:
                homo.cargo_homologado = master["nombre"]
                homo.justificacion = f"Match exacto ({master.get('area', '')})"
                homo.editado_manual = False
            else:
                homo = Homologacion(
                    cargo_id=cargo.id,
                    cargo_homologado=master["nombre"],
                    justificacion=f"Match exacto ({master.get('area', '')})"
                )
                db.add(homo)
            cargo.estado = "HOMOLOGADO"

        db.commit()
        logger.info(f"Fase 1: {len(matched)} matchs exactos, {len(unmatched)} pendientes")

        # FASE 2: IA para los no encontrados
        if unmatched:
            _process_with_ia(unmatched, masters, db)

        upload.status = "completado"
        db.commit()
        logger.info(f"Homologacion completada para upload {upload_id}")
    except Exception as e:
        logger.error(f"Error en start_batch_processing: {e}")
        try:
            upload.status = "error"
            db.commit()
        except:
            pass
    finally:
        db.close()


def _process_with_ia(unmatched_cargos, masters, db):
    """
    IA para cargos no encontrados:
    1. Revisa si hay archivos opcionales con descripcion del cargo
    2. Usa la descripcion del Excel si existe
    3. Busca en nombre Y descripcion de los maestros
    """
    from .ia_service import homologar_con_ia

    # Preparar datos para IA: nombre + descripcion disponible
    cargos_batch = []
    for cargo in unmatched_cargos:
        descripcion = ""
        # Primero: descripcion del Excel
        if cargo.descripcion_empresa:
            descripcion = cargo.descripcion_empresa
        # Tambien: datos del campo datos_excel si tiene descripcion
        if cargo.homologacion and cargo.homologacion.datos_excel:
            excel_desc = cargo.homologacion.datos_excel.get("descripcion", "")
            if excel_desc and not descripcion:
                descripcion = excel_desc

        cargos_batch.append({
            "id": cargo.id,
            "nombre_cargo": cargo.nombre_cargo,
            "area": cargo.area,
            "descripcion": descripcion,
            "descripcion_empresa": descripcion,
            "cargo_jefe": "",
        })

    try:
        resultados = homologar_con_ia(db, cargos_batch, masters)

        sugeridos = 0
        for res in resultados:
            cargo_id = res.get("id")
            if not cargo_id:
                continue
            cargo = next((c for c in unmatched_cargos if c.id == cargo_id), None)
            if not cargo:
                continue

            homo = cargo.homologacion
            if not homo:
                homo = Homologacion(cargo_id=cargo.id)
                db.add(homo)

            cargo_homologado = res.get("cargo_homologado", "SIN COINCIDENCIA")
            justificacion = res.get("justificacion", "")
            confianza = res.get("confianza", 0)

            if cargo_homologado and cargo_homologado != "SIN COINCIDENCIA":
                homo.cargo_homologado = cargo_homologado
                homo.justificacion = f"Sugerido IA: {justificacion} (confianza: {confianza})"
                homo.editado_manual = False
                cargo.estado = "SUGERIDO"
                sugeridos += 1
            else:
                homo.cargo_homologado = "SIN COINCIDENCIA"
                homo.justificacion = f"IA: {justificacion}" if justificacion else "Sin coincidencia encontrada"
                cargo.estado = "SIN_COINCIDENCIA"

        db.commit()
        logger.info(f"Fase 2 IA: {sugeridos} sugeridos de {len(resultados)} procesados")
    except Exception as e:
        logger.error(f"Error en homologacion IA: {e}")
        # Marcar todos como sin coincidencia si la IA falla
        for cargo in unmatched_cargos:
            cargo.estado = "SIN_COINCIDENCIA"
        db.commit()
