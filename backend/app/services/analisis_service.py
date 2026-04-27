import logging
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from ..models import (
    CargoEmpresa, ValoracionCargo, Curva, Colaborador
)

logger = logging.getLogger(__name__)


# ==========================================
# PROCESO 4: ANÁLISIS Y CURVAS
# ==========================================

def calcular_curvas_equidad(db: Session, empresa_id: int = None, upload_id: int = None) -> List[Curva]:
    """
    Calcular curvas de equidad por categoría.
    
    Las curvas se calculan con los percentiles:
    - Q1 (25%): Subpago
    - Mediana (50%): Posición competitiva
    - Q3 (75%): Sobrepago
    """
    
    from ..models import Valoracion, Cargo
    
    # Obtener valoraciones segun el modelo
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
        logger.warning(f"No hay valoraciones con datos")
        return []
    
    # Por ahora, agrupar todos juntos (sin categoria)
    por_categoria = {0: valoraciones}
    
    # Calcular curvas por categoría
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
    logger.info(f"Calculadas {len(curvas)} curvas para empresa {empresa_id}")
    
    return curvas


def analizar_equidad(db: Session, empresa_id: int) -> Dict:
    """
    Analizar nivel de equidad de la empresa.
    
    Rangos:
    - < 80%: Subpago
    - 80% - 120%: Competitivo
    - > 120%: Sobrepago
    """
    
    valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id,
        ValoracionCargo.g.isnot(None),
        ValoracionCargo.categoria.isnot(None)
    ).all()
    
    if not valoraciones:
        return {"total": 0}
    
    # Obtener curvas de referencia
    curvas = db.query(Curva).all()
    curva_por_cat = {c.categoria: c for c in curvas}
    
    subpago = 0
    competitivo = 0
    sobrepago = 0
    detalles = []
    
    for v in valoraciones:
        cat = v.categoria
        if cat not in curva_por_cat:
            continue
        
        curva = curva_por_cat[cat]
        actual = v.g or 0
        referencia = curva.med_garantizado or 1
        
        if referencia > 0:
            posicion = (actual / referencia) * 100
            
            if posicion < 80:
                subpago += 1
            elif posicion <= 120:
                competitivo += 1
            else:
                sobrepago += 1
            
            detalles.append({
                "cargo": v.cargo,
                "categoria": cat,
                "actual": actual,
                "referencia": referencia,
                "posicion": round(posicion, 1),
            })
    
    total = len(detalles)
    
    return {
        "total": total,
        "subpago": subpago,
        "competitivo": competitivo,
        "sobrepago": sobrepago,
        "pct_subpago": round(subpago / total * 100, 1) if total > 0 else 0,
        "pct_competitivo": round(competitivo / total * 100, 1) if total > 0 else 0,
        "pct_sobrepago": round(sobrepago / total * 100, 1) if total > 0 else 0,
        "detalles": detalles[:10],  # Primeros 10
    }


def analizar_competitividad(
    db: Session,
    empresa_id: int,
    mercado_ref: str = "mediana"
) -> Dict:
    """
    Analizar competitividad vs mercado externo.
    
    mercado_ref: mediana, q1, q3
    """
    
    # Por implementar: comparar con datos de mercado externos
    return {
        "mercado_ref": mercado_ref,
        "mensaje": "Requiere datos de mercado externo",
    }


def calcular_nivelacion(
    db: Session,
    empresa_id: int,
    target: float = 1.0
) -> Dict:
    """
    Calcular costo de nivelación a la política target.
    
    target: 0.7 (70% equidad), 0.8, 0.9, 1.0 (100%)
    """
    
    valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id,
        ValoracionCargo.g.isnot(None),
        ValoracionCargo.categoria.isnot(None)
    ).all()
    
    if not valoraciones:
        return {"total": 0}
    
    # Obtener curvas
    curvas = db.query(Curva).all()
    curva_por_cat = {c.categoria: c for c in curvas}
    
    costo_total = 0
    criticos = []
    
    for v in valoraciones:
        cat = v.categoria
        if cat not in curva_por_cat:
            continue
        
        curva = curva_por_cat[cat]
        actual = v.g or 0
        target_g = curva.med_garantizado * target
        
        diferenciah = max(0, target_g - actual)
        costo_mensual = diferenciah * 12  # Anual
        costo_total += costo_mensual
        
        if v.criticidad in ["Crítico", "Muy Importante"]:
            criticos.append({
                "cargo": v.cargo,
                "cat": cat,
                "actual": actual,
                "target": target_g,
                "diferencia": diferenciah,
                "criticidad": v.criticidad,
            })
    
    return {
        "target": target,
        "costo_total_anual": costo_total,
        "costo_mensual": costo_total / 12,
        "criticos": len(criticos),
        "detalles_criticos": criticos,
    }


