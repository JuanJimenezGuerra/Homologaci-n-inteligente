import os
import logging
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from anthropic import Anthropic
from ..models import (
    CargoEmpresa, ValoracionCargo, MasterCargo
)

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DEFAULT_MODEL = "claude-3-haiku-20240307"


# ==========================================
# FACTORES DE VALORACIÓN HAY/SHR
# ==========================================

# Factor 1: Conocimiento y Habilidad
FACTOR_CONOCIMIENTO = {
    "conocimientos": ["A", "B", "C", "D", "E", "F", "G", "H"],
    "experiencia": ["-", "o", "+"],
    "habilidad_gerencial": ["I", "II", "III", "IV", "V", "VI", "VII"],
    "rol_cargo": ["1", "2", "3", "4"],
}

# Factor 2: Comunicación y Contacto
FACTOR_CONTACTO = {
    "contacto": ["A", "B", "C"],
    "frecuencia": ["1", "2", "3", "4"],
    "contenido_relaciones": ["I", "II", "III", "IV", "V"],
}

# Factor 3: Solución de Problemas
FACTOR_COMPLEJIDAD = {
    "complejidad_conceptual": ["1", "2", "3", "4", "5", "6"],
    "tendencia": ["-", "o", "+"],
    "guias_apoyo": ["A", "B", "C", "D", "E", "F"],
}

# Factor 4: Responsabilidad
FACTOR_RESPONSABILIDAD = {
    "impacto": ["I", "II", "III", "IV"],
    "autonomia": ["A", "B", "C", "D", "E", "F", "G"],
    "magnitud": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
}

# Tabla de puntos (implementación simplificada)
TABLA_PUNTOS = {
    # Factor 1: Conocimiento + Habilidad = 30-900 puntos
    "A": 30, "B": 50, "C": 70, "D": 100, "E": 130, "F": 170, "G": 220, "H": 270,
    "I": 30, "II": 50, "III": 70, "IV": 100, "V": 130, "VI": 170, "VII": 220,
    "1": 20, "2": 50, "3": 80, "4": 120,
    
    # Factor 2: Contacto = 20-190 puntos
    "A": 20, "B": 50, "C": 90,
    "1": 10, "2": 25, "3": 45, "4": 70,
    "I": 10, "II": 25, "III": 45, "IV": 70, "V": 100,
    
    # Factor 3: Complejidad = 10-160 puntos
    "1": 10, "2": 20, "3": 35, "4": 55, "5": 80, "6": 110,
    "A": 10, "B": 20, "C": 35, "D": 50, "E": 70, "F": 100,
    
    # Factor 4: Responsabilidad = 30-400 puntos
    "I": 30, "II": 60, "III": 100, "IV": 150,
    "A": 10, "B": 25, "C": 50, "D": 80, "E": 120, "F": 170, "G": 230,
    "1": 15, "2": 30, "3": 50, "4": 75, "5": 105, "6": 140, "7": 180, "8": 225, "9": 275, "10": 330,
}


# ==========================================
# PROCESO 3: VALORACIÓN DE CARGOS (12 FACTORES)
# ==========================================

