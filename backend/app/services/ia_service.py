import os
import json
import time
import requests

# Configuration - Use Google Gemini API directly (FREE)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"

print(f"[IA] GEMINI_API_KEY: {'OK' if GEMINI_API_KEY else 'NO - GET FREE KEY AT: https://ai.google.dev/'}")


def call_ia(messages, max_tokens=1000, timeout=45):
    """Call Google Gemini API directly (FREE tier)."""
    if not GEMINI_API_KEY:
        print("[IA] ERROR: No GEMINI_API_KEY! Get free key at https://ai.google.dev/")
        return ""

    try:
        # Convert messages to Gemini format
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m["content"]}]
            })

        print(f"[IA] Calling Gemini...")
        resp = requests.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json={"contents": contents, "generationConfig": {"maxOutputTokens": max_tokens}},
            timeout=timeout
        )

        if resp.ok:
            data = resp.json()
            content = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
            if content:
                print(f"[IA] OK: {len(content)} chars")
                return content
            else:
                print("[IA] Empty response")
        else:
            print(f"[IA] HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[IA] Error: {e}")
    return ""


def extract_json(text):
    """Extract JSON from response."""
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


def extract_json_array(text):
    """Extract JSON array."""
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
    if not GEMINI_API_KEY:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    print(f"[homologar_con_ia] Processing {len(cargos)} cargos")

    resultados = []
    for i in range(0, len(cargos), 8):
        batch = cargos[i:i+8]
        catalogo = "\n".join([f"- {m['nombre']}" for m in masters[:80]])
        cargos_text = "\n".join([f"ID:{c.get('id')} | {c.get('nombre_cargo', '').upper()}" for c in batch])

        prompt = f"""You are an expert in job classification in Colombia.

CATALOG:
{catalogo}

JOBS TO MATCH:
{cargos_text}

INSTRUCTIONS:
For each ID, find the most similar job in catalog.
Return ONLY JSON array:
[{"id": ID, "cargo_homologado": "EXACT_NAME", "justificacion": "reason", "confianza": 0.0 to 1.0}]
If no match, use "SIN COINCIDENCIA"."""

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
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Parse error", "confianza": 0.0} for c in batch])

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print(f"[homologar_con_ia] Done: {exitos}/{len(cargos)} matched")
    return resultados


# ==========================================
# VALORACION
# ==========================================

def valorar_con_ia(cargo):
    if not GEMINI_API_KEY:
        return {"error": "Sin API key"}

    prompt = f"""Assign SHR/HAY levels for: {cargo.get('nombre_cargo', 'N/A')}

Return ONLY JSON:
{"conocimientos":"A-H","experiencia":"--/-/o/+","habilidades":"I-VII","responsabilidad":"1-4","contacto":"A-C","frecuencia":"1-4","contraste":"I-V","complejidad":"1-5","iniciativa":"I-IV","autonomia":"A-G","magnitud":"0-14","impacto":"I-VII","justificacion":"brief"}"""

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
    if not GEMINI_API_KEY:
        return {"fuente": "Sin API key", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "", "url": ""}

    nombre = cargo.get("nombre_cargo", "")
    prompt = f"""Info about job "{nombre}" in Colombia.

Return ONLY JSON:
{"fuente":"Internet","titulo":"Job","descripcion":"Brief","url":"https://example.com"}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=400)
    if not content:
        return {"fuente": "Error", "titulo": nombre, "descripcion": "Error IA", "url": ""}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
    return {"fuente": "Error", "titulo": nombre, "descripcion": "Parse error", "url": ""}
