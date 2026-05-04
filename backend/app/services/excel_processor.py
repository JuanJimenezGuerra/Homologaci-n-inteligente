import pandas as pd
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion, Upload, Empresa
import logging
import os

logger = logging.getLogger(__name__)

CARGO_FIELD_MAP = {
    "#": "numero",
    "id": "id_cargo",
    "nombre del cargo": "nombre_cargo",
    "numero de personas que ocupan el cargo": "num_personas",
    "tiene impacto directo en ingresos/egresos": "impacto_directo",
    "responsables de ingresos o egresos": "tipo_impacto",
    "monto anual por el que tienen impacto directo": "monto_anual",
    "tipo de contrato": "tipo_contrato",
    "modalidad de trabajo": "modalidad",
    "cargo del jefe inmediato": "cargo_jefe",
    "area": "area",
    "descripcion del cargo": "descripcion",
    "pacto / convencion": "pacto",
    "tipo de salario": "tipo_salario",
    "horas al mes": "horas_mes",
    "porcentaje de arl": "pct_arl",
    "basico": "basico",
    "valor por cumplimiento al 100%": "cumplimiento_100",
    "real pagado (promedio mensual)": "real_pagado",
    "concepto 2": "concepto_2",
    "concepto 3": "concepto_3",
    "concepto 5": "concepto_5",
    "concepto 6": "concepto_6",
    "concepto 7": "concepto_7",
    "concepto 8": "concepto_8",
    "valor por cumplimiento al 100%.": "cumplimiento_100_2",
    "real pagado ultimo a": "real_pagado_anio",
    "bono trimestral": "bono_trimestral",
    "bono por antig": "bono_antiguedad",
    "columna16": "columna16",
    "concepto 1": "concepto_1",
    "concepto2": "concepto2",
    "concepto3": "concepto3",
    "concepto1 ": "concepto4",
    "concepto2 ": "concepto5",
    "concepto3 ": "concepto6",
    "concepto4 ": "concepto7",
    "prima extralegal de navidad": "prima_navidad",
    "prima extralegal de vacaciones": "prima_vacaciones",
    "columna10": "columna10",
    "columna11": "columna11",
    "prima extralegal de navidad2": "prima_navidad_2",
    "prima extralegal de vacaciones2": "prima_vacaciones_2",
    "columna124": "columna124",
}

DATOS_GENERALES_MAP = {
    "fecha de diligenciamiento": "fecha_diligenciamiento",
    "consultor": "consultor",
    "nombre de la empresa": "nombre_empresa",
    "razon social": "razon_social",
    "nit": "nit",
    "direccion": "direccion",
    "telefono": "telefono",
    "departamento": "departamento",
    "ciudad": "ciudad",
    "persona que diligencia": "persona_contacto",
    "cargo": "cargo_contacto",
    "telefono del contacto": "telefono_contacto",
    "email": "email_contacto",
    "sector economico": "sector_economico",
    "actividad economica": "actividad_economica",
    "tipo de empresa": "tipo_empresa",
    "principales productos": "principales_productos",
    "motivo": "motivacion",
    "cuantas personas": "num_personas_contratadas",
    "empleados con modalidad de trabajo presencial": "empleados_presenciales",
}


def _clean_col_name(name):
    if not name or pd.isna(name):
        return ""
    n = str(name).lower().strip()
    n = n.replace("\n", " ").replace("  ", " ")
    for c in ["á", "à", "â", "ä"]:
        n = n.replace(c, "a")
    for c in ["é", "è", "ê", "ë"]:
        n = n.replace(c, "e")
    for c in ["í", "ì", "î", "ï"]:
        n = n.replace(c, "i")
    for c in ["ó", "ò", "ô", "ö"]:
        n = n.replace(c, "o")
    for c in ["ú", "ù", "û", "ü"]:
        n = n.replace(c, "u")
    return n


def _map_field(col_name):
    cleaned = _clean_col_name(col_name)
    for key, value in CARGO_FIELD_MAP.items():
        if key in cleaned:
            return value
    return None


def _parsear_numero(valor):
    if valor is None or pd.isna(valor):
        return None
    try:
        s = str(valor).replace(".", "").replace(",", ".")
        return float(s)
    except:
        return None


