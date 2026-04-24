import pandas as pd
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, Upload
import logging

logger = logging.getLogger(__name__)

def process_requirements_excel(file_path: str, upload_id: int, db: Session):
    """
    Procesador universal de Excel.
    Busca dinámicamente la fila de encabezados y las columnas clave.
    """
    try:
        xl = pd.ExcelFile(file_path)
        
        # 1. Determinar la mejor pestaña
        sheet_name = xl.sheet_names[0]
        for s in xl.sheet_names:
            s_clean = s.lower().replace("ó", "o").replace("ú", "u").replace("á", "a")
            if "informaci" in s_clean and "cargo" in s_clean:
                sheet_name = s
                break

        logger.info(f"Usando pestaña: {sheet_name}")

        # 2. Leer crudo para detectar la fila de encabezado
        df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
        
        header_idx = 0
        for idx, row in df_raw.iterrows():
            row_str = " ".join([str(x).lower() for x in row if not pd.isna(x)])
            # Si una fila tiene estas palabras clave, es muy probable que sea el header
            if "cargo" in row_str and ("nombre" in row_str or "denominaci" in row_str or "nivel" in row_str):
                header_idx = idx
                break
                
        # 3. Leer el DataFrame con el encabezado correcto
        df = pd.read_excel(file_path, sheet_name=sheet_name, skiprows=header_idx)
        
        # Limpiar nombres de columnas
        df.columns = [str(c).strip() for c in df.columns]
        columns = list(df.columns)
        
        # 4. Detectar columnas clave dinámicamente
        title_col = columns[0] # Por defecto la primera
        for col in columns:
            col_str = str(col).lower()
            if "cargo" in col_str and ("nombre" in col_str or "denominaci" in col_str):
                title_col = col
                break
                
        area_col = None
        for col in columns:
            if "area" in str(col).lower() or "área" in str(col).lower():
                area_col = col
                break

        logger.info(f"Columna de cargo detectada: '{title_col}'")
        
        cargos_created = 0
        for idx, row in df.iterrows():
            nombre = row[title_col] if title_col in df.columns else None
            
            # Saltar filas vacías
            if pd.isna(nombre) or str(nombre).strip() == "" or str(nombre).strip().upper() == "NAN":
                continue
                
            nombre_str = str(nombre).strip().upper()
            area_str = str(row[area_col]).strip().upper() if area_col and area_col in df.columns and not pd.isna(row[area_col]) else "N/A"
            
            # Extraer todas las columnas como diccionario
            datos_excel = {}
            for col in columns:
                val = row[col]
                # Limpiar floats que son NaN o NaT
                if pd.isna(val):
                    datos_excel[str(col)] = None
                else:
                    datos_excel[str(col)] = str(val).strip()
                
            cargo = Cargo(
                upload_id=upload_id,
                nombre_cargo=nombre_str,
                area=area_str,
                estado="PENDIENTE"
            )
            db.add(cargo)
            db.flush()
            
            homo = Homologacion(
                cargo_id=cargo.id,
                cargo_homologado="PENDIENTE",
                datos_excel=datos_excel
            )
            db.add(homo)
            cargos_created += 1

        if cargos_created == 0:
            raise ValueError(f"No se pudieron extraer cargos válidos de la pestaña {sheet_name}.")

        db.commit()
        logger.info(f"✅ Procesados {cargos_created} cargos del upload {upload_id}")
        return cargos_created

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error procesando Excel: {e}")
        raise e
