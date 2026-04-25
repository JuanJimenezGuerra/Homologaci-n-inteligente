import os
import requests
import json
import time
from sqlalchemy.orm import Session
from ..models import Cargo, Valoracion, ProcessingLog

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

def start_valoracion_batch(upload_id: int, db: Session):
    """Procesa la valoración de todos los cargos de un upload"""
    
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    
    # Si hay N8N_WEBHOOK_URL, usar n8n
    if N8N_WEBHOOK_URL:
        _process_with_n8n(upload_id, cargos, db)
    else:
        # Fallback: usar OpenRouter directo
        _process_with_openrouter_direct(upload_id, cargos, db)

def _process_with_n8n(upload_id: int, cargos: list, db: Session):
    """Envía cargos a n8n para valoración"""
    
    cargos_data = []
    for c in cargos:
        cargos_data.append({
            "id": c.id,
            "nombre": c.nombre_cargo,
            "area": c.area,
            "cargo_homologado": c.homologacion.cargo_homologado if c.homologacion else "",
            "descripcion": c.descripcion_empresa or ""
        })
    
    payload = {
        "cargos": cargos_data,
        "upload_id": upload_id,
        "backend_url": BACKEND_URL
    }
    
    try:
        # Llamar al webhook de n8n para valoración
        requests.post(N8N_WEBHOOK_URL + "/valoracion", json=payload, timeout=10)
        # n8n procesará y devolverá los resultados al webhook /webhook/n8n-valoracion
    except Exception as e:
        print(f"Error llamando a n8n para valoración: {e}")

def _process_with_openrouter_direct(upload_id: int, cargos: list, db: Session):
    """Procesamiento directo con OpenRouter si no hay n8n"""
    
    if not OPENROUTER_API_KEY:
        print("No hay OPENROUTER_API_KEY ni N8N_WEBHOOK_URL configurado")
        return
    
    for cargo in cargos:
        try:
            resultado = _valorar_cargo_con_openrouter(cargo)
            
            # Guardar en DB
            val = db.query(Valoracion).filter(Valoracion.cargo_id == cargo.id).first()
            if not val:
                val = Valoracion(cargo_id=cargo.id)
                db.add(val)
            
            val.conocimientos = resultado.get("conocimientos")
            val.experiencia = resultado.get("experiencia")
            val.habilidad_gerencial = resultado.get("habilidad_gerencial")
            val.rol_cargo = resultado.get("rol_cargo")
            val.contacto = resultado.get("contacto")
            val.frecuencia = resultado.get("frecuencia")
            val.contenido_relaciones = resultado.get("contenido_relaciones")
            val.complejidad_conceptual = resultado.get("complejidad_conceptual")
            val.tendencia_cc = resultado.get("tendencia_cc")
            val.guias_apoyo = resultado.get("guias_apoyo")
            val.tendencia_ga = resultado.get("tendencia_ga")
            val.impacto = resultado.get("impacto")
            val.autonomia = resultado.get("autonomia")
            val.magnitud = resultado.get("magnitud")
            val.criterio_1 = resultado.get("criterio_1", 0)
            val.criterio_2 = resultado.get("criterio_2", 0)
            val.criterio_3 = resultado.get("criterio_3", 0)
            
            db.commit()
            time.sleep(1)  # Rate limiting
            
        except Exception as e:
            print(f"Error valorando cargo {cargo.id}: {e}")
            continue

def _valorar_cargo_con_openrouter(cargo) -> dict:
    """Llama a OpenRouter para valorar un cargo"""
    
    prompt = f"""Eres experto en valoración de cargos bajo metodología HAY/SHR.

CARGO A VALORAR:
- Nombre: {cargo.nombre_cargo}
- Área: {cargo.area}
- Cargo Homologado: {cargo.homologacion.cargo_homologado if cargo.homologacion else 'N/A'}
- Descripción: {cargo.descripcion_empresa or 'No disponible'}

FACTORES A EVALUAR (responde SOLO con JSON):

Factor 1 - Conocimiento & Habilidad:
- conocimientos: A-H (A=básico, H=experto)
- experiencia: - (sin exp) / o (media) / + (alta)
- habilidad_gerencial: I-VII (I=sin staff, VII=director general)
- rol_cargo: 1-4 (1=operativo, 4=estratégico)

Factor 2 - Comunicación:
- contacto: A (interno básico) / B (externo coordinación) / C (representación corporativa)
- frecuencia: 1-4 (1=ocasional, 4=constante)
- contenido_relaciones: I-V (I=intercambio info, V=negociación estratégica)

Factor 3 - Solución de Problemas:
- complejidad_conceptual: 1-5 (1=rutina, 5=abstracción compleja)
- tendencia_cc: texto libre breve
- guias_apoyo: A-H (A=instrucciones detalladas, H=sin guías)
- tendencia_ga: texto libre breve

Factor 4 - Responsabilidad:
- impacto: I-IV (I=asesoría, IV=dirección total)
- autonomia: A-G (A=supervisión constante, G=autonomía total)
- magnitud: 1-14 (presupuesto/personas: 1=mínimo, 14=corporativo)

Criticidad (0 o 1):
- criterio_1: ¿Es difícil reemplazar? (0=no, 1=sí)
- criterio_2: ¿Impacto crítico en resultados? (0=no, 1=sí)
- criterio_3: ¿Conocimiento especializado único? (0=no, 1=sí)

Responde SOLO con JSON sin explicaciones:
{{
  "conocimientos": "C",
  "experiencia": "o",
  "habilidad_gerencial": "III",
  "rol_cargo": "2",
  "contacto": "B",
  "frecuencia": "3",
  "contenido_relaciones": "III",
  "complejidad_conceptual": "3",
  "tendencia_cc": "problemas variables",
  "guias_apoyo": "D",
  "tendencia_ga": "procedimientos estandarizados",
  "impacto": "II",
  "autonomia": "D",
  "magnitud": "5",
  "criterio_1": 0,
  "criterio_2": 1,
  "criterio_3": 0
}}"""

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": BACKEND_URL,
            "X-Title": "SHR Valoracion"
        },
        json={
            "model": "openrouter/free",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 600
        },
        timeout=45
    )
    
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    
    # Limpiar markdown
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    
    return json.loads(content)
