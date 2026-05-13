from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from datetime import datetime
from ..database import get_db
from ..models import (
    SesionValoracion, ValoracionVersion, CargoOrganizacional, User, AuditLog,
    GrupoEmpresarial, Empresa, Regional, Sede, Macroproceso, Proceso, Area,
)
from ..database import get_db
from ..auth import get_current_user
from ..services.scoring_service import calcular_puntaje
from .organizacion import _serialize

router = APIRouter(prefix="/api/v1", tags=["Valoración - Sesiones"])


def _get_user_id(current_user) -> Optional[int]:
    return current_user.id if current_user else None


def _audit(db: Session, entidad: str, entidad_id: int, accion: str, user_id: int = None, antes: dict = None, despues: dict = None):
    log = AuditLog(
        usuario_id=user_id,
        entidad=entidad,
        entidad_id=entidad_id,
        accion=accion,
        antes=antes,
        despues=despues,
    )
    db.add(log)


ESTADOS_SESION_VALIDOS = ("EN_PROCESO", "PENDIENTE", "CANCELADA", "FINALIZADA", "APROBADA")
ESTADOS_VALORACION_VALIDOS = ("BORRADOR", "EN_REVISION", "APROBADA", "RECHAZADA", "DEFINITIVA", "HISTORICA")

TRANSICIONES_SESION = {
    "PENDIENTE": ["EN_PROCESO", "CANCELADA"],
    "EN_PROCESO": ["FINALIZADA", "CANCELADA", "PENDIENTE"],
    "FINALIZADA": ["APROBADA", "EN_PROCESO", "CANCELADA"],
    "APROBADA": [],
    "CANCELADA": ["PENDIENTE"],
}

TRANSICIONES_VALORACION = {
    "BORRADOR": ["EN_REVISION", "RECHAZADA"],
    "EN_REVISION": ["APROBADA", "RECHAZADA", "BORRADOR"],
    "APROBADA": ["DEFINITIVA", "EN_REVISION"],
    "RECHAZADA": ["EN_REVISION", "BORRADOR"],
    "DEFINITIVA": ["HISTORICA"],
    "HISTORICA": [],
}


# ==========================================
# SESIÓN DE VALORACIÓN
# ==========================================

