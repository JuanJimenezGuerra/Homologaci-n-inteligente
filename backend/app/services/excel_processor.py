import pandas as pd
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, Upload
import logging

logger = logging.getLogger(__name__)

# Nombres de columnas según el Excel "Formulario de requerimientos"
COLUMN_NAMES = [
    "A_empresa", "B_nit", "C_ciudad", "D_nombre_cargo", "E_codigo_cargo",
    "F_nivel_cargo", "G_dependencia", "H_jefe_inmediato", "I_personas_cargo",
    "J_tipo_contrato", "K_salario", "L_area", "M_horario", "N_formacion",
    "O_experiencia", "P_conocimientos", "Q_habilidades", "R_responsabilidades",
    "S_mision", "T_funcion1", "U_funcion2", "V_funcion3", "W_funcion4",
    "X_funcion5", "Y_funcion6", "Z_funcion7", "AA_funcion8", "AB_funcion9",
    "AC_funcion10", "AD_relaciones_internas", "AE_relaciones_externas",
    "AF_decision1", "AG_decision2", "AH_decision3", "AI_impacto",
    "AJ_confidencialidad", "AK_manejo_dinero", "AL_supervision",
    "AM_viajes", "AN_condiciones", "AO_riesgos", "AP_epp",
    "AQ_indicadores", "AR_metas", "AS_observaciones"
]

def process_requirements_excel(file_path: str, upload_id: int, db: Session):
    """
    Procesa 'Formulario de requerimientos.xlsx'
    Pestaña: 'Información de cargo'
    Lee desde la fila 5 (header en fila 4, datos desde fila 5)
    Columnas A -> AS (índices 0 a 44)
    Columna D (índice 3) -> nombre_cargo
    Columna L (índice 11) -> area
    """
    try:
        xl = pd.ExcelFile(file_path)
        logger.info(f"Pestañas encontradas: {xl.sheet_names}")

        # Buscar la pestaña correcta de forma flexible
        sheet_name = None
        for s in xl.sheet_names:
            s_clean = s.lower().replace("ó", "o").replace("ú", "u").replace("á", "a")
            if "informaci" in s_clean and "cargo" in s_clean:
                sheet_name = s
                break

        if not sheet_name:
            # Si no encuentra la pestaña específica, usar la primera
            sheet_name = xl.sheet_names[0]
            logger.warning(f"No se encontró 'Información de cargo', usando pestaña: {sheet_name}")

        # Leer el Excel: la fila 4 tiene los headers, datos desde fila 5
        # skiprows=4 significa que salta las primeras 4 filas y toma la 5 como header
        df = pd.read_excel(file_path, sheet_name=sheet_name, skiprows=4, header=None)

        logger.info(f"Dimensiones del DataFrame: {df.shape}")
        logger.info(f"Primeras columnas: {df.iloc[:2, :5].to_string()}")

        # Limitar a 45 columnas (A-AS)
        max_cols = min(df.shape[1], 45)
        df = df.iloc[:, :max_cols]

        cargos_created = 0
        for idx, row in df.iterrows():
            # Columna D = índice 3 = nombre del cargo
            nombre = row.iloc[3] if len(row) > 3 else None
            # Columna L = índice 11 = área
            area = row.iloc[11] if len(row) > 11 else None

            # Saltar filas vacías
            if nombre is None or pd.isna(nombre) or str(nombre).strip() == "" or str(nombre).strip().upper() == "NAN":
                continue

            nombre_str = str(nombre).strip().upper()
            area_str = str(area).strip().upper() if area is not None and not pd.isna(area) else "N/A"

            # Construir diccionario con todos los datos (A-AS)
            datos_excel = {}
            for col_idx in range(max_cols):
                # Usar nombre descriptivo si está disponible, sino la letra de columna
                if col_idx < len(COLUMN_NAMES):
                    key = COLUMN_NAMES[col_idx]
                else:
                    key = f"col_{col_idx}"

                val = row.iloc[col_idx]
                if val is None or (isinstance(val, float) and pd.isna(val)):
                    datos_excel[key] = None
                else:
                    datos_excel[key] = str(val).strip()

            # Crear el cargo
            cargo = Cargo(
                upload_id=upload_id,
                nombre_cargo=nombre_str,
                area=area_str,
                estado="PENDIENTE"
            )
            db.add(cargo)
            db.flush()  # Obtener el ID

            # Crear la homologación vacía con los datos del Excel
            homo = Homologacion(
                cargo_id=cargo.id,
                cargo_homologado="PENDIENTE",
                datos_excel=datos_excel
            )
            db.add(homo)

            cargos_created += 1

        if cargos_created == 0:
            raise ValueError(
                f"No se encontraron cargos válidos en la pestaña '{sheet_name}'. "
                f"Verifica que el archivo tenga datos desde la fila 5 y que la columna D contenga el nombre del cargo."
            )

        db.commit()
        logger.info(f"✅ Procesados {cargos_created} cargos del upload {upload_id}")
        return cargos_created

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error procesando Excel: {e}", exc_info=True)
        raise e
