import logging
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from ..models import Valoracion, Cargo, Curva

logger = logging.getLogger(__name__)

def _estimar_puntos(v) -> float:
    """Calculate total points from valuation factors.
    Soporta tanto codigos de letra (legacy) como valores textuales (nuevo pipeline)."""
    pts_c = {"A": 20, "B": 40, "C": 60, "D": 80, "E": 100, "F": 120, "G": 140, "H": 160,
             "Básico": 20, "Medio": 40, "Avanzado": 60, "Experto": 80}
    mult_e = {"-": 0.8, "o": 1.0, "+": 1.2,
              "Mínima": 0.6, "1-2 años": 0.8, "3-5 años": 1.0, "5-7 años": 1.2, "7+ años": 1.4}
    pts_h = {"I": 10, "II": 20, "III": 30, "IV": 40, "V": 50, "VI": 60, "VII": 70,
             "No requiere": 10, "Baja": 20, "Media": 30, "Alta": 40}
    pts_r = {"1": 10, "2": 15, "3": 25, "4": 35,
             "Individual": 10, "Supervisión": 15, "Táctico": 25, "Estratégico": 35, "Dirección": 45}
    pts_contacto = {"A": 5, "B": 10, "C": 15,
                    "Interno": 5, "Mixto": 10, "Externo": 15, "Cliente": 20}
    pts_freq = {"1": 2, "2": 4, "3": 6, "4": 8,
                "Esporádica": 2, "Mensual": 4, "Semanal": 6, "Diaria": 8, "Permanente": 10}
    pts_cont = {"I": 5, "II": 10, "III": 15, "IV": 20, "V": 25,
                "Informativo": 5, "Coordinación": 10, "Negociación": 15, "Asesoría": 20}
    pts_cc = {"1": 10, "2": 20, "3": 30, "4": 40, "5": 50,
              "Repetitiva": 10, "Procedimental": 20, "Analítica": 30, "Creativa": 40, "Estratégica": 50}
    mult_t = {"-": 0.85, "o": 1.0, "+": 1.15,
              "Decreciente": 0.85, "Estable": 1.0, "Creciente": 1.15}
    pts_g = {"A": 10, "B": 20, "C": 30, "D": 40, "E": 50, "F": 60, "G": 70, "H": 80,
             "Específicas": 10, "Generales": 20, "Políticas": 30, "Autonomía total": 40}
    pts_imp = {"I": 10, "II": 20, "III": 30, "IV": 40,
               "Mínimo": 10, "Medio": 20, "Alto": 30, "Crítico": 40}
    pts_aut = {"A": 10, "B": 20, "C": 30, "D": 40, "E": 50, "F": 60, "G": 70,
               "Nula": 10, "Supervisada": 20, "Guiada": 30, "Total": 40}
    pts_mag = {**{str(i): i * 5 for i in range(15)},
               "Pequeña": 5, "Mediana": 10, "Grande": 15, "Corporativa": 20}

    f1 = (pts_c.get(v.conocimientos, 40) * mult_e.get(v.experiencia, 1.0) +
          pts_h.get(v.habilidad_gerencial, 20) + pts_r.get(str(v.rol_cargo or ""), 15))
    f2 = (pts_contacto.get(v.contacto, 10) + pts_freq.get(str(v.frecuencia or ""), 4) +
          pts_cont.get(v.contenido_relaciones, 10))
    f3 = (pts_cc.get(str(v.complejidad_conceptual or ""), 20) * mult_t.get(v.tendencia_cc, 1.0) +
          pts_g.get(v.guias_apoyo, 20) * mult_t.get(v.tendencia_ga, 1.0))
    f4 = (pts_imp.get(v.impacto, 20) + pts_aut.get(v.autonomia, 20) +
          pts_mag.get(str(v.magnitud or ""), 10))

    crit = (int(v.criterio_1 or 0) + int(v.criterio_2 or 0) + int(v.criterio_3 or 0))
    raw = f1 + f2 + f3 + f4
    return raw * (1 + crit * 0.05)


def calcular_curvas_equidad(db: Session, upload_id: int) -> List[Curva]:
    """Calculate salary curves based on valuation points."""
    valoraciones = db.query(Valoracion).join(Cargo).filter(
        Cargo.upload_id == upload_id,
        Valoracion.garantizado.isnot(None)
    ).all()

    if not valoraciones or len(valoraciones) < 3:
        return []

    # Sort by points
    valoraciones_ordenadas = sorted(valoraciones, key=lambda v: _estimar_puntos(v))
    n = len(valoraciones_ordenadas)

    qi_idx = n // 4
    med_idx = n // 2
    qiii_idx = 3 * n // 4

    # Calculate salary at each quartile
    garantizados = sorted([float(v.garantizado or 0) for v in valoraciones if v.garantizado])

    if len(garantizados) < 3:
        return []

    curva = Curva(
        upload_id=upload_id,
        qi_garantizado=garantizados[qi_idx] if qi_idx < len(garantizados) else garantizados[-1],
        qi_g_v=0,
        qi_ct=0,
        med_garantizado=garantizados[med_idx] if med_idx < len(garantizados) else garantizados[-1],
        med_g_v=0,
        med_ct=0,
        qiii_garantizado=garantizados[qiii_idx] if qiii_idx < len(garantizados) else garantizados[-1],
        qiii_g_v=0,
        qiii_ct=0,
    )

    # Remove old curves for this upload
    db.query(Curva).filter(Curva.upload_id == upload_id).delete()
    db.add(curva)
    db.commit()
    return [curva]