@router.get("/empresas/{empresa_id}/sesiones-valoracion")
def listar_sesiones(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize(db.query(SesionValoracion).filter(
        SesionValoracion.empresa_id == empresa_id,
        SesionValoracion.deleted_at.is_(None)
    ).order_by(desc(SesionValoracion.created_at)).all())


@router.post("/sesiones-valoracion")
def crear_sesion(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sesion = SesionValoracion(
        empresa_id=data["empresa_id"],
        nombre=data["nombre"],
        descripcion=data.get("descripcion"),
        estado="PENDIENTE",
        fecha_inicio=data.get("fecha_inicio"),
        metodologia=data.get("metodologia", "SHR/HAY"),
        observaciones=data.get("observaciones"),
        creada_por=_get_user_id(current_user),
    )
    db.add(sesion)
    db.commit()
    db.refresh(sesion)
    _audit(db, "sesiones_valoracion", sesion.id, "CREATE", _get_user_id(current_user))
    db.commit()
    return _serialize(sesion)


@router.get("/sesiones-valoracion/{sesion_id}")
def obtener_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sesion = db.query(SesionValoracion).filter(
        SesionValoracion.id == sesion_id,
        SesionValoracion.deleted_at.is_(None)
    ).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return _serialize(sesion)


@router.put("/sesiones-valoracion/{sesion_id}")
def actualizar_sesion(
    sesion_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sesion = db.query(SesionValoracion).filter(
        SesionValoracion.id == sesion_id,
        SesionValoracion.deleted_at.is_(None)
    ).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    antes = _serialize(sesion)
    for key in ("nombre", "descripcion", "observaciones", "metodologia"):
        if key in data:
            setattr(sesion, key, data[key])

    db.commit()
    db.refresh(sesion)
    despues = _serialize(sesion)
    _audit(db, "sesiones_valoracion", sesion_id, "UPDATE", _get_user_id(current_user), antes=antes, despues=despues)
    db.commit()
    return _serialize(sesion)


@router.post("/sesiones-valoracion/{sesion_id}/transicion")
def transicionar_sesion(
    sesion_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia el estado de una sesión respetando la máquina de estados."""
    sesion = db.query(SesionValoracion).filter(
        SesionValoracion.id == sesion_id,
        SesionValoracion.deleted_at.is_(None)
    ).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    nuevo_estado = data.get("estado")
    if nuevo_estado not in ESTADOS_SESION_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Estado '{nuevo_estado}' no válido")

    transiciones_permitidas = TRANSICIONES_SESION.get(sesion.estado, [])
    if nuevo_estado not in transiciones_permitidas:
        raise HTTPException(
            status_code=400,
            detail=f"Transición no permitida: {sesion.estado} → {nuevo_estado}. Permitidas: {transiciones_permitidas}"
        )

    antes = _serialize(sesion)
    sesion.estado = nuevo_estado
    if nuevo_estado == "APROBADA":
        sesion.fecha_fin = datetime.now()
        _finalizar_valoraciones_en_sesion(db, sesion_id, _get_user_id(current_user))

    db.commit()
    db.refresh(sesion)
    despues = _serialize(sesion)
    _audit(db, "sesiones_valoracion", sesion_id, f"TRANSICION_{nuevo_estado}", _get_user_id(current_user), antes=antes, despues=despues)
    db.commit()
    return _serialize(sesion)


@router.delete("/sesiones-valoracion/{sesion_id}")
def eliminar_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sesion = db.query(SesionValoracion).filter(
        SesionValoracion.id == sesion_id,
        SesionValoracion.deleted_at.is_(None)
    ).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    sesion.deleted_at = func.now()
    _audit(db, "sesiones_valoracion", sesion_id, "SOFT_DELETE", _get_user_id(current_user))
    db.commit()
    return {"message": "Sesión eliminada lógicamente"}


def _finalizar_valoraciones_en_sesion(db: Session, sesion_id: int, user_id: int = None):
    """Cuando una sesión se aprueba, las valoraciones en estado APROBADA pasan a DEFINITIVA,
    y las anteriores DEFINITIVAS pasan a HISTORICA."""
    versiones = db.query(ValoracionVersion).filter(
        ValoracionVersion.sesion_id == sesion_id,
        ValoracionVersion.estado == "APROBADA"
    ).all()

    for v in versiones:
        # Marcar la DEFINITIVA anterior como HISTORICA
        cargo = db.query(CargoOrganizacional).filter(
            CargoOrganizacional.valoracion_actual_id.isnot(None),
            CargoOrganizacional.id == v.cargo_id
        ).first()
        if cargo and cargo.valoracion_actual_id:
            anterior = db.query(ValoracionVersion).filter(
                ValoracionVersion.id == cargo.valoracion_actual_id
            ).first()
            if anterior and anterior.id != v.id:
                anterior.estado = "HISTORICA"

        # Esta versión pasa a DEFINITIVA
        v.estado = "DEFINITIVA"

        # Actualizar cargo
        if cargo:
            cargo.valoracion_actual_id = v.id
            cargo.tiene_valoracion_activa = True
            cargo.estado_valoracion = "VALORADO"

    db.commit()


# ==========================================
# VERSIONES DE VALORACIÓN
# ==========================================

@router.get("/cargos-organizacionales/{cargo_id}/versiones-valoracion")
def listar_versiones(
    cargo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize(db.query(ValoracionVersion).filter(
        ValoracionVersion.cargo_id == cargo_id,
        ValoracionVersion.cargo_id.isnot(None)
    ).order_by(desc(ValoracionVersion.version)).all())


@router.post("/sesiones-valoracion/{sesion_id}/versiones")
def crear_version_valoracion(
    sesion_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea una nueva versión de valoración para un cargo dentro de una sesión."""
    cargo_id = data.get("cargo_id")
    if not cargo_id:
        raise HTTPException(status_code=400, detail="cargo_id requerido")

    sesion = db.query(SesionValoracion).filter(
        SesionValoracion.id == sesion_id,
        SesionValoracion.deleted_at.is_(None)
    ).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    if sesion.estado in ("APROBADA", "CANCELADA", "FINALIZADA"):
        raise HTTPException(status_code=400, detail=f"No se pueden crear versiones en sesión {sesion.estado}")

    cargo = db.query(CargoOrganizacional).filter(
        CargoOrganizacional.id == cargo_id,
        CargoOrganizacional.deleted_at.is_(None)
    ).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo organizacional no encontrado")

    # Calcular número de versión
    ultima_version = db.query(func.max(ValoracionVersion.version)).filter(
        ValoracionVersion.cargo_id == cargo_id
    ).scalar() or 0

    v = ValoracionVersion(
        cargo_id=cargo_id,
        sesion_id=sesion_id,
        version=ultima_version + 1,
        estado="BORRADOR",
        conocimientos=data.get("conocimientos"),
        experiencia=data.get("experiencia"),
        habilidad_gerencial=data.get("habilidad_gerencial"),
        rol_cargo=data.get("rol_cargo"),
        contacto=data.get("contacto"),
        frecuencia=data.get("frecuencia"),
        contenido_relaciones=data.get("contenido_relaciones"),
        complejidad_conceptual=data.get("complejidad_conceptual"),
        tendencia_cc=data.get("tendencia_cc"),
        guias_apoyo=data.get("guias_apoyo"),
        tendencia_ga=data.get("tendencia_ga"),
        impacto=data.get("impacto"),
        autonomia=data.get("autonomia"),
        magnitud=data.get("magnitud"),
        criterio_1=data.get("criterio_1", 0),
        criterio_2=data.get("criterio_2", 0),
        criterio_3=data.get("criterio_3", 0),
        justificacion=data.get("justificacion"),
        motivo_cambio=data.get("motivo_cambio"),
        created_by=_get_user_id(current_user),
    )
    db.add(v)
    db.commit()
    db.refresh(v)

    cargo.estado_valoracion = "EN_PROCESO"
    db.commit()

    _audit(db, "valoraciones_version", v.id, f"CREATE_v{v.version}", _get_user_id(current_user), {"cargo_id": cargo_id, "sesion_id": sesion_id})
    db.commit()
    return _serialize(v)


@router.post("/versiones-valoracion/{version_id}/transicion")
def transicionar_version(
    version_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia el estado de una versión de valoración respetando la máquina de estados."""
    v = db.query(ValoracionVersion).filter(ValoracionVersion.id == version_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Versión no encontrada")

    nuevo_estado = data.get("estado")
    if nuevo_estado not in ESTADOS_VALORACION_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Estado '{nuevo_estado}' no válido")

    transiciones_permitidas = TRANSICIONES_VALORACION.get(v.estado, [])
    if nuevo_estado not in transiciones_permitidas:
        raise HTTPException(
            status_code=400,
            detail=f"Transición no permitida: {v.estado} → {nuevo_estado}. Permitidas: {transiciones_permitidas}"
        )

    antes = _serialize(v)
    v.estado = nuevo_estado
    v.updated_by = _get_user_id(current_user)

    # Si es DEFINITIVA, actualizar el cargo
    if nuevo_estado == "DEFINITIVA":
        cargo = db.query(CargoOrganizacional).filter(CargoOrganizacional.id == v.cargo_id).first()
        if cargo:
            # La anterior DEFINITIVA pasa a HISTORICA
            if cargo.valoracion_actual_id and cargo.valoracion_actual_id != v.id:
                anterior = db.query(ValoracionVersion).filter(
                    ValoracionVersion.id == cargo.valoracion_actual_id
                ).first()
                if anterior:
                    anterior.estado = "HISTORICA"
            cargo.valoracion_actual_id = v.id
            cargo.tiene_valoracion_activa = True
            cargo.estado_valoracion = "VALORADO"

    # Recalcular puntaje al transicionar
    score = calcular_puntaje(v)
    v.puntos_totales = score["puntaje_total"]
    v.nivel_shr = score["nivel_shr"]
    v.categoria = score["categoria"]

    db.commit()
    db.refresh(v)
    despues = _serialize(v)
    _audit(db, "valoraciones_version", version_id, f"TRANSICION_{nuevo_estado}", _get_user_id(current_user), antes=antes, despues=despues)
    db.commit()
    return _serialize(v)


@router.put("/versiones-valoracion/{version_id}")
def actualizar_version(
    version_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    v = db.query(ValoracionVersion).filter(ValoracionVersion.id == version_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Versión no encontrada")

    if v.estado in ("DEFINITIVA", "HISTORICA"):
        raise HTTPException(status_code=400, detail=f"No se puede editar una versión {v.estado}")

    updatable = (
        "conocimientos", "experiencia", "habilidad_gerencial", "rol_cargo",
        "contacto", "frecuencia", "contenido_relaciones",
        "complejidad_conceptual", "tendencia_cc", "guias_apoyo", "tendencia_ga",
        "impacto", "autonomia", "magnitud",
        "criterio_1", "criterio_2", "criterio_3",
        "justificacion", "motivo_cambio",
    )
    antes = _serialize(v)
    for key in updatable:
        if key in data:
            setattr(v, key, data[key])
    v.editado_manual = True
    v.updated_by = _get_user_id(current_user)

    # Recalcular puntaje
    score = calcular_puntaje(v)
    v.puntos_totales = score["puntaje_total"]
    v.nivel_shr = score["nivel_shr"]
    v.categoria = score["categoria"]

    db.commit()
    db.refresh(v)
    despues = _serialize(v)
    _audit(db, "valoraciones_version", version_id, "UPDATE", _get_user_id(current_user), antes=antes, despues=despues)
    db.commit()
    return _serialize(v)


@router.get("/sesiones-valoracion/{sesion_id}/consolidado")
def consolidar_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna el consolidado de valoraciones definitivas de una sesión."""
    versiones = db.query(ValoracionVersion).filter(
        ValoracionVersion.sesion_id == sesion_id,
        ValoracionVersion.estado.in_(["DEFINITIVA", "APROBADA"])
    ).all()

    result = []
    for v in versiones:
        cargo = db.query(CargoOrganizacional).filter(
            CargoOrganizacional.id == v.cargo_id,
            CargoOrganizacional.deleted_at.is_(None)
        ).first()
        result.append({
            "version": _serialize(v),
            "cargo": _serialize(cargo),
        })

    return {"sesion_id": sesion_id, "total": len(result), "valoraciones": result}


# ==========================================
# CARGOS EN SESIÓN (N2)
# ==========================================

@router.post("/sesiones-valoracion/{sesion_id}/cargos")
def agregar_cargo_a_sesion(
    sesion_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agrega un cargo a una sesión creando una versión en BORRADOR."""
    cargo_id = data.get("cargo_id")
    if not cargo_id:
        raise HTTPException(status_code=400, detail="cargo_id requerido")

    sesion = db.query(SesionValoracion).filter(
        SesionValoracion.id == sesion_id,
        SesionValoracion.deleted_at.is_(None)
    ).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if sesion.estado in ("APROBADA", "CANCELADA", "FINALIZADA"):
        raise HTTPException(status_code=400, detail=f"No se pueden agregar cargos a sesión {sesion.estado}")

    cargo = db.query(CargoOrganizacional).filter(
        CargoOrganizacional.id == cargo_id,
        CargoOrganizacional.deleted_at.is_(None)
    ).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")

    existe = db.query(ValoracionVersion).filter(
        ValoracionVersion.sesion_id == sesion_id,
        ValoracionVersion.cargo_id == cargo_id,
        ValoracionVersion.cargo_id.isnot(None)
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="El cargo ya está en la sesión")

    ultima_version = db.query(func.max(ValoracionVersion.version)).filter(
        ValoracionVersion.cargo_id == cargo_id
    ).scalar() or 0

    v = ValoracionVersion(
        cargo_id=cargo_id, sesion_id=sesion_id, version=ultima_version + 1,
        estado="BORRADOR", created_by=_get_user_id(current_user),
    )
    db.add(v); db.commit(); db.refresh(v)

    cargo.estado_valoracion = "EN_PROCESO"
    db.commit()

    _audit(db, "valoraciones_version", v.id, "CREATE_via_sesion", _get_user_id(current_user),
           {"cargo_id": cargo_id, "sesion_id": sesion_id})
    db.commit()
    return _serialize(v)


@router.delete("/sesiones-valoracion/{sesion_id}/cargos/{cargo_id}")
def quitar_cargo_de_sesion(
    sesion_id: int,
    cargo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina todas las versiones no-definitivas de un cargo en una sesión."""
    versiones = db.query(ValoracionVersion).filter(
        ValoracionVersion.sesion_id == sesion_id,
        ValoracionVersion.cargo_id == cargo_id,
        ValoracionVersion.cargo_id.isnot(None)
    ).all()

    if not versiones:
        raise HTTPException(status_code=404, detail="El cargo no está en la sesión")

    eliminadas = 0
    for v in versiones:
        if v.estado in ("DEFINITIVA", "HISTORICA"):
            continue
        v.deleted_at = func.now()
        eliminadas += 1
        _audit(db, "valoraciones_version", v.id, "SOFT_DELETE_via_sesion", _get_user_id(current_user),
               {"sesion_id": sesion_id, "cargo_id": cargo_id})

    db.commit()
    return {"message": f"Se eliminaron {eliminadas} versión(es) del cargo de la sesión", "eliminadas": eliminadas}


@router.get("/sesiones-valoracion/{sesion_id}/cargos")
def listar_cargos_en_sesion(
    sesion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos los cargos con versiones activas en una sesión."""
    versiones = db.query(ValoracionVersion).filter(
        ValoracionVersion.sesion_id == sesion_id,
        ValoracionVersion.cargo_id.isnot(None)
    ).all()
    result = []
    for v in versiones:
        cargo = db.query(CargoOrganizacional).filter(
            CargoOrganizacional.id == v.cargo_id,
            CargoOrganizacional.deleted_at.is_(None)
        ).first()
        if cargo:
            result.append({
                "cargo": _serialize(cargo),
                "version": _serialize(v),
            })
    return result


@router.get("/cargos-organizacionales/{cargo_id}/valoracion-activa")
def obtener_valoracion_activa(
    cargo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene la valoración definitiva activa de un cargo."""
    cargo = db.query(CargoOrganizacional).filter(
        CargoOrganizacional.id == cargo_id,
        CargoOrganizacional.deleted_at.is_(None)
    ).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")

    if not cargo.tiene_valoracion_activa or not cargo.valoracion_actual_id:
        return {"cargo": _serialize(cargo), "valoracion": None, "mensaje": "Sin valoración activa"}

    v = db.query(ValoracionVersion).filter(
        ValoracionVersion.id == cargo.valoracion_actual_id
    ).first()
    return {"cargo": _serialize(cargo), "valoracion": _serialize(v)}
