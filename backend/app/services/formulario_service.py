import os
import json
import logging
from datetime import date
from sqlalchemy.orm import Session
from typing import Optional, List
from ..models import (
    Empresa, PracticaCompensacion, PrimaExtralegal, CargoEmpresa,
    MasterCargo, Categoria, Nivel
)

logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURACION DE CRITERIOS DE HOMOLOGACION
# ==========================================

class CriteriosHomologacion:
    """Criterios configurables para personalizar la homologacion"""

    DEFAULT = {
        "priorizar_funciones": True,
        "priorizar_nivel": True,
        "considerar_tamano": True,
        "nivel_agresividad": "medio",
        "exigir_coincidencia_fuerte": False,
        "permitir_agrupaciones": True,
        "segundo_idioma_required": False,
    }

    @classmethod
    def get_default(cls) -> dict:
        return cls.DEFAULT.copy()

    @classmethod
    def validar(cls, criterios: dict) -> bool:
        validos = set(cls.DEFAULT.keys())
        return all(k in validos for k in criterios.keys())


# ==========================================
# PROCESO 1: FORMULARIO DE REQUERIMIENTOS
# ==========================================

def crear_empresa(db: Session, user_id: int, data: dict) -> Empresa:

    empresa = Empresa(
        user_id=user_id,
        nombre_empresa=data.get("nombre_empresa", ""),
        razon_social=data.get("razon_social"),
        nit=data.get("nit"),
        direccion=data.get("direccion"),
        telefono=data.get("telefono"),
        departamento=data.get("departamento"),
        ciudad=data.get("ciudad"),
        persona_contacto=data.get("persona_contacto"),
        cargo_contacto=data.get("cargo_contacto"),
        telefono_contacto=data.get("telefono_contacto"),
        email_contacto=data.get("email_contacto"),
        sector_economico=data.get("sector_economico"),
        actividad_economica=data.get("actividad_economica"),
        tipo_empresa=data.get("tipo_empresa"),
        principales_productos=data.get("principales_productos"),
        motivacion=data.get("motivacion"),
        num_personas_contratadas=data.get("num_personas_contratadas"),
        empleados_presenciales=data.get("empleados_presenciales"),
    )

    if data.get("fecha_diligenciamiento"):
        empresa.fecha_diligenciamiento = date.fromisoformat(data["fecha_diligenciamiento"])

    db.add(empresa)
    db.commit()
    db.refresh(empresa)

    logger.info(f"Empresa creada: {empresa.id} - {empresa.nombre_empresa}")
    return empresa


def guardar_practicas_compensacion(db: Session, empresa_id: int, data: dict) -> PracticaCompensacion:

    practica = PracticaCompensacion(
        empresa_id=empresa_id,
        tiene_estructura_salarial=data.get("tiene_estructura_salarial"),
        ultima_actualizacion=data.get("ultima_actualizacion"),
        metodologia_valoracion=data.get("metodologia_valoracion"),
        tiene_bonos_resultados=data.get("tiene_bonos_resultados"),
        bonos_resultados_cargos=data.get("bonos_resultados_cargos"),
        tiene_comisiones=data.get("tiene_comisiones"),
        comisiones_cargos=data.get("comisiones_cargos"),
        tiene_compensacion_flexible=data.get("tiene_compensacion_flexible"),
        compensacion_flexible_cargos=data.get("compensacion_flexible_cargos"),
    )

    db.add(practica)
    db.commit()
    db.refresh(practica)

    if data.get("primas"):
        for prima_data in data["primas"]:
            guardar_prima_extralegal(db, practica.id, prima_data)

    logger.info(f"Practicas guardadas para empresa {empresa_id}")
    return practica


def guardar_prima_extralegal(db: Session, practica_id: int, data: dict) -> PrimaExtralegal:

    prima = PrimaExtralegal(
        practica_id=practica_id,
        nombre_prima=data.get("nombre_prima", ""),
        tipo=data.get("tipo"),
        dias_salario=data.get("dias_salario"),
        es_constitutivo=data.get("es_constitutivo"),
        ene=data.get("ene"),
        feb=data.get("feb"),
        mar=data.get("mar"),
        abr=data.get("abr"),
        may=data.get("may"),
        jun=data.get("jun"),
        jul=data.get("jul"),
        ago=data.get("ago"),
        sep=data.get("sep"),
        oct=data.get("oct"),
        nov=data.get("nov"),
        dic=data.get("dic"),
    )

    db.add(prima)
    db.commit()
    db.refresh(prima)

    return prima


