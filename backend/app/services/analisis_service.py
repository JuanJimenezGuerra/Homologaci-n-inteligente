import logging
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from ..models import (
    CargoEmpresa, ValoracionCargo, Curva, Colaborador
)

logger = logging.getLogger(__name__)


def calcular_curvas_equidad(db: Session, empresa_id: int = None, upload_id: int = None) -> List[Curva]:
    from ..models import Valoracion, Cargo

    if upload_id:
        valoraciones = db.query(Valoracion).join(Cargo).filter(
            Cargo.upload_id == upload_id,
            Valoracion.g.isnot(None)
        ).all()
    elif empresa_id:
        valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
            CargoEmpresa.empresa_id == empresa_id,
            ValoracionCargo.g.isnot(None)
        ).all()
    else:
        return []

    if not valoraciones:
        return []

    por_categoria = {0: valoraciones}

    curvas = []
    for cat, vals in por_categoria.items():
        if len(vals) < 3:
            continue

        garantizados = sorted([v.g or 0 for v in vals if v.g])
        g_v = sorted([v.g_v or 0 for v in vals if hasattr(v, 'g_v') and v.g_v])
        ct = sorted([v.ct or 0 for v in vals if hasattr(v, 'ct') and v.ct])

        n = len(garantizados)
        qi_idx = n // 4
        med_idx = n // 2
        qiii_idx = 3 * n // 4

        curva = Curva(
            categoria=cat,
            qi_garantizado=garantizados[qi_idx] if qi_idx < n else garantizados[-1],
            qi_g_v=g_v[qi_idx] if qi_idx < len(g_v) else g_v[-1],
            qi_ct=ct[qi_idx] if qi_idx < len(ct) else ct[-1],
            med_garantizado=garantizados[med_idx],
            med_g_v=g_v[med_idx] if med_idx < len(g_v) else g_v[-1],
            med_ct=ct[med_idx] if med_idx < len(ct) else ct[-1],
            qiii_garantizado=garantizados[qiii_idx] if qiii_idx < n else garantizados[-1],
            qiii_g_v=g_v[qiii_idx] if qiii_idx < len(g_v) else g_v[-1],
            qiii_ct=ct[qiii_idx] if qiii_idx < len(ct) else ct[-1],
        )

        db.add(curva)
        curvas.append(curva)

    db.commit()
    return curvas


def analizar_equidad(db: Session, empresa_id: int = None, upload_id: int = None) -> Dict:
    from ..models import Valoracion, Cargo

    if upload_id:
        valoraciones = db.query(Valoracion).join(Cargo).filter(
            Cargo.upload_id == upload_id
        ).all()
    elif empresa_id:
        valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
            CargoEmpresa.empresa_id == empresa_id,
            ValoracionCargo.g.isnot(None)
        ).all()
    else:
        return {"total": 0}

    if not valoraciones:
        return {"total": 0}

    subpago = 0
    competitivo = 0
    sobrepago = 0
    detalles = []

    for v in valoraciones:
        cargo_name = v.cargo if hasattr(v, 'cargo') and v.cargo else "N/A"
        actual = v.g or 0
        referencia = actual * 1.1

        if referencia > 0:
            posicion = (actual / referencia) * 100
            if posicion < 80:
                subpago += 1
            elif posicion <= 120:
                competitivo += 1
            else:
                sobrepago += 1

            detalles.append({
                "cargo": cargo_name,
                "actual": actual,
                "referencia": referencia,
                "posicion": round(posicion, 1),
            })

    total = len(detalles) if detalles else 1

    return {
        "total": total,
        "subpago": subpago,
        "competitivo": competitivo,
        "sobrepago": sobrepago,
        "pct_subpago": round(subpago / total * 100, 1),
        "pct_competitivo": round(competitivo / total * 100, 1),
        "pct_sobrepago": round(sobrepago / total * 100, 1),
        "detalles": detalles[:10],
    }


def calcular_nivelacion(db: Session, empresa_id: int = None, upload_id: int = None, target: float = 1.0) -> Dict:
    from ..models import Valoracion, Cargo

    if upload_id:
        valoraciones = db.query(Valoracion).join(Cargo).filter(Cargo.upload_id == upload_id).all()
    elif empresa_id:
        valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
            CargoEmpresa.empresa_id == empresa_id,
            ValoracionCargo.g.isnot(None)
        ).all()
    else:
        return {"total": 0}

    if not valoraciones:
        return {"total": 0}

    costo_total = 0
    criticos = []

    for v in valoraciones:
        actual = v.g or 0
        target_g = actual * target
        diferencia = max(0, target_g - actual)
        costo_mensual = diferencia * 12
        costo_total += costo_mensual

    return {
        "target": target,
        "costo_total_anual": costo_total,
        "costo_mensual": costo_total / 12,
    }


def calcular_costos_nivelacion(db: Session, empresa_id: int = None, upload_id: int = None, bandas: List[float] = None) -> Dict:
    bandas = bandas or [0.7, 0.8, 0.9, 1.0]
    costos = {}
    for target in bandas:
        calculo = calcular_nivelacion(db, empresa_id, upload_id, target)
        costos[f"target_{int(target*100)}"] = {
            "costo_anual": calculo["costo_total_anual"],
            "costo_mensual": calculo["costo_mensual"],
        }
    return costos


def resumen_valoracion(db: Session, empresa_id: int = None, upload_id: int = None) -> dict:
    from ..models import Valoracion, Cargo

    if upload_id:
        valoraciones = db.query(Valoracion).join(Cargo).filter(Cargo.upload_id == upload_id).all()
    elif empresa_id:
        valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
            CargoEmpresa.empresa_id == empresa_id
        ).all()
    else:
        return {"total": 0}

    if not valoraciones:
        return {"total": 0}

    total = len(valoraciones)
    puntos_promedio = sum(v.puntos or 0 for v in valoraciones) / total if total > 0 else 0

    return {
        "total": total,
        "puntos_promedio": round(puntos_promedio, 0),
    }


def reporte_consolidado(db: Session, empresa_id: int = None, upload_id: int = None) -> Dict:
    from ..models import Valoracion, Cargo

    if upload_id:
        total_cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).count()
        homologados = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == "HOMOLOGADO").count()
    elif empresa_id:
        total_cargos = db.query(CargoEmpresa).filter(CargoEmpresa.empresa_id == empresa_id).count()
        homologados = db.query(CargoEmpresa).filter(CargoEmpresa.empresa_id == empresa_id, CargoEmpresa.estado == "HOMOLOGADO").count()
    else:
        return {}

    resumen_val = resumen_valoracion(db, empresa_id, upload_id)
    equidad = analizar_equidad(db, empresa_id, upload_id)
    nivelacion = calcular_costos_nivelacion(db, empresa_id, upload_id)

    return {
        "empresa_id": empresa_id,
        "Resumen_proceso": {
            "total_cargos": total_cargos,
            "homologados": homologados,
            "valoraciones": resumen_val.get("total", 0),
        },
        "equidad": equidad,
        "nivelacion": nivelacion,
    }
