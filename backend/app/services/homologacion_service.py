import os
import json
import logging
import re
import difflib
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from anthropic import Anthropic
from ..models import (
    CargoEmpresa, MasterCargo, HomologacionCargo, Categoria
)

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DEFAULT_MODEL = "claude-3-haiku-20240307"


# ==========================================
# PROCESO 2: HOMOLOGACIÓN CON CRITERIOS
# ==========================================

def homologar_cargo(
    db: Session,
    cargo_empresa_id: int,
    criterios: Dict = None,
    tamano_empresa: str = "mediana",
    sector: str = None
) -> HomologacionCargo:
    """
    Homologar un cargo usando IA con criterios configurables.
    
    Los criterios permiten personalizar la homologación:
    - priorizar_funciones: usar descripción vs nombre
    - priorizar_nivel: considerar nivel jerárquico
    - nivel_agresividad: conservador/medio/agresivo
    - exigir_coincidencia_fuerte: solo matches altos
    """
    
    cargo = db.query(CargoEmpresa).filter(CargoEmpresa.id == cargo_empresa_id).first()
    if not cargo:
        raise ValueError(f"Cargo {cargo_empresa_id} no encontrado")
    
    # Usar criterios por defecto
    criterios = criterios or {
        "priorizar_funciones": True,
        "priorizar_nivel": True,
        "considerar_tamano": True,
        "nivel_agresividad": "medio",
    }
    
    # 1. Verificar coincidencia exacta
    match_exacto = _buscar_exacto(cargo.nombre_cargo, cargo.area)
    if match_exacto:
        return _crear_homologacion(db, cargo, match_exacto, "Coincidencia exacta", 1.0)
    
    # 2. Búsqueda por similitud
    match_fuzzy = _buscar_fuzzy(cargo.nombre_cargo, cargo.area)
    if match_fuzzy:
        confianza = 0.8
        if criterios.get("nivel_agresividad") == "conservador":
            confianza = 0.9
        elif criterios.get("nivel_agresividad") == "agresivo":
            confianza = 0.6
        
        if match_fuzzy[1] >= confianza:
            return _crear_homologacion(db, cargo, match_facto[0], "Similitud alta", match_fuzzy[1])
    
    # 3. Usar IA si no hay match claro
    if ANTHROPIC_API_KEY:
        resultado_ia = _homologar_con_ia(
            cargo, criterios, tamano_empresa, sector
        )
        if resultado_ia:
            return resultado_ia
    
    # 4. Sin coincidencia
    return _crear_homologacion(
        db, cargo, None, "Sin coincidencia en catálogo", 0.0
    )


def homologar_lote(
    db: Session,
    empresa_id: int,
    criterios: Dict = None,
    tamano_empresa: str = "mediana",
    setor: str = None
) -> List[HomologacionCargo]:
    """Homologar todos los cargos de una empresa"""
    
    cargos = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id,
        CargoEmpresa.estado == "PENDIENTE"
    ).all()
    
    resultados = []
    for cargo in cargos:
        try:
            result = homologar_cargo(
                db, cargo.id, criterios, tamano_empresa, setor
            )
            resultados.append(result)
            
            # Actualizar estado del cargo
            cargo.estado = "HOMOLOGADO"
            db.commit()
            
        except Exception as e:
            logger.error(f"Error homologando {cargo.nombre_cargo}: {e}")
    
    return resultados


def _buscar_exacto(nombre: str, area: str = None) -> Optional[MasterCargo]:
    """Búsqueda exacta en el catálogo"""
    
    return None  # Por implementar con DB


def _buscar_fuzzy(nombre: str, area: str = None) -> Optional[tuple]:
    """Búsqueda por similitud"""
    
    # Por implementar con DB
    return None


def _crear_homologacion(
    db: Session,
    cargo: CargoEmpresa,
    master: Optional[MasterCargo],
    justificacion: str,
    confianza: float
) -> HomologacionCargo:
    """Crear registro de homologación"""
    
    homologacion = HomologacionCargo(
        cargo_empresa_id=cargo.id,
        cargo_valorado=cargo.nombre_cargo,
        cargo_homologado_1=master.nombre if master else "SIN COINCIDENCIA",
        descripcion_1=master.descripcion if master else None,
        observaciones=justificacion,
    )
    
    if master:
        homologacion.master_cargo_id = master.id
    
    db.add(homologacion)
    db.commit()
    db.refresh(homologacion)
    
    return homologacion