def analizar_equidad(db: Session, upload_id: int) -> Dict:
    """Analyze salary equity: subpago/competitivo/sobrepago."""
    valoraciones = db.query(Valoracion).join(Cargo).filter(
        Cargo.upload_id == upload_id
    ).all()

    if not valoraciones:
        return {"total": 0, "subpago": 0, "competitivo": 0, "sobrepago": 0,
                "pct_subpago": 0, "pct_competitivo": 0, "pct_sobrepago": 0, "detalles": []}

    subpago = 0
    competitivo = 0
    sobrepago = 0
    detalles = []

    for v in valoraciones:
        cargo = db.query(Cargo).filter(Cargo.id == v.cargo_id).first()
        if not cargo:
            continue

        # Get actual salary
        salario_actual = float(v.garantizado or v.basico or 0)
        if salario_actual == 0:
            continue

        # Calculate reference: points * 25000
        puntos = _estimar_puntos(v)
        salario_ref = puntos * 25000

        if salario_ref > 0:
            posicion = (salario_actual / salario_ref) * 100
        else:
            posicion = 100

        if posicion < 80:
            subpago += 1
        elif posicion <= 120:
            competitivo += 1
        else:
            sobrepago += 1

        detalles.append({
            "cargo": cargo.nombre_cargo,
            "actual": salario_actual,
            "referencia": salario_ref,
            "posicion": round(posicion, 1),
        })

    total = len(detalles) if detalles else 1

    return {
        "total": total,
        "subpago": subpago,
        "competitivo": competitivo,
        "sobrepago": sobrepago,
        "pct_subpago": round(subpago / total * 100, 1) if total > 0 else 0,
        "pct_competitivo": round(competitivo / total * 100, 1) if total > 0 else 0,
        "pct_sobrepago": round(sobrepago / total * 100, 1) if total > 0 else 0,
        "detalles": detalles[:10],
    }


def calcular_nivelacion(db: Session, upload_id: int, target: float = 1.0) -> Dict:
    """Calculate salary adjustment cost to reach target equity."""
    valoraciones = db.query(Valoracion).join(Cargo).filter(
        Cargo.upload_id == upload_id
    ).all()

    if not valoraciones:
        return {"total": 0, "costo_total_anual": 0, "costo_mensual": 0}

    costo_total = 0

    for v in valoraciones:
        salario_actual = float(v.garantizado or v.basico or 0)
        if salario_actual == 0:
            continue

        target_salary = salario_actual * target
        diferencia = max(0, target_salary - salario_actual)
        costo_total += diferencia * 12  # Annual cost

    return {
        "target": target,
        "costo_total_anual": costo_total,
        "costo_mensual": costo_total / 12,
    }


def calcular_costos_nivelacion(db: Session, upload_id: int, bandas: List[float] = None) -> Dict:
    """Calculate adjustment costs for multiple target bands."""
    bandas = bandas or [0.7, 0.8, 0.9, 1.0]
    costos = {}
    for target in bandas:
        calculo = calcular_nivelacion(db, upload_id, target)
        costos[f"target_{int(target*100)}"] = {
            "costo_anual": calculo["costo_total_anual"],
            "costo_mensual": calculo["costo_mensual"],
        }
    return costos


def resumen_valoracion(db: Session, upload_id: int) -> dict:
    """Get summary of valuations for an upload."""
    valoraciones = db.query(Valoracion).join(Cargo).filter(
        Cargo.upload_id == upload_id
    ).all()

    if not valoraciones:
        return {"total": 0, "puntos_promedio": 0}

    total = len(valoraciones)
    puntos_promedio = sum(_estimar_puntos(v) for v in valoraciones) / total if total > 0 else 0

    return {
        "total": total,
        "puntos_promedio": round(puntos_promedio, 0),
    }


def reporte_consolidado(db: Session, upload_id: int) -> Dict:
    """Generate consolidated report with all analysis."""
    # Count cargos
    total_cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).count()
    homologados = db.query(Cargo).filter(
        Cargo.upload_id == upload_id,
        Cargo.estado == "HOMOLOGADO"
    ).count()

    resumen_val = resumen_valoracion(db, upload_id)
    equidad = analizar_equidad(db, upload_id)
    nivelacion = calcular_costos_nivelacion(db, upload_id)

    return {
        "upload_id": upload_id,
        "resumen_proceso": {
            "total_cargos": total_cargos,
            "homologados": homologados,
            "valoraciones": resumen_val.get("total", 0),
        },
        "equidad": equidad,
        "nivelacion": nivelacion,
    }
