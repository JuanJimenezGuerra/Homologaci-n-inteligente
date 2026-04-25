import pandas as pd
from sqlalchemy.orm import Session
from ..models import MasterDescription
import logging

def process_master_excel(file_path: str, db: Session):
    """
    Processes 'Herramienta de homologación de cargos.xlsx'
    Sheet: 'Descripciones'
    """
    try:
        xl = pd.ExcelFile(file_path)
        
        # Buscar la pestaña Descripciones (case-insensitive)
        sheet_name = None
        for s in xl.sheet_names:
            if "descripcion" in s.lower():
                sheet_name = s
                break
                
        if not sheet_name:
            raise ValueError("No se encontró la pestaña 'Descripciones' en el archivo maestro.")
            
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        # Limpiar datos anteriores
        db.query(MasterDescription).delete()
        
        # Encontrar el índice de las columnas clave
        cols = [str(c).lower().strip() for c in df.columns]
        
        nombre_idx = -1
        desc_idx = -1
        area_idx = -1
        
        for i, c in enumerate(cols):
            if c == "nombre" or "nombre del cargo" in c:
                nombre_idx = i
            elif "descripci" in c or "funciones" in c:
                desc_idx = i
            elif "area" in c or "área" in c:
                area_idx = i
                
        if nombre_idx == -1:
            raise ValueError("No se encontró la columna 'NOMBRE' en la pestaña Descripciones.")
            
        cargos_agregados = 0
        for _, row in df.iterrows():
            nombre = str(row.iloc[nombre_idx]).strip() if nombre_idx != -1 else ""
            if not nombre or nombre.lower() == "nan":
                continue
                
            descripcion = str(row.iloc[desc_idx]).strip() if desc_idx != -1 else ""
            area = str(row.iloc[area_idx]).strip() if area_idx != -1 else ""
            
            master_entry = MasterDescription(
                nombre_cargo=nombre.upper(),
                descripcion=descripcion,
                area=area.upper()
            )
            db.add(master_entry)
            cargos_agregados += 1
        
        db.commit()
        return cargos_agregados
    except Exception as e:
        db.rollback()
        logging.error(f"Error processing master excel: {e}")
        raise e