def valorar_cargo(
    db: Session,
    cargo_empresa_id: int,
    datos: Dict = None
) -> ValoracionCargo:
    """
    Valorar un cargo usando los 12 factores HAY/SHR.
    
    Factores:
    Factor 1 (4 subfactores = 4-12 puntos c/u):
      - Conocimientos (A-H)
      - Experiencia (-, o, +)
      - Habilidad Gerencial (I-VII)
      - Rol del Cargo (1-4)
    
    Factor 2 (3 subfactores = 3-15 puntos c/u):
      - Contacto (A-C)
      - Frecuencia (1-4)
      - Contenido Relaciones (I-V)
    
    Factor 3 (4 subfactores = 4-18 puntos c/u):
      - Complejidad Conceptual (1-6)
      - Tendencia (-, o, +)
      - Guías de Apoyo (A-F)
      - Tendencia (-, o, +)
    
    Factor 4 (3 subfactores = 3-30 puntos c/u):
      - Impacto (I-IV)
      - Autonomía (A-G)
      - Magnitud (1-10)
    
    + 3 criterios de criticidad (0-1 cada uno)
    """
    
    cargo = db.query(CargoEmpresa).filter(CargoEmpresa.id == cargo_empresa_id).first()
    if not cargo:
        raise ValueError(f"Cargo {cargo_empresa_id} no encontrado")
    
    # Usar datos proporcionados o默认值
    datos = datos or {}
    
    # ===== FACTOR 1: CONOCIMIENTO Y HABILIDAD =====
    conocimientos = datos.get("conocimientos", "C")
    experiencia = datos.get("experiencia", "o")
    habilidad_gerencial = datos.get("habilidad_gerencial", "III")
    rol_cargo = datos.get("rol_cargo", "2")
    
    # Calcular puntos Factor 1
    puntos_c_h = (
        TABLA_PUNTOS.get(conocimientos, 70) +
        TABLA_PUNTOS.get(experiencia, 20) +
        TABLA_PUNTOS.get(habilidad_gerencial, 50) +
        TABLA_PUNTOS.get(rol_cargo, 50)
    )
    
    # ===== FACTOR 2: CONTACTO Y COMUNICACIÓN =====
    contacto = datos.get("contacto", "B")
    frecuencia = datos.get("frecuencia", "2")
    contenido_relaciones = datos.get("contenido_relaciones", "III")
    
    puntos_hc = (
        TABLA_PUNTOS.get(contacto, 50) +
        TABLA_PUNTOS.get(frecuencia, 25) +
        TABLA_PUNTOS.get(contenido_relaciones, 45)
    )
    
    total_puntos_1 = puntos_c_h + puntos_hc
    
    # ===== FACTOR 3: SOLUCIÓN DE PROBLEMAS =====
    complejidad = datos.get("complejidad_conceptual", "3")
    tendencia_cc = datos.get("tendencia_cc", "o")
    guias = datos.get("guias_apoyo", "C")
    tendencia_ga = datos.get("tendencia_ga", "o")
    
    puntos_2 = (
        TABLA_PUNTOS.get(complejidad, 35) +
        TABLA_PUNTOS.get(tendencia_cc, 0) +
        TABLA_PUNTOS.get(guias, 35) +
        TABLA_PUNTOS.get(tendencia_ga, 0)
    )
    
    # ===== FACTOR 4: RESPONSABILIDAD =====
    impacto = datos.get("impacto", "II")
    autonomia = datos.get("autonomia", "D")
    magnitud = datos.get("magnitud", "5")
    
    puntos_rr = (
        TABLA_PUNTOS.get(impacto, 60) +
        TABLA_PUNTOS.get(autonomia, 80) +
        TABLA_PUNTOS.get(magnitud, 75)
    )
    
    # ===== TOTAL PUNTOS =====
    total_puntos = total_puntos_1 + puntos_2 + puntos_rr
    
    # ===== CRITERIOS DE CRITICIDAD =====
    criterio_1 = datos.get("criterio_1", 0)
    criterio_2 = datos.get("criterio_2", 0)
    criterio_3 = datos.get("criterio_3", 0)
    
    # ===== CALCULAR CATEGORÍA =====
    categoria, nivel, criticidad = _calcular_categoria(total_puntos, criterio_1 + criterio_2 + criterio_3)
    
    # ===== COMPENSACIONES (basado en punto medio) =====
    punto_medio = total_puntos
    g = _calcular_garantizado(punto_medio)
    g_v = g * 1.3  # 30% variable
    ct = g_v * 1.5  # Compensación total
    
    # ===== VALORACIÓN COMPLETA =====
    valoracion = ValoracionCargo(
        cargo_empresa_id=cargo_empresa_id,
        
        # Identificación
        cargo=cargo.nombre_cargo,
        area=cargo.area,
        cargo_homologado=cargo.homologado,
        
        # Factor 1
        puntos=total_puntos,
        conocimientos=conocimientos,
        experiencia=experiencia,
        habilidad_gerencial=habilidad_gerencial,
        rol_cargo=int(rol_cargo) if rol_cargo.isdigit() else 2,
        puntos_c_h=puntos_c_h,
        
        # Factor 2
        contacto=contacto,
        frecuencia=int(frecuencia) if frecuencia.isdigit() else 2,
        contenido_relaciones=contenido_relaciones,
        puntos_hc=puntos_hc,
        total_puntos_1=total_puntos_1,
        
        # Factor 3
        complejidad_conceptual=int(complejidad) if complejidad.isdigit() else 3,
        tendencia_cc=tendencia_cc,
        guias_apoyo=guias,
        tendencia_ga=tendencia_ga,
        total_puntos_2=puntos_2,
        
        # Factor 4
        impacto=impacto,
        autonomia=autonomia,
        magnitud=int(magnitud) if magnitud.isdigit() else 5,
        puntos_rr=puntos_rr,
        
        # Criterios
        criterio_1=criterio_1,
        criterio_2=criterio_2,
        criterio_3=criterio_3,
        
        # Resultados
        categoria=categoria,
        criticidad=criticidad,
        nivel=nivel,
        frecuencia_val=criterio_1 + criterio_2 + criterio_3,
        
        # Compensaciones
        g=g,
        g_v=g_v,
        ct=ct,
    )
    
    db.add(valoracion)
    db.commit()
    db.refresh(valoracion)
    
    logger.info(f"Valoración creada para {cargo.nombre_cargo}: {total_puntos} puntos, Categoría {categoria}")
    
    return valoracion


