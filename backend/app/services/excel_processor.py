import pandas as pd
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, Upload
import logging

logger = logging.getLogger(__name__)

def process_requirements_excel(file_path: str, upload_id: int, db: Session):
    try:
        xl = pd.ExcelFile(file_path)
        
        sheet_name = xl.sheet_names[0]
        for s in xl.sheet_names:
            s_clean = s.lower().replace("ó", "o").replace("ú", "u").replace("á", "a")
            if "informaci" in s_clean and "cargo" in s_clean:
                sheet_name = s
                break

        # Buscar encabezado
        df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
        
        header_idx = 0
        for idx, row in df_raw.iterrows():
            row_str = " ".join([str(x).lower() for x in row if not pd.isna(x)])
            if "cargo" in row_str and ("nombre" in row_str or "denominaci" in row_str or "nivel" in row_str):
                header_idx = idx
                break
                
        # Leer usando el índice del header
        df = pd.read_excel(file_path, sheet_name=sheet_name, skiprows=header_idx)
        
        # Trabajar con índices de columnas en lugar de nombres para evitar colisiones por nombres duplicados
        columns = list(df.columns)
        
        title_idx = 0
        for i, col in enumerate(columns):
            col_str = str(col).lower()
            if "cargo" in col_str and ("nombre" in col_str or "denominaci" in col_str):
                title_idx = i
                break
                
        area_idx = -1
        for i, col in enumerate(columns):
            if "area" in str(col).lower() or "área" in str(col).lower():
                area_idx = i
                break

        cargos_created = 0
        for idx, row in df.iterrows():
            # Extraer de forma segura por índice, no por nombre
            nombre = row.iloc[title_idx] if title_idx < len(row) else None
            
            # Chequeo seguro de NaN para evitar el error de Series
            if nombre is None or pd.isna(nombre):
                continue
                
            nombre_str = str(nombre).strip()
            if not nombre_str or nombre_str.upper() == "NAN":
                continue
                
            nombre_str = nombre_str.upper()
            
            area_str = "N/A"
            if area_idx >= 0 and area_idx < len(row):
                area_val = row.iloc[area_idx]
                if not pd.isna(area_val):
                    area_str = str(area_val).strip().upper()
            
            # Extraer todo a JSON usando el nombre original de la columna (haciendo cast a string seguro)
            datos_excel = {}
            for i, col in enumerate(columns):
                val = row.iloc[i] if i < len(row) else None
                # Validar si es nan de forma segura
                is_nan = False
                try:
                    is_nan = pd.isna(val)
                except:
                    pass # Si falla es porque no es un scalar, lo tratamos como string normal
                
                col_name = str(col).strip()
                if not col_name or col_name.lower() == "nan":
                    col_name = f"Columna_{i+1}"
                    
                datos_excel[col_name] = None if is_nan else str(val).strip()
                
            cargo = Cargo(upload_id=upload_id, nombre_cargo=nombre_str, area=area_str, estado="PENDIENTE")
            db.add(cargo)
            db.flush()
            
            homo = Homologacion(cargo_id=cargo.id, cargo_homologado="PENDIENTE", datos_excel=datos_excel)
            db.add(homo)
            cargos_created += 1

        if cargos_created == 0:
            raise ValueError("No se encontraron cargos válidos. Verifica el formato del Excel.")

        db.commit()
        return cargos_created

    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando Excel: {e}")
        raise e
