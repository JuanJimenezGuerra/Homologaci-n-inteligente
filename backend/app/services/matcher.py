import os
import requests
import json
import logging
import time
import re
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, ProcessingLog, MasterDescription, Upload

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

def get_master_descriptions(db: Session):
    masters = db.query(MasterDescription).all()
    return [{"nombre": m.nombre_cargo, "descripcion": m.descripcion, "area": m.area} for m in masters]

def normalize_text(text):
    """Normalize text for better matching: lowercase, remove accents, extra spaces."""
    if not text: return ""
    t = str(text).lower().strip()
    t = t.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    return re.sub(r'\s+', ' ', t)

def find_exact_match(cargo_nombre: str, masters: list):
    """Búsqueda exacta (ignorando mayúsculas/acentos) para no gastar IA."""
    norm_cargo = normalize_text(cargo_nombre)
    for m in masters:
        if normalize_text(m["nombre"]) == norm_cargo:
            return m
    # Intento de coincidencia parcial muy segura (ej: "Coordinador TIC" vs "COORDINADOR DE TIC")
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        if norm_cargo in norm_m or norm_m in norm_cargo:
            # Solo si la diferencia de longitud es muy pequeña (evitar falsos positivos como "Asistente" vs "Asistente de Gerencia")
            if abs(len(norm_cargo) - len(norm_m)) < 5:
                return m
    return None

def homologar_con_openrouter(cargo_nombre: str, cargo_area: str, cargo_descripcion: str, masters: list, retries=3) -> dict:
    if not OPENROUTER_API_KEY:
        return {"cargo_homologado": "SIN COINCIDENCIA", "justificacion": "API key de OpenRouter no configurada.", "status": "sin_coincidencia"}

    masters_text = "\n".join([f"- {m['nombre']}: {m['descripcion'][:150]}" for m in masters[:50]])
    if not masters_text: masters_text = "No hay descripciones maestras disponibles."

    prompt = f"""Eres un experto en homologación de cargos de Recursos Humanos.
CARGO A HOMOLOGAR:
- Nombre: {cargo_nombre}
- Área: {cargo_area}
- Descripción Funcional: {cargo_descripcion or 'No disponible'}

CARGOS MAESTROS DISPONIBLES:
{masters_text}

INSTRUCCIONES:
1. Elige el cargo maestro MÁS similar.
2. Responde ÚNICAMENTE con un JSON:
{{"cargo_homologado": "NOMBRE EXACTO DEL CARGO MAESTRO", "justificacion": "Por qué se eligió (max 100 words)", "status": "homologado"}}
Si no hay coincidencia: {{"cargo_homologado": "SIN COINCIDENCIA", "justificacion": "", "status": "sin_coincidencia"}}"""

    for attempt in range(retries):
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": BACKEND_URL,
                    "X-Title": "SHR Homologacion"
                },
                json={
                    "model": "openrouter/free",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 500
                },
                timeout=30
            )
            
            # Si hay Rate Limit (429), esperar y reintentar
            if response.status_code == 429:
                logger.warning(f"Rate limit 429 (intento {attempt+1}/{retries}). Esperando 5 segundos...")
                time.sleep(5)
                continue
                
            response.raise_for_status()
            
            content = response.json()["choices"][0]["message"]["content"].strip()
            if "```json" in content: content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content: content = content.split("```")[1].split("```")[0].strip()
            
            return json.loads(content)
            
        except Exception as e:
            if attempt == retries - 1:
                return {"cargo_homologado": "SIN COINCIDENCIA", "justificacion": f"Error IA: {str(e)[:50]}", "status": "error"}
            time.sleep(2) # Fallo temporal, esperar 2 seg

def start_batch_processing(upload_id: int, db: Session):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload: return

    upload.status = "procesando"
    db.commit()

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == "PENDIENTE").all()
    masters = get_master_descriptions(db)

    _process_direct(upload_id, cargos, masters, db)
    
    upload.status = "completado"
    db.commit()

def _process_direct(upload_id: int, cargos: list, masters: list, db: Session):
    for i, cargo in enumerate(cargos):
        try:
            cargo.estado = "PROCESANDO"
            db.commit()
            
            # 1. BÚSQUEDA RÁPIDA (Reglas Exactas / Similares) -> Sin gastar IA
            match = find_exact_match(cargo.nombre_cargo, masters)
            
            if match:
                result = {
                    "cargo_homologado": match["nombre"],
                    "justificacion": "", # Sin justificación de IA si lo encontró directo
                    "status": "homologado"
                }
            else:
                # 2. BÚSQUEDA INTELIGENTE (IA con funciones extraídas)
                # Respetamos el delay entre llamadas IA gratuitas
                time.sleep(1) 
                result = homologar_con_openrouter(
                    cargo_nombre=cargo.nombre_cargo,
                    cargo_area=cargo.area or "",
                    cargo_descripcion=cargo.descripcion_empresa or "",
                    masters=masters
                )
            
            homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
            if not homo:
                homo = Homologacion(cargo_id=cargo.id)
                db.add(homo)
            
            homo.cargo_homologado = result.get("cargo_homologado", "SIN COINCIDENCIA")
            homo.justificacion = result.get("justificacion", "")
            
            status = result.get("status", "sin_coincidencia")
            cargo.estado = "HOMOLOGADO" if status == "homologado" else "SIN_COINCIDENCIA" if status == "sin_coincidencia" else "ERROR"
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error procesando cargo {cargo.id}: {e}")
            cargo.estado = "ERROR"
            db.commit()
