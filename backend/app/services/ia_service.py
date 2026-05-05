import os
import json
import time
import requests
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# Configuración OpenRouter - usar la API key original que funcionaba
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_KEY_2 = os.getenv("OPENROUTER_API_KEY_2", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

print(f"IA Service: OPENROUTER_API_KEY={'OK' if OPENROUTER_API_KEY else 'NO'}")
print(f"IA Service: OPENROUTER_API_KEY_2={'OK' if OPENROUTER_API_KEY_2 else 'NO'}")
print(f"IA Service: MODEL={OPENROUTER_MODEL}")


def call_openrouter(messages: list, max_tokens: int = 800, temperature: float = 0.1, timeout: int = 60, use_secondary: bool = False) -> Optional[str]:
    """Call OpenRouter API."""
    try:
        api_key = OPENROUTER_API_KEY_2 if use_secondary else OPENROUTER_API_KEY
        if not api_key:
            return None

        model = OPENROUTER_MODEL
        print(f"OpenRouter: llamando {model} ({'SEC' if use_secondary else 'PRI'})")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        resp = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=timeout)

        if resp.ok:
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            if content:
                print(f"OpenRouter: OK, {len(content)} chars")
                return content
            else:
                print("OpenRouter: respuesta vacía")
                return None
        else:
            print(f"OpenRouter: HTTP {resp.status_code} - {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"OpenRouter: Error - {e}")
        return None


def call_ia(messages: list, max_tokens: int = 800, temperature: float = 0.1, timeout: int = 60) -> Optional[str]:
    """Intenta PRIMARY (original) primero, luego SECONDARY (nueva)."""
    # PRIMARY (tu API key original que funcionaba)
    if OPENROUTER_API_KEY:
        content = call_openrouter(messages, max_tokens, temperature, timeout, use_secondary=False)
        if content:
            return content

    # SECONDARY (tu nueva API key, por si la original falla)
    if OPENROUTER_API_KEY_2:
        content = call_openrouter(messages, max_tokens, temperature, timeout, use_secondary=True)
        if content:
            return content

    print("call_ia: Ambas keys fallaron")
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
    return None


# ==========================================
# HOMOLOGACIÓN CON IA
# ==========================================

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


def build_homologacion_prompt(cargos: list, masters: list) -> str:
    """Construye el prompt para homologación."""
    masters_text = "\n".join([f"- {m['nombre']}" for m in masters[:80]])

    cargos_text = ""
    for c in cargos:
        nombre = (c.get("nombre_cargo") or "").upper()
        area = (c.get("area") or "N/A").upper()
        cargos_text += f"ID:{c.get('id')} | {nombre} | {area}\n"

    prompt = f"""Eres experto en homologación de cargos en Colombia.

CATÁLOGO MAESTRO:
{masters_text}

CARGOS A HOMOLOGAR:
{cargos_text}

INSTRUCCIONES:
1. Para cada ID, busca el cargo más similar en el catálogo.
2. Responde SOLO con un array JSON:
[
  {{"id": ID, "cargo_homologado": "NOMBRE_EXACTO", "justificacion": "razón", "confianza": 0.0 a 1.0}}
]
3. Si no hay coincidencia, usa "SIN COINCIDENCIA"."""

    return prompt


def homologar_con_ia(db, cargos: list, masters: list = None) -> list:
    """Homologa cargos usando OpenRouter IA."""

    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    if not masters:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin catálogo", "confianza": 0.0} for c in cargos]

    print(f"homologar_con_ia: Procesando {len(cargos)} cargos")

    resultados = []
    batch_size = 8

    for i in range(0, len(cargos), batch_size):
        batch = cargos[i:i + batch_size]
        prompt = build_homologacion_prompt(batch, masters)

        content = None
        for intento in range(2):
            content = call_ia([{"role": "user", "content": prompt}], max_tokens=1500, timeout=60)
            if content:
                break
            time.sleep(2)

        if not content:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "confianza": 0.0} for c in batch])
            continue

        parsed = extract_json_array(content)
        if parsed and isinstance(parsed, list):
            for r in parsed:
                resultados.append({
                    "id": r.get("id"),
                    "cargo_homologado": r.get("cargo_homologado", "SIN COINCIDENCIA"),
                    "justificacion": (r.get("justificacion") or "")[:60],
                    "confianza": float(r.get("confianza", 0.5)),
                })
        else:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseo", "confianza": 0.0} for c in batch])

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print(f"homologar_con_ia: {exitos}/{len(cargos)} exitos")
    return resultados


# ==========================================
# VALORACIÓN CON IA
# ==========================================

def valorar_con_ia(cargo: dict) -> dict:
    """Valora cargo con IA."""
    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return {"error": "Sin API key"}

    prompt = f"""Asigna niveles SHR/HAY para: {cargo.get('nombre_cargo', 'N/A')}

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

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=500, timeout=30)

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
  "descripcion": "Breve descripción",
  "url": "https://ejemplo.com"
}}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=400, timeout=30)

    if not content:
        return {"fuente": "Error", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "Error IA", "url": ""}

    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed

    return {"fuente": "Error", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "Error parseo", "url": ""}