def comparar_curvas(db: Session, empresa_id: int) -> List[Dict]:
    """
    Comparar estructura actual vs curvas de mercado por categoría.
    """
    
    valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()
    
    curvas = db.query(Curva).all()
    curva_por_cat = {c.categoria: c for c in curvas}
    
    comparativos = []
    for v in valoraciones:
        cat = v.categoria
        if cat not in curva_por_cat:
            continue
        
        curva = curva_por_cat[cat]
        
        comparativos.append({
            "cargo": v.cargo,
            "categoria": cat,
            "criticidad": v.criticidad,
            "garantizado_actual": v.g or 0,
            "garantizado_md": curva.med_garantizado or 0,
            "posicion": round((v.g or 0) / curva.med_garantizado * 100, 1) if curva.med_garantizado else 0,
            "g_v_actual": v.g_v or 0,
            "g_v_md": curva.med_g_v or 0,
            "ct_actual": v.ct or 0,
            "ct_md": curva.med_ct or 0,
        })
    
    return comparativos


def estructura_vs_mediana(db: Session, empresa_id: int) -> Dict:
    """Análisis de estructura vs mediana de mercado"""
    
    comparativos = comparar_curvas(db, empresa_id)
    
    if not comparativos:
        return {"total": 0}
    
    # Agregar por categoría
    por_cat = {}
    for c in comparativos:
        cat = c["categoria"]
        if cat not in por_cat:
            por_cat[cat] = {"count": 0, "posiciones": []}
        por_cat[cat]["count"] += 1
        por_cat[cat]["posiciones"].append(c["posicion"])
    
    # Calcular estadísticas
    resultado = {"total": len(comparativos)}
    for cat, data in por_cat.items():
        posiciones = data["posiciones"]
        resultado[f"cat_{cat}"] = {
            "count": data["count"],
            "posicion_promedio": round(sum(posiciones) / len(posiciones), 1),
            "posicion_min": min(posiciones),
            "posicion_max": max(posiciones),
        }
    
    return resultado


def calcular_costos_nivelacion(
    db: Session,
    empresa_id: int,
    bandas: List[float] = None
) -> Dict:
    """
    Calcular costos de nivelación por bandas.
    
    bandas: [0.7, 0.8, 0.9, 1.0]
    """
    
    bandas = bandas or [0.7, 0.8, 0.9, 1.0]
    costos = {}
    
    for target in bandas:
        calculo = calcular_nivelacion(db, empresa_id, target)
        costos[f"target_{int(target*100)}"] = {
            "costo_anual": calculo["costo_total_anual"],
            "costo_mensual": calculo["costo_mensual"],
            "criticos": calculo["criticos"],
        }
    
    return costos


# ==========================================
# REPORTES CONSOLIDADOS
# ==========================================

def reporte_consolidado(db: Session, empresa_id: int) -> Dict:
    """
    Generar reporte consolidado completo.
    """
    
    # 1. Homologaciones
    homologados = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id,
        CargoEmpresa.homologado.isnot(None)
    ).count()
    
    total_cargos = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).count()
    
    # 2. Valoraciones
    resumen_val = resumen_valoracion(db, empresa_id)
    
    # 3. Equidad
    equidad = analizar_equidad(db, empresa_id)
    
    # 4. Competitividad
    competitividad = analizar_competitividad(db, empresa_id)
    
    # 5. Nivelación
    nivelacion = calcular_costos_nivelacion(db, empresa_id)
    
    return {
        "empresa_id": empresa_id,
        "Resumen_proceso": {
            "total_cargos": total_cargos,
            "homologados": homologados,
            "valoraciones": resumen_val.get("total", 0),
        },
        "equidad": equidad,
        "competitividad": competitividad,
        "nivelacion": nivelacion,
    }


def ExportarExcel(db: Session, empresa_id: int, tipo: str = "consolidado") -> List[Dict]:
    """
    Exportar datos para Excel.
    
    tipos: consolidado, homologacion, valoracion, curvas, nivelacion
    """
    
    if tipo == "homologacion":
        from .homologacion_service import ExportarHomologaciones
        return ExportarHomologaciones(db, empresa_id)
    
    if tipo == "valoracion":
        from .valoracion_service import ExportarValoraciones
        return ExportarValoraciones(db, empresa_id)
    
    if tipo == "curvas":
        return comparar_curvas(db, empresa_id)
    
    if tipo == "nivelacion":
        return calcular_costos_nivelacion(db, empresa_id)
    
    # Consolidado
    return [{"reporte": "completo"}]