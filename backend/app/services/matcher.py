import os
import requests
import json
import logging
import re
import difflib
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, MasterDescription, Upload

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


def get_master_descriptions(db: Session):
    masters = db.query(MasterDescription).all()
    return [{"nombre": m.nombre_cargo or "", "descripcion": m.descripcion or "", "area": m.area or ""} for m in masters]


def normalize_text(text):
    if not text:
        return ""
    t = str(text).lower().strip()
    t = t.replace('a', 'a').replace('e', 'e').replace('i', 'i').replace('o', 'o').replace('u', 'u')
    t = re.sub(r'^(coordinador|supervisor|jefe|gerente|director|analista|especialista)\s+', '', t)
    return re.sub(r'\s+', ' ', t)


def find_exact_match(cargo_nombre: str, masters: list):
    if not cargo_nombre or not masters:
        return None

    norm_cargo = normalize_text(cargo_nombre)

    # 1. Busqueda exacta
    for m in masters:
        if normalize_text(m["nombre"]) == norm_cargo:
            return m

    # 2. Busqueda fuzzy con threshold mas bajo
    best_match = None
    best_ratio = 0.0
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        ratio = difflib.SequenceMatcher(None, norm_cargo, norm_m).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = m

    if best_ratio >= 0.55:
        return best_match

    # 3. Busqueda por palabras clave
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        palabras = norm_cargo.split()
        for palabra in palabras:
            if len(palabra) > 4 and palabra in norm_m:
                return m

    # 4. Si el cargo es muy corto
    if len(norm_cargo) <= 15:
        for m in masters:
            norm_m = normalize_text(m["nombre"])
            if norm_cargo in norm_m:
                return m

    return None


def _call_openrouter(messages, max_tokens=500):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None
    try:
        resp = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": BACKEND_URL,
                "X-Title": "SHR Homologacion",
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
    return None


def _call_openai(messages, max_tokens=500):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        resp = requests.post(
            OPENAI_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
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


def _call_ia(messages, max_tokens=500):
    """Intenta OpenRouter primero, fallback a OpenAI si esta configurado."""
    content = _call_openrouter(messages, max_tokens)
    if content:
        return content
    content = _call_openai(messages, max_tokens)
    if content:
        return content
    return None


def _extract_json(text):
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


def homologar_lote_con_ia(cargos_batch: list, masters: list) -> list:
    masters_text = "\n".join([f"- {m['nombre']}: {m['descripcion'][:80]}" for m in masters[:30]])
    if not masters_text:
        masters_text = "No hay maestros."

    cargos_text = ""
    for c in cargos_batch[:8]:
        nm = c.get('nombre', c.get('cargo_nombre', ''))
        desc = c.get('descripcion', '')
        desc_part = f"\n   DESCRIPCION: {desc}" if desc else ""
        cargos_text += f"ID: {c.get('id', 0)} | {nm}{desc_part}\n"

    prompt = f"""Eres experto en RRHH colombiano.
MAESTROS: {masters_text}
CARGOS: {cargos_text}
Para cada cargo, selecciona el maestro mas similar. Usa la descripcion del cargo para mejorar la precision si el nombre no coincide. Responde JSON array:
[{{"id": ID, "cargo_homologado": "NOMBRE", "justificacion": "razon"}}]"""

    content = _call_ia([{"role": "user", "content": prompt}], max_tokens=800)
    if not content:
        return [{"id": c.get("id", 0), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key de IA", "status": "sin_key"} for c in cargos_batch]

    try:
        if "[" in content:
            start = content.find("[")
            end = content.rfind("]") + 1
            return _extract_json(content[start:end])
    except Exception as e:
        logger.error(f"Error parsing IA response: {e}")

    return [{"id": c.get("id", 0), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "status": "error"} for c in cargos_batch]


def start_batch_processing(upload_id: int, db: Session):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        return

    upload.status = "procesando"
    db.commit()

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == "PENDIENTE").all()
    masters = get_master_descriptions(db)

    _process_direct_batch(upload_id, cargos, masters, db)

    upload.status = "completado"
    db.commit()


def _process_direct_batch(upload_id: int, cargos: list, masters: list, db: Session):
    cargos_para_ia = []

    for cargo in cargos:
        nombre_cargo = cargo.nombre_cargo

        # Buscar coincidencia local
        master = find_exact_match(nombre_cargo, masters)

        if master:
            homo = cargo.homologacion
            if homo:
                homo.cargo_homologado = master["nombre"]
                homo.justificacion = f"Coincidencia exacta en base ({master.get('area', '')})"
                homo.editado_manual = False
            else:
                homo = Homologacion(
                    cargo_id=cargo.id,
                    cargo_homologado=master["nombre"],
                    justificacion=f"Coincidencia exacta en base ({master.get('area', '')})"
                )
                db.add(homo)

            cargo.estado = "HOMOLOGADO"
        else:
            cargo.estado = "SIN_COINCIDENCIA"
            cargos_para_ia.append(cargo)

    db.commit()

    # Si hay cargos sin match, intentar con IA usando nombre Y descripcion
    if cargos_para_ia:
        cargos_batch = [{"id": c.id, "nombre": c.nombre_cargo, "area": c.area, "descripcion": c.descripcion_empresa or ""} for c in cargos_para_ia]

        try:
            resultados = homologar_lote_con_ia(cargos_batch, masters)

            for res in resultados:
                cargo_id = res.get("id")
                if cargo_id:
                    cargo = next((c for c in cargos_para_ia if c.id == cargo_id), None)
                    if cargo:
                        cargo.estado = "HOMOLOGADO"

                        homo = cargo.homologacion
                        if homo:
                            homo.cargo_homologado = res.get("cargo_homologado", "SIN COINCIDENCIA")
                            homo.justificacion = f"Sugerido por IA: {res.get('justificacion', '')}"
                        else:
                            homo = Homologacion(
                                cargo_id=cargo.id,
                                cargo_homologado=res.get("cargo_homologado", "SIN COINCIDENCIA"),
                                justificacion=f"Sugerido por IA: {res.get('justificacion', '')}"
                            )
                            db.add(homo)

            db.commit()
        except Exception as e:
            logger.error(f"Error en procesamiento IA: {e}")
