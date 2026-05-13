from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models import (
    GrupoEmpresarial, Empresa, Regional, Sede, Macroproceso,
    Proceso, Area, CargoOrganizacional, User, AuditLog
)
from ..auth import get_current_user
from ..services.carga_organizacional import procesar_archivo
import os
import shutil

router = APIRouter(prefix="/api/v1", tags=["Organización"])


def _serialize(obj):
    if obj is None:
        return None
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    cols = [c.name for c in obj.__table__.columns]
    result = {}
    for c in cols:
        val = getattr(obj, c)
        if isinstance(val, datetime):
            val = val.isoformat()
        result[c] = val
    return result


def _soft_delete(db: Session, model, record_id: int, user_id: int = None):
    obj = db.query(model).filter(model.id == record_id, model.deleted_at.is_(None)).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"no encontrado")
    obj.deleted_at = func.now()
    if hasattr(obj, 'estado'):
        obj.estado = "INACTIVO"
    _audit(db, model.__tablename__, record_id, "SOFT_DELETE", user_id)
    db.commit()
    return {"message": "eliminado"}


def _audit(db: Session, entidad: str, entidad_id: int, accion: str, user_id: int = None, antes: dict = None, despues: dict = None):
    db.add(AuditLog(usuario_id=user_id, entidad=entidad, entidad_id=entidad_id, accion=accion, antes=antes, despues=despues))


def _uid(cu):
    return cu.id if cu else None


# ─── GRUPO EMPRESARIAL ─────────────────────────────────