def _calcular_categoria(puntos: int, criterios_cumplidos: int) -> tuple:
    """Calcular categoría, nivel y criticidad basados en puntos"""
    
    # Tabla de categorías (simplificada)
    if puntos >= 2000:
        return 25, "Presidente Global", "Crítico"
    elif puntos >= 1700:
        return 22, "Gerente General", "Crítico"
    elif puntos >= 1400:
        return 18, "Director", "Muy Importante"
    elif puntos >= 1100:
        return 15, "Gerente Senior", "Muy Importante"
    elif puntos >= 850:
        return 12, "Coordinador", "Importante"
    elif puntos >= 600:
        return 8, "Supervisor", "Relevante"
    elif puntos >= 400:
        return 5, "Analista", "Relevante"
    else:
        return 2, "Auxiliar", "Relevante"


def _calcular_garantizado(punto_medio: int) -> float:
    """Calcular garantizado basado en punto medio"""
    
    # Fórmula simplificada (en producción usar tabla real)
    return punto_medio * 25000


def valorar_lote(
    db: Session,
    empresa_id: int,
    datos: Dict = None
) -> List[ValoracionCargo]:
    """Valorar todos los cargos de una empresa"""
    
    cargos = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id,
        CargoEmpresa.estado == "HOMOLOGADO"
    ).all()
    
    resultados = []
    for cargo in cargos:
        try:
            result = valorar_cargo(db, cargo.id, datos)
            resultados.append(result)
        except Exception as e:
            logger.error(f"Error valorando {cargo.nombre_cargo}: {e}")
    
    return resultados


# ==========================================
# VALORACIÓN CON IA
# ==========================================

