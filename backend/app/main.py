from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import get_db, engine, Base, run_migrations
from .models import (
    User, Upload, Cargo, Homologacion, JobStatus, ProcessingLog,
    Empresa, CargoEmpresa, ValoracionCargo, MasterDescription, Valoracion,
    Regional, Sede, Area, MuestraPeriodo,
)
from .auth import get_password_hash, create_access_token, verify_password, get_current_user
from .services.excel_processor import process_requirements_excel
from .services.master_data import process_master_excel
from .services.matcher import start_batch_processing
from .services.excel_formulario_service import procesar_excel_formulario, guardar_en_db
from .services.analisis_service import calcular_curvas_equidad, analizar_equidad, calcular_nivelacion, reporte_consolidado
import os
import shutil
from typing import List, Optional
from pydantic import BaseModel

try:
    print("Iniciando migraciones de base de datos...")
    run_migrations()
    print("Iniciando creacion/verificacion de tablas...")
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas/verificadas exitosamente.")
except Exception as e:
    print(f"ERROR CRITICO al conectar a la base de datos: {e}")

app = FastAPI(title="SHR Homologacion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

class HomologacionUpdate(BaseModel):
    cargo_homologado: str
    justificacion: str

# ==========================================
# HEALTH CHECK (para cron-job.org, Render, etc.)
# ==========================================

@app.get("/ping")
def ping():
    return {"status": "ok", "message": "SHR Homologacion API running"}

@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}

# ==========================================
# STARTUP
# ==========================================

@app.on_event("startup")
def startup_event():
    db = next(get_db())

    seed_users = [
        ("admin@shr.com", "admin123"),
        ("analista1@shr.com", "admin123"),
        ("analista2@shr.com", "admin123"),
    ]

    for email, password in seed_users:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.password_hash = get_password_hash(password)
        else:
            db.add(User(email=email, password_hash=get_password_hash(password)))

    db.commit()
    print("Usuarios seed verificados/creados")

    master_count = db.query(MasterDescription).count()
    if master_count < 100:
        master_path = os.path.join(os.path.dirname(__file__), "..", "data", "master_cargos.xlsx")
        if os.path.exists(master_path):
            try:
                count = process_master_excel(master_path, db)
                print(f"Base maestra inicializada con {count} cargos desde {master_path}")
            except Exception as e:
                print(f"Error al inicializar base maestra: {e}")
        else:
            print(f"No se encontro el archivo maestro en {master_path}")

# ==========================================
# AUTH
# ==========================================

from fastapi.security import OAuth2PasswordRequestForm

@app.post("/token")
@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contrasena incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# ==========================================
# UPLOADS & CARGOS
# ==========================================