@router.get("/grupos-empresariales")
def listar_grupos(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    q = db.query(GrupoEmpresarial).filter(GrupoEmpresarial.deleted_at.is_(None))
    return _serialize(q.all())


@router.post("/grupos-empresariales")
def crear_grupo(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    g = GrupoEmpresarial(nombre=data["nombre"], descripcion=data.get("descripcion"),
                         sector_principal=data.get("sector_principal"), tamano=data.get("tamano"),
                         pais_principal=data.get("pais_principal", "Colombia"), created_by=_uid(cu))
    db.add(g); db.commit(); db.refresh(g)
    _audit(db, "grupos_empresariales", g.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(g)


@router.get("/grupos-empresariales/{grupo_id}")
def obtener_grupo(grupo_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    g = db.query(GrupoEmpresarial).filter(GrupoEmpresarial.id == grupo_id, GrupoEmpresarial.deleted_at.is_(None)).first()
    if not g: raise HTTPException(404)
    return _serialize(g)


@router.put("/grupos-empresariales/{grupo_id}")
def actualizar_grupo(grupo_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    g = db.query(GrupoEmpresarial).filter(GrupoEmpresarial.id == grupo_id, GrupoEmpresarial.deleted_at.is_(None)).first()
    if not g: raise HTTPException(404)
    antes = _serialize(g)
    for k in ("nombre","descripcion","sector_principal","tamano","pais_principal","estado"):
        if k in data: setattr(g, k, data[k])
    g.updated_by = _uid(cu)
    db.commit(); db.refresh(g)
    despues = _serialize(g)
    _audit(db, "grupos_empresariales", grupo_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(g)


@router.delete("/grupos-empresariales/{grupo_id}")
def eliminar_grupo(grupo_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _soft_delete(db, GrupoEmpresarial, grupo_id, _uid(cu))


# ─── EMPRESA ────────────────────────────────────────────

@router.get("/grupos-empresariales/{grupo_id}/empresas")
def listar_empresas_por_grupo(grupo_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Empresa).filter(Empresa.grupo_empresarial_id == grupo_id, Empresa.deleted_at.is_(None)).all())


@router.get("/empresas")
def listar_empresas(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Empresa).filter(Empresa.deleted_at.is_(None)).all())


@router.post("/empresas")
def crear_empresa(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    e = Empresa(grupo_empresarial_id=data.get("grupo_empresarial_id"), regional_id=data.get("regional_id"),
                nit=data.get("nit"), nombre_empresa=data.get("nombre", data.get("nombre_empresa")),
                razon_social=data.get("razon_social"), sector_economico=data.get("sector_economico"),
                subsector=data.get("subsector"), tipo_empresa=data.get("tipo_empresa"),
                tamano_empresa=data.get("tamano_empresa"), descripcion_negocio=data.get("descripcion_negocio"),
                modelo_operativo=data.get("modelo_operativo"), cadena_valor=data.get("cadena_valor"),
                ciudad=data.get("ciudad"), direccion=data.get("direccion"))
    db.add(e); db.commit(); db.refresh(e)
    _audit(db, "empresas", e.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(e)


@router.get("/empresas/{empresa_id}")
def obtener_empresa(empresa_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    e = db.query(Empresa).filter(Empresa.id == empresa_id, Empresa.deleted_at.is_(None)).first()
    if not e: raise HTTPException(404)
    return _serialize(e)


@router.put("/empresas/{empresa_id}")
def actualizar_empresa(empresa_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    e = db.query(Empresa).filter(Empresa.id == empresa_id, Empresa.deleted_at.is_(None)).first()
    if not e: raise HTTPException(404)
    antes = _serialize(e)
    for k in ("nombre_empresa","razon_social","nit","sector_economico","subsector","tipo_empresa",
              "tamano_empresa","descripcion_negocio","modelo_operativo","cadena_valor","direccion",
              "telefono","ciudad","departamento","persona_contacto","email_contacto",
              "principales_productos","num_personas_contratadas","ingresos_aproximados",
              "estado","regional_id","grupo_empresarial_id"):
        if k in data: setattr(e, k, data[k])
    e.updated_by = _uid(cu)
    db.commit(); db.refresh(e)
    despues = _serialize(e)
    _audit(db, "empresas", empresa_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(e)


@router.delete("/empresas/{empresa_id}")
def eliminar_empresa(empresa_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _soft_delete(db, Empresa, empresa_id, _uid(cu))


# ─── REGIONAL ───────────────────────────────────────────

@router.get("/empresas/{empresa_id}/regionales")
def listar_regionales_por_empresa(empresa_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Regional).filter(Regional.empresa_id == empresa_id, Regional.deleted_at.is_(None)).all())


@router.post("/regionales")
def crear_regional(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    r = Regional(empresa_id=data.get("empresa_id"), nombre=data["nombre"],
                 descripcion=data.get("descripcion"), responsable=data.get("responsable"))
    db.add(r); db.commit(); db.refresh(r)
    _audit(db, "regionales", r.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(r)


@router.put("/regionales/{regional_id}")
def actualizar_regional(regional_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    r = db.query(Regional).filter(Regional.id == regional_id, Regional.deleted_at.is_(None)).first()
    if not r: raise HTTPException(404)
    antes = _serialize(r)
    for k in ("nombre","descripcion","responsable","estado","empresa_id"):
        if k in data: setattr(r, k, data[k])
    db.commit(); db.refresh(r)
    despues = _serialize(r)
    _audit(db, "regionales", regional_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(r)


@router.delete("/regionales/{regional_id}")
def eliminar_regional(regional_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _soft_delete(db, Regional, regional_id, _uid(cu))


# ─── SEDE ───────────────────────────────────────────────

@router.get("/regionales/{regional_id}/sedes")
def listar_sedes_por_regional(regional_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Sede).filter(Sede.regional_id == regional_id, Sede.deleted_at.is_(None)).all())


@router.post("/sedes")
def crear_sede(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    s = Sede(regional_id=data.get("regional_id"), nombre=data["nombre"], direccion=data.get("direccion"),
             ciudad=data.get("ciudad"), departamento=data.get("departamento"), pais=data.get("pais","Colombia"),
             tipo_sede=data.get("tipo_sede"), cantidad_empleados=data.get("cantidad_empleados"))
    db.add(s); db.commit(); db.refresh(s)
    _audit(db, "sedes", s.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(s)


@router.put("/sedes/{sede_id}")
def actualizar_sede(sede_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    s = db.query(Sede).filter(Sede.id == sede_id, Sede.deleted_at.is_(None)).first()
    if not s: raise HTTPException(404)
    antes = _serialize(s)
    for k in ("nombre","direccion","ciudad","departamento","pais","tipo_sede","cantidad_empleados","estado","regional_id"):
        if k in data: setattr(s, k, data[k])
    db.commit(); db.refresh(s)
    despues = _serialize(s)
    _audit(db, "sedes", sede_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(s)


@router.delete("/sedes/{sede_id}")
def eliminar_sede(sede_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _soft_delete(db, Sede, sede_id, _uid(cu))


# ─── MACROPROCESO ───────────────────────────────────────

@router.get("/empresas/{empresa_id}/macroprocesos")
def listar_macroprocesos(empresa_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Macroproceso).filter(Macroproceso.empresa_id == empresa_id, Macroproceso.deleted_at.is_(None)).all())


@router.post("/macroprocesos")
def crear_macroproceso(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    m = Macroproceso(empresa_id=data["empresa_id"], nombre=data["nombre"], descripcion=data.get("descripcion"),
                     tipo=data.get("tipo"), criticidad=data.get("criticidad"), created_by=_uid(cu))
    db.add(m); db.commit(); db.refresh(m)
    _audit(db, "macroprocesos", m.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(m)


@router.put("/macroprocesos/{macroproceso_id}")
def actualizar_macroproceso(macroproceso_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    m = db.query(Macroproceso).filter(Macroproceso.id == macroproceso_id, Macroproceso.deleted_at.is_(None)).first()
    if not m: raise HTTPException(404)
    antes = _serialize(m)
    for k in ("nombre","descripcion","tipo","criticidad","estado"):
        if k in data: setattr(m, k, data[k])
    db.commit(); db.refresh(m)
    despues = _serialize(m)
    _audit(db, "macroprocesos", macroproceso_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(m)


@router.delete("/macroprocesos/{macroproceso_id}")
def eliminar_macroproceso(macroproceso_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    procesos = db.query(Proceso).filter(Proceso.macroproceso_id == macroproceso_id, Proceso.deleted_at.is_(None)).count()
    if procesos > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: el macroproceso tiene {procesos} proceso(s) activo(s).")
    return _soft_delete(db, Macroproceso, macroproceso_id, _uid(cu))


# ─── PROCESO ────────────────────────────────────────────

@router.get("/macroprocesos/{macroproceso_id}/procesos")
def listar_procesos_por_macroproceso(macroproceso_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Proceso).filter(Proceso.macroproceso_id == macroproceso_id, Proceso.deleted_at.is_(None)).all())


@router.post("/procesos")
def crear_proceso(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    p = Proceso(macroproceso_id=data["macroproceso_id"], nombre=data["nombre"],
                descripcion=data.get("descripcion"), lider_proceso=data.get("lider_proceso"),
                criticidad=data.get("criticidad"), created_by=_uid(cu))
    db.add(p); db.commit(); db.refresh(p)
    _audit(db, "procesos", p.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(p)


@router.get("/procesos/{proceso_id}")
def obtener_proceso(proceso_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    p = db.query(Proceso).filter(Proceso.id == proceso_id, Proceso.deleted_at.is_(None)).first()
    if not p: raise HTTPException(404)
    return _serialize(p)


@router.put("/procesos/{proceso_id}")
def actualizar_proceso(proceso_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    p = db.query(Proceso).filter(Proceso.id == proceso_id, Proceso.deleted_at.is_(None)).first()
    if not p: raise HTTPException(404)
    antes = _serialize(p)
    for k in ("nombre","descripcion","lider_proceso","criticidad","estado","macroproceso_id"):
        if k in data: setattr(p, k, data[k])
    p.updated_by = _uid(cu)
    db.commit(); db.refresh(p)
    despues = _serialize(p)
    _audit(db, "procesos", proceso_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(p)


@router.delete("/procesos/{proceso_id}")
def eliminar_proceso(proceso_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    areas = db.query(Area).filter(Area.proceso_id == proceso_id, Area.deleted_at.is_(None)).count()
    if areas > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: el proceso tiene {areas} área(s) activa(s).")
    return _soft_delete(db, Proceso, proceso_id, _uid(cu))


# ─── AREA ───────────────────────────────────────────────

@router.get("/procesos/{proceso_id}/areas")
def listar_areas_por_proceso(proceso_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Area).filter(Area.proceso_id == proceso_id, Area.deleted_at.is_(None)).all())


@router.get("/areas")
def listar_areas(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(Area).filter(Area.deleted_at.is_(None)).all())


@router.post("/areas")
def crear_area(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    a = Area(sede_id=data.get("sede_id"), proceso_id=data.get("proceso_id"), nombre=data["nombre"],
             nombre_corto=data.get("nombre_corto"), tipo_area=data.get("tipo_area"),
             area_padre_id=data.get("area_padre_id"), descripcion=data.get("descripcion"),
             objetivo=data.get("objetivo"), responsable=data.get("responsable"))
    db.add(a); db.commit(); db.refresh(a)
    _audit(db, "areas", a.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(a)


@router.put("/areas/{area_id}")
def actualizar_area(area_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    a = db.query(Area).filter(Area.id == area_id, Area.deleted_at.is_(None)).first()
    if not a: raise HTTPException(404)
    antes = _serialize(a)
    for k in ("nombre","nombre_corto","tipo_area","area_padre_id","sede_id","proceso_id",
              "descripcion","objetivo","responsable","estado"):
        if k in data: setattr(a, k, data[k])
    db.commit(); db.refresh(a)
    despues = _serialize(a)
    _audit(db, "areas", area_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(a)


@router.delete("/areas/{area_id}")
def eliminar_area(area_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    cargos_activos = db.query(CargoOrganizacional).filter(CargoOrganizacional.area_id == area_id, CargoOrganizacional.deleted_at.is_(None)).count()
    if cargos_activos > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: el área tiene {cargos_activos} cargo(s) activo(s). Reasigne o elimine los cargos primero.")
    return _soft_delete(db, Area, area_id, _uid(cu))


# ─── CARGO ORGANIZACIONAL ───────────────────────────────

@router.get("/areas/{area_id}/cargos")
def listar_cargos_por_area(area_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(CargoOrganizacional).filter(CargoOrganizacional.area_id == area_id, CargoOrganizacional.deleted_at.is_(None)).all())


@router.get("/empresas/{empresa_id}/cargos-organizacionales")
def listar_cargos_empresa(empresa_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return _serialize(db.query(CargoOrganizacional).filter(CargoOrganizacional.empresa_id == empresa_id, CargoOrganizacional.deleted_at.is_(None)).all())


@router.post("/cargos-organizacionales")
def crear_cargo_organizacional(data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    c = CargoOrganizacional(codigo=data.get("codigo"), nombre=data["nombre"],
        nombre_estandarizado=data.get("nombre_estandarizado"), empresa_id=data["empresa_id"],
        area_id=data.get("area_id"), jefe_cargo_id=data.get("jefe_cargo_id"),
        nivel_organizacional=data.get("nivel_organizacional"),
        tiene_personal_a_cargo=data.get("tiene_personal_a_cargo", False),
        cantidad_subordinados=data.get("cantidad_subordinados", 0),
        sector=data.get("sector"), modelo_operativo=data.get("modelo_operativo"),
        ubicacion=data.get("ubicacion"), modalidad=data.get("modalidad"),
        mision=data.get("mision"), objetivo=data.get("objetivo"), proposito=data.get("proposito"),
        responsabilidades_generales=data.get("responsabilidades_generales"),
        responsabilidades_especificas=data.get("responsabilidades_especificas"),
        funciones_clave=data.get("funciones_clave"), indicadores=data.get("indicadores"),
        formacion_requerida=data.get("formacion_requerida"),
        conocimientos_generales=data.get("conocimientos_generales"),
        conocimientos_especificos=data.get("conocimientos_especificos"),
        experiencia=data.get("experiencia"), certificaciones=data.get("certificaciones"),
        competencias=data.get("competencias"), created_by=_uid(cu))
    db.add(c); db.commit(); db.refresh(c)
    _audit(db, "cargos_organizacionales", c.id, "CREATE", _uid(cu)); db.commit()
    return _serialize(c)


@router.get("/cargos-organizacionales/{cargo_id}")
def obtener_cargo_organizacional(cargo_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    c = db.query(CargoOrganizacional).filter(CargoOrganizacional.id == cargo_id, CargoOrganizacional.deleted_at.is_(None)).first()
    if not c: raise HTTPException(404)
    return _serialize(c)


@router.put("/cargos-organizacionales/{cargo_id}")
def actualizar_cargo_organizacional(cargo_id: int, data: dict, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    c = db.query(CargoOrganizacional).filter(CargoOrganizacional.id == cargo_id, CargoOrganizacional.deleted_at.is_(None)).first()
    if not c: raise HTTPException(404)
    antes = _serialize(c)
    for k in ("codigo","nombre","nombre_estandarizado","area_id","jefe_cargo_id","nivel_organizacional",
              "tiene_personal_a_cargo","cantidad_subordinados","sector","modelo_operativo","ubicacion",
              "modalidad","mision","objetivo","proposito","responsabilidades_generales",
              "responsabilidades_especificas","funciones_clave","indicadores","formacion_requerida",
              "conocimientos_generales","conocimientos_especificos","experiencia","certificaciones",
              "competencias","estado","estado_valoracion"):
        if k in data: setattr(c, k, data[k])
    c.updated_by = _uid(cu)
    db.commit(); db.refresh(c)
    despues = _serialize(c)
    _audit(db, "cargos_organizacionales", cargo_id, "UPDATE", _uid(cu), antes=antes, despues=despues); db.commit()
    return _serialize(c)


@router.delete("/cargos-organizacionales/{cargo_id}")
def eliminar_cargo_organizacional(cargo_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    cargo = db.query(CargoOrganizacional).filter(CargoOrganizacional.id == cargo_id, CargoOrganizacional.deleted_at.is_(None)).first()
    if not cargo: raise HTTPException(404)
    if cargo.tiene_valoracion_activa or cargo.estado_valoracion in ("VALORADO", "DEFINITIVA"):
        raise HTTPException(status_code=400, detail="No se puede eliminar: el cargo tiene una valoración definitiva activa. Inactive el cargo en su lugar.")
    subordinados = db.query(CargoOrganizacional).filter(CargoOrganizacional.jefe_cargo_id == cargo_id, CargoOrganizacional.deleted_at.is_(None)).count()
    if subordinados > 0:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar: el cargo tiene {subordinados} subordinado(s). Reasigne primero.")
    return _soft_delete(db, CargoOrganizacional, cargo_id, _uid(cu))


# ─── ÁRBOL ORGANIZACIONAL ───────────────────────────────

@router.get("/empresas/{empresa_id}/arbol")
def obtener_arbol(empresa_id: int, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id, Empresa.deleted_at.is_(None)).first()
    if not empresa: raise HTTPException(404)
    grupo = None
    if empresa.grupo_empresarial_id:
        grupo = db.query(GrupoEmpresarial).filter(GrupoEmpresarial.id == empresa.grupo_empresarial_id).first()
    regionales = db.query(Regional).filter(Regional.empresa_id == empresa_id, Regional.deleted_at.is_(None)).all()
    sedes = db.query(Sede).filter(Sede.deleted_at.is_(None)).all()
    macroprocesos = db.query(Macroproceso).filter(Macroproceso.empresa_id == empresa_id, Macroproceso.deleted_at.is_(None)).all()
    mp_ids = [mp.id for mp in macroprocesos]
    procesos = db.query(Proceso).filter(Proceso.macroproceso_id.in_(mp_ids), Proceso.deleted_at.is_(None)).all() if mp_ids else []
    p_ids = [p.id for p in procesos]
    areas = db.query(Area).filter(Area.proceso_id.in_(p_ids), Area.deleted_at.is_(None)).all() if p_ids else []
    a_ids = [a.id for a in areas]
    cargos = db.query(CargoOrganizacional).filter(CargoOrganizacional.area_id.in_(a_ids), CargoOrganizacional.deleted_at.is_(None)).all() if a_ids else []
    return {
        "grupo": _serialize(grupo), "empresa": _serialize(empresa),
        "regionales": _serialize(regionales), "sedes": _serialize(sedes),
        "macroprocesos": _serialize(macroprocesos), "procesos": _serialize(procesos),
        "areas": _serialize(areas), "cargos": _serialize(cargos),
    }


# ─── CARGA MASIVA EXCEL (N4) ────────────────────────────

@router.post("/organizacion/carga-masiva")
def carga_masiva_organizacional(
    file: UploadFile = File(...),
    empresa_id: int = Form(None),
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato no válido. Use .xlsx")

    temp_path = os.path.join(os.getenv("TEMP", "/tmp"), f"carga_org_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        resultado = procesar_archivo(temp_path, db, empresa_id=empresa_id)
        _audit(db, "organizacion", 0, "CARGA_MASIVA", _uid(cu), despues=resultado)
        db.commit()
        return resultado
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error procesando archivo: {str(e)[:200]}")
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
