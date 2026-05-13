from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..database import get_db
from ..models import AuditLog, User
from ..auth import get_current_user
from .organizacion import _serialize

router = APIRouter(prefix="/api/v1", tags=["Auditoría"])


@router.get("/audit-logs")
def listar_audit_logs(
    entidad: str = Query(None, description="Filtrar por entidad (tabla)"),
    entidad_id: int = Query(None, description="Filtrar por ID de registro"),
    accion: str = Query(None, description="Filtrar por acción"),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(AuditLog)
    if entidad:
        q = q.filter(AuditLog.entidad == entidad)
    if entidad_id:
        q = q.filter(AuditLog.entidad_id == entidad_id)
    if accion:
        q = q.filter(AuditLog.accion == accion)
    return _serialize(q.order_by(desc(AuditLog.timestamp)).limit(limit).all())


@router.get("/audit-logs/entidad/{entidad}/{entidad_id}")
def audit_logs_por_entidad(
    entidad: str,
    entidad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize(db.query(AuditLog).filter(
        AuditLog.entidad == entidad,
        AuditLog.entidad_id == entidad_id
    ).order_by(desc(AuditLog.timestamp)).all())