def _homologar_con_ia(
    cargo: CargoEmpresa,
    criterios: Dict,
    tamano_empresa: str,
    setor: str = None
) -> Optional[HomologacionCargo]:
    """Homologar usando Anthropic con criterios"""
    
    if not ANTHROPIC_API_KEY:
        return None
    
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    # Construir prompt con criterios
    criterio_text = _construir_prompt_criterios(criterios)
    
    prompt = f"""Eres experto en RRHH y homologación de cargos en Colombia.

**CARGO A HOMOLOGAR:**
- Nombre: {cargo.nombre_cargo}
- Área: {cargo.area}
- Descripción: {cargo.descripcion or 'No disponible'}
- Jefe inmediato: {cargo.cargo_jefe or 'No especificado'}
- Modalidad: {cargo.modalidad}

**CONTEXTO DE LA EMPRESA:**
- Tamaño: {tamano_empresa}
- Sector: {sector or 'No especificado'}

**CRITERIOS DE HOMOLOGACIÓN:**
{criterio_text}

Responde SOLO con JSON (sin texto adicional):
{{
  "cargo_homologado": "NOMBRE DEL CARGO EN CATÁLOGO",
  "alternativa": "NOMBRE ALTERNO (opcional)",
  "confianza": 0.0-1.0,
  "explicacion": "breve justificación",
  "nivel": "jerarquía del cargo",
  "area": "área funcional"
}}"""

    try:
        response = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=500,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}]
        )
        
        content = response.content[0].text.strip()
        
        # Limpiar JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        data = json.loads(content)
        
        # Buscar cargo en catálogo (falta implementar)
        # Por ahora retornar resultado directo
        
        return data
        
    except Exception as e:
        logger.error(f"Error en homologación IA: {e}")
        return None


def _construir_prompt_criterios(criterios: Dict) -> str:
    """Construir texto de criterios para el prompt"""
    
    lines = []
    
    if criterios.get("priorizar_funciones"):
        lines.append("- Priorizar la descripción del cargo sobre el nombre")
    
    if criterios.get("priorizar_nivel"):
        lines.append("- Considerar el nivel jerárquico del cargo")
    
    nivel = criterios.get("nivel_agresividad", "medio")
    if nivel == "conservador":
        lines.append("- Ser conservador: solo aceptar matches con confianza > 0.9")
        lines.append("- Si no hay coincidencia clara, marcar como 'SIN COINCIDENCIA'")
    elif nivel == "agresivo":
        lines.append("- Ser agresivo: aceptar matches con confianza > 0.5")
    
    if criterios.get("exigir_coincidencia_fuerte"):
        lines.append("- Exigir coincidencia fuerte en responsabilidades principales")
    
    if criterios.get("considerar_tamano"):
        lines.append("- Considerar el tamaño de la empresa para el nivel")
    
    return "\n".join(lines) if lines else "- Usar criterios estándar de RRHH"


# ==========================================
# CONFIGURACIÓN DE CRITERIOS
# ==========================================

def guardar_criterios(db: Session, empresa_id: int, criterios: Dict) -> bool:
    """Guardar configuración de criterios para una empresa"""
    
    empresa = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).first()
    
    # Guardar en campo JSON o tabla separada (por implementar)
    return True


def obtener_criterios(db: Session, empresa_id: int) -> Dict:
    """Obtener criterios guardados de una empresa"""
    
    return {
        "priorizar_funciones": True,
        "priorizar_nivel": True,
        "considerar_tamano": True,
        "nivel_agresividad": "medio",
    }


# ==========================================
# REPORTES DE HOMOLOGACIÓN
# ==========================================

def resumen_homologacion(db: Session, empresa_id: int) -> dict:
    """Resumen del estado de homologación"""
    
    cargos = db.query(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()
    
    total = len(cargos)
    homologados = sum(1 for c in cargos if c.estado == "HOMOLOGADO")
    pendientes = total - homologados
    
    return {
        "total": total,
        "homologados": homologados,
        "pendientes": pendientes,
        "porcentaje": round(homologados / total * 100, 1) if total > 0 else 0,
    }


def ExportarHomologaciones(db: Session, empresa_id: int) -> List[dict]:
    """Exportar результат de homologaciones"""
    
    resultados = db.query(HomologacionCargo).join(CargoEmpresa).filter(
        CargoEmpresa.empresa_id == empresa_id
    ).all()
    
    return [
        {
            "cargo": h.cargo_valorado,
            "homologado": h.cargo_homologado_1,
            "alternativa": h.cargo_homologado_2,
            "observaciones": h.observaciones,
            "editado": h.editado_manual,
        }
        for h in resultados
    ]