import os
import requests
import json
import logging
import re
import difflib
from anthropic import Anthropic
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, MasterDescription, Upload

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DEFAULT_OPENROUTER = "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"
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

def get_master_descriptions(db: Session):
    masters = db.query(MasterDescription).all()
    return [{"nombre": m.nombre_cargo or "", "descripcion": m.descripcion or "", "area": m.area or ""} for m in masters]

def normalize_text(text):
    if not text: return ""
    t = str(text).lower().strip()
    t = t.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    t = re.sub(r'^(coordinador|supervisor|jefe|gerente|director|analista|especialista)\s+', '', t)
    return re.sub(r'\s+', ' ', t)

def find_exact_match(cargo_nombre: str, masters: list):
    if not cargo_nombre or not masters:
        return None
        
    norm_cargo = normalize_text(cargo_nombre)
    
    # 1. Búsqueda exacta
    for m in masters:
        if normalize_text(m["nombre"]) == norm_cargo:
            return m
            
    # 2. Búsqueda fuzzy con threshold más bajo
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
        
    # 3. Búsqueda por palabras clave
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

def _homologar_con_openrouter(cargos_batch, masters_text, cargos_text):
    api_key = os.getenv("OPENROUTER_API_KEY") or DEFAULT_OPENROUTER
    if not api_key:
        return [{"id": c.get("id", 0), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "status": "sin_key"} for c in cargos_batch]
    
    prompt = f"""Eres experto en RRHH. MAESTROS: {masters_text}
CARGO: {cargos_text}
Responde solo JSON: [{{"id": ID, "cargo_homologado": "NOMBRE", "justificacion": "razón"}}]"""
    
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "google/gemini-2.0-flash-exp:free",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500
            },
            timeout=30
        )
        if resp.ok:
            content = resp.json()["choices"][0]["message"]["content"]
            if "[" in content:
                start = content.find("[")
                end = content.rfind("]") + 1
                return json.loads(content[start:end])
    except Exception as e:
        logger.error(f"OpenRouter error: {e}")
    
    return [{"id": c.get("id", 0), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "status": "error"} for c in cargos_batch]

def _homologar_con_anthropic(cargos_batch, masters_text, cargos_text):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    
    prompt = f"""Eres experto en RRHH colombiano.
MAESTROS: {masters_text}
CARGO: {cargos_text}
Selecciona el maestro más similar. Responde JSON array:
[{{"id": ID, "cargo_homologado": "NOMBRE", "justificacion": "razón"}}]"""

    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=800,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}]
        )
        content = response.content[0].text.strip()
        if "[" in content:
            start = content.find("[")
            end = content.rfind("]") + 1
            return json.loads(content[start:end])
    except Exception as e:
        logger.error(f"Anthropic error: {e}")
    
    return None

def homologar_lote_con_ia(cargos_batch: list, masters: list) -> list:
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENROUTER_API_KEY") or DEFAULT_OPENROUTER
    
    if not api_key:
        return [{"id": c.get("id", 0), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "status": "sin_key"} for c in cargos_batch]

    masters_text = "\n".join([f"- {m['nombre']}: {m['descripcion'][:80]}" for m in masters[:30]])
    if not masters_text: masters_text = "No hay maestros."

    cargos_text = ""
    for c in cargos_batch[:8]:
        nm = c.get('nombre', c.get('cargo_nombre', ''))
        cargos_text += f"ID: {c.get('id', 0)} | {nm}\n"

    # Try Anthropic first
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            result = _homologar_con_anthropic(cargos_batch, masters_text, cargos_text)
            if result:
                return result
        except Exception as e:
            logger.warning(f"Anthropic failed: {e}")
    
    # Fallback a OpenRouter
    return _homologar_con_openrouter(cargos_batch, masters_text, cargos_text)

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
            # Ya tiene match local
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
            # No tiene match, marcar para IA
            cargo.estado = "SIN_COINCIDENCIA"
            cargos_para_ia.append(cargo)
    
    db.commit()
    
    # Si hay cargos sin match, intentar con IA
    if cargos_para_ia:
        cargos_batch = [{"id": c.id, "nombre": c.nombre_cargo, "area": c.area} for c in cargos_para_ia]
        
        try:
            resultados = homologar_lote_con_ia(cargos_batch, masters)
            
            for res in resultados:
                cargo_id = res.get("id")
                if cargo_id:
                    cargo = next((c for c in cargos_para_ia if c.id == cargo_id), None)
                    if cargo:
                        cargo.cargo_homologado = res.get("cargo_homologado", "SIN COINCIDENCIA")
                        cargo.justificacion = res.get("justificacion", "Sugerido por IA")
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