@app.post("/uploads/master")
def upload_master_file(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    temp_path = os.path.join(os.getenv("TEMP", "/tmp"), f"temp_master_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        count = process_master_excel(temp_path, db)
        return {"message": f"Se cargaron {count} descripciones maestras", "count": count}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/uploads/requirements")
def upload_requirements_file(
    empresa: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    temp_path = os.path.join(os.getenv("TEMP", "/tmp"), f"temp_req_{file.filename.replace(' ', '_')}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        empresa_nombre = empresa.upper() if empresa and empresa.strip() else None

        if not empresa_nombre:
            from .services.excel_processor import procesar_datos_generales
            empresa_id = procesar_datos_generales(temp_path, "EMPRESA", db)
            if empresa_id:
                emp = db.query(Empresa).filter(Empresa.id == empresa_id).first()
                if emp:
                    empresa_nombre = emp.nombre_empresa.upper()

        if not empresa_nombre:
            empresa_nombre = file.filename.replace(".xlsx", "").replace(".xls", "").upper()

        upload = Upload(
            user_id=current_user.id,
            filename=file.filename,
            empresa=empresa_nombre,
            status="pendiente"
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)

        count = process_requirements_excel(temp_path, upload.id, db)

        # Obtener datos de la empresa para retornarlos al frontend
        empresa_data = None
        if empresa_nombre:
            emp = db.query(Empresa).filter(Empresa.nombre_empresa == empresa_nombre).order_by(Empresa.id.desc()).first()
            if emp:
                empresa_data = {
                    "id": emp.id,
                    "nombre_empresa": emp.nombre_empresa,
                    "nit": emp.nit,
                    "direccion": emp.direccion,
                    "telefono": emp.telefono,
                    "departamento": emp.departamento,
                    "ciudad": emp.ciudad,
                    "sector_economico": emp.sector_economico,
                    "tipo_empresa": emp.tipo_empresa,
                    "consultor": emp.consultor,
                    "persona_contacto": emp.persona_contacto,
                    "email_contacto": emp.email_contacto,
                }

        return {"upload_id": upload.id, "count": count, "empresa": empresa_nombre, "empresa_data": empresa_data}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Error en el Excel: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

@app.get("/uploads")
def list_uploads(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Upload).all()

@app.get("/uploads/{upload_id}/cargos")
def list_cargos(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    result = []
    for c in cargos:
        homo = c.homologacion
        result.append({
            "id": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area,
            "estado": c.estado,
            "descripcion_empresa": c.descripcion_empresa,
            "homologacion": {
                "cargo_homologado": homo.cargo_homologado if homo else None,
                "justificacion": homo.justificacion if homo else None,
                "editado_manual": homo.editado_manual if homo else False,
                "datos_excel": homo.datos_excel if homo else {},
            } if homo else None
        })
    return result

@app.get("/uploads/{upload_id}/empresa")
def get_empresa_from_upload(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene los datos de la empresa asociados a un upload."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload or not upload.empresa:
        raise HTTPException(status_code=404, detail="Upload no encontrado")

    emp = db.query(Empresa).filter(Empresa.nombre_empresa == upload.empresa).order_by(Empresa.id.desc()).first()
    if not emp:
        return {"nombre_empresa": upload.empresa}

    return {
        "id": emp.id,
        "nombre_empresa": emp.nombre_empresa,
        "nit": emp.nit,
        "direccion": emp.direccion,
        "telefono": emp.telefono,
        "departamento": emp.departamento,
        "ciudad": emp.ciudad,
        "sector_economico": emp.sector_economico,
        "tipo_empresa": emp.tipo_empresa,
        "consultor": emp.consultor,
        "persona_contacto": emp.persona_contacto,
        "email_contacto": emp.email_contacto,
        "actividad_economica": emp.actividad_economica,
        "principales_productos": emp.principales_productos,
        "motivacion": emp.motivacion,
        "empleados_presenciales": emp.empleados_presenciales,
        "empleados_teletrabajo": emp.empleados_teletrabajo,
        "empleados_mixta": emp.empleados_mixta,
    }

@app.put("/homologacion/{cargo_id}")
async def update_homologation(cargo_id: int, data: dict, db: Session = Depends(get_db)):
    homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo_id).first()
    if not homo:
        raise HTTPException(status_code=404, detail="Homologacion no encontrada")
    homo.cargo_homologado = data.get("cargo_homologado")
    homo.editado_manual = True
    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if cargo:
        cargo.estado = "HOMOLOGADO"
    db.commit()
    return {"message": "Actualizado correctamente"}

@app.post("/procesar/{upload_id}")
def start_processing(upload_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    background_tasks.add_task(start_batch_processing, upload_id)
    return {"message": "Procesamiento iniciado en segundo plano"}

@app.post("/procesar/{upload_id}/cancel")
def cancel_processing(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload no encontrado")
    upload.status = "cancelado"
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado.in_(["PROCESANDO", "PENDIENTE"])).all()
    for c in cargos:
        c.estado = "PENDIENTE"
    db.commit()
    return {"message": "Procesamiento cancelado"}

@app.patch("/cargos/{cargo_id}")
def update_cargo_manual(cargo_id: int, req: HomologacionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
    if not homo:
        homo = Homologacion(cargo_id=cargo.id)
        db.add(homo)
    homo.cargo_homologado = req.cargo_homologado
    homo.justificacion = req.justificacion
    homo.editado_manual = True
    cargo.estado = JobStatus.HOMOLOGADO
    db.commit()
    return {"message": "Actualizado manualmente"}

# ==========================================
# HOMOLOGACION CON IA (endpoint principal)
# ==========================================

@app.post("/homologacion/ejecutar")
def ejecutar_homologacion(
    upload_id: int = Query(..., description="Upload ID"),
    usar_ia: bool = Query(True, description="Usar IA para los no encontrados"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ejecuta homologacion: match exacto + IA para los restantes (marcados como SUGERIDO)."""
    from .services.matcher import find_exact_matches, load_all_masters, normalize_cargo_name, _process_with_ia

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    masters = load_all_masters(db)
    masters_list = [{"nombre": m["nombre"], "descripcion": m["descripcion"], "area": m["area"]} for m in masters]

    matched_exact, unmatched = find_exact_matches(cargos, masters)

    # Mark exact matches as HOMOLOGADO
    for cargo, master in matched_exact:
        homo = cargo.homologacion
        if homo:
            homo.cargo_homologado = master["nombre"]
            homo.justificacion = f"Match exacto ({master.get('area', '')})"
            homo.editado_manual = False
        else:
            homo = Homologacion(
                cargo_id=cargo.id,
                cargo_homologado=master["nombre"],
                justificacion=f"Match exacto ({master.get('area', '')})"
            )
            db.add(homo)
        cargo.estado = "HOMOLOGADO"

    db.commit()

    # IA for unmatched - marked as SUGERIDO
    ia_suggested = 0
    if usar_ia and unmatched:
        from .services.ia_service import homologar_con_ia

        cargos_batch = [{
            "id": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area,
            "descripcion": c.descripcion_empresa or "",
            "descripcion_empresa": c.descripcion_empresa or "",
            "cargo_jefe": "",
        } for c in unmatched]

        try:
            resultados = homologar_con_ia(db, cargos_batch, masters)
            for res in resultados:
                cargo_id = res.get("id")
                if not cargo_id:
                    continue
                cargo = next((c for c in unmatched if c.id == cargo_id), None)
                if not cargo:
                    continue

                homo = cargo.homologacion
                if not homo:
                    homo = Homologacion(cargo_id=cargo.id)
                    db.add(homo)

                cargo_homologado = res.get("cargo_homologado", "SIN COINCIDENCIA")
                justificacion = res.get("justificacion", "")
                confianza = res.get("confianza", 0)

                if cargo_homologado and cargo_homologado != "SIN COINCIDENCIA":
                    homo.cargo_homologado = cargo_homologado
                    homo.justificacion = f"Sugerido IA: {justificacion} (confianza: {confianza})"
                    homo.editado_manual = False
                    cargo.estado = "SUGERIDO"
                    ia_suggested += 1
                else:
                    homo.cargo_homologado = "SIN COINCIDENCIA"
                    homo.justificacion = f"IA: {justificacion}" if justificacion else "Sin coincidencia"
                    cargo.estado = "SIN_COINCIDENCIA"

            db.commit()
        except Exception as e:
            print(f"Error homologacion IA: {e}")

    return {
        "mensaje": f"Se procesaron {len(cargos)} cargos",
        "matched_exact": len(matched_exact),
        "suggested_ia": ia_suggested,
        "not_matched": len(unmatched) - ia_suggested,
        "total": len(cargos),
        "upload_id": upload_id,
    }

@app.post("/homologacion/reprocesar")
def reprocesar_homologacion(
    upload_id: int = Query(..., description="Upload ID"),
    observaciones: str = Body("", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reprocesa homologaciones usando IA con las observaciones del analista."""
    from .services.ia_service import homologar_con_ia

    # Save observaciones on ALL homologaciones that have them edited
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    if not cargos:
        raise HTTPException(status_code=404, detail="No hay cargos en este upload")

    # Get all cargos that are not exact matches (SUGERIDO, SIN_COINCIDENCIA, PENDIENTE, or manually edited)
    cargos_to_reprocess = [c for c in cargos if c.estado not in ["HOMOLOGADO"]]
    if not cargos_to_reprocess:
        return {"mensaje": "No hay cargos pendientes para reprocesar"}

    # Build prompt with existing context + analyst observations
    masters = []
    from .services.matcher import load_all_masters
    masters = load_all_masters(db)

    cargos_batch = [{
        "id": c.id,
        "nombre_cargo": c.nombre_cargo,
        "area": c.area,
        "descripcion": c.descripcion_empresa or "",
        "descripcion_empresa": c.descripcion_empresa or "",
        "cargo_homologado_actual": c.homologacion.cargo_homologado if c.homologacion else "",
    } for c in cargos_to_reprocess]

    results_count = 0
    # Call IA with observations injected into the batch
    from .services.ia_service import homologar_con_ia_observaciones
    resultados = homologar_con_ia_observaciones(db, cargos_batch, masters, observaciones)

    for res in resultados:
        cargo_id = res.get("id")
        cargo = next((c for c in cargos_to_reprocess if c.id == cargo_id), None)
        if not cargo:
            continue

        homo = cargo.homologacion
        if not homo:
            homo = Homologacion(cargo_id=cargo.id)
            db.add(homo)

        cargo_homologado = res.get("cargo_homologado", "SIN_COINCIDENCIA")
        justificacion = res.get("justificacion", "")

        if cargo_homologado and cargo_homologado != "SIN_COINCIDENCIA":
            homo.cargo_homologado = cargo_homologado
            homo.justificacion = f"Reproceso IA (obs. analista): {justificacion}"
            homo.editado_manual = False
            cargo.estado = "SUGERIDO"
            results_count += 1
        else:
            homo.cargo_homologado = "SIN_COINCIDENCIA"
            homo.justificacion = f"Reproceso IA: {justificacion}" if justificacion else "Sin coincidencia tras reproceso"
            cargo.estado = "SIN_COINCIDENCIA"

    db.commit()

    return {
        "mensaje": f"Reproceso completado: {results_count}/{len(cargos_to_reprocess)} cargos reprocesados",
        "reprocesados": results_count,
        "total_pendientes": len(cargos_to_reprocess),
        "upload_id": upload_id,
    }

@app.get("/ia/status")
def ia_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Diagnostico del servicio de IA."""
    from .services.ia_service import OPENROUTER_API_KEY, OPENAI_API_KEY, OPENROUTER_MODEL, OPENAI_MODEL
    import os

    status = {
        "openrouter_key": "CONFIGURADA" if OPENROUTER_API_KEY else "NO CONFIGURADA",
        "openrouter_model": OPENROUTER_MODEL,
        "openai_key": "CONFIGURADA" if OPENAI_API_KEY else "NO CONFIGURADA",
        "openai_model": OPENAI_MODEL,
        "any_key": bool(OPENROUTER_API_KEY or OPENAI_API_KEY),
    }

    if status["any_key"]:
        status["test"] = "OK - al menos una API key configurada"
    else:
        status["test"] = "ERROR - Ninguna API key configurada. Agrega OPENROUTER_API_KEY en Render Environment Variables"

    return status

# ==========================================
# VALORACION CON IA
# ==========================================

@app.post("/valoracion/{cargo_id}/evaluar-ia")
def evaluar_cargo_con_ia(cargo_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Evalua un cargo con IA y guarda la valoracion."""
    from .services.ia_service import valorar_cargo_con_ia

    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")

    cargo_dict = {
        "id": cargo.id,
        "nombre_cargo": cargo.nombre_cargo,
        "area": cargo.area,
        "descripcion_empresa": cargo.descripcion_empresa,
        "cargo_homologado": cargo.homologacion.cargo_homologado if cargo.homologacion else "",
    }

    resultado = valorar_cargo_con_ia(cargo_dict)

    val = db.query(Valoracion).filter(Valoracion.cargo_id == cargo.id).first()
    if not val:
        val = Valoracion(cargo_id=cargo.id)
        db.add(val)

    val.conocimientos = resultado.get("conocimientos")
    val.experiencia = resultado.get("experiencia")
    val.habilidad_gerencial = resultado.get("habilidadGerencial")
    val.rol_cargo = resultado.get("rolCargo")
    val.contacto = resultado.get("contacto")
    val.frecuencia = resultado.get("frecuenciaContacto")
    val.contenido_relaciones = resultado.get("contenidoRelaciones")
    val.complejidad_conceptual = resultado.get("complejidadConceptual")
    val.tendencia_cc = resultado.get("tendenciaCC")
    val.guias_apoyo = resultado.get("guiasApoyo")
    val.tendencia_ga = resultado.get("tendenciaGA")
    val.impacto = resultado.get("impacto")
    val.autonomia = resultado.get("autonomia")
    val.magnitud = resultado.get("magnitud")
    val.criterio_1 = int(resultado.get("criterio1", 0))
    val.criterio_2 = int(resultado.get("criterio2", 0))
    val.criterio_3 = int(resultado.get("criterio3", 0))
    val.justificacion_ia = resultado.get("justificacion", "")
    val.basico = resultado.get("garantizado")
    val.real_pagado = resultado.get("garantizadoVariable")
    val.garantizado = resultado.get("garantizado")
    val.garantizado_variable = resultado.get("garantizadoVariable")
    val.compensacion_total = resultado.get("compensacionTotal")
    val.editado_manual = False
    db.commit()

    # Calcular puntos totales
    from .services.ia_service import valorar_cargo_con_ia
    pts = _estimar_puntos_totales(val)

    return {
        "cargo_id": cargo_id,
        "valoracion": resultado,
        "puntos_totales": pts,
        "justificacion_ia": resultado.get("justificacion", ""),
        "estado": "valorado"
    }

@app.post("/procesar-valoracion/{upload_id}")
def start_valoracion_processing(upload_id: int, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Inicia valoracion de TODOS los cargos de un upload con IA."""
    from .services.valoracion_processor import start_valoracion_batch
    background_tasks.add_task(start_valoracion_batch, upload_id)
    return {"message": "Valoracion iniciada en segundo plano"}

@app.get("/uploads/{upload_id}/valoraciones")
def list_valoraciones(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    result = []
    for c in cargos:
        val = c.valoracion
        val_data = None
        if val:
            pts = _estimar_puntos_totales(val)
            val_data = {
                "conocimientos": val.conocimientos,
                "experiencia": val.experiencia,
                "habilidadGerencial": val.habilidad_gerencial,
                "rolCargo": val.rol_cargo,
                "contacto": val.contacto,
                "frecuenciaContacto": val.frecuencia,
                "contenidoRelaciones": val.contenido_relaciones,
                "complejidadConceptual": val.complejidad_conceptual,
                "tendenciaCC": val.tendencia_cc,
                "guiasApoyo": val.guias_apoyo,
                "tendenciaGA": val.tendencia_ga,
                "impacto": val.impacto,
                "autonomia": val.autonomia,
                "magnitud": val.magnitud,
                "criterio1": val.criterio_1 or 0,
                "criterio2": val.criterio_2 or 0,
                "criterio3": val.criterio_3 or 0,
                "justificacion": val.justificacion_ia,
                "editado_manual": val.editado_manual if val.editado_manual else False,
                "puntos_totales": pts,
                "estado": "valorado" if not val.editado_manual else "editado",
                "basico": val.basico,
                "realPagado": val.real_pagado,
                "garantizado": val.garantizado,
                "garantizadoVariable": val.garantizado_variable,
                "compensacionTotal": val.compensacion_total,
                "puntoMedioReferencia": val.punto_medio_referencia,
                "posicionEquidadPct": val.posicion_equidad_pct,
            }
        result.append({
            "id": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area,
            "estado": c.estado,
            "cargo_homologado": c.homologacion.cargo_homologado if c.homologacion else None,
            "descripcion_empresa": c.descripcion_empresa,
            "valoracion": val_data,
        })
    return result

@app.patch("/valoracion/{cargo_id}")
def update_valoracion_manual(cargo_id: int, req: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    val = db.query(Valoracion).filter(Valoracion.cargo_id == cargo.id).first()
    if not val:
        val = Valoracion(cargo_id=cargo.id)
        db.add(val)
    for key, value in req.items():
        if hasattr(val, key):
            setattr(val, key, value)
    val.editado_manual = True
    db.commit()
    return {"message": "Valoracion actualizada"}

# ==========================================
# ENTIDADES ORGANIZACIONALES
# ==========================================

@app.get("/regionales")
def list_regionales(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Regional).all()

@app.post("/regionales")
def create_regional(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    regional = Regional(nombre=data["nombre"], descripcion=data.get("descripcion"))
    db.add(regional)
    db.commit()
    db.refresh(regional)
    return {"id": regional.id, "nombre": regional.nombre}

@app.get("/sedes")
def list_sedes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Sede).all()

@app.post("/sedes")
def create_sede(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sede = Sede(
        regional_id=data.get("regional_id"),
        nombre=data["nombre"],
        direccion=data.get("direccion"),
        ciudad=data.get("ciudad"),
        departamento=data.get("departamento"),
        tipo_sede=data.get("tipo_sede"),
    )
    db.add(sede)
    db.commit()
    db.refresh(sede)
    return {"id": sede.id, "nombre": sede.nombre}

@app.get("/areas")
def list_areas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Area).all()

@app.post("/areas")
def create_area(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    area = Area(
        sede_id=data.get("sede_id"),
        nombre=data["nombre"],
        nombre_corto=data.get("nombre_corto"),
        tipo_area=data.get("tipo_area"),
        area_padre_id=data.get("area_padre_id"),
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return {"id": area.id, "nombre": area.nombre}

@app.get("/empresas/{empresa_id}/muestras")
def list_muestras_empresa(empresa_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    muestras = db.query(MuestraPeriodo).filter(MuestraPeriodo.empresa_id == empresa_id).all()
    return [
        {
            "id": m.id,
            "ano": m.ano,
            "periodo": m.periodo,
            "estado": m.estado,
            "fecha_inicio": str(m.fecha_inicio) if m.fecha_inicio else None,
            "fecha_completado": str(m.fecha_completado) if m.fecha_completado else None,
            "consultor": m.consultor,
        }
        for m in muestras
    ]

@app.post("/empresas/{empresa_id}/muestras")
def create_muestra(empresa_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    muestra = MuestraPeriodo(
        empresa_id=empresa_id,
        ano=data.get("ano", 2026),
        periodo=data.get("periodo", f"{data.get('ano', 2026)}-1"),
        estado="EN_PROCESO",
        consultor=data.get("consultor"),
    )
    db.add(muestra)
    db.commit()
    db.refresh(muestra)
    return {"id": muestra.id, "ano": muestra.ano, "estado": muestra.estado}

@app.get("/empresas")
def list_empresas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    empresas = db.query(Empresa).all()
    return [
        {
            "id": e.id,
            "nombre_empresa": e.nombre_empresa,
            "nit": e.nit,
            "ciudad": e.ciudad,
            "departamento": e.departamento,
            "sector_economico": e.sector_economico,
        }
        for e in empresas
    ]

# ==========================================
# ANALISIS Y REPORTES
# ==========================================

@app.post("/analisis/curvas/upload/{upload_id}")
def generar_curvas_upload(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    curvas = calcular_curvas_equidad(db, upload_id=upload_id)
    return {"curvas_generadas": len(curvas)}

@app.get("/analisis/reporte/upload/{upload_id}")
def get_reporte_upload(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from .services.ia_service import call_ia
    from .models import Valoracion, Cargo

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    valoraciones = db.query(Valoracion).join(Cargo).filter(Cargo.upload_id == upload_id).all()

    subpago = 0
    competitivo = 0
    sobrepago = 0
    detalles = []

    for v in valoraciones:
        cargo = next((c for c in cargos if c.id == v.cargo_id), None)
        if not cargo:
            continue

        puntos_est = _estimar_puntos_totales(v)
        salario_ref = puntos_est * 25000
        salario_actual = float(v.magnitud or 0) * 100000 if v.magnitud else 0

        if salario_actual > 0 and salario_ref > 0:
            posicion = (salario_actual / salario_ref) * 100
        else:
            posicion = 100

        if posicion < 80:
            subpago += 1
        elif posicion <= 120:
            competitivo += 1
        else:
            sobrepago += 1

        detalles.append({
            "cargo": cargo.nombre_cargo,
            "actual": salario_actual,
            "referencia": salario_ref,
            "posicion": round(posicion, 1),
        })

    total = len(detalles) if detalles else 1

    puntos_data = []
    for v in valoraciones:
        cargo = next((c for c in cargos if c.id == v.cargo_id), None)
        if cargo:
            pts = _estimar_puntos_totales(v)
            salario_est = pts * 25000
            puntos_data.append({"cargo": cargo.nombre_cargo, "puntos": pts, "valor": salario_est})

    puntos_data.sort(key=lambda x: x["puntos"])

    return {
        "equidad": {
            "total": total,
            "subpago": subpago,
            "competitivo": competitivo,
            "sobrepago": sobrepago,
            "pct_subpago": round(subpago / total * 100, 1) if total > 0 else 0,
            "pct_competitivo": round(competitivo / total * 100, 1) if total > 0 else 0,
            "pct_sobrepago": round(sobrepago / total * 100, 1) if total > 0 else 0,
            "detalles": detalles[:10],
        },
        "curvas": {
            "min": [{"puntos": d["puntos"], "valor": d["valor"] * 0.85} for d in puntos_data],
            "mid": [{"puntos": d["puntos"], "valor": d["valor"]} for d in puntos_data],
            "max": [{"puntos": d["puntos"], "valor": d["valor"] * 1.3} for d in puntos_data],
        },
        "nivelacion": {
            f"target_{int(t * 100)}": {
                "costo_anual": sum(max(0, d["referencia"] * t - d["actual"]) for d in detalles) * 12,
            }
            for t in [0.7, 0.8, 0.9, 1.0]
        },
        "competitividad": {
            "promedio": round(sum(d["posicion"] for d in detalles) / len(detalles), 1) if detalles else 0,
            "cargos": detalles[:10],
        },
    }

def _estimar_puntos_totales(v):
    pts_c = {"A": 20, "B": 40, "C": 60, "D": 80, "E": 100, "F": 120, "G": 140, "H": 160}
    mult_e = {"-": 0.8, "o": 1.0, "+": 1.2}
    pts_h = {"I": 10, "II": 20, "III": 30, "IV": 40, "V": 50, "VI": 60, "VII": 70}
    pts_r = {"1": 10, "2": 15, "3": 25, "4": 35}
    pts_contacto = {"A": 5, "B": 10, "C": 15}
    pts_freq = {"1": 2, "2": 4, "3": 6, "4": 8}
    pts_cont = {"I": 5, "II": 10, "III": 15, "IV": 20, "V": 25}
    pts_cc = {"1": 10, "2": 20, "3": 30, "4": 40, "5": 50}
    mult_t = {"-": 0.85, "o": 1.0, "+": 1.15}
    pts_g = {"A": 10, "B": 20, "C": 30, "D": 40, "E": 50, "F": 60, "G": 70, "H": 80}
    pts_imp = {"I": 10, "II": 20, "III": 30, "IV": 40}
    pts_aut = {"A": 10, "B": 20, "C": 30, "D": 40, "E": 50, "F": 60, "G": 70}
    pts_mag = {str(i): i * 5 for i in range(15)}

    f1 = (pts_c.get(v.conocimientos, 60) * mult_e.get(v.experiencia, 1.0) +
          pts_h.get(v.habilidad_gerencial, 30) + pts_r.get(str(v.rol_cargo or ""), 15))
    f2 = (pts_contacto.get(v.contacto, 10) + pts_freq.get(str(v.frecuencia or ""), 4) +
          pts_cont.get(v.contenido_relaciones, 10))
    f3 = (pts_cc.get(str(v.complejidad_conceptual or ""), 20) * mult_t.get(v.tendencia_cc, 1.0) +
          pts_g.get(v.guias_apoyo, 30) * mult_t.get(v.tendencia_ga, 1.0))
    f4 = (pts_imp.get(v.impacto, 20) + pts_aut.get(v.autonomia, 30) +
          pts_mag.get(str(v.magnitud or ""), 0))

    crit = (int(v.criterio_1 or 0) + int(v.criterio_2 or 0) + int(v.criterio_3 or 0))
    raw = f1 + f2 + f3 + f4
    return raw * (1 + crit * 0.05)

# ==========================================
# MODULO DE EQUIDAD - PIECEWISE LINEAR REGRESSION
# ==========================================

@app.post("/modelo-equidad/{upload_id}")
def calcular_modelo_equidad(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Calcula modelo de equidad salarial con regresion lineal segmentada."""
    from .services.equity_model import calcular_equidad
    import pandas as pd

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    if not cargos:
        raise HTTPException(status_code=404, detail="No hay cargos en este upload")

    data = []
    for c in cargos:
        val = c.valoracion
        if not val:
            continue

        pts = _estimar_puntos_totales(val)

        salario_g = val.garantizado or val.basico or None
        salario_gv = val.garantizado_variable or val.real_pagado or None
        salario_ct = val.compensacion_total or None

        data.append({
            "id_cargo": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area or "",
            "puntos": pts,
            "salario_g": salario_g,
            "salario_gv": salario_gv,
            "salario_ct": salario_ct,
        })

    if not data:
        raise HTTPException(status_code=400, detail="No hay cargos con valoracion. Completa la valuacion primero.")

    df = pd.DataFrame(data)
    resultado = calcular_equidad(df)
    return resultado
