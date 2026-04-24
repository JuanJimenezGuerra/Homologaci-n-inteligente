from sqlalchemy.orm import Session
from ..models import Cargo, MasterDescription, JobStatus, ProcessingLog, Upload
from thefuzz import process
import requests
import os
import json
import logging

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL")

def prefilter_candidates(cargo_nombre: str, db: Session, limit=10):
    """
    Finds top candidates from master descriptions using fuzzy matching.
    """
    master_entries = db.query(MasterDescription).all()
    if not master_entries:
        return []
    
    choices = {m.id: f"{m.nombre_cargo} | {m.descripcion}" for m in master_entries}
    
    # Use thefuzz to find top matches
    matches = process.extract(cargo_nombre, choices, limit=limit)
    
    results = []
    for match_text, score, master_id in matches:
        master = db.query(MasterDescription).get(master_id)
        results.append({
            "id": master.id,
            "nombre": master.nombre_cargo,
            "descripcion": master.descripcion,
            "score": score
        })
    
    return results

def start_batch_processing(upload_id: int, db: Session):
    """
    Orchestrates the batch processing.
    """
    upload = db.query(Upload).get(upload_id)
    if not upload:
        return
    
    upload.status = "procesando"
    db.commit()

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado == JobStatus.PENDIENTE).all()
    
    # Process in batches of 5
    batch_size = 5
    for i in range(0, len(cargos), batch_size):
        batch = cargos[i:i + batch_size]
        payload_cargos = []
        
        for cargo in batch:
            cargo.estado = JobStatus.PROCESANDO
            db.commit()
            
            candidates = prefilter_candidates(cargo.nombre_cargo, db)
            payload_cargos.append({
                "id": cargo.id,
                "nombre": cargo.nombre_cargo,
                "area": cargo.area,
                "descripcion_empresa": cargo.descripcion_empresa,
                "candidatos_maestros": candidates
            })
            
            # Log progress
            log = ProcessingLog(
                upload_id=upload_id,
                cargo_id=cargo.id,
                level="INFO",
                message=f"Preparando cargo para IA. {len(candidates)} candidatos encontrados."
            )
            db.add(log)
        
        db.commit()
        
        # Send to n8n
        if N8N_WEBHOOK_URL:
            try:
                response = requests.post(N8N_WEBHOOK_URL, json={
                    "upload_id": upload_id,
                    "batch": payload_cargos
                })
                response.raise_for_status()
            except Exception as e:
                logging.error(f"Error calling n8n: {e}")
                for cargo in batch:
                    cargo.estado = JobStatus.ERROR
                    log = ProcessingLog(
                        upload_id=upload_id,
                        cargo_id=cargo.id,
                        level="ERROR",
                        message=f"Fallo al enviar a n8n: {str(e)}"
                    )
                    db.add(log)
                db.commit()
        else:
            logging.warning("N8N_WEBHOOK_URL not configured")

    upload.status = "completado" # This might be premature if n8n is async, 
    # but for now we mark the 'dispatch' as completed.
    db.commit()