def guardar_cargo_empresa(db: Session, empresa_id: int, data: dict) -> CargoEmpresa:

    cargo = CargoEmpresa(
        empresa_id=empresa_id,
        numero=data.get("numero"),
        nombre_cargo=data.get("nombre_cargo", ""),
        num_personas=data.get("num_personas"),
        impacto_directo=data.get("impacto_directo"),
        tipo_impacto=data.get("tipo_impacto"),
        monto_anual=data.get("monto_anual"),
        tipo_contrato=data.get("tipo_contrato"),
        modalidad=data.get("modalidad"),
        cargo_jefe=data.get("cargo_jefe"),
        area=data.get("area"),
        descripcion=data.get("descripcion"),
        pacto=data.get("pacto"),
        tipo_salario=data.get("tipo_salario"),
        horas_mes=data.get("horas_mes"),
        pct_arl=data.get("pct_arl"),
        basico=data.get("basico"),
        cumplimiento_100=data.get("cumplimiento_100"),
        real_pagado=data.get("real_pagado"),
        concepto_2=data.get("concepto_2"),
        concepto_3=data.get("concepto_3"),
        concepto_5=data.get("concepto_5"),
        concepto_6=data.get("concepto_6"),
        concepto_7=data.get("concepto_7"),
        concepto_8=data.get("concepto_8"),
        cumplimiento_100_2=data.get("cumplimiento_100_2"),
        real_pagado_anio=data.get("real_pagado_anio"),
        bono_trimestral=data.get("bono_trimestral"),
        bono_antiguedad=data.get("bono_antiguedad"),
        columna16=data.get("columna16"),
        concepto_1=data.get("concepto_1"),
        concepto2=data.get("concepto2"),
        concepto3=data.get("concepto3"),
        concepto4=data.get("concepto4"),
        concepto5=data.get("concepto5"),
        prima_navidad=data.get("prima_navidad"),
        prima_vacaciones=data.get("prima_vacaciones"),
        columna10=data.get("columna10"),
        columna11=data.get("columna11"),
        prima_navidad_2=data.get("prima_navidad_2"),
        prima_vacaciones_2=data.get("prima_vacaciones_2"),
        columna124=data.get("columna124"),
    )

    db.add(cargo)
    db.commit()
    db.refresh(cargo)

    return cargo


def importar_cargos_desde_excel(db: Session, empresa_id: int, rows: List[dict]) -> int:

    count = 0
    for row in rows:
        try:
            guardar_cargo_empresa(db, empresa_id, row)
            count += 1
        except Exception as e:
            logger.error(f"Error importando cargo {row.get('nombre_cargo')}: {e}")

    logger.info(f"Importados {count} cargos para empresa {empresa_id}")
    return count


def obtener_empresa(db: Session, empresa_id: int) -> Optional[Empresa]:

    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    return empresa


def listar_cargos_empresa(db: Session, empresa_id: int) -> List[CargoEmpresa]:

    return db.query(CargoEmpresa).filter(CargoEmpresa.empresa_id == empresa_id).all()


# ==========================================
# CARGA DEL CATALOGO MAESTRO
# ==========================================

def cargar_master_cargos(db: Session, rows: List[dict]) -> int:

    count = 0
    for row in rows:
        cargo = MasterCargo(
            codigo_2017=row.get("codigo_2017"),
            nombre=row.get("nombre"),
            codigo_area=row.get("codigo_area"),
            area_general=row.get("area_general"),
            subarea=row.get("subarea"),
            area_especifica=row.get("area_especifica"),
            codigo_nivel=row.get("codigo_nivel"),
            nivel_actual=row.get("nivel_actual"),
            descripcion=row.get("descripcion"),
            reporta_a=row.get("reporta_a"),
            estudios_requeridos=row.get("estudios_requeridos"),
            experiencia_requerida=row.get("experiencia_requerida"),
            segundo_idioma=row.get("segundo_idioma"),
        )
        db.add(cargo)
        count += 1

    db.commit()
    logger.info(f"Cargados {count} master_cargos")
    return count


def buscar_cargo_master(db: Session, nombre: str, area: str = None) -> Optional[MasterCargo]:

    query = db.query(MasterCargo).filter(
        MasterCargo.nombre.ilike(f"%{nombre}%")
    )

    if area:
        query = query.filter(MasterCargo.area_general.ilike(f"%{area}%"))

    return query.first()


def cargar_categorias(db: Session, rows: List[dict]) -> int:

    count = 0
    for row in rows:
        cat = Categoria(
            categoria=row.get("categoria"),
            ruta_carrera_gerencial=row.get("ruta_carrera_gerencial"),
            ruta_carrera_individual=row.get("ruta_carrera_individual"),
            pista=row.get("pista"),
        )
        db.add(cat)
        count += 1

    for row_nivel in [
        {"categoria": 25, "nivel": "Presidente Global", "propuesta": "Ejecutivo"},
        {"categoria": 20, "nivel": "Vicepresidente", "propuesta": "Ejecutivo"},
        {"categoria": 15, "nivel": "Gerente Senior", "propuesta": "Gerencia Media"},
        {"categoria": 12, "nivel": "Coordinador", "propuesta": "Tactico"},
        {"categoria": 8, "nivel": "Supervisor", "propuesta": "Soporte"},
        {"categoria": 4, "nivel": "Auxiliar", "propuesta": "Operativo"},
    ]:
        nivel = Nivel(**row_nivel)
        db.add(nivel)

    db.commit()
    logger.info(f"Cargadas {count} categorias y niveles")
    return count


# ==========================================
# EXPORTACION A EXCEL
# ==========================================

def exportar_formulario_empresa(db: Session, empresa_id: int) -> dict:

    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        return {}

    return {
        "empresa": {
            "nombre": empresa.nombre_empresa,
            "nit": empresa.nit,
            "razon_social": empresa.razon_social,
            "direccion": empresa.direccion,
            "telefono": empresa.telefono,
            "departamento": empresa.departamento,
            "ciudad": empresa.ciudad,
            "persona_contacto": empresa.persona_contacto,
            "cargo_contacto": empresa.cargo_contacto,
            "email_contacto": empresa.email_contacto,
            "sector_economico": empresa.sector_economico,
            "actividad_economica": empresa.actividad_economica,
            "tipo_empresa": empresa.tipo_empresa,
            "num_personas": empresa.num_personas_contratadas,
        },
        "cargos": [
            {
                "nombre": c.nombre_cargo,
                "area": c.area,
                "descripcion": c.descripcion,
                "basico": c.basico,
                "modalidad": c.modalidad,
            }
            for c in empresa.cargos_empresa
        ]
    }
