import os
import requests
import json
import logging
import time
import re
import difflib
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
    if not text: return ""
    t = str(text).lower().strip()
    t = t.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    return re.sub(r'\s+', ' ', t)

def find_exact_match(cargo_nombre: str, masters: list):
    norm_cargo = normalize_text(cargo_nombre)
    
    # 1. Búsqueda exacta
    for m in masters:
        if normalize_text(m["nombre"]) == norm_cargo:
            return m
            
    # 2. Búsqueda por similitud (Fuzzy matching)
    best_match = None
    best_ratio = 0.0
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        ratio = difflib.SequenceMatcher(None, norm_cargo, norm_m).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = m
            
    # Umbral del 80% de similitud para atrapar variaciones leves como "Gerente General" vs "GERENT GENERAL."
    if best_ratio >= 0.80:
        return best_match
        
    # 3. Búsqueda de contención parcial
    for m in masters:
        norm_m = normalize_text(m["nombre"])
        if (norm_cargo in norm_m or norm_m in norm_cargo) and abs(len(norm_cargo) - len(norm_m)) < 10:
            return m
            
    return None

def homologar_lote_con_openrouter(cargos_batch: list, masters: list, retries=3) -> list:
    if not OPENROUTER_API_KEY:
        return [{"id": c["id"], "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "No API key", "status": "sin_coincidencia"} for c in cargos_batch]

    masters_text = "\n".join([f"- {m['nombre']}: {m['descripcion'][:150]}" for m in masters[:50]])
    if not masters_text: masters_text = "No hay maestros."

    cargos_text = ""
    for c in cargos_batch:
        cargos_text += f"ID: {c['id']} | Nombre: {c['nombre']} | Area: {c['area']} | Funciones: {str(c['descripcion'])[:200]}\n"

    prompt = f"""Eres experto en RRHH. 
CARGOS MAESTROS DISPONIBLES:
{masters_text}

CARGOS A HOMOLOGAR:
{cargos_text}

INSTRUCCIONES:
Para cada cargo a homologar, debes actuar como un experto analista. Analiza el nombre del cargo y sus funciones y selecciona el cargo maestro que MÁS SE PAREZCA o sea MÁS LÓGICO como equivalente. 
¡JAMÁS TE RINDAS! NUNCA devuelvas 'SIN COINCIDENCIA'. SIEMPRE debes proponer una sugerencia válida extraída de los CARGOS MAESTROS DISPONIBLES.
Devuelve ÚNICAMENTE un arreglo JSON estricto con esta estructura exacta para cada ID proporcionado:
[
  {{"id": ID_AQUI, "cargo_homologado": "NOMBRE MAESTRO SUGERIDO", "justificacion": "Breve razón por la que lo sugieres (max 20 words)", "status": "sugerido"}}
]"""

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
                    "max_tokens": 800
                },
                timeout=45
            )
            
            if response.status_code == 429:
                time.sleep(5)
                continue
                
            response.raise_for_status()
            
            content = response.json()["choices"][0]["message"]["content"].strip()
            if "```json" in content: content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content: content = content.split("```")[1].split("```")[0].strip()
            
            # Limpiar posible basura al inicio/final
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
    # FASE 1: Resolución Inmediata (Exact Match)
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
            cargo.estado = "HOMOLOGADO"
        else:
            cargos_para_ia.append(cargo)
            cargo.estado = "PROCESANDO"
            
    db.commit()

    # FASE 2: Procesamiento por Lotes en IA (5 a la vez para velocidad)
    batch_size = 10  # Aumentado a 10 para mayor velocidad
    for i in range(0, len(cargos_para_ia), batch_size):
        # Verificar si el usuario canceló el proceso
        db.refresh(upload)
        if upload.status == "cancelado":
            logger.info(f"Procesamiento cancelado por el usuario para upload {upload_id}")
            break
            
        batch = cargos_para_ia[i:i+batch_size]
        batch_dicts = [
            {"id": c.id, "nombre": c.nombre_cargo, "area": c.area, "descripcion": c.descripcion_empresa or ""} 
            for c in batch
        ]
        
        resultados_ia = homologar_lote_con_openrouter(batch_dicts, masters)
        
        # Mapear resultados a la DB
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
        time.sleep(1) # Pequeña pausa entre lotes para cuidar la cuota gratuita
