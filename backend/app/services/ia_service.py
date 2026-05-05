import os
import json
import time
import requests
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

# Configuracion OpenRouter (principal)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-flash-1.5")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Configuracion OpenRouter secundaria (tu nueva cuenta)
OPENROUTER_API_KEY_2 = os.getenv("OPENROUTER_API_KEY_2", "")

BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

print(f"IA Service: OPENROUTER_API_KEY={'CONFIGURADA' if OPENROUTER_API_KEY else 'NO CONFIGURADA'}")
print(f"IA Service: OPENROUTER_API_KEY_2={'CONFIGURADA' if OPENROUTER_API_KEY_2 else 'NO CONFIGURADA'}")


def call_openrouter(messages: list, max_tokens: int = 800, temperature: float = 0.1, timeout: int = 60, use_secondary: bool = False) -> Optional[str]:
    """Call OpenRouter API (soporta primary y secondary key)."""
    try:
        api_key = OPENROUTER_API_KEY_2 if use_secondary else OPENROUTER_API_KEY
        model = OPENROUTER_MODEL

        if not api_key:
            print(f"OpenRouter: {'Secondary' if use_secondary else 'Primary'} API key no configurada")
            return None

        print(f"OpenRouter: llamando {model} ({'secundaria' if use_secondary else 'primaria'})")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": BACKEND_URL,
            "X-Title": "SHR Homologacion",
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
                print(f"OpenRouter: OK, respuesta {len(content)} chars")
                return content
            else:
                print(f"OpenRouter: respuesta vacia")
                return None
        else:
            print(f"OpenRouter: HTTP {resp.status_code} - {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"OpenRouter: excepcion - {e}")
        return None


def call_ia(messages: list, max_tokens: int = 800, temperature: float = 0.1, timeout: int = 60) -> Optional[str]:
    """Intenta con OpenRouter primary, luego secondary."""
    # Intentar primary
    content = call_openrouter(messages, max_tokens, temperature, timeout, use_secondary=False)
    if content:
        return content

    # Intentar secondary (tu nueva cuenta)
    if OPENROUTER_API_KEY_2:
        content = call_openrouter(messages, max_tokens, temperature, timeout, use_secondary=True)
        if content:
            return content

    print("call_ia: Ambas API keys fallaron o no configuradas")
    return None


def extract_json(text: str) -> Optional[dict]:
    """Extrae JSON de la respuesta de IA."""
    if not text:
        return None
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Error extrayendo JSON: {e}. Texto: {text[:300]}")
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
        return None
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Error extrayendo JSON array: {e}")
        return None


# ==========================================
# HOMOLOGACION CON IA
# ==========================================

MASTER_CARGOS_CACHE = None

def load_master_cargos(db) -> list:
    """Carga los cargos maestros de la base de datos."""
    from ..models import MasterDescription, MasterCargo

    masters = []
    md_list = db.query(MasterDescription).all()
    for m in md_list:
        masters.append({
            "nombre": m.nombre_cargo or "",
            "descripcion": m.descripcion or "",
            "area": m.area or "",
            "fuente": "master_descriptions",
        })

    mc_list = db.query(MasterCargo).all()
    for m in mc_list:
        masters.append({
            "nombre": m.nombre or "",
            "descripcion": m.descripcion or "",
            "area": f"{m.area_general or ''} - {m.area_especifica or ''}".strip(),
            "fuente": "master_cargos",
        })

    logger.info(f"Cargados {len(masters)} cargos maestros")
    return masters


def build_homologacion_prompt(cargos: list, masters: list) -> str:
    """Construye el prompt para homologacion de cargos."""

    masters_text = "\n".join([
        f"- {m['nombre'].upper() if m.get('nombre') else ''} | {m.get('area', '')}"
        for m in masters[:80]
    ])

    cargos_text = ""
    for c in cargos[:10]:
        desc = (c.get("descripcion", "") or c.get("descripcion_empresa", "") or "").upper()
        area = (c.get("area", "N/A") or "").upper()
        nombre = (c.get("nombre_cargo", "") or "").upper()
        cargos_text += f"""
ID: {c.get('id', '')}
CARGO: {nombre}
AREA: {area}
DESCRIPCION: {desc[:150]}
---
"""

    prompt = f"""Eres un experto en clasificacion y homologacion de cargos en Colombia bajo metodologia SHR/HAY.

Tu tarea es encontrar el cargo maestro MAS similar para cada cargo de la empresa.

=== CATALOGO MAESTRO DE CARGOS (referencia) ===
{masters_text}

=== CARGOS A HOMOLOGAR ===
{cargos_text}

INSTRUCCIONES:
1. Para cada cargo, selecciona el cargo maestro MAS similar del catalogo.
2. Usa la DESCRIPCION y el AREA del cargo para mejorar la precision.
3. Considera el nivel jerarquico (jefe, coordinador, analista, auxiliar) para seniority.
4. Si NO hay ningun cargo similar en el catalogo, responde "SIN COINCIDENCIA".
5. El nombre del cargo homologado debe ser EXACTAMENTE como aparece en el catalogo.

Responde SOLO con un array JSON valido:
[
  {{
    "id": ID_NUMERICO,
    "cargo_homologado": "NOMBRE EXACTO DEL CARGO MAESTRO O SIN COINCIDENCIA",
    "justificacion": "Razon breve (max 60 chars)",
    "confianza": 0.0 a 1.0
  }}
]"""

    return prompt


def homologar_con_ia(db, cargos: list, masters: list = None) -> list:
    """Homologa cargos usando OpenRouter IA."""

    # Verificar API keys
    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        print("homologar_con_ia: NO hay API keys de OpenRouter configuradas")
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key de IA", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)
    if not masters:
        print("homologar_con_ia: NO hay cargos maestros en la base de datos")
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin catalogo maestro", "confianza": 0.0} for c in cargos]

    batch_size = 8
    print(f"homologar_con_ia: Procesando {len(cargos)} cargos en lotes de {batch_size}")

    resultados = []
    for i in range(0, len(cargos), batch_size):
        batch = cargos[i:i + batch_size]
        prompt = build_homologacion_prompt(batch, masters)
        lote_num = i // batch_size + 1
        print(f"homologar_con_ia: Lote {lote_num}, {len(batch)} cargos")

        # Intentar con retry automatico
        content = None
        max_retries = 2
        for attempt in range(max_retries):
            content = call_ia([{"role": "user", "content": prompt}], max_tokens=2000, timeout=90)
            if content:
                break
            print(f"homologar_con_ia: Lote {lote_num} intento {attempt + 1} fallo, reintentando...")
            time.sleep(2)

        if not content:
            print(f"homologar_con_ia: Lote {lote_num} FALLO definitivo - sin respuesta de IA")
            resultados.extend([
                {"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin respuesta de IA", "confianza": 0.0}
                for c in batch
            ])
            continue

        parsed = extract_json_array(content)
        if parsed and isinstance(parsed, list):
            parsed_ids = {r.get("id") for r in parsed}
            for res in parsed:
                resultados.append({
                    "id": res.get("id"),
                    "cargo_homologado": res.get("cargo_homologado", "SIN COINCIDENCIA"),
                    "justificacion": res.get("justificacion", ""),
                    "confianza": res.get("confianza", 0.5),
                })

            # Agregar cargos no procesados por IA
            for c in batch:
                if c.get("id") not in parsed_ids:
                    resultados.append({
                        "id": c.get("id"),
                        "cargo_homologado": "SIN COINCIDENCIA",
                        "justificacion": "Respuesta IA incompleta",
                        "confianza": 0.0,
                    })
        else:
            print(f"homologar_con_ia: Lote {lote_num} FALLO parseo")
            resultados.extend([
                {"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseando IA", "confianza": 0.0}
                for c in batch
            ])

    total_ok = len([r for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA"])
    print(f"homologar_con_ia: Completado - {total_ok}/{len(cargos)} exitosos")
    return resultados


def homologar_con_ia_observaciones(db, cargos: list, masters: list = None, observaciones: str = "") -> list:
    """Homologa con observaciones del analista."""

    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)
    if not masters:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin catalogo", "confianza": 0.0} for c in cargos]

    print(f"homologar_con_ia_observaciones: Reprocesando {len(cargos)} cargos")

    obs_text = f"\nOBSERVACIONES DEL ANALISTA:\n{observaciones}\n" if observaciones else ""

    masters_text = "\n".join([f"- {m['nombre']} | {m['area']}" for m in masters[:80]])

    cargos_text = ""
    for c in cargos[:5]:
        desc = c.get("descripcion", "") or c.get("descripcion_empresa", "") or ""
        area = c.get("area", "N/A")
        cargos_text += f"""
ID: {c['id']}
Cargo: {c['nombre_cargo']}
Area: {area}
Descripcion: {desc[:200]}
---
"""

    prompt = f"""Eres un experto en homologacion de cargos. Un analista reviso y tiene observaciones.

{obs_text}
=== CATALOGO MAESTRO ===
{masters_text}

=== CARGOS A REPROCESAR ===
{cargos_text}

INSTRUCCIONES:
1. Usa las observaciones para mejorar la seleccion.
2. Responde SOLO con un array JSON valido:
[
  {{"id": ID, "cargo_homologado": "NOMBRE", "justificacion": "razon", "confianza": 0.0 a 1.0}}
]"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=2000)

    if not content:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error en IA", "confianza": 0.0} for c in cargos]

    parsed = extract_json_array(content)
    if parsed and isinstance(parsed, list):
        return [{
            "id": res.get("id"),
            "cargo_homologado": res.get("cargo_homologado", "SIN COINCIDENCIA"),
            "justificacion": res.get("justificacion", ""),
            "confianza": res.get("confianza", 0.5),
        } for res in parsed]

    return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseando IA", "confianza": 0.0} for c in cargos]


# ==========================================
# VALORACION CON IA (12 criterios SHR/HAY)
# ==========================================

def build_valoracion_prompt(cargo: dict) -> str:
    """Construye prompt para valoracion de 12 criterios."""
    prompt = f"""Eres un experto en valoracion de cargos bajo metodologia SHR/HAY.

Cargo: {cargo.get('nombre_cargo', 'N/A')}
Nivel: {cargo.get('nivel_empresa', 'N/A')}
Reporta a: {cargo.get('reporta_a', 'N/A')}

Por favor, asigna niveles para los 12 criterios:
1. Conocimientos (A-H)
2. Experiencia (--/-/o/+)
3. Habilidades (I-VII)
4. Responsabilidad (1-4)
5. Contacto (A-C)
6. Frecuencia (1-4)
7. Contraste (I-V)
8. Complejidad (1-5)
9. Iniciativa (I-IV)
10. Autonomia (A-G)
11. Magnitud (0-14)
12. Impacto (I-VII)

Responde SOLO con un objeto JSON:
{{
  "conocimientos": "A",
  "experiencia": "-",
  "habilidades": "I",
  "responsabilidad": "1",
  "contacto": "A",
  "frecuencia": "1",
  "contraste": "I",
  "complejidad": "1",
  "iniciativa": "I",
  "autonomia": "A",
  "magnitud": "0",
  "impacto": "I",
  "justificacion": "breve explicacion"
}}"""
    return prompt


def valorar_con_ia(cargo: dict) -> dict:
    """Valora un cargo usando IA."""
    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return {"error": "Sin API key de IA"}

    prompt = build_valoracion_prompt(cargo)
    content = call_ia([{"role": "user", "content": prompt}], max_tokens=1000)

    if not content:
        return {"error": "Sin respuesta de IA"}

    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed

    return {"error": "Error parseando respuesta IA"}


# ==========================================
# BUSCAR EN INTERNET (SIN COINCIDENCIA)
# ==========================================

def buscar_en_internet(cargo: dict) -> dict:
    """Busca informacion del cargo en internet via IA."""
    nombre = cargo.get("nombre_cargo", "")

    if not OPENROUTER_API_KEY and not OPENROUTER_API_KEY_2:
        return {
            "fuente": "No disponible (sin API key)",
            "titulo": nombre,
            "descripcion": "Configura OPENROUTER_API_KEY o OPENROUTER_API_KEY_2 en Render",
            "url": "",
        }

    prompt = f"""Busca informacion sobre el cargo "{nombre}" en Colombia.

Responde SOLO con un objeto JSON:
{{
  "fuente": "Internet",
  "titulo": "Cargo encontrado",
  "descripcion": "Breve descripcion del cargo",
  "url": "https://ejemplo.com"
}}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=500)

    if not content:
        return {
            "fuente": "Error",
            "titulo": nombre,
            "descripcion": "Error consultando IA",
            "url": "",
        }

    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed

    return {
        "fuente": "Error",
        "titulo": nombre,
        "descripcion": "Error parseando respuesta",
        "url": "",
    }