def valorar_cargo_con_ia(
    db: Session,
    cargo_empresa_id: int
) -> ValoracionCargo:
    """Valorar un cargo usando Anthropic (cuando no hay datos manuales)"""
    
    cargo = db.query(CargoEmpresa).filter(CargoEmpresa.id == cargo_empresa_id).first()
    if not cargo:
        raise ValueError(f"Cargo {cargo_empresa_id} no encontrado")
    
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY no configurada")
    
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    prompt = f"""Eres experto en valoración de cargos bajo metodología HAY/SHR.

**CARGO:**
- Nombre: {cargo.nombre_cargo}
- Área: {cargo.area}
- Descripción: {cargo.descripcion or 'No disponible'}
- Cargo Homologado: {cargo.homologado or 'No homologado'}

**FACTORES A EVALUAR (responde SOLO con JSON):**

Factor 1 - Conocimiento & Habilidad:
- conocimientos: A-H (A=básico, H=experto)
- experiencia: - (sin), o (media), + (alta)
- habilidad_gerencial: I-VII (I=sin staff, VII=director)
- rol_cargo: 1-4 (1=operativo, 4=estratégico)

Factor 2 - Comunicación:
- contacto: A (interno), B (coordinación), C (representación)
- frecuencia: 1-4 (1=ocasional, 4=constante)
- contenido_relaciones: I-V (info a negociación)

Factor 3 - Solución de Problemas:
- complejidad_conceptual: 1-6 (1=rutina, 6=abstracto)
- tendencia_cc: -, o, +
- guias_apoyo: A-F (A=detalladas, F=sin guías)
- tendencia_ga: -, o, +

Factor 4 - Responsabilidad:
- impacto: I-IV (asesoría a dirección)
- autonomia: A-G (A=supervisión, G=autonomía)
- magnitud: 1-10 (presupuesto/personas)

Criticidad (0 o 1):
- criterio_1: ¿Conocimiento especializado único?
- criterio_2: ¿Pertenece al core del negocio?
- criterio_3: ¿Ofertalimited de personas?

Responde SOLO con JSON:
{{
  "conocimientos": "C",
  "experiencia": "o",
  "habilidad_gerencial": "III",
  "rol_cargo": "2",
  "contacto": "B",
  "frecuencia": "3",
  "contenido_relaciones": "III",
  "complejidad_conceptual": "3",
  "tendencia_cc": "o",
  "guias_apoyo": "D",
  "tendencia_ga": "o",
  "impacto": "II",
  "autonomia": "D",
  "magnitud": "5",
  "criterio_1": 0,
  "criterio_2": 1,
  "criterio_3": 0
}}"""

    try:
        response = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=600,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}]
        )
        
        content = response.content[0].text.strip()
        
        # Limpiar JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        datos = json.loads(content.strip())
        
        return valorar_cargo(db, cargo_empresa_id, datos)
        
    except Exception as e:
        logger.error(f"Error en valoración IA: {e}")
        raise


# ==========================================
# REPORTES DE VALORACIÓN
# ==========================================

def resumen_valoracion(db: Session, empresa_id: int) -> dict:
    """Resumen del estado de valoración"""
    
    valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()
    
    if not valoraciones:
        return {"total": 0}
    
    total = len(valoraciones)
    puntos_promedio = sum(v.puntos or 0 for v in valoraciones) / total
    
    # Distribución por categoría
    por_categoria = {}
    por_criticidad = {}
    
    for v in valoraciones:
        cat = v.categoria or 0
        crit = v.criticidad or "N/A"
        
        por_categoria[cat] = por_categoria.get(cat, 0) + 1
        por_criticidad[crit] = por_criticidad.get(crit, 0) + 1
    
    return {
        "total": total,
        "puntos_promedio": round(puntos_promedio, 0),
        "por_categoria": por_categoria,
        "por_criticidad": por_criticidad,
    }


def ExportarValoraciones(db: Session, empresa_id: int) -> List[dict]:
    """Exportar resultados de valoraciones"""
    
    resultados = db.query(ValoracionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()
    
    return [
        {
            "cargo": v.cargo,
            "area": v.area,
            "puntos": v.puntos,
            "categoria": v.categoria,
            "nivel": v.nivel,
            "criticidad": v.criticidad,
            "g": v.g,
            "g_v": v.g_v,
            "ct": v.ct,
        }
        for v in resultados
    ]


import json