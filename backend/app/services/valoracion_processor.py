import os
import json
import time
import requests
import logging
from sqlalchemy.orm import Session
from ..models import Cargo, Valoracion, ProcessingLog

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

    # OpenRouter
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

    # OpenAI fallback
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


VALORACION_PROMPT = """Eres experto en valoracion de cargos bajo metodologia HAY/SHR.

CARGO A VALORAR:
- Nombre: {nombre}
- Area: {area}
- Cargo Homologado: {homologado}
- Descripcion: {descripcion}

FACTORES A EVALUAR (responde SOLO con JSON):

Factor 1 - Conocimiento & Habilidad:
- conocimientos: A-H (A=basico, H=experto)
- experiencia: - (sin exp) / o (media) / + (alta)
- habilidad_gerencial: I-VII (I=sin staff, VII=director general)
- rol_cargo: 1-4 (1=operativo, 4=estrategico)

Factor 2 - Comunicacion:
- contacto: A (interno basico) / B (externo coordinacion) / C (representacion corporativa)
- frecuencia: 1-4 (1=ocasional, 4=constante)
- contenido_relaciones: I-V (I=intercambio info, V=negociacion estrategica)

Factor 3 - Solucion de Problemas:
- complejidad_conceptual: 1-5 (1=rutina, 5=abstraccion compleja)
- tendencia_cc: texto libre breve
- guias_apoyo: A-H (A=instrucciones detalladas, H=sin guias)
- tendencia_ga: texto libre breve

Factor 4 - Responsabilidad:
- impacto: I-IV (I=asesoria, IV=direccion total)
- autonomia: A-G (A=supervision constante, G=autonomia total)
- magnitud: 1-14 (presupuesto/personas: 1=minimo, 14=corporativo)

Criticidad (0 o 1):
- criterio_1: ¿Es dificil reemplazar? (0=no, 1=si)
- criterio_2: ¿Impacto critico en resultados? (0=no, 1=sí)
- criterio_3: ¿Conocimiento especializado unico? (0=no, 1=sí)

Responde SOLO con JSON sin explicaciones:
{{
  "conocimientos": "C",
  "experiencia": "o",
  "habilidad_gerencial": "III",
  "rol_cargo": "2",
  "contacto": "B",
  "frecuencia": "3",
  "contenido_relaciones": "III",
  "complejidad_conceptual": "3",
  "tendencia_cc": "problemas variables",
  "guias_apoyo": "D",
  "tendencia_ga": "procedimientos estandarizados",
  "impacto": "II",
  "autonomia": "D",
  "magnitud": "5",
  "criterio_1": 0,
  "criterio_2": 1,
  "criterio_3": 0
}}"""


def _valorar_cargo_con_ia(cargo) -> dict:
    homologado = "N/A"
    if cargo.homologacion and cargo.homologacion.cargo_homologado:
        homologado = cargo.homologacion.cargo_homologado

    prompt = VALORACION_PROMPT.format(
        nombre=cargo.nombre_cargo,
        area=cargo.area,
        homologado=homologado,
        descripcion=cargo.descripcion_empresa or "No disponible",
    )

    content = _call_ia(prompt, max_tokens=600)
    if not content:
        raise ValueError("No hay API key de IA configurada (OPENROUTER_API_KEY o OPENAI_API_KEY)")

    return _extract_json(content)


def start_valoracion_batch(upload_id: int, db: Session):
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    _process_with_ia(upload_id, cargos, db)


def _process_with_ia(upload_id: int, cargos: list, db: Session):
    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        print("No hay OPENROUTER_API_KEY ni OPENAI_API_KEY configurado")
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
            val.habilidad_gerencial = resultado.get("habilidad_gerencial")
            val.rol_cargo = resultado.get("rol_cargo")
            val.contacto = resultado.get("contacto")
            val.frecuencia = resultado.get("frecuencia")
            val.contenido_relaciones = resultado.get("contenido_relaciones")
            val.complejidad_conceptual = resultado.get("complejidad_conceptual")
            val.tendencia_cc = resultado.get("tendencia_cc")
            val.guias_apoyo = resultado.get("guias_apoyo")
            val.tendencia_ga = resultado.get("tendencia_ga")
            val.impacto = resultado.get("impacto")
            val.autonomia = resultado.get("autonomia")
            val.magnitud = resultado.get("magnitud")
            val.criterio_1 = resultado.get("criterio_1", 0)
            val.criterio_2 = resultado.get("criterio_2", 0)
            val.criterio_3 = resultado.get("criterio_3", 0)

            db.commit()
            time.sleep(1)

        except Exception as e:
            print(f"Error valorando cargo {cargo.id}: {e}")
            continue
