from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query, Form, Body
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
import threading
import time
from typing import List, Optional
from pydantic import BaseModel

# Progress tracking for real-time updates
_homologacion_progress: dict = {}
_progress_lock = threading.Lock()

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
                    "razon_social": emp.razon_social,
                    "nit": emp.nit,
                    "direccion": emp.direccion,
                    "telefono": emp.telefono,
                    "departamento": emp.departamento,
                    "ciudad": emp.ciudad,
                    "sector_economico": emp.sector_economico,
                    "actividad_economica": emp.actividad_economica,
                    "tipo_empresa": emp.tipo_empresa,
                    "principales_productos": emp.principales_productos,
                    "consultor": emp.consultor,
                    "persona_contacto": emp.persona_contacto,
                    "cargo_contacto": emp.cargo_contacto,
                    "telefono_contacto": emp.telefono_contacto,
                    "email_contacto": emp.email_contacto,
                    "motivacion": emp.motivacion,
                    "num_personas_contratadas": emp.num_personas_contratadas,
                    "empleados_presenciales": emp.empleados_presenciales,
                    "empleados_teletrabajo": emp.empleados_teletrabajo,
                    "empleados_mixta": emp.empleados_mixta,
                    "tipos_contratos": emp.tipos_contratos,
                    "distribucion_contratos": emp.distribucion_contratos,
                    "ventas_reales": emp.ventas_reales,
                    "ventas_presupuestadas": emp.ventas_presupuestadas,
                    "ingresos_reales": emp.ingresos_reales,
                    "ingresos_presupuestados": emp.ingresos_presupuestados,
                    "excedentes_reales": emp.excedentes_reales,
                    "excedentes_presupuestados": emp.excedentes_presupuestados,
                    "fecha_diligenciamiento": emp.fecha_diligenciamiento.isoformat() if emp.fecha_diligenciamiento else None,
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
    """Obtiene TODOS los datos de la empresa asociados a un upload."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload or not upload.empresa:
        raise HTTPException(status_code=404, detail="Upload no encontrado")

    emp = db.query(Empresa).filter(Empresa.nombre_empresa == upload.empresa).order_by(Empresa.id.desc()).first()
    if not emp:
        return {"nombre_empresa": upload.empresa}

    return {
        "id": emp.id,
        "nombre_empresa": emp.nombre_empresa,
        "razon_social": emp.razon_social,
        "nit": emp.nit,
        "direccion": emp.direccion,
        "telefono": emp.telefono,
        "departamento": emp.departamento,
        "ciudad": emp.ciudad,
        "sector_economico": emp.sector_economico,
        "actividad_economica": emp.actividad_economica,
        "tipo_empresa": emp.tipo_empresa,
        "principales_productos": emp.principales_productos,
        "consultor": emp.consultor,
        "persona_contacto": emp.persona_contacto,
        "cargo_contacto": emp.cargo_contacto,
        "telefono_contacto": emp.telefono_contacto,
        "email_contacto": emp.email_contacto,
        "motivacion": emp.motivacion,
        "num_personas_contratadas": emp.num_personas_contratadas,
        "empleados_presenciales": emp.empleados_presenciales,
        "empleados_teletrabajo": emp.empleados_teletrabajo,
        "empleados_mixta": emp.empleados_mixta,
        "tipos_contratos": emp.tipos_contratos,
        "distribucion_contratos": emp.distribucion_contratos,
        "ventas_reales": emp.ventas_reales,
        "ventas_presupuestadas": emp.ventas_presupuestadas,
        "ingresos_reales": emp.ingresos_reales,
        "ingresos_presupuestados": emp.ingresos_presupuestados,
        "excedentes_reales": emp.excedentes_reales,
        "excedentes_presupuestados": emp.excedentes_presupuestados,
        "fecha_diligenciamiento": emp.fecha_diligenciamiento.isoformat() if emp.fecha_diligenciamiento else None,
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
# HOMOLOGACION CON IA (endpoint principal - async con progreso)
# ==========================================

@app.post("/homologacion/ejecutar")
def ejecutar_homologacion(
    upload_id: int = Query(..., description="Upload ID"),
    usar_ia: bool = Query(True, description="Usar IA para los no encontrados"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Inicia homologacion en segundo plano y retorna inmediatamente para polling."""
    from .database import SessionLocal
    from .services.matcher import find_exact_matches, load_all_masters

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    if not cargos:
        raise HTTPException(status_code=404, detail="No hay cargos en este upload")

    total_cargos = len(cargos)

    # Inicializar estado de progreso
    with _progress_lock:
        _homologacion_progress[upload_id] = {
            "status": "procesando",
            "total": total_cargos,
            "processed": 0,
            "exact_matches": 0,
            "ia_suggested": 0,
            "not_matched": 0,
            "current_batch": "Iniciando...",
            "current_cargo": None,
            "recent_results": [],
            "started_at": __import__('datetime').datetime.now().isoformat(),
        }

    # Iniciar procesamiento en background con sesion propia
    def run_homologacion():
        thread_db = SessionLocal()
        try:
            from .services.matcher import find_exact_matches, load_all_masters

            # Re-cargar cargos con la sesion del thread
            cargos_thread = thread_db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
            masters = load_all_masters(thread_db)

            matched_exact, unmatched = find_exact_matches(cargos_thread, masters)

            with _progress_lock:
                _homologacion_progress[upload_id]["current_batch"] = "Procesando matchs exactos..."

            # Phase 1: Exact matches
            exact_count = 0
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
                    thread_db.add(homo)
                cargo.estado = "HOMOLOGADO"
                exact_count += 1

                with _progress_lock:
                    prog = _homologacion_progress.get(upload_id, {})
                    prog["processed"] = exact_count
                    prog["exact_matches"] = exact_count
                    prog["current_cargo"] = cargo.nombre_cargo
                    prog["recent_results"].append({
                        "id": cargo.id,
                        "nombre_cargo": cargo.nombre_cargo,
                        "cargo_homologado": master["nombre"],
                        "estado": "homologado",
                        "justificacion": f"Match exacto ({master.get('area', '')})",
                        "tipo": "exacto",
                    })

            thread_db.commit()
            print(f"Homologacion: {exact_count} matchs exactos guardados")

            with _progress_lock:
                _homologacion_progress[upload_id]["exact_matches"] = exact_count

            # Phase 2: IA for unmatched - process in small batches with commit per batch
            ia_suggested = 0
            total_processed = exact_count
            if usar_ia and unmatched:
                from .services.ia_service import homologar_con_ia

                with _progress_lock:
                    _homologacion_progress[upload_id]["current_batch"] = f"Consultando IA ({len(unmatched)} cargos restantes)..."

                # Process unmatched one batch at a time (batch of 8), commit after each
                for batch_start in range(0, len(unmatched), 8):
                        batch = unmatched[batch_start:batch_start + 8]
                        cargos_batch = [{
                            "id": c.id,
                            "nombre_cargo": c.nombre_cargo,
                            "area": c.area,
                            "descripcion": c.descripcion_empresa or "",
                            "descripcion_empresa": c.descripcion_empresa or "",
                            "cargo_jefe": "",
                        } for c in batch]

                        try:
                            resultados = homologar_con_ia(thread_db, cargos_batch, masters)
                        except Exception as e:
                            print(f"Error en lote IA batch {batch_start}: {e}")
                            resultados = [
                                {"id": c["id"], "cargo_homologado": "SIN COINCIDENCIA", "justificacion": f"Error IA: {str(e)[:80]}", "confianza": 0.0}
                                for c in cargos_batch
                            ]

                        # Process results for this batch
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
                                thread_db.add(homo)

                            cargo_homologado = res.get("cargo_homologado", "SIN COINCIDENCIA")
                            justificacion = res.get("justificacion", "")
                            confianza = res.get("confianza", 0)

                            total_processed += 1

                            with _progress_lock:
                                prog = _homologacion_progress.get(upload_id, {})
                                prog["processed"] = total_processed
                                prog["current_cargo"] = cargo.nombre_cargo

                            if cargo_homologado and cargo_homologado != "SIN COINCIDENCIA":
                                homo.cargo_homologado = cargo_homologado
                                homo.justificacion = f"Sugerido IA: {justificacion} (confianza: {confianza})"
                                homo.editado_manual = False
                                cargo.estado = "SUGERIDO"
                                ia_suggested += 1
                                with _progress_lock:
                                    prog["ia_suggested"] = ia_suggested
                                    prog["recent_results"].append({
                                        "id": cargo.id,
                                        "nombre_cargo": cargo.nombre_cargo,
                                        "cargo_homologado": cargo_homologado,
                                        "estado": "sugerido",
                                        "justificacion": f"Sugerido IA: {justificacion}",
                                        "tipo": "ia",
                                    })
                            else:
                                homo.cargo_homologado = "SIN COINCIDENCIA"
                                homo.justificacion = f"IA: {justificacion}" if justificacion else "Sin coincidencia"
                                cargo.estado = "SIN_COINCIDENCIA"
                                with _progress_lock:
                                    prog = _homologacion_progress.get(upload_id, {})
                                    prog["not_matched"] = prog.get("not_matched", 0) + 1
                                    prog["recent_results"].append({
                                        "id": cargo.id,
                                        "nombre_cargo": cargo.nombre_cargo,
                                        "cargo_homologado": "SIN COINCIDENCIA",
                                        "estado": "sin_coincidencia",
                                        "justificacion": justificacion or "Sin coincidencia",
                                        "tipo": "sin_coincidencia",
                                    })

                        # Trim recent results
                        with _progress_lock:
                            prog = _homologacion_progress.get(upload_id, {})
                            if len(prog.get("recent_results", [])) > 50:
                                prog["recent_results"] = prog["recent_results"][-50:]

                        # Commit after each batch so progress is saved even if next batch fails
                        try:
                            thread_db.commit()
                        except Exception as e:
                            thread_db.rollback()
                            print(f"Error commit batch {batch_start}: {e}")

                        print(f"Batch {batch_start//8 + 1} completado, total procesados: {total_processed}/{total_cargos}")

            with _progress_lock:
                prog = _homologacion_progress.get(upload_id, {})
                prog["status"] = "completado"
                prog["processed"] = total_processed
                prog["exact_matches"] = exact_count
                prog["ia_suggested"] = ia_suggested
                prog["not_matched"] = len(unmatched) - ia_suggested
                prog["current_batch"] = "Completado"
                prog["current_cargo"] = None

            print(f"Homologacion completada: {total_processed} cargos procesados ({exact_count} exactos, {ia_suggested} IA, {len(unmatched) - ia_suggested} sin coinc.)")
        except Exception as e:
            print(f"Error CRITICO en thread homologacion: {e}")
            import traceback
            traceback.print_exc()
            with _progress_lock:
                _homologacion_progress[upload_id]["status"] = "error"
                _homologacion_progress[upload_id]["current_batch"] = f"Error: {str(e)[:100]}"
        finally:
            thread_db.close()

    # Start background thread
    thread = threading.Thread(target=run_homologacion, daemon=True)
    thread.start()

    return {
        "mensaje": "Homologacion iniciada en segundo plano",
        "total": total_cargos,
        "upload_id": upload_id,
    }

