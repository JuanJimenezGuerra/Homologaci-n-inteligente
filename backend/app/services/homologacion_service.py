import os
import json
import logging
import re
import difflib
import requests
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from ..models import (
    CargoEmpresa, MasterCargo, HomologacionCargo, Categoria
)

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


def _call_ia(prompt, max_tokens=500):
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
# PROCESO 2: HOMOLOGACION CON CRITERIOS
# ==========================================

def homologar_cargo(
    db: Session,
    cargo_empresa_id: int,
    criterios: Dict = None,
    tamano_empresa: str = "mediana",
    sector: str = None
) -> HomologacionCargo:

    cargo = db.query(CargoEmpresa).filter(CargoEmpresa.id == cargo_empresa_id).first()
    if not cargo:
        raise ValueError(f"Cargo {cargo_empresa_id} no encontrado")

    criterios = criterios or {
        "priorizar_funciones": True,
        "priorizar_nivel": True,
        "considerar_tamano": True,
        "nivel_agresividad": "medio",
    }

    # 1. Verificar coincidencia exacta
    match_exacto = _buscar_exacto(cargo.nombre_cargo, cargo.area)
    if match_exacto:
        return _crear_homologacion(db, cargo, match_exacto, "Coincidencia exacta", 1.0)

    # 2. Busqueda por similitud
    match_fuzzy = _buscar_fuzzy(cargo.nombre_cargo, cargo.area)
    if match_fuzzy:
        confianza = 0.8
        if criterios.get("nivel_agresividad") == "conservador":
            confianza = 0.9
        elif criterios.get("nivel_agresividad") == "agresivo":
            confianza = 0.6

        if match_fuzzy[1] >= confianza:
            return _crear_homologacion(db, cargo, match_fuzzy[0], "Similitud alta", match_fuzzy[1])

    # 3. Usar IA si no hay match claro
    if OPENROUTER_API_KEY or OPENAI_API_KEY:
        resultado_ia = _homologar_con_ia(
            cargo, criterios, tamano_empresa, sector
        )
        if resultado_ia:
            return resultado_ia

    # 4. Sin coincidencia
    return _crear_homologacion(
        db, cargo, None, "Sin coincidencia en catalogo", 0.0
    )


def homologar_lote(
    db: Session,
    empresa_id: int,
    criterios: Dict = None,
    tamano_empresa: str = "mediana",
    sector: str = None
) -> List[HomologacionCargo]:

    cargos = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id,
        CargoEmpresa.estado == "PENDIENTE"
    ).all()

    resultados = []
    for cargo in cargos:
        try:
            result = homologar_cargo(
                db, cargo.id, criterios, tamano_empresa, sector
            )
            resultados.append(result)

            cargo.estado = "HOMOLOGADO"
            db.commit()

        except Exception as e:
            logger.error(f"Error homologando {cargo.nombre_cargo}: {e}")

    return resultados


def _buscar_exacto(nombre: str, area: str = None) -> Optional[MasterCargo]:
    """Busqueda exacta en el catalogo"""
    return None  # Por implementar con DB


def _buscar_fuzzy(nombre: str, area: str = None) -> Optional[tuple]:
    """Busqueda por similitud"""
    return None


def _crear_homologacion(
    db: Session,
    cargo: CargoEmpresa,
    master: Optional[MasterCargo],
    justificacion: str,
    confianza: float
) -> HomologacionCargo:

    homologacion = HomologacionCargo(
        cargo_empresa_id=cargo.id,
        cargo_valorado=cargo.nombre_cargo,
        cargo_homologado_1=master.nombre if master else "SIN COINCIDENCIA",
        descripcion_1=master.descripcion if master else None,
        observaciones=justificacion,
    )

    if master:
        homologacion.master_cargo_id = master.id

    db.add(homologacion)
    db.commit()
    db.refresh(homologacion)

    return homologacion


def _homologar_con_ia(
    cargo: CargoEmpresa,
    criterios: Dict,
    tamano_empresa: str,
    sector: str = None
) -> Optional[HomologacionCargo]:

    criterio_text = _construir_prompt_criterios(criterios)

    prompt = f"""Eres experto en RRHH y homologacion de cargos en Colombia.

**CARGO A HOMOLOGAR:**
- Nombre: {cargo.nombre_cargo}
- Area: {cargo.area}
- Descripcion: {cargo.descripcion or 'No disponible'}
- Jefe inmediato: {cargo.cargo_jefe or 'No especificado'}
- Modalidad: {cargo.modalidad}

**CONTEXTO DE LA EMPRESA:**
- Tamano: {tamano_empresa}
- Sector: {sector or 'No especificado'}

**CRITERIOS DE HOMOLOGACION:**
{criterio_text}

Responde SOLO con JSON (sin texto adicional):
{{
  "cargo_homologado": "NOMBRE DEL CARGO EN CATALOGO",
  "alternativa": "NOMBRE ALTERNO (opcional)",
  "confianza": 0.0-1.0,
  "explicacion": "breve justificacion",
  "nivel": "jerarquia del cargo",
  "area": "area funcional"
}}"""

    content = _call_ia(prompt, max_tokens=500)
    if not content:
        return None

    try:
        return _extract_json(content)
    except Exception as e:
        logger.error(f"Error en homologacion IA: {e}")
        return None


def _construir_prompt_criterios(criterios: Dict) -> str:

    lines = []

    if criterios.get("priorizar_funciones"):
        lines.append("- Priorizar la descripcion del cargo sobre el nombre")

    if criterios.get("priorizar_nivel"):
        lines.append("- Considerar el nivel jerarquico del cargo")

    nivel = criterios.get("nivel_agresividad", "medio")
    if nivel == "conservador":
        lines.append("- Ser conservador: solo aceptar matches con confianza > 0.9")
        lines.append("- Si no hay coincidencia clara, marcar como 'SIN COINCIDENCIA'")
    elif nivel == "agresivo":
        lines.append("- Ser agresivo: aceptar matches con confianza > 0.5")

    if criterios.get("exigir_coincidencia_fuerte"):
        lines.append("- Exigir coincidencia fuerte en responsabilidades principales")

    if criterios.get("considerar_tamano"):
        lines.append("- Considerar el tamano de la empresa para el nivel")

    return "\n".join(lines) if lines else "- Usar criterios estandar de RRHH"


# ==========================================
# CONFIGURACION DE CRITERIOS
# ==========================================

def guardar_criterios(db: Session, empresa_id: int, criterios: Dict) -> bool:
    return True


def obtener_criterios(db: Session, empresa_id: int) -> Dict:
    return {
        "priorizar_funciones": True,
        "priorizar_nivel": True,
        "considerar_tamano": True,
        "nivel_agresividad": "medio",
    }


# ==========================================
# REPORTES DE HOMOLOGACION
# ==========================================

def resumen_homologacion(db: Session, empresa_id: int) -> dict:

    cargos = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()

    total = len(cargos)
    homologados = sum(1 for c in cargos if c.estado == "HOMOLOGADO")
    pendientes = total - homologados

    return {
        "total": total,
        "homologados": homologados,
        "pendientes": pendientes,
        "porcentaje": round(homologados / total * 100, 1) if total > 0 else 0,
    }


def ExportarHomologaciones(db: Session, empresa_id: int) -> List[dict]:

    resultados = db.query(HomologacionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()

    return [
        {
            "cargo": h.cargo_valorado,
            "homologado": h.cargo_homologado_1,
            "alternativa": h.cargo_homologado_2,
            "observaciones": h.observaciones,
            "editado": h.editado_manual,
        }
        for h in resultados
    ]
