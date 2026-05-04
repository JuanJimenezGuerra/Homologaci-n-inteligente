import os
import logging
import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from ..models import Empresa, PracticaCompensacion, PrimaExtralegal, CargoEmpresa, Cargo, Homologacion, Upload
from datetime import datetime

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
    "empleados con modalidad de teletrabajo": "empleados_teletrabajo",
    "empleados con modalidad de trabajo mixta": "empleados_mixta",
    "tipos de contratos": "tipos_contratos",
    "distribucion de los tipos": "distribucion_contratos",
    "como se distribuyen": "distribucion_contratos",
    "ventas sector real": "ventas_reales",
    "v. reales": "ventas_reales_valor",
    "v. presupuestadas": "ventas_presupuestadas_valor",
    "ingresos reales": "ingresos_reales",
    "ingresos presupuestados": "ingresos_presupuestados",
    "excedentes reales": "excedentes_reales",
    "excedentes presupuestados": "excedentes_presupuestados",
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


def procesar_excel_formulario(file_path: str, empresa_id: int = None) -> Dict:
    resultado = {
        "empresa": {},
        "practicas": {},
        "primas": [],
        "cargos": [],
        "listas": {},
        "niveles": [],
    }
    
    try:
        excel = pd.ExcelFile(file_path)
        hojas = excel.sheet_names
        logger.info(f"Hojas encontradas: {hojas}")
        
        hoja_datos = _encontrar_hoja(hojas, ["Datos generales", "informacion general"])
        if hoja_datos:
            df = pd.read_excel(file_path, sheet_name=hoja_datos, header=None)
            resultado["empresa"] = _procesar_datos_generales(df)
        
        if "Practicas de compensacion" in [_clean_col_name(h) for h in hojas] or \
           "Prácticas de compensación" in hojas:
            hoja_practicas = _encontrar_hoja(hojas, ["Practicas", "compensacion"])
            if hoja_practicas:
                df = pd.read_excel(file_path, sheet_name=hoja_practicas)
                resultado["practicas"] = _procesar_practicas(df)
                resultado["primas"] = _procesar_primas(df)
        
        hoja_cargo = _encontrar_hoja(hojas, ["Informacion por cargo", "Información por cargo"])
        if hoja_cargo:
            df_cargo = pd.read_excel(file_path, sheet_name=hoja_cargo, header=None)
            resultado["cargos"] = _procesar_cargos_completo(df_cargo)
        
        hoja_lista = _encontrar_hoja(hojas, ["LISTA", "Lista"])
        if hoja_lista:
            df = pd.read_excel(file_path, sheet_name=hoja_lista)
            resultado["listas"] = _procesar_listas(df)
        
        hoja_nivel = _encontrar_hoja(hojas, ["Explicacion", "tipologia"])
        if hoja_nivel:
            df = pd.read_excel(file_path, sheet_name=hoja_nivel)
            resultado["niveles"] = _procesar_niveles(df)
        
        logger.info(f"Excel procesado: {len(resultado['cargos'])} cargos")
        
    except Exception as e:
        logger.error(f"Error procesando Excel: {e}")
        raise
    
    return resultado


def _encontrar_hoja(hojas: List[str], opciones: List[str]) -> Optional[str]:
    for hoja in hojas:
        hoja_clean = _clean_col_name(hoja)
        for opt in opciones:
            opt_clean = _clean_col_name(opt)
            if opt_clean in hoja_clean:
                return hoja
    return None


