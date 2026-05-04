import os
import json
import logging
import requests
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from ..models import (
    CargoEmpresa, ValoracionCargo, MasterCargo
)

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


def _call_ia(prompt, max_tokens=600):
    """Intenta OpenRouter primero, fallback a OpenAI."""
    messages = [{"role": "user", "content": prompt}]

    if OPENROUTER_API_KEY:
        try:
            resp = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.1,
                },
                timeout=30,
            )
            if resp.ok:
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenRouter error: {e}")

    if OPENAI_API_KEY:
        try:
            resp = requests.post(
                OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENAI_MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.1,
                },
                timeout=30,
            )
            if resp.ok:
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"OpenAI error: {e}")

    return None


def _extract_json(text):
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


# ==========================================
# FACTORES DE VALORACION HAY/SHR
# ==========================================

FACTOR_CONOCIMIENTO = {
    "conocimientos": ["A", "B", "C", "D", "E", "F", "G", "H"],
    "experiencia": ["-", "o", "+"],
    "habilidad_gerencial": ["I", "II", "III", "IV", "V", "VI", "VII"],
    "rol_cargo": ["1", "2", "3", "4"],
}

FACTOR_CONTACTO = {
    "contacto": ["A", "B", "C"],
    "frecuencia": ["1", "2", "3", "4"],
    "contenido_relaciones": ["I", "II", "III", "IV", "V"],
}

FACTOR_COMPLEJIDAD = {
    "complejidad_conceptual": ["1", "2", "3", "4", "5", "6"],
    "tendencia": ["-", "o", "+"],
    "guias_apoyo": ["A", "B", "C", "D", "E", "F"],
}

FACTOR_RESPONSABILIDAD = {
    "impacto": ["I", "II", "III", "IV"],
    "autonomia": ["A", "B", "C", "D", "E", "F", "G"],
    "magnitud": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
}

TABLA_PUNTOS = {
    "A": 30, "B": 50, "C": 70, "D": 100, "E": 130, "F": 170, "G": 220, "H": 270,
    "I": 30, "II": 50, "III": 70, "IV": 100, "V": 130, "VI": 170, "VII": 220,
    "1": 20, "2": 50, "3": 80, "4": 120,
    "A": 20, "B": 50, "C": 90,
    "I": 10, "II": 25, "III": 45, "IV": 70, "V": 100,
    "A": 10, "B": 20, "C": 35, "D": 50, "E": 70, "F": 100,
    "I": 30, "II": 60, "III": 100, "IV": 150,
    "A": 10, "B": 25, "C": 50, "D": 80, "E": 120, "F": 170, "G": 230,
    "1": 15, "2": 30, "3": 50, "4": 75, "5": 105, "6": 140, "7": 180, "8": 225, "9": 275, "10": 330,
}


# ==========================================
# PROCESO 3: VALORACION DE CARGOS (12 FACTORES)
# ==========================================

def valorar_cargo(
    db: Session,
    cargo_empresa_id: int,
    datos: Dict = None
) -> ValoracionCargo:

    cargo = db.query(CargoEmpresa).filter(CargoEmpresa.id == cargo_empresa_id).first()
    if not cargo:
        raise ValueError(f"Cargo {cargo_empresa_id} no encontrado")

    datos = datos or {}

    conocimientos = datos.get("conocimientos", "C")
    experiencia = datos.get("experiencia", "o")
    habilidad_gerencial = datos.get("habilidad_gerencial", "III")
    rol_cargo = datos.get("rol_cargo", "2")

    puntos_c_h = (
        TABLA_PUNTOS.get(conocimientos, 70) +
        TABLA_PUNTOS.get(experiencia, 20) +
        TABLA_PUNTOS.get(habilidad_gerencial, 50) +
        TABLA_PUNTOS.get(rol_cargo, 50)
    )

    contacto = datos.get("contacto", "B")
    frecuencia = datos.get("frecuencia", "2")
    contenido_relaciones = datos.get("contenido_relaciones", "III")

    puntos_hc = (
        TABLA_PUNTOS.get(contacto, 50) +
        TABLA_PUNTOS.get(frecuencia, 25) +
        TABLA_PUNTOS.get(contenido_relaciones, 45)
    )

    total_puntos_1 = puntos_c_h + puntos_hc

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

    impacto = datos.get("impacto", "II")
    autonomia = datos.get("autonomia", "D")
    magnitud = datos.get("magnitud", "5")

    puntos_rr = (
        TABLA_PUNTOS.get(impacto, 60) +
        TABLA_PUNTOS.get(autonomia, 80) +
        TABLA_PUNTOS.get(magnitud, 75)
    )

    total_puntos = total_puntos_1 + puntos_2 + puntos_rr

    criterio_1 = datos.get("criterio_1", 0)
    criterio_2 = datos.get("criterio_2", 0)
    criterio_3 = datos.get("criterio_3", 0)

    categoria, nivel, criticidad = _calcular_categoria(total_puntos, criterio_1 + criterio_2 + criterio_3)

    punto_medio = total_puntos
    g = _calcular_garantizado(punto_medio)
    g_v = g * 1.3
    ct = g_v * 1.5

    valoracion = ValoracionCargo(
        cargo_empresa_id=cargo_empresa_id,
        cargo=cargo.nombre_cargo,
        area=cargo.area,
        cargo_homologado=cargo.homologado,
        puntos=total_puntos,
        conocimientos=conocimientos,
        experiencia=experiencia,
        habilidad_gerencial=habilidad_gerencial,
        rol_cargo=int(rol_cargo) if str(rol_cargo).isdigit() else 2,
        puntos_c_h=puntos_c_h,
        contacto=contacto,
        frecuencia=int(frecuencia) if str(frecuencia).isdigit() else 2,
        contenido_relaciones=contenido_relaciones,
        puntos_hc=puntos_hc,
        total_puntos_1=total_puntos_1,
        complejidad_conceptual=int(complejidad) if str(complejidad).isdigit() else 3,
        tendencia_cc=tendencia_cc,
        guias_apoyo=guias,
        tendencia_ga=tendencia_ga,
        total_puntos_2=puntos_2,
        impacto=impacto,
        autonomia=autonomia,
        magnitud=int(magnitud) if str(magnitud).isdigit() else 5,
        puntos_rr=puntos_rr,
        criterio_1=criterio_1,
        criterio_2=criterio_2,
        criterio_3=criterio_3,
        categoria=categoria,
        criticidad=criticidad,
        nivel=nivel,
        frecuencia_val=criterio_1 + criterio_2 + criterio_3,
        g=g,
        g_v=g_v,
        ct=ct,
    )

    db.add(valoracion)
    db.commit()
    db.refresh(valoracion)

    logger.info(f"Valoracion creada para {cargo.nombre_cargo}: {total_puntos} puntos, Categoria {categoria}")

    return valoracion


