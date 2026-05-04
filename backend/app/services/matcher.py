import os
import requests
import json
import logging
import re
import difflib
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, MasterDescription, Upload

logger = logging.getLogger(__name__)


def get_master_descriptions(db: Session):
    masters = db.query(MasterDescription).all()
    return [{"nombre": m.nombre_cargo or "", "descripcion": m.descripcion or "", "area": m.area or ""} for m in masters]


def normalize_text(text):
    if not text:
        return ""
    t = str(text).lower().strip()
    t = t.replace("a", "a").replace("e", "e").replace("i", "i").replace("o", "o").replace("u", "u")
    t = re.sub(r"^(coordinador|supervisor|jefe|gerente|director|analista|especialista)\s+", "", t)
    return re.sub(r"\s+", " ", t)


def find_exact_match(cargo_nombre: str, masters: list):
    if not cargo_nombre or not masters:
        return None

    norm_cargo = normalize_text(cargo_nombre)

    for m in masters:
        if normalize_text(m["nombre"]) == norm_cargo:
            return m

    best_match = None
    best_ratio = 0.0
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        ratio = difflib.SequenceMatcher(None, norm_cargo, norm_m).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = m

    if best_ratio >= 0.55:
        return best_match

    for m in masters:
        norm_m = normalize_text(m["nombre"])
        palabras = norm_cargo.split()
        for palabra in palabras:
            if len(palabra) > 4 and palabra in norm_m:
                return m

    if len(norm_cargo) <= 15:
        for m in masters:
            norm_m = normalize_text(m["nombre"])
            if norm_cargo in norm_m:
                return m

    return None


def start_batch_processing(upload_id: int, db: Session):
    """Procesa lote de homologacion: match local -> IA para los que no coinciden."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        return

    upload.status = "procesando"
    db.commit()

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == "PENDIENTE").all()
    masters = get_master_descriptions(db)

    _process_homologacion_batch(upload_id, cargos, masters, db)

    upload.status = "completado"
    db.commit()


def _process_homologacion_batch(upload_id: int, cargos: list, masters: list, db: Session):
    cargos_para_ia = []

    for cargo in cargos:
        nombre_cargo = cargo.nombre_cargo
        master = find_exact_match(nombre_cargo, masters)

        if master:
            homo = cargo.homologacion
            if homo:
                homo.cargo_homologado = master["nombre"]
                homo.justificacion = f"Coincidencia local ({master.get('area', '')})"
                homo.editado_manual = False
            else:
                homo = Homologacion(
                    cargo_id=cargo.id,
                    cargo_homologado=master["nombre"],
                    justificacion=f"Coincidencia local ({master.get('area', '')})"
                )
                db.add(homo)

            cargo.estado = "HOMOLOGADO"
        else:
            cargo.estado = "SIN_COINCIDENCIA"
            cargos_para_ia.append(cargo)

    db.commit()

    if cargos_para_ia:
        from ..services.ia_service import homologar_con_ia

        cargos_batch = [{
            "id": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area,
            "descripcion": c.descripcion_empresa or "",
            "cargo_jefe": "",
        } for c in cargos_para_ia]

        try:
            resultados = homologar_con_ia(db, cargos_batch)

            for res in resultados:
                cargo_id = res.get("id")
                if cargo_id:
                    cargo = next((c for c in cargos_para_ia if c.id == cargo_id), None)
                    if cargo:
                        cargo.estado = "HOMOLOGADO"

                        homo = cargo.homologacion
                        if homo:
                            homo.cargo_homologado = res.get("cargo_homologado", "SIN COINCIDENCIA")
                            homo.justificacion = f"IA: {res.get('justificacion', '')} (confianza: {res.get('confianza', 0)})"
                        else:
                            homo = Homologacion(
                                cargo_id=cargo.id,
                                cargo_homologado=res.get("cargo_homologado", "SIN COINCIDENCIA"),
                                justificacion=f"IA: {res.get('justificacion', '')} (confianza: {res.get('confianza', 0)})"
                            )
                            db.add(homo)

            db.commit()
            logger.info(f"Homologacion IA completada para {len(resultados)} cargos")
        except Exception as e:
            logger.error(f"Error en homologacion IA: {e}")
