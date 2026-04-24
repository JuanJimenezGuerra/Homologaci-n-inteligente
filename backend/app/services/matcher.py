from sqlalchemy.orm import Session
from ..models import Cargo, MasterDescription, Homologacion, ProcessingLog, Upload
import requests
import os
import json
import logging
import time

logger = logging.getLogger(__name__)

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

def get_master_descriptions(db: Session):
    """Get all master descriptions for the AI prompt."""
    masters = db.query(MasterDescription).all()
    return [{"nombre": m.nombre_cargo, "descripcion": m.descripcion, "area": m.area} for m in masters]

def homologar_con_openrouter(cargo_nombre: str, cargo_area: str, cargo_descripcion: str, masters: list) -> dict:
    """
    Call OpenRouter API directly to homologate a job title.
    Uses the free Gemini Flash model via OpenRouter.
    """
    if not OPENROUTER_API_KEY:
        return {"cargo_homologado": "SIN COINCIDENCIA", "justificacion": "API key de OpenRouter no configurada.", "status": "sin_coincidencia"}

    # Build master list for prompt (top 50 to avoid token limits)
    masters_text = "\n".join([f"- {m['nombre']}: {m['descripcion'][:150]}" for m in masters[:50]])
    
    if not masters_text:
        masters_text = "No hay descripciones maestras disponibles."

    prompt = f"""Eres un experto en homologación de cargos de Recursos Humanos en Colombia.
Tu tarea es encontrar el cargo maestro más similar al cargo de la empresa cliente.

CARGO A HOMOLOGAR:
- Nombre: {cargo_nombre}
- Área: {cargo_area}
- Descripción de la empresa: {cargo_descripcion or 'No disponible'}

CARGOS MAESTROS DISPONIBLES:
{masters_text}

INSTRUCCIONES:
1. Analiza el cargo a homologar y compáralo con los cargos maestros.
2. Elige el cargo maestro MÁS similar (NO inventes nombres nuevos).
3. Si ninguno es adecuado, responde con "SIN COINCIDENCIA".
4. Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{{"cargo_homologado": "NOMBRE EXACTO DEL CARGO MAESTRO", "justificacion": "Explicación breve de por qué se eligió este cargo (máximo 100 palabras)", "status": "homologado"}}

Si no hay coincidencia adecuada:
{{"cargo_homologado": "SIN COINCIDENCIA", "justificacion": "No se encontró un cargo maestro suficientemente similar.", "status": "sin_coincidencia"}}"""

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
        response.raise_for_status()
        
        content = response.json()["choices"][0]["message"]["content"].strip()
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        result = json.loads(content)
        logger.info(f"✅ OpenRouter respondió para '{cargo_nombre}': {result.get('cargo_homologado')}")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Error parseando JSON de OpenRouter: {e}. Respuesta: {content}")
        return {"cargo_homologado": "SIN COINCIDENCIA", "justificacion": f"Error en respuesta de IA: {str(e)}", "status": "error"}
    except Exception as e:
        logger.error(f"❌ Error llamando OpenRouter: {e}")
        return {"cargo_homologado": "SIN COINCIDENCIA", "justificacion": f"Error de conexión con IA: {str(e)}", "status": "error"}

def start_batch_processing(upload_id: int, db: Session):
    """
    Orchestrates batch processing:
    1. If N8N_WEBHOOK_URL is set → sends to n8n (async)
    2. Otherwise → calls OpenRouter directly (sync, faster for small batches)
    """
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        logger.error(f"Upload {upload_id} no encontrado")
        return

    upload.status = "procesando"
    db.commit()

    cargos = db.query(Cargo).filter(
        Cargo.upload_id == upload_id, 
        Cargo.estado == "PENDIENTE"
    ).all()
    
    logger.info(f"📦 Procesando {len(cargos)} cargos del upload {upload_id}")

    # Get master descriptions once
    masters = get_master_descriptions(db)
    logger.info(f"📚 {len(masters)} descripciones maestras disponibles")

    if N8N_WEBHOOK_URL:
        # === MODE: n8n (async) ===
        _process_via_n8n(upload_id, cargos, masters, db)
    else:
        # === MODE: Direct OpenRouter (sync) ===
        _process_direct(upload_id, cargos, masters, db)

    upload.status = "completado"
    db.commit()
    logger.info(f"✅ Procesamiento del upload {upload_id} completado")

def _process_via_n8n(upload_id: int, cargos: list, masters: list, db: Session):
    """Send all cargos to n8n webhook for processing."""
    payload_cargos = []
    for cargo in cargos:
        cargo.estado = "PROCESANDO"
        payload_cargos.append({
            "id": cargo.id,
            "nombre": cargo.nombre_cargo,
            "area": cargo.area,
            "descripcion_empresa": cargo.descripcion_empresa or "",
        })
    db.commit()

    try:
        response = requests.post(
            N8N_WEBHOOK_URL,
            json={
                "upload_id": upload_id,
                "backend_url": BACKEND_URL,
                "cargos": payload_cargos,
                "masters": masters[:50]  # Send top 50 masters
            },
            timeout=10
        )
        response.raise_for_status()
        logger.info(f"✅ Enviado a n8n: {len(payload_cargos)} cargos")
    except Exception as e:
        logger.error(f"❌ Error enviando a n8n: {e}. Cayendo a modo directo.")
        # Fallback to direct processing
        _process_direct(upload_id, cargos, masters, db)

def _process_direct(upload_id: int, cargos: list, masters: list, db: Session):
    """Process each cargo directly with OpenRouter API."""
    for i, cargo in enumerate(cargos):
        try:
            cargo.estado = "PROCESANDO"
            db.commit()
            
            logger.info(f"🔄 [{i+1}/{len(cargos)}] Procesando: {cargo.nombre_cargo}")
            
            result = homologar_con_openrouter(
                cargo_nombre=cargo.nombre_cargo,
                cargo_area=cargo.area or "",
                cargo_descripcion=cargo.descripcion_empresa or "",
                masters=masters
            )
            
            # Update homologacion
            homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
            if not homo:
                homo = Homologacion(cargo_id=cargo.id)
                db.add(homo)
            
            homo.cargo_homologado = result.get("cargo_homologado", "SIN COINCIDENCIA")
            homo.justificacion = result.get("justificacion", "")
            
            # Update cargo status
            status = result.get("status", "sin_coincidencia")
            if status == "homologado":
                cargo.estado = "HOMOLOGADO"
            elif status == "sin_coincidencia":
                cargo.estado = "SIN_COINCIDENCIA"
            else:
                cargo.estado = "ERROR"
            
            log = ProcessingLog(
                upload_id=upload_id,
                cargo_id=cargo.id,
                level="INFO",
                message=f"IA: {homo.cargo_homologado}",
                raw_response=json.dumps(result)
            )
            db.add(log)
            db.commit()
            
            # Small delay to avoid rate limiting
            if i < len(cargos) - 1:
                time.sleep(0.5)
                
        except Exception as e:
            logger.error(f"❌ Error procesando cargo {cargo.id}: {e}")
            cargo.estado = "ERROR"
            db.commit()
