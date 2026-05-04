import json
import time
import logging
from sqlalchemy.orm import Session
from ..models import Cargo, Valoracion, ProcessingLog

logger = logging.getLogger(__name__)


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


def start_valoracion_batch(upload_id: int, db: Session):
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    _process_with_ia(upload_id, cargos, db)


def _process_with_ia(upload_id: int, cargos: list, db: Session):
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
