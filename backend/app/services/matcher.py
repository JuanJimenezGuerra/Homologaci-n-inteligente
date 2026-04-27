import os
import requests
import json
import logging
import time
import re
import difflib
from anthropic import Anthropic
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, ProcessingLog, MasterDescription, Upload

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

def get_master_descriptions(db: Session):
    masters = db.query(MasterDescription).all()
    return [{"nombre": m.nombre_cargo, "descripcion": m.descripcion or "", "area": m.area or ""} for m in masters]

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
    for m in masters:
        if normalize_text(m["nombre"]) == norm_cargo:
            return m
            
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
        
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        palabras = norm_cargo.split()
        for palabra in palabras:
            if len(palabra) > 4 and palabra in norm_m:
                return m
                
    if len(norm_cargo) <= 15:
        for m in masters:
            norm_m = normalize_text(m["nombre"])
            if norm_cargo in norm_m:
                return m
            
    return None

def _homologar_con_openrouter(cargos_batch, masters_text, cargos_text):
    """Fallback usando OpenRouter (gratis)"""
    api_key = os.getenv("OPENROUTER_API_KEY")
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
    """Homologar usando Anthropic"""
    prompt = f"""Eres experto en RRHH colombiano.
MAESTROS: {masters_text}
CARGO: {cargos_text}
Selecciona el maestro más similar. Responde JSON array:
[{{"id": ID, "cargo_homologado": "NOMBRE", "justificacion": "razón"}}]"""

    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=800,
        temperature=0.1,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text.strip()
    if "```json" in content: content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content: content = content.split("```")[1].split("```")[0].strip()
    
    start = content.find('[')
    end = content.rfind(']') + 1
    if start != -1 and end != 0:
        content = content[start:end]
        
    return json.loads(content)

def homologar_lote_con_ia(cargos_batch: list, masters: list, retries=3) -> list:
    # Intentar Anthropic primero, luego OpenRouter
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENROUTER_API_KEY")
    
    if not api_key:
        return [{"id": c.get("id", 0), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "status": "sin_key"} for c in cargos_batch]

    masters_text = "\n".join([f"- {m['nombre']}: {m['descripcion'][:80]}" for m in masters[:30]])
    if not masters_text: masters_text = "No hay maestros."

    cargos_text = ""
    for c in cargos_batch[:8]:
        cargos_text += f"ID: {c.get('id', 0)} | {c.get('nombre', c.get('cargo_nombre', ''))}\n"

    # Try Anthropic first
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            return _homologar_con_anthropic(cargos_batch, masters_text, cargos_text)
        except Exception as e:
            logger.warning(f"Anthropic failed: {e}, trying OpenRouter")
    
    # Fallback a OpenRouter
    return _homologar_con_openrouter(cargos_batch, masters_text, cargos_text)
        try:
            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=800,
                temperature=0.1,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text.strip()
            if "```json" in content: content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content: content = content.split("```")[1].split("```")[0].strip()
            
            start = content.find('[')
            end = content.rfind(']') + 1
            if start != -1 and end != 0:
                content = content[start:end]
                
            resultados = json.loads(content)
            if isinstance(resultados, list):
                return resultados
            
        except Exception as e:
            if attempt == retries - 1:
                logger.error(f"Error IA Lote: {e}")
                return [{"id": c["id"], "cargo_homologado": "SIN COINCIDENCIA", "justificacion": f"Error IA: {str(e)[:40]}", "status": "error"} for c in cargos_batch]
            time.sleep(2)

def start_batch_processing(upload_id: int, db: Session):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload: return

    upload.status = "procesando"
    db.commit()

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == "PENDIENTE").all()
    masters = get_master_descriptions(db)

    _process_direct_batch(upload_id, cargos, masters, db)
    
    upload.status = "completado"
    db.commit()

def _process_direct_batch(upload_id: int, cargos: list, masters: list, db: Session):
    cargos_para_ia = []
    
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    
    for cargo in cargos:
        match = find_exact_match(cargo.nombre_cargo, masters)
        if match:
            homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
            if not homo:
                homo = Homologacion(cargo_id=cargo.id)
                db.add(homo)
            homo.cargo_homologado = match["nombre"]
            homo.justificacion = "⚡ Homologación Directa (Coincidencia de nombre)"
            cargo.estado = "HOMOLOGADO"
        else:
            cargos_para_ia.append(cargo)
            cargo.estado = "PROCESANDO"
            
    db.commit()

    batch_size = 10
    for i in range(0, len(cargos_para_ia), batch_size):
        db.refresh(upload)
        if upload.status == "cancelado":
            logger.info(f"Procesamiento cancelado por el usuario para upload {upload_id}")
            break
            
        batch = cargos_para_ia[i:i+batch_size]
        
        batch_dicts = [
            {"id": c.id, "nombre": c.nombre_cargo, "area": c.area, "descripcion": c.descripcion_empresa or ""} 
            for c in batch
        ]
        resultados_ia = homologar_lote_con_ia(batch_dicts, masters)
        
        for res in resultados_ia:
            cargo_id = res.get("id")
            if not cargo_id: continue
            
            cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
            if not cargo: continue
            
            homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
            if not homo:
                homo = Homologacion(cargo_id=cargo.id)
                db.add(homo)
                
            cargo_homologado_ia = str(res.get("cargo_homologado", "")).upper().strip()
            homo.cargo_homologado = cargo_homologado_ia
            
            just_ia = res.get("justificacion", "")
            homo.justificacion = f"🤖 {just_ia}"
            
            status = res.get("status", "sugerido")
            cargo.estado = "SUGERIDO" if status == "sugerido" or status == "homologado" else "ERROR"
            
        db.commit()
        time.sleep(1)