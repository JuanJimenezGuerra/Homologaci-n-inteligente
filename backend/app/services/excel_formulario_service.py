import os
import logging
import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Dict
from ..models import Empresa, PracticaCompensacion, PrimaExtralegal, CargoEmpresa
from datetime import datetime

logger = logging.getLogger(__name__)


def procesar_excel_formulario(file_path: str, empresa_id: int = None) -> Dict:
    """
    Procesar archivo Excel del Formulario de Requerimientos.
    
    Lee todas las pestañas y extrae los datos:
    - Datos Generales
    - Prácticas Compensación
    - Información por Cargo
    - LISTA
    - Explicación Tipología y Niveles
    - Listas
    """
    
    resultado = {
        "empresa": {},
        "practicas": {},
        "primas": [],
        "cargos": [],
        "listas": {},
        "niveles": [],
    }
    
    try:
        # Leer todas las hojas del Excel
        excel = pd.ExcelFile(file_path)
        hojas = excel.sheet_names
        logger.info(f"Hojas encontradas: {hojas}")
        
        # === 1. DATOS GENERALES (primera pestaña) ===
        if "Datos generales" in hojas or "Datos generales" in [h.lower() for h in hojas]:
            df = pd.read_excel(file_path, sheet_name=0)
            resultado["empresa"] = _procesar_datos_generales(df)
        
        # === 2. PRÁCTICAS DE COMPENSACIÓN ===
        if "Prácticas de compensación" in hojas or "Prácticas" in [h.lower() for h in hojas]:
            df = pd.read_excel(file_path, sheet_name="Prácticas de compensación")
            resultado["practicas"] = _procesar_practicas(df)
            resultado["primas"] = _procesar_primas(df)
        
        # === 3. INFORMACIÓN POR CARGO (más importante) ===
        hoja_cargo = _encontrar_hoja(hojas, ["Información por cargo", "información por cargo"])
        if hoja_cargo:
            df = pd.read_excel(file_path, sheet_name=hoja_cargo)
            resultado["cargos"] = _procesar_cargos(df)
        
        # === 4. LISTAS ===
        hoja_lista = _encontrar_hoja(hojas, ["LISTA", "Lista"])
        if hoja_lista:
            df = pd.read_excel(file_path, sheet_name=hoja_lista)
            resultado["listas"] = _procesar_listas(df)
        
        # === 5. EXPLICACIÓN TIPOLOGÍA Y NIVELES ===
        hoja_nivel = _encontrar_hoja(hojas, ["Explicación", "tipología"])
        if hoja_nivel:
            df = pd.read_excel(file_path, sheet_name=hoja_nivel)
            resultado["niveles"] = _procesar_niveles(df)
        
        logger.info(f"Excel procesado: {len(resultado['cargos'])} cargos")
        
    except Exception as e:
        logger.error(f"Error procesando Excel: {e}")
        raise
    
    return resultado


def _encontrar_hoja(hojas: List[str], opciones: List[str]) -> str:
    """Encontrar nombre de hoja que coincida con opciones"""
    for hoja in hojas:
        for opt in opciones:
            if opt.lower() in hoja.lower():
                return hoja
    return None


def _procesar_datos_generales(df: pd.DataFrame) -> Dict:
    """Procesar pestaña de Datos Generales"""
    datos = {}
    
    # Buscar campos por nombre en las filas
    for _, row in df.iterrows():
        valor = str(row.iloc[2]) if len(row) > 2 else ""
        if pd.notna(valor) and valor != "nan" and valor != "":
            # Mapeo de campos comunes
            campo = str(row.iloc[1]).lower().strip() if len(row) > 1 else ""
            
            if "empresa" in campo:
                datos["nombre_empresa"] = valor
            elif "nit" in campo:
                datos["nit"] = valor
            elif "razón" in campo or "social" in campo:
                datos["razon_social"] = valor
            elif "dirección" in campo or "direccion" in campo:
                datos["direccion"] = valor
            elif "teléfono" in campo or "telefono" in campo:
                datos["telefono"] = valor
            elif "departamento" in campo:
                datos["departamento"] = valor
            elif "ciudad" in campo:
                datos["ciudad"] = valor
            elif "contacto" in campo and "persona" not in campo:
                datos["persona_contacto"] = valor
            elif "cargo" in campo and "contacto" not in campo:
                datos["cargo_contacto"] = valor
            elif "email" in campo or "correo" in campo:
                datos["email_contacto"] = valor
            elif "sector" in campo:
                datos["sector_economico"] = valor
            elif "actividad" in campo:
                datos["actividad_economica"] = valor
            elif "tipo de empresa" in campo:
                datos["tipo_empresa"] = valor
            elif "personas contratadas" in campo or "numero" in campo:
                datos["num_personas_contratadas"] = _parsear_numero(valor)
            elif "presencial" in campo:
                datos["empleados_presenciales"] = _parsear_numero(valor)
    
    return datos


def _procesar_practicas(df: pd.DataFrame) -> Dict:
    """Procesar prácticas de compensación"""
    practicas = {}
    
    for _, row in df.iterrows():
        pregunta = str(row.iloc[1]).lower() if len(row) > 1 else ""
        respuesta = str(row.iloc[2]) if len(row) > 2 else ""
        
        if "estructura salarial" in pregunta:
            practicas["tiene_estructura_salarial"] = respuesta
        elif "última actualización" in pregunta or "actualización" in pregunta:
            practicas["ultima_actualizacion"] = _parsear_numero(respuesta)
        elif "metodología" in pregunta or "valoración" in pregunta:
            practicas["metologia_valoracion"] = respuesta
        elif "bonos" in pregunta and "resultados" in pregunta:
            practicas["tiene_bonos_resultados"] = respuesta
        elif "comisiones" in pregunta:
            practicas["tiene_comisiones"] = respuesta
    
    return practicas