@app.get("/homologacion/status/{upload_id}")
def get_homologacion_status(upload_id: int, db: Session = Depends(get_db)):
    """Obtiene el estado actual del procesamiento de homologacion."""
    with _progress_lock:
        progress = _homologacion_progress.get(upload_id)

    if not progress:
        # Check if homologacion was already completed (no progress tracking)
        cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
        if not cargos:
            raise HTTPException(status_code=404, detail="Upload no encontrado")
        
        stats = {
            "total": len(cargos),
            "homologados": sum(1 for c in cargos if c.estado == "HOMOLOGADO"),
            "sugeridos": sum(1 for c in cargos if c.estado == "SUGERIDO"),
            "sin_coincidencia": sum(1 for c in cargos if c.estado == "SIN_COINCIDENCIA"),
            "pendientes": sum(1 for c in cargos if c.estado in ["PENDIENTE", "PROCESANDO"]),
        }
        return {
            "status": "no_iniciado" if stats["pendientes"] == stats["total"] else "completado",
            **stats,
            "recent_results": [],
            "current_cargo": None,
            "current_batch": "Procesamiento previo completado",
        }

    return progress

@app.get("/homologacion/results/{upload_id}")
def get_homologacion_results(upload_id: int, db: Session = Depends(get_db)):
    """Obtiene los cargos con sus homologaciones (para polling durante procesamiento)."""
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    result = []
    for c in cargos:
        h = c.homologacion
        result.append({
            "id": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area,
            "estado": c.estado,
            "descripcion_empresa": c.descripcion_empresa,
            "homologacion": {
                "cargo_homologado": h.cargo_homologado if h else None,
                "justificacion": h.justificacion if h else None,
                "editado_manual": h.editado_manual if h else False,
                "datos_excel": h.datos_excel if h else {},
            } if h else None
        })
    return result

