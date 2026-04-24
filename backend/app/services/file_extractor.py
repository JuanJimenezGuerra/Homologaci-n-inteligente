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
    Processes multiple files (PDF, DOCX, XLSX) and tries to map them
    to existing cargos in the upload.
    """
    # Get all cargos for this upload
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    if not cargos:
        return 0
    
    cargo_names = {c.id: c.nombre_cargo for c in cargos}
    mapped_count = 0

    for file_obj in files:
        filename = file_obj.filename
        content = file_obj.file.read()
        
        # 1. Extract text based on extension
        text = ""
        ext = os.path.splitext(filename)[1].lower()
        try:
            if ext == '.pdf':
                text = extract_text_from_pdf(content)
            elif ext in ['.docx', '.doc']:
                text = extract_text_from_docx(content)
            elif ext in ['.xlsx', '.xls']:
                df = pd.read_excel(io.BytesIO(content))
                text = df.to_string()
            
            if not text.strip():
                continue

            # 2. Map filename to cargo name using fuzzy matching
            # We strip extension for better matching
            clean_filename = os.path.splitext(filename)[0]
            best_match = process.extractOne(clean_filename, cargo_names)
            
            if best_match and best_match[1] > 80: # 80% similarity threshold
                cargo_id = best_match[2]
                cargo = db.query(Cargo).get(cargo_id)
                cargo.descripcion_empresa = text
                mapped_count += 1
                
        except Exception as e:
            print(f"Error processing file {filename}: {e}")
            continue
            
    db.commit()
    return mapped_count