def _procesar_primas(df: pd.DataFrame) -> List[Dict]:
    """Procesar primas extralegales"""
    primas = []
    
    # Buscar la sección de primas en el DataFrame
    for _, row in df.iterrows():
        nombre = str(row.iloc[1]) if len(row) > 1 else ""
        if pd.notna(nombre) and "prima" in nombre.lower():
            prima = {
                "nombre_prima": nombre,
                "tipo": str(row.iloc[2]) if len(row) > 2 else "",
                "dias_salario": _parsear_numero(str(row.iloc[3])) if len(row) > 3 else 0,
                "es_constitutivo": str(row.iloc[4]) if len(row) > 4 else "",
            }
            # Meses (columnas 5-16)
            meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
            for i, mes in enumerate(meses):
                if len(row) > 5 + i:
                    prima[mes] = str(row.iloc[5 + i])
            primas.append(prima)
    
    return primas


def _procesar_cargos(df: pd.DataFrame) -> List[Dict]:
    """Procesar información por cargo - LA MÁS IMPORTANTE"""
    cargos = []
    
    # La primera fila contiene los headers
    headers = df.iloc[0].tolist() if len(df) > 0 else []
    
    # Mapear headers a nombres de campo
    mapeo = _crear_mapeo_campos()
    
    # Procesar cada fila (desde la fila 1,skip header)
    for idx in range(1, len(df)):
        row = df.iloc[idx]
        
        # Skip filas vacías
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
    """Crear mapeo de headers Excel a campos del modelo"""
    return {
        "#": "numero",
        "id": "id",
        "nombre del cargo": "nombre_cargo",
        "nombre del cargo ": "nombre_cargo",
        "número de personas que ocupan el cargo": "num_personas",
        "¿tiene impacto directo en ingresos/egresos? (si / no)": "impacto_directo",
        "responsables de ingresos o egresos?": "tipo_impacto",
        "monto anual por el que tienen impacto directo": "monto_anual",
        "tipo de contrato": "tipo_contrato",
        "modalidad de trabajo": "modalidad",
        "cargo del jefe inmediato": "cargo_jefe",
        "área": "area",
        "descripción del cargo": "descripcion",
        "pacto / convención": "pacto",
        "tipo de salario": "tipo_salario",
        "horas al mes": "horas_mes",
        "porcentaje de arl": "pct_arl",
        "básico": "basico",
        "valor por cumplimiento al 100%": "cumplimiento_100",
        "real pagado (promedio mensual)": "real_pagado",
        "concepto 2": "concepto_2",
        "concepto 3": "concepto_3",
        "concepto 5": "concepto_5",
        "concepto 6": "concepto_6",
        "concepto 7": "concepto_7",
        "concepto 8": "concepto_8",
        "valor por cumplimiento al 100%": "cumplimiento_100_2",
        "real pagado ultimo año": "real_pagado_anio",
        "bono trimestral": "bono_trimestral",
        "bono por antigüedad": "bono_antiguedad",
        "prima extralegal de navidad": "prima_navidad",
        "prima extralegal de vacaciones": "prima_vacaciones",
    }


def _procesar_listas(df: pd.DataFrame) -> Dict:
    """Procesar listas de validación"""
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
    """Procesar tipología y niveles"""
    niveles = []
    
    for _, row in df.iterrows():
        if len(row) >= 2:
            tipologia = str(row.iloc[0]).strip()
            descripcion = str(row.iloc[1]).strip() if len(row) > 1 else ""
            
            if pd.notna(tipologia) and tipologia not in ["nan", "", "Tipología"]:
                niveles.append({
                    "tipologia": tipologia,
                    "descripcion": descripcion,
                })
    
    return niveles


def _parsear_numero(valor) -> int:
    """Convertir valor a número"""
    if pd.isna(valor) or valor == "nan":
        return 0
    try:
        return int(float(str(valor).replace(",", "")))
    except:
        return 0


def _limpiar_valor(valor):
    """Limpiar valor de celda"""
    if pd.isna(valor):
        return None
    val = str(valor).strip()
    if val in ["nan", "None", ""]:
        return None
    # Intentar convertir a número
    try:
        return int(float(val.replace(",", "")))
    except:
        pass
    try:
        return float(val.replace(",", ""))
    except:
        return val


def guardar_en_db(db: Session, empresa_id: int,data: Dict) -> Dict:
    """Guardar todos los datos procesados en la base de datos"""
    
    resultados = {
        "empresa_guardada": False,
        "practicas_guardadas": False,
        "primas_guardadas": 0,
        "cargos_guardados": 0,
    }
    
    # 1. Actualizar empresa
    if empresa_id:
        empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
        if empresa:
            for key, value in data.get("empresa", {}).items():
                if hasattr(empresa, key) and value:
                    setattr(empresa, key, value)
            db.commit()
            resultados["empresa_guardada"] = True
    
    # 2. Guardar prácticas
    if data.get("practicas") and empresa_id:
        practicas = PracticaCompensacion(
            empresa_id=empresa_id,
            **data["practicas"]
        )
        db.add(practicas)
        db.commit()
        db.refresh(practicas)
        resultados["practicas_guardadas"] = True
        
        # 3. Guardar primas extralegales
        for prima_data in data.get("primas", []):
            prima = PrimaExtralegal(
                practica_id=practicas.id,
                **prima_data
            )
            db.add(prima)
            resultados["primas_guardadas"] += 1
        db.commit()
    
    # 4. Guardar cargos
    for cargo_data in data.get("cargos", []):
        # Filtrar solo campos válidos
        cargo_dict = {}
        for key, value in cargo_data.items():
            if value is not None and key in CargoEmpresa.__table__.columns:
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