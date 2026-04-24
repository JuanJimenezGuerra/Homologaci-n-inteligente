import pandas as pd
from sqlalchemy.orm import Session
from ..models import Cargo, JobStatus, Upload
import logging

def process_requirements_excel(file_path: str, upload_id: int, db: Session):
    """
    Processes 'Formulario de requerimientos.xlsx'
    Sheet: 'Información de cargo'
    Read from row 5 (skip 4)
    Cols: A -> AS (0 to 44)
    Col D -> nombre_cargo
    Col L -> area
    """
    try:
        xl = pd.ExcelFile(file_path)
        # Buscar pestaña que contenga "Informaci" y "cargo" (sin importar mayúsculas/minúsculas)
        sheet_name = next((s for s in xl.sheet_names if "informaci" in s.lower() and "cargo" in s.lower()), None)
        
        if not sheet_name:
            print(f"Pestañas disponibles: {xl.sheet_names}")
            raise ValueError(f"No se encontró la pestaña 'Información de cargo'. Pestañas disponibles: {xl.sheet_names}")
            
        # Read excel, skip 4 rows
        df = pd.read_excel(file_path, sheet_name=sheet_name, skiprows=4)
        
        # Take first 45 columns
        df = df.iloc[:, :45]
        
        cargos_created = 0
        for _, row in df.iterrows():
            # Column D is index 3, Column L is index 11
            nombre = row.iloc[3]
            area = row.iloc[11]
            
            if pd.isna(nombre) or str(nombre).strip() == "":
                continue
                
            cargo = Cargo(
                upload_id=upload_id,
                nombre_cargo=str(nombre).strip().upper(),
                area=str(area).strip().upper() if not pd.isna(area) else "N/A",
                estado=JobStatus.PENDIENTE
            )
            db.add(cargo)
            cargos_created += 1
            
        db.commit()
        return cargos_created
    except Exception as e:
        db.rollback()
        logging.error(f"Error processing requirements excel: {e}")
        raise e