def _procesar_datos_generales(df: pd.DataFrame) -> Dict:
    datos = {}
    for row_idx in range(len(df)):
        row_vals = [df.iloc[row_idx, col_idx] for col_idx in range(len(df.columns))]
        
        label_col = None
        valor_col = None
        valor_alt = None
        
        for col_idx in range(len(row_vals)):
            val = row_vals[col_idx]
            if pd.notna(val) and str(val).strip() and str(val).strip().upper() not in ["NAN", "NONE"]:
                label_clean = _clean_col_name(val)
                
                if label_col is None:
                    label_col = col_idx
                
                if label_col is not None and col_idx > label_col:
                    if valor_col is None:
                        valor_col = col_idx
                        valor_alt = col_idx
                    else:
                        valor_alt = col_idx
        
        if label_col is None or valor_col is None:
            continue
        
        label = str(df.iloc[row_idx, label_col]).strip()
        label_clean = _clean_col_name(label)
        valor = str(df.iloc[row_idx, valor_col]).strip() if valor_col < len(row_vals) else None
        
        if valor and pd.notna(valor) and str(valor).strip() and str(valor).strip().upper() not in ["NAN", "NONE"]:
            for key, field in DATOS_GENERALES_MAP.items():
                if key in label_clean:
                    if field in ["num_personas_contratadas", "empleados_presenciales", "empleados_teletrabajo",
                                 "empleados_mixta", "ventas_reales_valor", "ventas_presupuestadas_valor",
                                 "ingresos_reales", "ingresos_presupuestados", "excedentes_reales", "excedentes_presupuestados"]:
                        datos[field] = _parsear_numero(valor)
                    else:
                        datos[field] = valor
                    break
    
    if not datos.get("nombre_empresa"):
        for row_idx in range(len(df)):
            for col_idx in range(len(df.columns)):
                val = df.iloc[row_idx, col_idx]
                if pd.notna(val) and "razon social" in _clean_col_name(val):
                    if col_idx + 1 < len(df.columns):
                        next_val = df.iloc[row_idx, col_idx + 1]
                        if pd.notna(next_val):
                            datos["nombre_empresa"] = str(next_val).strip()
                            break
    
    return datos


def _procesar_practicas(df: pd.DataFrame) -> Dict:
    practicas = {}
    for _, row in df.iterrows():
        pregunta = str(row.iloc[1]).lower() if len(row) > 1 else ""
        respuesta = str(row.iloc[2]) if len(row) > 2 else ""
        
        if "estructura salarial" in pregunta:
            practicas["tiene_estructura_salarial"] = respuesta
        elif "ultima actualizacion" in _clean_col_name(pregunta):
            practicas["ultima_actualizacion"] = _parsear_numero(respuesta)
        elif "metodologia" in _clean_col_name(pregunta) or "valoracion" in _clean_col_name(pregunta):
            practicas["metodologia_valoracion"] = respuesta
        elif "bonos" in _clean_col_name(pregunta) and "resultados" in _clean_col_name(pregunta):
            practicas["tiene_bonos_resultados"] = respuesta
        elif "comisiones" in _clean_col_name(pregunta):
            practicas["tiene_comisiones"] = respuesta
    
    return practicas


def _procesar_primas(df: pd.DataFrame) -> List[Dict]:
    primas = []
    for _, row in df.iterrows():
        nombre = str(row.iloc[1]) if len(row) > 1 else ""
        if pd.notna(nombre) and "prima" in _clean_col_name(nombre):
            prima = {
                "nombre_prima": nombre,
                "tipo": str(row.iloc[2]) if len(row) > 2 else "",
                "dias_salario": _parsear_numero(str(row.iloc[3])) if len(row) > 3 else 0,
                "es_constitutivo": str(row.iloc[4]) if len(row) > 4 else "",
            }
            meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
            for i, mes in enumerate(meses):
                if len(row) > 5 + i:
                    prima[mes] = str(row.iloc[5 + i])
            primas.append(prima)
    
    return primas


def _procesar_cargos_completo(df: pd.DataFrame) -> List[Dict]:
    cargos = []
    
    header_idx = 0
    for idx in range(len(df)):
        row_str = " ".join([_clean_col_name(x) for x in df.iloc[idx] if pd.notna(x)])
        if "nombre del cargo" in row_str:
            header_idx = idx
            break
    
    headers = [str(x).strip() for x in df.iloc[header_idx].tolist()]
    
    for idx in range(header_idx + 1, len(df)):
        row = df.iloc[idx]
        
        nombre = row.iloc[3] if len(row) > 3 else None
        if nombre is None or pd.isna(nombre):
            continue
        
        nombre_str = str(nombre).strip()
        if not nombre_str or nombre_str.upper() in ["NAN", ""]:
            continue
        
        nombre_str = nombre_str.upper()
        
        cargo = {"nombre_cargo": nombre_str}
        
        for i in range(len(row)):
            if i >= len(headers):
                continue
            val = row.iloc[i]
            if pd.isna(val) or str(val).strip().upper() == "NAN":
                continue
            
            col_name = headers[i]
            if not col_name or col_name.upper() == "NAN":
                continue
            
            mapped = _map_field(col_name)
            key = mapped if mapped else _clean_col_name(col_name)
            cargo[key] = _limpiar_valor(val)
        
        cargos.append(cargo)
    
    logger.info(f"Procesados {len(cargos)} cargos del Excel con columnas completas")
    return cargos


