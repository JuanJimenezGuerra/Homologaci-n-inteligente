import os
import json
import time
import requests

# USA SOLO OPENROUTER CON MODELO GRATUITO
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY2", "")  # Tu nueva key en Render
OPENROUTER_MODEL = "meta-llama/llama-3.1-8b-instruct:free"  # Modelo 100% GRATUITO
OPENAI_API_KEY = ""
OPENAI_MODEL = ""
URL = "https://openrouter.ai/api/v1/chat/completions"

# Debug: mostrar TODAS las vars de entorno relacionadas
print("=== ENV VARS DEBUG ===")
print(f"OPENROUTER_API_KEY2: {'OK' if os.getenv('OPENROUTER_API_KEY2') else 'NO CONFIGURADA'}")
print(f"OPENROUTER_API_KEY (lo que lee): {'OK' if OPENROUTER_API_KEY else 'VACIA'}")
print(f"OPENROUTER_MODEL: {OPENROUTER_MODEL}")
print(f"Todas las vars: {[k for k in os.environ.keys() if 'API' in k or 'KEY' in k]}")


def call_ia(messages, max_tokens=1000, timeout=45):
    """Llama a OpenRouter con modelo GRATUITO."""
    if not OPENROUTER_API_KEY:
        print("[IA] ERROR: No hay OPENROUTER_API_KEY")
        return ""

    try:
        print(f"[IA] Llamando {OPENROUTER_MODEL}...")
        resp = requests.post(
            URL,
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
            json={"model": OPENROUTER_MODEL, "messages": messages, "max_tokens": max_tokens},
            timeout=timeout
        )
        if resp.ok:
            content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            if content:
                print(f"[IA] OK: {len(content)} caracteres")
                return content
            else:
                print("[IA] Respuesta vacía")
        else:
            print(f"[IA] HTTP {resp.status_code}: {resp.text[:150]}")
    except Exception as e:
        print(f"[IA] Error: {e}")
    return ""


def extract_json(text):
    """Extrae JSON de la respuesta."""
    if not text:
        return None
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text.strip())
    except:
        return None


def extract_json_array(text):
    """Extrae array JSON."""
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
    except:
        pass
    return None


# ==========================================
# HOMOLOGACION
# ==========================================

def load_master_cargos(db):
    from ..models import MasterDescription, MasterCargo
    masters = []
    for m in db.query(MasterDescription).all():
        if m.nombre_cargo:
            masters.append({"nombre": m.nombre_cargo.upper()})
    for m in db.query(MasterCargo).all():
        if m.nombre:
            masters.append({"nombre": m.nombre.upper()})
    return masters


def homologar_con_ia(db, cargos, masters=None):
    if not OPENROUTER_API_KEY:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    print(f"[HOMOLOGACION] Procesando {len(cargos)} cargos")

    resultados = []
    for i in range(0, len(cargos), 8):
        batch = cargos[i:i+8]
        catalogo = "\n".join([f"- {m['nombre']}" for m in masters[:80]])
        cargos_txt = "\n".join([f"ID:{c.get('id')} | {c.get('nombre_cargo', '').upper()}" for c in batch])

        json_example = '[{"id": 1, "cargo_homologado": "NOMBRE", "justificacion": "razon", "confianza": 0.5}]'
        prompt = f"""Eres experto en homologacion de cargos en Colombia.

CATALOGO:
{catalogo}

CARGOS:
{cargos_txt}

INSTRUCCIONES:
1. Para cada ID, busca el cargo mas similar en el catalogo.
2. Responde SOLO con array JSON (ejemplo: {json_example})
3. Si no hay coincidencia, usa "SIN COINCIDENCIA"."""

        content = ""
        for intento in range(2):
            content = call_ia([{"role": "user", "content": prompt}], max_tokens=1500)
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
                    "justificacion": str(r.get("justificacion", ""))[:60],
                    "confianza": float(r.get("confianza", 0.5)),
                })
        else:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseo", "confianza": 0.0} for c in batch])

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print(f"[HOMOLOGACION] {exitos}/{len(cargos)} exitos")
    return resultados


# ==========================================
# VALORACION
# ==========================================

def valorar_con_ia(cargo):
    if not OPENROUTER_API_KEY:
        return {"error": "Sin API key"}

    prompt = f"""Asigna niveles SHR/HAY para: {cargo.get('nombre_cargo', 'N/A')}

Responde SOLO JSON:
{"conocimientos":"A-H","experiencia":"--/-/o/+","habilidades":"I-VII","responsabilidad":"1-4","contacto":"A-C","frecuencia":"1-4","contraste":"I-V","complejidad":"1-5","iniciativa":"I-IV","autonomia":"A-G","magnitud":"0-14","impacto":"I-VII","justificacion":"breve"}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=500)
    if not content:
        return {"error": "Sin respuesta IA"}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
    return {"error": "Error parseo"}


# ==========================================
# BUSCAR EN INTERNET
# ==========================================

def buscar_en_internet(cargo):
    if not OPENROUTER_API_KEY:
        return {"fuente": "Sin API key", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "", "url": ""}

    nombre = cargo.get("nombre_cargo", "")
    prompt = f"""Dame info del cargo "{nombre}" en Colombia.

Responde SOLO JSON:
{"fuente":"Internet","titulo":"Cargo","descripcion":"Breve","url":"https://ejemplo.com"}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=400)
    if not content:
        return {"fuente": "Error", "titulo": nombre, "descripcion": "Error IA", "url": ""}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
    return {"fuente": "Error", "titulo": nombre, "descripcion": "Error parseo", "url": ""}
