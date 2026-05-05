import os
import json
import time
import requests
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# OpenRouter config (primary = agotada, secondary = nueva activa)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_KEY_2 = os.getenv("OPENROUTER_API_KEY_2", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

print(f"IA Service: PRIMARY={'OK' if OPENROUTER_API_KEY else 'NO'}")
print(f"IA Service: SECONDARY (activa)={'OK' if OPENROUTER_API_KEY_2 else 'NO'}")
print(f"IA Service: MODEL={OPENROUTER_MODEL}")


def call_openrouter(messages: list, max_tokens: int = 1000, temperature: float = 0.0, timeout: int = 45, use_secondary: bool = False) -> Optional[str]:
    """Call OpenRouter API - usa secondary (nueva) por defecto si esta disponible."""
    try:
        # Prioridad: secondary (nueva) > primary (agotada)
        if use_secondary:
            api_key = OPENROUTER_API_KEY
        else:
            api_key = OPENROUTER_API_KEY_2 if OPENROUTER_API_KEY_2 else OPENROUTER_API_KEY

        if not api_key:
            return None

        model = OPENROUTER_MODEL

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": BACKEND_URL,
            "X-Title": "SHR-Homologacion",
        }

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }

        resp = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=timeout)

        if resp.ok:
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            if content:
                return content
        else:
            print(f"OpenRouter: HTTP {resp.status_code} - {resp.text[:100]}")
    except Exception as e:
        print(f"OpenRouter: Error - {e}")
    return None


def call_ia(messages: list, max_tokens: int = 1000, temperature: float = 0.0, timeout: int = 45) -> Optional[str]:
    """Intenta con SECONDARY (nueva) primero, luego PRIMARY."""
    # Intentar con la nueva (secondary) primero
    if OPENROUTER_API_KEY_2:
        content = call_openrouter(messages, max_tokens, temperature, timeout, use_secondary=False)
        if content:
            return content

    # Fallback a primary (agotada, por si acaso)
    if OPENROUTER_API_KEY:
        content = call_openrouter(messages, max_tokens, temperature, timeout, use_secondary=True)
        if content:
            return content

    return None


def extract_json(text: str) -> Optional[dict]:
    """Extrae JSON de la respuesta."""
    if not text:
        return None
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text.strip())
    except Exception:
        return None


def extract_json_array(text: str) -> Optional[list]:
    """Extrae array JSON de la respuesta."""
    if not text:
        return None
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        text = text.strip()
        if text.startswith("["):
            return json.loads(text)
    except Exception:
        pass

    # Intentar extraer objetos individuales
    try:
        import re
        pattern = r'\{[^{}]*"id"\s*:\s*\d+[^{}]*\}'
        matches = re.findall(pattern, text)
        if matches:
            return [json.loads(m) for m in matches if '"id"' in m]
    except Exception:
        pass

    return None


# ==========================================
# HOMOLOGACION CON IA (RAPIDA Y PRECISA)
# ==========================================

MASTER_CARGOS_CACHE = None

def load_master_cargos(db) -> list:
    """Carga los cargos maestros."""
    from ..models import MasterDescription, MasterCargo

    masters = []
    for m in db.query(MasterDescription).all():
        if m.nombre_cargo:
            masters.append({
                "id": m.id,
                "nombre": m.nombre_cargo.upper(),
                "area": (m.area or "").upper(),
            })

    for m in db.query(MasterCargo).all():
        if m.nombre:
            masters.append({
                "id": m.id,
                "nombre": m.nombre.upper(),
                "area": f"{(m.area_general or '')} {(m.area_especifica or '')}".strip().upper(),
            })

    return masters


