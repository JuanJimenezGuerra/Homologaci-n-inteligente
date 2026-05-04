import json
import time
import logging
from ..models import Cargo, Valoracion, ProcessingLog

logger = logging.getLogger(__name__)


def _get_db():
    """Crea una nueva sesion de DB para uso en background tasks."""
    from ..database import SessionLocal
    return SessionLocal()


def _valorar_cargo_con_ia(cargo) -> dict:
    """Valora un cargo usando el servicio de IA unificado."""
    from ..services.ia_service import valorar_cargo_con_ia as ia_valorar

    cargo_dict = {
        "id": cargo.id,
        "nombre_cargo": cargo.nombre_cargo,
        "area": cargo.area,
        "descripcion_empresa": cargo.descripcion_empresa,
        "cargo_homologado": cargo.homologacion.cargo_homologado if cargo.homologacion else "",
    }

    resultado = ia_valorar(cargo_dict)
    return resultado


def start_valoracion_batch(upload_id: int):
    """Inicia valoracion de TODOS los cargos de un upload con IA.
    Crea su propia sesion de DB para evitar problemas con background tasks."""
    db = _get_db()
    try:
        cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
        if not cargos:
            logger.warning(f"No hay cargos para valorar en upload {upload_id}")
            return

        _process_with_ia(cargos, db)
        logger.info(f"Valoracion completada para upload {upload_id}: {len(cargos)} cargos")
    except Exception as e:
        logger.error(f"Error en start_valoracion_batch: {e}")
    finally:
        db.close()


def _process_with_ia(cargos: list, db):
    if not cargos:
        return

    for cargo in cargos:
        try:
            resultado = _valorar_cargo_con_ia(cargo)

            val = db.query(Valoracion).filter(Valoracion.cargo_id == cargo.id).first()
            if not val:
                val = Valoracion(cargo_id=cargo.id)
                db.add(val)

            val.conocimientos = resultado.get("conocimientos")
            val.experiencia = resultado.get("experiencia")
            val.habilidad_gerencial = resultado.get("habilidadGerencial")
            val.rol_cargo = resultado.get("rolCargo")
            val.contacto = resultado.get("contacto")
            val.frecuencia = resultado.get("frecuenciaContacto")
            val.contenido_relaciones = resultado.get("contenidoRelaciones")
            val.complejidad_conceptual = resultado.get("complejidadConceptual")
            val.tendencia_cc = resultado.get("tendenciaCC")
            val.guias_apoyo = resultado.get("guiasApoyo")
            val.tendencia_ga = resultado.get("tendenciaGA")
            val.impacto = resultado.get("impacto")
            val.autonomia = resultado.get("autonomia")
            val.magnitud = resultado.get("magnitud")
            val.criterio_1 = resultado.get("criterio1", 0)
            val.criterio_2 = resultado.get("criterio2", 0)
            val.criterio_3 = resultado.get("criterio3", 0)

            db.commit()
            time.sleep(1.5)

        except Exception as e:
            logger.error(f"Error valorando cargo {cargo.id}: {e}")
            continue