def _calcular_categoria(puntos: int, criterios_cumplidos: int) -> tuple:
    if puntos >= 2000:
        return 25, "Presidente Global", "Critico"
    elif puntos >= 1700:
        return 22, "Gerente General", "Critico"
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
    return punto_medio * 25000


def valorar_lote(
    db: Session,
    empresa_id: int,
    datos: Dict = None
) -> List[ValoracionCargo]:

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
# VALORACION CON IA
# ==========================================

VALORACION_PROMPT = """Eres experto en valoracion de cargos bajo metodologia HAY/SHR.

**CARGO:**
- Nombre: {nombre}
- Area: {area}
- Descripcion: {descripcion}
- Cargo Homologado: {homologado}

**FACTORES A EVALUAR (responde SOLO con JSON):**

Factor 1 - Conocimiento & Habilidad:
- conocimientos: A-H (A=basico, H=experto)
- experiencia: - (sin), o (media), + (alta)
- habilidad_gerencial: I-VII (I=sin staff, VII=director)
- rol_cargo: 1-4 (1=operativo, 4=estrategico)

Factor 2 - Comunicacion:
- contacto: A (interno), B (coordinacion), C (representacion)
- frecuencia: 1-4 (1=ocasional, 4=constante)
- contenido_relaciones: I-V (info a negociacion)

Factor 3 - Solucion de Problemas:
- complejidad_conceptual: 1-6 (1=rutina, 6=abstracto)
- tendencia_cc: -, o, +
- guias_apoyo: A-F (A=detalladas, F=sin guias)
- tendencia_ga: -, o, +

Factor 4 - Responsabilidad:
- impacto: I-IV (asesoria a direccion)
- autonomia: A-G (A=supervision, G=autonomia)
- magnitud: 1-10 (presupuesto/personas)

Criticidad (0 o 1):
- criterio_1: ¿Conocimiento especializado unico?
- criterio_2: ¿Pertenece al core del negocio?
- criterio_3: ¿Oferta limitada de personas?

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


def valorar_cargo_con_ia(
    db: Session,
    cargo_empresa_id: int
) -> ValoracionCargo:

    cargo = db.query(CargoEmpresa).filter(CargoEmpresa.id == cargo_empresa_id).first()
    if not cargo:
        raise ValueError(f"Cargo {cargo_empresa_id} no encontrado")

    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        raise ValueError("No hay OPENROUTER_API_KEY ni OPENAI_API_KEY configurada")

    prompt = VALORACION_PROMPT.format(
        nombre=cargo.nombre_cargo,
        area=cargo.area,
        descripcion=cargo.descripcion or "No disponible",
        homologado=cargo.homologado or "No homologado",
    )

    content = _call_ia(prompt, max_tokens=600)
    if not content:
        raise ValueError("Error al llamar a la IA")

    try:
        datos = _extract_json(content)
    except Exception as e:
        logger.error(f"Error parsing IA response: {e}")
        raise

    return valorar_cargo(db, cargo_empresa_id, datos)


# ==========================================
# REPORTES DE VALORACION
# ==========================================

def resumen_valoracion(db: Session, empresa_id: int) -> dict:

    valoraciones = db.query(ValoracionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()

    if not valoraciones:
        return {"total": 0}

    total = len(valoraciones)
    puntos_promedio = sum(v.puntos or 0 for v in valoraciones) / total

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
