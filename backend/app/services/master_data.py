import pandas as pd
from sqlalchemy.orm import Session
from ..models import MasterDescription
import logging

def process_master_excel(file_path: str, db: Session):
    """
    Processes 'Herramienta de homologación de cargos.xlsx'
    Sheet: 'descripciones'
    """
    try:
        df = pd.read_excel(file_path, sheet_name="descripciones")
        
        # Clean existing master data (optional, but good for refresh)
        db.query(MasterDescription).delete()
        
        for _, row in df.iterrows():
            # Adjust column names based on the actual Excel structure if provided, 
            # otherwise assume some standard names or mapping
            # The user didn't specify column names for this file, just the sheet.
            # I'll use common sense or generic mapping for now.
            master_entry = MasterDescription(
                nombre_cargo=str(row.get('cargo', row.get('nombre_cargo', ''))).strip(),
                descripcion=str(row.get('descripcion', '')).strip(),
                area=str(row.get('area', '')).strip()
            )
            db.add(master_entry)
        
        db.commit()
        return len(df)
    except Exception as e:
        db.rollback()
        logging.error(f"Error processing master excel: {e}")
        raise e