class ReprocesarRequest(BaseModel):
    observaciones: str = ""
    cargo_ids: Optional[List[int]] = None

@app.post("/homologacion/reprocesar")
def reprocesar_homologacion(
    upload_id: int = Query(..., description="Upload ID"),
    req: ReprocesarRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reprocesa homologaciones usando IA con las observaciones del analista."""
    from .database import SessionLocal
    from .services.ia_service import homologar_con_ia_observaciones
    from .services.matcher import load_all_masters

    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    if not cargos:
        raise HTTPException(status_code=404, detail="No hay cargos en este upload")

    if req.cargo_ids:
        cargos_to_reprocess = [c for c in cargos if c.id in req.cargo_ids]
    else:
        cargos_to_reprocess = [c for c in cargos if c.estado not in ["HOMOLOGADO"]]

    if not cargos_to_reprocess:
        return {"mensaje": "No hay cargos seleccionados para reprocesar"}

    cargo_ids_to_reprocess = [c.id for c in cargos_to_reprocess]
    observaciones_text = req.observaciones

    with _progress_lock:
        _homologacion_progress[upload_id] = {
            "status": "reprocesando",
            "total": len(cargos_to_reprocess),
            "processed": 0,
            "exact_matches": 0,
            "ia_suggested": 0,
            "not_matched": 0,
            "current_batch": "Iniciando reproceso...",
            "current_cargo": None,
            "recent_results": [],
            "started_at": __import__('datetime').datetime.now().isoformat(),
        }

    def run_reproceso():
        thread_db = SessionLocal()
        try:
            from .services.ia_service import homologar_con_ia_observaciones
            from .services.matcher import load_all_masters

            cargos_thread = thread_db.query(Cargo).filter(Cargo.id.in_(cargo_ids_to_reprocess)).all()
            masters = load_all_masters(thread_db)

            cargos_batch = [{
                "id": c.id,
                "nombre_cargo": c.nombre_cargo,
                "area": c.area,
                "descripcion": c.descripcion_empresa or "",
                "descripcion_empresa": c.descripcion_empresa or "",
                "cargo_homologado_actual": c.homologacion.cargo_homologado if c.homologacion else "",
            } for c in cargos_thread]

            results_count = 0
            resultados = homologar_con_ia_observaciones(thread_db, cargos_batch, masters, observaciones_text, selected_ids=cargo_ids_to_reprocess if req.cargo_ids else None)

            for res in resultados:
                cargo_id = res.get("id")
                cargo = next((c for c in cargos_thread if c.id == cargo_id), None)
                if not cargo:
                    continue

                homo = cargo.homologacion
                if not homo:
                    homo = Homologacion(cargo_id=cargo.id)
                    thread_db.add(homo)

                cargo_homologado = res.get("cargo_homologado", "SIN_COINCIDENCIA")
                justificacion = res.get("justificacion", "")
                results_count += 1

                with _progress_lock:
                    prog = _homologacion_progress.get(upload_id, {})
                    prog["processed"] = results_count
                    prog["current_cargo"] = cargo.nombre_cargo

                if cargo_homologado and cargo_homologado != "SIN_COINCIDENCIA":
                    homo.cargo_homologado = cargo_homologado
                    homo.justificacion = f"Reproceso IA (obs. analista): {justificacion}"
                    homo.editado_manual = False
                    cargo.estado = "SUGERIDO"
                    with _progress_lock:
                        prog["ia_suggested"] = results_count
                        prog["recent_results"].append({
                            "id": cargo.id, "nombre_cargo": cargo.nombre_cargo,
                            "cargo_homologado": cargo_homologado, "estado": "sugerido",
                            "justificacion": f"Reproceso: {justificacion}", "tipo": "reproceso",
                        })
                else:
                    homo.cargo_homologado = "SIN_COINCIDENCIA"
                    homo.justificacion = f"Reproceso IA: {justificacion}" if justificacion else "Sin coincidencia"
                    cargo.estado = "SIN_COINCIDENCIA"
                    with _progress_lock:
                        prog["not_matched"] = prog.get("not_matched", 0) + 1
                        prog["recent_results"].append({
                            "id": cargo.id, "nombre_cargo": cargo.nombre_cargo,
                            "cargo_homologado": "SIN COINCIDENCIA", "estado": "sin_coincidencia",
                            "justificacion": justificacion or "Sin coincidencia", "tipo": "reproceso",
                        })

                with _progress_lock:
                    prog = _homologacion_progress.get(upload_id, {})
                    if len(prog.get("recent_results", [])) > 50:
                        prog["recent_results"] = prog["recent_results"][-50:]

            thread_db.commit()
            print(f"Reproceso completado: {results_count}/{len(cargos_thread)} cargos")

            with _progress_lock:
                prog = _homologacion_progress.get(upload_id, {})
                prog["status"] = "completado"
                prog["current_batch"] = "Reproceso completado"
                prog["current_cargo"] = None
        except Exception as e:
            print(f"Error CRITICO en thread reproceso: {e}")
            import traceback
            traceback.print_exc()
            with _progress_lock:
                _homologacion_progress[upload_id]["status"] = "error"
                _homologacion_progress[upload_id]["current_batch"] = f"Error: {str(e)[:100]}"
        finally:
            thread_db.close()

    thread = threading.Thread(target=run_reproceso, daemon=True)
    thread.start()

    return {
        "mensaje": f"Reproceso iniciado para {len(cargos_to_reprocess)} cargos",
        "reprocesados": len(cargos_to_reprocess),
        "upload_id": upload_id,
    }

@app.get("/ia/status")
def ia_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Diagnostico del servicio de IA."""
    from .services.ia_service import OPENAI_API_KEY, OPENAI_MODEL

    status = {
        "openai_key": "CONFIGURADA" if OPENAI_API_KEY else "NO CONFIGURADA",
        "openai_model": OPENAI_MODEL,
    }

    if OPENAI_API_KEY:
        status["test"] = "OK - API key configurada"
    else:
        status["test"] = "ERROR - Ninguna API key configurada. Agrega OPENAI_API_KEY en Render Environment Variables"

    return status

# ==========================================
# BUSQUEDA EN INTERNET PARA SIN_COINCIDENCIA
# ==========================================

@app.post("/homologacion/{cargo_id}/buscar-internet")
def buscar_internet_homologar(cargo_id: int, db: Session = Depends(get_db)):
    """Busca funciones del cargo en internet y homologa contra la base maestra."""
    from .services.ia_service import buscar_en_internet_y_homologar

    cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")

    hom = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
    if not hom:
        hom = Homologacion(cargo_id=cargo.id)
        db.add(hom)

    cargo_dict = {
        "id": cargo.id,
        "nombre_cargo": cargo.nombre_cargo,
        "area": cargo.area,
        "descripcion_empresa": cargo.descripcion_empresa or "",
    }

    try:
        resultado = buscar_en_internet_y_homologar(cargo_dict, db)
    except Exception as e:
        logger.error(f"Error en busqueda internet para cargo {cargo_id}: {e}")
        # Fallback: usar IA directamente sin busqueda web
        try:
            from .services.ia_service import homologar_con_ia, load_all_masters
            masters = load_all_masters(db)
            resultado = homologar_con_ia(cargo_dict, masters)
            resultado["url_busqueda"] = f"https://duckduckgo.com/?q={requests.utils.quote(cargo.nombre_cargo)}"
            resultado["justificacion"] = "IA directa (sin busqueda web): " + resultado.get("justificacion", "")
        except Exception as e2:
            logger.error(f"Fallback IA tambien fallo: {e2}")
            # Ultimo fallback: dejar sin cambios
            resultado = {
                "cargo_homologado": "SIN COINCIDENCIA",
                "justificacion": f"Error en busqueda y IA: {str(e)[:100]}",
                "url_busqueda": f"https://duckduckgo.com/?q={requests.utils.quote(cargo.nombre_cargo)}",
            }

    hom.cargo_homologado = resultado["cargo_homologado"]
    hom.justificacion = resultado["justificacion"]
    hom.busqueda_internet_url = resultado["url_busqueda"]
    hom.estado_busqueda = "BUSCADO_EN_INTERNET"
    db.commit()

    # Actualizar el estado del cargo
    cargo.estado = "BUSCADO_EN_INTERNET"
    db.commit()

    return {
        "cargo_id": cargo_id,
        "cargo_homologado": resultado["cargo_homologado"],
        "justificacion": resultado["justificacion"],
        "url_busqueda": resultado["url_busqueda"],
        "estado": "BUSCADO_EN_INTERNET",
    }

@app.post("/homologacion/buscar-internet-lote")
def buscar_internet_lote(body: dict = Body(...), db: Session = Depends(get_db)):
    """Busqueda en internet para multiple cargos SIN_COINCIDENCIA."""
    cargo_ids = body.get("cargo_ids", [])
    if not cargo_ids:
        return {"resultados": [], "mensaje": "No hay cargos para buscar"}
    
    from .services.ia_service import buscar_en_internet_y_homologar

    resultados = []
    errores = 0
    procesados = 0
    for cargo_id in cargo_ids:
        try:
            cargo = db.query(Cargo).filter(Cargo.id == cargo_id).first()
            if not cargo:
                resultados.append({"cargo_id": cargo_id, "error": "Cargo no encontrado"})
                continue

            hom = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
            if not hom:
                hom = Homologacion(cargo_id=cargo.id)
                db.add(hom)

            cargo_dict = {
                "id": cargo.id,
                "nombre_cargo": cargo.nombre_cargo,
                "area": cargo.area,
                "descripcion_empresa": cargo.descripcion_empresa or "",
            }

            resultado = buscar_en_internet_y_homologar(cargo_dict, db)

            hom.cargo_homologado = resultado["cargo_homologado"]
            hom.justificacion = resultado["justificacion"]
            hom.busqueda_internet_url = resultado.get("url_busqueda", "")
            hom.estado_busqueda = "BUSCADO_EN_INTERNET"
            cargo.estado = "BUSCADO_EN_INTERNET"
            db.commit()
            procesados += 1

            resultados.append({
                "cargo_id": cargo_id,
                "cargo_homologado": resultado.get("cargo_homologado", "SIN COINCIDENCIA"),
                "justificacion": resultado.get("justificacion", ""),
                "url_busqueda": resultado.get("url_busqueda", ""),
                "estado": "BUSCADO_EN_INTERNET",
            })
            time.sleep(2)  # Delay entre cargos para evitar rate limiting
        except Exception as e:
            db.rollback()
            errores += 1
            logger.error(f"Error en busqueda para cargo {cargo_id}: {e}")
            resultados.append({"cargo_id": cargo_id, "error": str(e)})
    
    logger.info(f"Busqueda masiva completada: {procesados} exitosos, {errores} errores de {len(cargo_ids)} totales")
    return {"resultados": resultados, "procesados": procesados, "errores": errores, "total": len(cargo_ids)}

    return {"resultados": resultados}

# ==========================================
# VALORACION CON IA
# ==========================================

@app.post("/valoracion/{cargo_id}/evaluar-ia")
def evaluar_cargo_con_ia(cargo_id: int, db: Session = Depends(get_db)):
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
def start_valoracion_processing(upload_id: int, background_tasks: BackgroundTasks):
    """Inicia valoracion de TODOS los cargos de un upload con IA."""
    from .services.valoracion_processor import start_valoracion_batch
    background_tasks.add_task(start_valoracion_batch, upload_id)
    return {"message": "Valoracion iniciada en segundo plano"}

@app.get("/uploads/{upload_id}/valoraciones")
def list_valoraciones(upload_id: int, db: Session = Depends(get_db)):
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
    """Generate salary curves and return curve data for frontend."""
    from .services.analisis_service import _estimar_puntos
    from .models import Valoracion, Cargo

    # Generate curves (saved to DB)
    calcular_curvas_equidad(db, upload_id=upload_id)

    # Get valuation data to return curve points
    valoraciones = db.query(Valoracion).join(Cargo).filter(
        Cargo.upload_id == upload_id
    ).all()

    puntos_data = []
    for v in valoraciones:
        cargo = db.query(Cargo).filter(Cargo.id == v.cargo_id).first()
        if cargo:
            pts = _estimar_puntos(v)
            salario_est = pts * 25000
            salario_actual = float(v.garantizado or v.basico or 0)
            if salario_actual > 0:
                puntos_data.append({
                    "cargo": cargo.nombre_cargo,
                    "puntos": pts,
                    "valor": salario_actual,
                })

    puntos_data.sort(key=lambda x: x["puntos"])

    return {
        "min": [{"puntos": d["puntos"], "valor": d["valor"] * 0.85, "cargo": d["cargo"]} for d in puntos_data],
        "mid": [{"puntos": d["puntos"], "valor": d["valor"], "cargo": d["cargo"]} for d in puntos_data],
        "max": [{"puntos": d["puntos"], "valor": d["valor"] * 1.3, "cargo": d["cargo"]} for d in puntos_data],
    }

@app.get("/analisis/reporte/upload/{upload_id}")
def get_reporte_upload(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate consolidated analysis report using analisis_service."""
    from .services.analisis_service import (
        analizar_equidad,
        calcular_costos_nivelacion,
        reporte_consolidado,
    )
    from .services.ia_service import call_ia
    from .models import Valoracion, Cargo

    # Get equity analysis
    equidad = analizar_equidad(db, upload_id=upload_id)

    # Get nivelacion costs
    nivelacion = calcular_costos_nivelacion(db, upload_id=upload_id)

    # Get salary data for curves and competitividad
    valoraciones = db.query(Valoracion).join(Cargo).filter(Cargo.upload_id == upload_id).all()
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()

    puntos_data = []
    competitividad_detalles = []

    for v in valoraciones:
        cargo = db.query(Cargo).filter(Cargo.id == v.cargo_id).first()
        if not cargo:
            continue

        from .services.analisis_service import _estimar_puntos
        pts = _estimar_puntos(v)
        salario_est = pts * 25000
        salario_actual = float(v.garantizado or v.basico or 0)

        puntos_data.append({
            "cargo": cargo.nombre_cargo,
            "puntos": pts,
            "valor": salario_est,
            "salario_actual": salario_actual,
        })

        if salario_actual > 0 and salario_est > 0:
            posicion = (salario_actual / salario_est) * 100
        else:
            posicion = 100

        competitividad_detalles.append({
            "cargo": cargo.nombre_cargo,
            "actual": salario_actual,
            "referencia": salario_est,
            "posicion": round(posicion, 1),
            "salario_empresa": salario_actual,
            "mercado_p50": salario_est,
            "diferencia_pct": round(posicion - 100, 1),
        })

    puntos_data.sort(key=lambda x: x["puntos"])

    return {
        "equidad": equidad,
        "curvas": {
            "min": [{"puntos": d["puntos"], "valor": d["valor"] * 0.85, "cargo": d["cargo"]} for d in puntos_data],
            "mid": [{"puntos": d["puntos"], "valor": d["valor"], "cargo": d["cargo"]} for d in puntos_data],
            "max": [{"puntos": d["puntos"], "valor": d["valor"] * 1.3, "cargo": d["cargo"]} for d in puntos_data],
        },
        "nivelacion": nivelacion,
        "competitividad": {
            "promedio": round(sum(d["posicion"] for d in competitividad_detalles) / len(competitividad_detalles), 1) if competitividad_detalles else 0,
            "cargos": competitividad_detalles[:10],
        },
    }

def _estimar_puntos_totales(v):
    """Calculate total points from valuation - delegates to analisis_service."""
    from .services.analisis_service import _estimar_puntos
    return _estimar_puntos(v)

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