def homologar_con_ia(db, cargos: list, masters: list = None) -> list:
    """Homologa cargos con IA rapida - prioriza SECONDARY key."""

    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    if not masters:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin catalogo", "confianza": 0.0} for c in cargos]

    # Preparar catalogo para el prompt
    catalogo = "\n".join([f"- {m['nombre']} ({m['area']})" for m in masters[:100]])

    resultados = []
    batch_size = 10  # Lotes mas grandes

    for i in range(0, len(cargos), batch_size):
        batch = cargos[i:i + batch_size]
        lote = i // batch_size + 1

        # Construir prompt compacto
        cargos_text = "\n".join([
            f"ID:{c.get('id')} | {c.get('nombre_cargo', '').upper()} | {(c.get('area', 'N/A') or 'N/A').upper()}"
            for c in batch
        ])

        prompt = f"""Eres experto en homologacion de cargos en Colombia.

CATALOGO MAESTRO:
{catalogo}

CARGOS A HOMOLOGAR:
{cargos_text}

INSTRUCCIONES:
1. Para cada ID, busca el cargo mas similar en el catalogo.
2. Responde SOLO con array JSON:
[{{"id":ID,"cargo_homologado":"NOMBRE_EXACTO","justificacion":"razon","confianza":0.0-1.0}}]
3. Si no hay coincidencia, usa "SIN COINCIDENCIA"."""

        # Llamar a IA con reintento
        content = None
        for intento in range(2):
            content = call_ia([{"role": "user", "content": prompt}], max_tokens=1500, timeout=60)
            if content:
                break
            time.sleep(1)

        if not content:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "confianza": 0.0} for c in batch])
            continue

        parsed = extract_json_array(content)
        if parsed and isinstance(parsed, list):
            parsed_dict = {r.get("id"): r for r in parsed if r.get("id")}
            for c in batch:
                r = parsed_dict.get(c.get("id"))
                if r:
                    resultados.append({
                        "id": c.get("id"),
                        "cargo_homologado": r.get("cargo_homologado", "SIN COINCIDENCIA"),
                        "justificacion": (r.get("justificacion", "") or "")[:60],
                        "confianza": float(r.get("confianza", 0.5)),
                    })
                else:
                    resultados.append({"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "No en respuesta IA", "confianza": 0.0})
        else:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseo", "confianza": 0.0} for c in batch])

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print(f"homologar_con_ia: {exitos}/{len(cargos)} exitos")
    return resultados


def homologar_con_ia_observaciones(db, cargos: list, masters: list = None, observaciones: str = "") -> list:
    """Reprocesa con observaciones del analista."""

    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    if not masters:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin catalogo", "confianza": 0.0} for c in cargos]

    catalogo = "\n".join([f"- {m['nombre']}" for m in masters[:100]])

    cargos_text = "\n".join([f"ID:{c.get('id')} | {c.get('nombre_cargo', '').upper()}" for c in cargos])

    prompt = f"""Eres experto en homologacion. Un analista dejo observaciones.

OBSERVACIONES: {observaciones}

CATALOGO:
{catalogo}

CARGOS:
{cargos_text}

Responde SOLO con array JSON:
[{{"id":ID,"cargo_homologado":"NOMBRE","justificacion":"razon","confianza":0.0-1.0}}]"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=1500, timeout=60)

    if not content:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "confianza": 0.0} for c in cargos]

    parsed = extract_json_array(content)
    if parsed and isinstance(parsed, list):
        return [{
            "id": r.get("id"),
            "cargo_homologado": r.get("cargo_homologado", "SIN COINCIDENCIA"),
            "justificacion": (r.get("justificacion", "") or "")[:60],
            "confianza": float(r.get("confianza", 0.5)),
        } for r in parsed]

    return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseo", "confianza": 0.0} for c in cargos]


# ==========================================
# VALORACION CON IA (RAPIDA)
# ==========================================

def build_valoracion_prompt(cargo: dict) -> str:
    """Prompt compacto para valoracion."""
    return f"""Asigna niveles SHR/HAY para: {cargo.get('nombre_cargo', 'N/A')}

Responde SOLO JSON:
{{
  "conocimientos": "A-H",
  "experiencia": "--/-/o/+",
  "habilidades": "I-VII",
  "responsabilidad": "1-4",
  "contacto": "A-C",
  "frecuencia": "1-4",
  "contraste": "I-V",
  "complejidad": "1-5",
  "iniciativa": "I-IV",
  "autonomia": "A-G",
  "magnitud": "0-14",
  "impacto": "I-VII",
  "justificacion": "breve"
}}"""


def valorar_con_ia(cargo: dict) -> dict:
    """Valora cargo con IA rapida."""
    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return {"error": "Sin API key"}

    content = call_ia([{"role": "user", "content": build_valoracion_prompt(cargo)}], max_tokens=500, timeout=30)

    if not content:
        return {"error": "Sin respuesta IA"}

    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed

    return {"error": "Error parseo"}


# ==========================================
# BUSCAR EN INTERNET
# ==========================================

def buscar_en_internet(cargo: dict) -> dict:
    """Busca info del cargo via IA."""
    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return {"fuente": "Sin API key", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "", "url": ""}

    prompt = f"""Dame info breve del cargo "{cargo.get('nombre_cargo', '')}" en Colombia.

Responde SOLO JSON:
{{
  "fuente": "Internet",
  "titulo": "Cargo encontrado",
  "descripcion": "Breve descripcion",
  "url": "https://ejemplo.com"
}}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=400, timeout=30)

    if not content:
        return {"fuente": "Error", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "Error IA", "url": ""}

    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed

    return {"fuente": "Error", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "Error parseo", "url": ""}
