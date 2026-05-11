import PyPDF2
import docx
import pandas as pd
import io
import os
from thefuzz import process
from sqlalchemy.orm import Session
from ..models import Cargo

def extract_text_from_pdf(file_bytes):
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

def extract_text_from_docx(file_bytes):
    doc = docx.Document(io.BytesIO(file_bytes))
    text = "\n".join([para.text for para in doc.paragraphs])
    return text

def process_extra_descriptions(upload_id: int, files: list, db: Session):
    """
    Processes multiple files (PDF, DOCX, XLSX) and creates NEW cargos from them.
    The filename (without extension) becomes the cargo name.
    These cargos are marked with area='DESCRIPCION_ANEXA' to distinguish them from requirements cargos.
    """
    mapped_count = 0
    created_cargos = []

    for file_obj in files:
        filename = file_obj.filename
        content = file_obj.file.read()
        
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.pdf', '.docx', '.doc', '.xlsx', '.xls']:
            continue

        try:
            # Extract text based on extension
            text = ""
            if ext == '.pdf':
                text = extract_text_from_pdf(content)
            elif ext in ['.docx', '.doc']:
                text = extract_text_from_docx(content)
            elif ext in ['.xlsx', '.xls']:
                df = pd.read_excel(io.BytesIO(content))
                text = df.to_string()
            
            if not text.strip():
                continue

            # Use filename (without extension) as cargo name
            cargo_nombre = os.path.splitext(filename)[0].strip()
            if not cargo_nombre:
                continue

            # Check if cargo already exists for this upload with same name
            existing = db.query(Cargo).filter(
                Cargo.upload_id == upload_id,
                Cargo.nombre_cargo == cargo_nombre
            ).first()

            if existing:
                # Update existing cargo description
                existing.descripcion_empresa = text
                # Mark as from extra description if not already
                if existing.area == 'PENDIENTE' or not existing.area:
                    existing.area = 'DESCRIPCION_ANEXA'
            else:
                # Create new cargo from extra description file
                new_cargo = Cargo(
                    upload_id=upload_id,
                    nombre_cargo=cargo_nombre,
                    area='DESCRIPCION_ANEXA',  # Mark as from extra description
                    descripcion_empresa=text,
                    estado='PENDIENTE'
                )
                db.add(new_cargo)
                created_cargos.append(cargo_nombre)

            mapped_count += 1
                    
        except Exception as e:
            print(f"Error processing file {filename}: {e}")
            continue
            
    db.commit()
    return mapped_count