def _procesar_cargos(df: pd.DataFrame) -> List[Dict]:
    cargos = []
    headers = df.iloc[0].tolist() if len(df) > 0 else []
    mapeo = _crear_mapeo_campos()
    
    for idx in range(1, len(df)):
        row = df.iloc[idx]
        if pd.isna(row.iloc[0]) or str(row.iloc[0]) == "nan":
            continue
        
        cargo = {}
        for col_idx, valor in enumerate(row):
            if col_idx < len(headers):
                header = str(headers[col_idx]).strip().lower()
                campo = mapeo.get(header, f"campo_{col_idx}")
                cargo[campo] = _limpiar_valor(valor)
        
        if cargo.get("nombre_cargo"):
            cargos.append(cargo)
    
    logger.info(f"Procesados {len(cargos)} cargos del Excel")
    return cargos


def _crear_mapeo_campos() -> Dict:
    return {
        "#": "numero",
        "id": "id",
        "nombre del cargo": "nombre_cargo",
        "nombre del cargo ": "nombre_cargo",
        "numero de personas que ocupan el cargo": "num_personas",
        "tiene impacto directo en ingresos/egresos? (si / no)": "impacto_directo",
        "responsables de ingresos o egresos?": "tipo_impacto",
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
        "valor por cumplimiento al 100%": "cumplimiento_100_2",
        "real pagado ultimo anio": "real_pagado_anio",
        "bono trimestral": "bono_trimestral",
        "bono por antiguedad": "bono_antiguedad",
        "prima extralegal de navidad": "prima_navidad",
        "prima extralegal de vacaciones": "prima_vacaciones",
    }


def _procesar_listas(df: pd.DataFrame) -> Dict:
    listas = {}
    for _, row in df.iterrows():
        mes = str(row.iloc[0]).strip() if len(row) > 0 else ""
        modalidad = str(row.iloc[3]).strip() if len(row) > 3 else ""
        
        if pd.notna(mes) and mes not in ["nan", "", "Meses"]:
            if "meses" not in listas:
                listas["meses"] = []
            listas["meses"].append(mes)
        
        if pd.notna(modalidad) and modalidad not in ["nan", "", "Modalidad"]:
            if "modalidades" not in listas:
                listas["modalidades"] = []
            if modalidad not in listas["modalidades"]:
                listas["modalidades"].append(modalidad)
    
    return listas


def _procesar_niveles(df: pd.DataFrame) -> List[Dict]:
    niveles = []
    for _, row in df.iterrows():
        if len(row) >= 2:
            tipologia = str(row.iloc[0]).strip()
            descripcion = str(row.iloc[1]).strip() if len(row) > 1 else ""
            
            if pd.notna(tipologia) and tipologia not in ["nan", "", "Tipologia"]:
                niveles.append({
                    "tipologia": tipologia,
                    "descripcion": descripcion,
                })
    
    return niveles


def _limpiar_valor(valor):
    if pd.isna(valor):
        return None
    val = str(valor).strip()
    if val in ["nan", "None", ""]:
        return None
    try:
        return int(float(val.replace(",", "").replace(".", "")))
    except:
        pass
    try:
        return float(val.replace(",", "").replace(".", ""))
    except:
        return val