def process_requirements_excel(file_path: str, upload_id: int, db: Session):
    print(f"=== process_requirements_excel called ===")
    print(f"file_path: {file_path}")
    print(f"upload_id: {upload_id}")
    print(f"file exists: {os.path.exists(file_path)}")
    try:
        xl = pd.ExcelFile(file_path)

        # Buscar la pestana "Informacion por cargo"
        sheet_name = None
        for s in xl.sheet_names:
            s_clean = _clean_col_name(s)
            if "informacion" in s_clean and "cargo" in s_clean:
                sheet_name = s
                break

        if not sheet_name:
            sheet_name = xl.sheet_names[0]

        df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

        # Encontrar la fila de headers (busca "nombre del cargo")
        header_idx = 4
        for idx in range(len(df)):
            row_str = " ".join([_clean_col_name(x) for x in df.iloc[idx] if pd.notna(x)])
            if "nombre del cargo" in row_str:
                header_idx = idx
                break

        headers = df.iloc[header_idx].tolist()

        print(f"=== Sheet: {sheet_name}, Header row: {header_idx}")
        print(f"=== Headers: {[h for h in headers if pd.notna(h) and str(h).strip()][:10]}...")

        cargos_created = 0
        for idx in range(header_idx + 1, len(df)):
            row = df.iloc[idx]

            nombre = row.iloc[3] if len(row) > 3 else None
            if nombre is None or pd.isna(nombre):
                continue

            nombre_str = str(nombre).strip()
            if not nombre_str or nombre_str.upper() in ["NAN", ""]:
                continue

            nombre_str = nombre_str.upper()

            area_str = "N/A"
            if len(row) > 11 and pd.notna(row.iloc[11]):
                area_str = str(row.iloc[11]).strip().upper()

            descripcion_str = None
            if len(row) > 12 and pd.notna(row.iloc[12]):
                descripcion_str = str(row.iloc[12]).strip()

            datos_excel = {"nombre_cargo": nombre_str, "area": area_str}
            if descripcion_str:
                datos_excel["descripcion"] = descripcion_str

            for i, col in enumerate(headers):
                if i >= len(row):
                    continue
                val = row.iloc[i]
                if pd.isna(val) or str(val).strip().upper() == "NAN":
                    continue
                col_name = str(col).strip()
                if not col_name or col_name.upper() == "NAN":
                    col_name = f"Columna_{i+1}"

                mapped = _map_field(col_name)
                key = mapped if mapped else _clean_col_name(col_name)
                datos_excel[key] = str(val).strip()

            cargo = Cargo(
                upload_id=upload_id,
                nombre_cargo=nombre_str,
                area=area_str,
                descripcion_empresa=descripcion_str,
                estado="PENDIENTE",
            )
            db.add(cargo)
            db.flush()

            homo = Homologacion(cargo_id=cargo.id, cargo_homologado="PENDIENTE", datos_excel=datos_excel)
            db.add(homo)
            cargos_created += 1

        if cargos_created == 0:
            raise ValueError("No se encontraron cargos validos. Verifica el formato del Excel.")

        db.commit()
        print(f"=== Excel processed: {cargos_created} cargos created ===")
        return cargos_created

    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando Excel: {e}")
        raise e


def procesar_datos_generales(file_path: str, empresa: str, db: Session) -> int:
    """
    Lee la pestana 'Datos generales' y crea/actualiza el registro de Empresa.
    Retorna el empresa_id.
    """
    try:
        xl = pd.ExcelFile(file_path)

        sheet_name = None
        for s in xl.sheet_names:
            s_clean = _clean_col_name(s)
            if "datos generales" in s_clean or "informacion general" in s_clean:
                sheet_name = s
                break

        if not sheet_name:
            return None

        df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

        datos = {}
        for row_idx in range(len(df)):
            label = df.iloc[row_idx, 1] if len(df.columns) > 1 else None
            valor = df.iloc[row_idx, 3] if len(df.columns) > 3 else None
            if pd.isna(valor):
                valor = df.iloc[row_idx, 6] if len(df.columns) > 6 else None

            if label is None or pd.isna(label):
                continue

            label_clean = _clean_col_name(label)

            for key, field in DATOS_GENERALES_MAP.items():
                if key in label_clean and pd.notna(valor):
                    datos[field] = str(valor).strip()
                    break

        if not datos.get("nombre_empresa"):
            datos["nombre_empresa"] = empresa.upper()

        from ..models import Empresa
        empresa_obj = Empresa(
            nombre_empresa=datos.get("nombre_empresa", empresa.upper()),
            razon_social=datos.get("razon_social"),
            nit=datos.get("nit"),
            direccion=datos.get("direccion"),
            telefono=datos.get("telefono"),
            departamento=datos.get("departamento"),
            ciudad=datos.get("ciudad"),
            persona_contacto=datos.get("persona_contacto"),
            cargo_contacto=datos.get("cargo_contacto"),
            telefono_contacto=datos.get("telefono_contacto"),
            email_contacto=datos.get("email_contacto"),
            sector_economico=datos.get("sector_economico"),
            actividad_economica=datos.get("actividad_economica"),
            tipo_empresa=datos.get("tipo_empresa"),
            principales_productos=datos.get("principales_productos"),
            motivacion=datos.get("motivacion"),
            num_personas_contratadas=_parsear_numero(datos.get("num_personas_contratadas")),
            empleados_presenciales=_parsear_numero(datos.get("empleados_presenciales")),
        )

        db.add(empresa_obj)
        db.commit()
        db.refresh(empresa_obj)

        return empresa_obj.id

    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando datos generales: {e}")
        return None
