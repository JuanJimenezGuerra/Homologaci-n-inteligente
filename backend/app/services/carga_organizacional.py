import pandas as pd
import logging
from sqlalchemy.orm import Session
from ..models import Area, CargoOrganizacional, Proceso, Macroproceso

logger = logging.getLogger(__name__)

AREA_COL_MAP = {
    "nombre": "nombre",
    "nombre_corto": "nombre_corto",
    "tipo_area": "tipo_area",
    "descripcion": "descripcion",
    "objetivo": "objetivo",
    "responsable": "responsable",
    "proceso_id": "proceso_id",
    "sede_id": "sede_id",
    "area_padre_id": "area_padre_id",
}

CARGO_COL_MAP = {
    "codigo": "codigo",
    "nombre": "nombre",
    "nombre_estandarizado": "nombre_estandarizado",
    "area_id": "area_id",
    "empresa_id": "empresa_id",
    "jefe_cargo_id": "jefe_cargo_id",
    "nivel_organizacional": "nivel_organizacional",
    "tiene_personal_a_cargo": "tiene_personal_a_cargo",
    "cantidad_subordinados": "cantidad_subordinados",
    "sector": "sector",
    "modelo_operativo": "modelo_operativo",
    "ubicacion": "ubicacion",
    "modalidad": "modalidad",
    "mision": "mision",
    "objetivo": "objetivo",
    "proposito": "proposito",
    "responsabilidades_generales": "responsabilidades_generales",
    "funciones_clave": "funciones_clave",
    "formacion_requerida": "formacion_requerida",
    "conocimientos_generales": "conocimientos_generales",
    "experiencia": "experiencia",
    "competencias": "competencias",
}

def _limpiar_col(df):
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n") for c in df.columns]
    return df

def _bool_val(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("si", "s", "yes", "1", "true", "x")
    try:
        return bool(int(v))
    except (ValueError, TypeError):
        return False

def procesar_areas(df, db: Session, empresa_id: int = None, proceso_id_default: int = None) -> dict:
    df = _limpiar_col(df.copy())
    creados = 0
    errores = []
    for idx, row in df.iterrows():
        try:
            nombre = row.get("nombre")
            if pd.isna(nombre) or not str(nombre).strip():
                errores.append(f"Fila {idx+2}: nombre requerido")
                continue
            payload = {"nombre": str(nombre).strip()}
            for col, field in AREA_COL_MAP.items():
                val = row.get(col)
                if pd.notna(val) and str(val).strip():
                    payload[field] = str(val).strip() if not isinstance(val, (int, float)) else val
            if "proceso_id" not in payload and proceso_id_default:
                payload["proceso_id"] = proceso_id_default
            if not payload.get("proceso_id"):
                errores.append(f"Fila {idx+2}: '{nombre}' requiere proceso_id")
                continue
            existe = db.query(Area).filter(Area.nombre == payload["nombre"], Area.proceso_id == payload.get("proceso_id"), Area.deleted_at.is_(None)).first()
            if existe:
                errores.append(f"Fila {idx+2}: área '{nombre}' ya existe en este proceso")
                continue
            area = Area(**{k: v for k, v in payload.items() if hasattr(Area, k)})
            db.add(area)
            db.flush()
            creados += 1
        except Exception as e:
            db.rollback()
            errores.append(f"Fila {idx+2}: {str(e)[:100]}")
    return {"creados": creados, "errores": errores, "area_id_map": {}}


def procesar_cargos(df, db: Session, empresa_id: int = None) -> dict:
    df = _limpiar_col(df.copy())
    creados = 0
    errores = []
    for idx, row in df.iterrows():
        try:
            nombre = row.get("nombre")
            if pd.isna(nombre) or not str(nombre).strip():
                errores.append(f"Fila {idx+2}: nombre requerido")
                continue
            payload = {"nombre": str(nombre).strip()}
            for col, field in CARGO_COL_MAP.items():
                val = row.get(col)
                if pd.notna(val) and str(val).strip():
                    if field in ("tiene_personal_a_cargo",):
                        payload[field] = _bool_val(val)
                    elif field == "cantidad_subordinados":
                        try:
                            payload[field] = int(float(val))
                        except (ValueError, TypeError):
                            payload[field] = 0
                    else:
                        payload[field] = str(val).strip() if not isinstance(val, (int, float)) else val
            if "empresa_id" not in payload and empresa_id:
                payload["empresa_id"] = empresa_id
            if not payload.get("empresa_id"):
                errores.append(f"Fila {idx+2}: '{nombre}' requiere empresa_id")
                continue
            existe = db.query(CargoOrganizacional).filter(CargoOrganizacional.nombre == payload["nombre"], CargoOrganizacional.empresa_id == payload["empresa_id"], CargoOrganizacional.deleted_at.is_(None)).first()
            if existe:
                errores.append(f"Fila {idx+2}: cargo '{nombre}' ya existe en esta empresa")
                continue
            cargo = CargoOrganizacional(**{k: v for k, v in payload.items() if hasattr(CargoOrganizacional, k)})
            db.add(cargo)
            db.flush()
            creados += 1
        except Exception as e:
            db.rollback()
            errores.append(f"Fila {idx+2}: {str(e)[:100]}")
    return {"creados": creados, "errores": errores}


def procesar_archivo(file_path: str, db: Session, empresa_id: int = None) -> dict:
    resultado = {"areas": {"creados": 0, "errores": []}, "cargos": {"creados": 0, "errores": []}, "total_creados": 0}

    try:
        sheet_names = pd.ExcelFile(file_path).sheet_names
        if "Areas" in sheet_names:
            df_areas = pd.read_excel(file_path, sheet_name="Areas")
            resultado["areas"] = procesar_areas(df_areas, db, empresa_id=empresa_id)
            db.commit()
        if "Cargos" in sheet_names:
            df_cargos = pd.read_excel(file_path, sheet_name="Cargos")
            resultado["cargos"] = procesar_cargos(df_cargos, db, empresa_id=empresa_id)
            db.commit()
        resultado["total_creados"] = resultado["areas"]["creados"] + resultado["cargos"]["creados"]
    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando archivo: {e}")
        raise
    return resultado