def guardar_en_db(db: Session, empresa_id: int, data: Dict) -> Dict:
    resultados = {
        "empresa_guardada": False,
        "practicas_guardadas": False,
        "primas_guardadas": 0,
        "cargos_guardados": 0,
    }
    
    if empresa_id:
        empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
        if empresa:
            for key, value in data.get("empresa", {}).items():
                if hasattr(empresa, key) and value:
                    setattr(empresa, key, value)
            db.commit()
            resultados["empresa_guardada"] = True
    
    if data.get("practicas") and empresa_id:
        practicas = PracticaCompensacion(
            empresa_id=empresa_id,
            **data["practicas"]
        )
        db.add(practicas)
        db.commit()
        db.refresh(practicas)
        resultados["practicas_guardadas"] = True
        
        for prima_data in data.get("primas", []):
            prima = PrimaExtralegal(
                practica_id=practicas.id,
                **prima_data
            )
            db.add(prima)
            resultados["primas_guardadas"] += 1
        db.commit()
    
    for cargo_data in data.get("cargos", []):
        cargo_dict = {}
        for key, value in cargo_data.items():
            if value is not None and hasattr(CargoEmpresa, key):
                cargo_dict[key] = value
        
        if cargo_dict.get("nombre_cargo"):
            cargo = CargoEmpresa(
                empresa_id=empresa_id,
                **cargo_dict
            )
            db.add(cargo)
            resultados["cargos_guardados"] += 1
    
    db.commit()
    logger.info(f"Datos guardados: {resultados}")
    
    return resultados


def procesar_formulario_requerimientos(db: Session, file_path: str, empresa_nombre: str = None) -> Dict:
    try:
        data = procesar_excel_formulario(file_path)
        
        empresa = Empresa(
            nombre_empresa=data.get("empresa", {}).get("nombre_empresa", empresa_nombre or "EMPRESA"),
            razon_social=data.get("empresa", {}).get("razon_social"),
            nit=data.get("empresa", {}).get("nit"),
            direccion=data.get("empresa", {}).get("direccion"),
            telefono=data.get("empresa", {}).get("telefono"),
            departamento=data.get("empresa", {}).get("departamento"),
            ciudad=data.get("empresa", {}).get("ciudad"),
            persona_contacto=data.get("empresa", {}).get("persona_contacto"),
            cargo_contacto=data.get("empresa", {}).get("cargo_contacto"),
            telefono_contacto=data.get("empresa", {}).get("telefono_contacto"),
            email_contacto=data.get("empresa", {}).get("email_contacto"),
            sector_economico=data.get("empresa", {}).get("sector_economico"),
            actividad_economica=data.get("empresa", {}).get("actividad_economica"),
            tipo_empresa=data.get("empresa", {}).get("tipo_empresa"),
            principales_productos=data.get("empresa", {}).get("principales_productos"),
            motivacion=data.get("empresa", {}).get("motivacion"),
            num_personas_contratadas=data.get("empresa", {}).get("num_personas_contratadas"),
            empleados_presenciales=data.get("empresa", {}).get("empleados_presenciales"),
        )
        db.add(empresa)
        db.flush()
        
        upload = Upload(
            empresa_id=empresa.id,
            nombre_archivo=os.path.basename(file_path),
            status="completado",
        )
        db.add(upload)
        db.flush()
        
        for cargo_data in data.get("cargos", []):
            nombre_cargo = cargo_data.get("nombre_cargo", "")
            if not nombre_cargo:
                continue
            
            area = cargo_data.get("area", "N/A")
            descripcion = cargo_data.get("descripcion")
            
            datos_excel = {
                "nombre_cargo": nombre_cargo,
                "area": area,
            }
            for key, val in cargo_data.items():
                if key not in ["nombre_cargo", "area"]:
                    datos_excel[key] = val
            
            cargo = Cargo(
                upload_id=upload.id,
                nombre_cargo=nombre_cargo.upper(),
                area=area.upper() if area else "N/A",
                descripcion_empresa=descripcion,
                estado="PENDIENTE",
            )
            db.add(cargo)
            db.flush()
            
            homo = Homologacion(
                cargo_id=cargo.id,
                cargo_homologado="PENDIENTE",
                datos_excel=datos_excel,
            )
            db.add(homo)
        
        db.commit()
        
        return {
            "empresa_id": empresa.id,
            "upload_id": upload.id,
            "cargos_creados": len(data.get("cargos", [])),
            "empresa": data.get("empresa", {}),
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando formulario: {e}")
        raise e
