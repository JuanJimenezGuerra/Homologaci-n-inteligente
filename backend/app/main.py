from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import get_db, engine, Base
from .models import User, Upload, Cargo, Homologacion, JobStatus, ProcessingLog, Empresa, CargoEmpresa, ValoracionCargo
from .auth import get_password_hash, create_access_token, verify_password, get_current_user
from .services.excel_processor import process_requirements_excel
from .services.master_data import process_master_excel
from .services.matcher import start_batch_processing
from .services.excel_formulario_service import procesar_excel_formulario, guardar_en_db
from .services.homologacion_service import homologar_cargo, homologar_lote, obtener_criterios, guardar_criterios
from .services.valoracion_service import valorar_cargo, valorar_lote, resumen_valoracion
from .services.analisis_service import calcular_curvas_equidad, analizar_equidad, calcular_nivelacion, reporte_consolidado
import os
import shutil
from typing import List
from pydantic import BaseModel

# Create tables
try:
    print("Iniciando creación de tablas...")
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas/verificadas exitosamente.")
except Exception as e:
    print(f"ERROR CRÍTICO al conectar a la base de datos: {e}")
    # En desarrollo esto ayuda, en producción nos dice por qué falló el despliegue

app = FastAPI(title="SHR Homologación API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---
class LoginRequest(BaseModel):
    email: str
    password: str

class HomologacionUpdate(BaseModel):
    cargo_homologado: str
    justificacion: str

# --- Seed Data ---
from .models import MasterDescription

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    
    # Usuarios obligatorios con contraseña fija
    seed_users = [
        ("admin@shr.com", "admin123"),
        ("analista1@shr.com", "admin123"),
        ("analista2@shr.com", "admin123"),
    ]
    
    for email, password in seed_users:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # Actualizar password hash para garantizar acceso (por si cambió el secret/SECRET_KEY)
            existing.password_hash = get_password_hash(password)
        else:
            db.add(User(email=email, password_hash=get_password_hash(password)))
    
    db.commit()
    print("Usuarios seed verificados/creados")
        
    # Verificar si la base maestra está vacía o incompleta y cargarla automáticamente
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
            print(f"No se encontró el archivo maestro en {master_path}")

# --- Endpoints ---

from fastapi.security import OAuth2PasswordRequestForm

@app.post("/token")
@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/uploads/master")
def upload_master_file(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    temp_path = f"temp_master_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        count = process_master_excel(temp_path, db)
        return {"message": f"Se cargaron {count} descripciones maestras", "count": count}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

from fastapi import Form

@app.post("/uploads/requirements")
def upload_requirements_file(empresa: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    print(f"=== Upload request ===")
    print(f"empresa param: {empresa}")
    print(f"file: {file.filename}")
    print(f"user_id: {current_user.id}")
    print(f"Columns in Upload (actual): {list(Upload.__table__.columns.keys())}")
    
    # Create upload record SIN empresa_id
    upload = Upload(
        user_id=current_user.id, 
        filename=file.filename, 
        empresa=empresa.upper(),
        status="pendiente"
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    print(f"Upload created with id: {upload.id}")

    temp_path = os.path.join("/tmp", f"temp_req_{upload.id}_{file.filename.replace(' ', '_')}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"=== Calling process_requirements_excel with file: {temp_path} ===")
        count = process_requirements_excel(temp_path, upload.id, db)
        print(f"=== Excel processed: {count} cargos created ===")
        return {"upload_id": upload.id, "count": count}
    except Exception as e:
        print(f"Error procesando excel: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error en el Excel: {str(e)}"
        )
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

from .services.file_extractor import process_extra_descriptions

@app.post("/uploads/{upload_id}/manuales")
async def upload_manuales(upload_id: int, files: List[UploadFile] = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = process_extra_descriptions(upload_id, files, db)
    return {"message": f"Se procesaron {len(files)} archivos y se mapearon {count} descripciones de cargo", "count": count}
@app.get("/uploads")
def list_uploads(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Upload).all()

@app.get("/uploads/{upload_id}/cargos")
def list_cargos(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    print(f"=== list_cargos called with upload_id: {upload_id} ===")
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    print(f"Found {len(cargos)} cargos for upload_id {upload_id}")
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
    print(f"Returning {len(result)} cargos")
    return result

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
def start_processing(upload_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    background_tasks.add_task(start_batch_processing, upload_id, db)
    return {"message": "Procesamiento iniciado en segundo plano"}

@app.post("/procesar/{upload_id}/cancel")
def cancel_processing(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload no encontrado")
    
    upload.status = "cancelado"
    
    # Marcar los cargos pendientes o procesando como PENDIENTE para que se puedan reintentar luego
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id, Cargo.estado.in_(["PROCESANDO", "PENDIENTE"])).all()
    for c in cargos:
        c.estado = "PENDIENTE"
        
    db.commit()
    return {"message": "Procesamiento cancelado"}

@app.post("/webhook/n8n")
def n8n_webhook(data: dict, db: Session = Depends(get_db)):
    """
    Receives results from n8n.
    Expected data: {
        "results": [
            {"cargo_id": 1, "cargo_homologado": "...", "justificacion": "...", "status": "homologado"},
            ...
        ]
    }
    """
    results = data.get("results", [])
    for res in results:
        cargo_id = res.get("cargo_id")
        cargo = db.query(Cargo).get(cargo_id)
        if not cargo:
            continue
        
        # Validation
        homologado = res.get("cargo_homologado")
        justificacion = res.get("justificacion")
        status_ia = res.get("status", "homologado")
        
        if not homologado or not justificacion:
            cargo.estado = JobStatus.ERROR
            log = ProcessingLog(
                upload_id=cargo.upload_id,
                cargo_id=cargo.id,
                level="ERROR",
                message="Respuesta de IA inválida o incompleta",
                raw_response=str(res)
            )
            db.add(log)
        else:
            cargo.estado = JobStatus.HOMOLOGADO if status_ia != "SIN COINCIDENCIA" else JobStatus.SIN_COINCIDENCIA
            
            # Upsert homologacion
            homo = db.query(Homologacion).filter(Homologacion.cargo_id == cargo.id).first()
            if not homo:
                homo = Homologacion(cargo_id=cargo.id)
                db.add(homo)
            
            homo.cargo_homologado = homologado
            homo.justificacion = justificacion
            
            log = ProcessingLog(
                upload_id=cargo.upload_id,
                cargo_id=cargo.id,
                level="INFO",
                message=f"IA procesó exitosamente: {homologado}",
                raw_response=str(res)
            )
            db.add(log)
            
    db.commit()
    return {"status": "ok"}

@app.patch("/cargos/{cargo_id}")
def update_cargo_manual(cargo_id: int, req: HomologacionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cargo = db.query(Cargo).get(cargo_id)
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

from .services.excel_exporter import export_to_excel

from .models import Valoracion

@app.post("/procesar-valoracion/{upload_id}")
def start_valoracion_processing(upload_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Inicia el proceso de valoración de cargos con IA"""
    from .services.valoracion_processor import start_valoracion_batch
    background_tasks.add_task(start_valoracion_batch, upload_id, db)
    return {"message": "Valoración iniciada en segundo plano"}

@app.get("/uploads/{upload_id}/valoraciones")
def list_valoraciones(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtiene las valoraciones de un upload"""
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    result = []
    for c in cargos:
        val = c.valoracion
        result.append({
            "id": c.id,
            "nombre_cargo": c.nombre_cargo,
            "area": c.area,
            "cargo_homologado": c.homologacion.cargo_homologado if c.homologacion else None,
            "valoracion": {
                "conocimientos": val.conocimientos if val else None,
                "experiencia": val.experiencia if val else None,
                "habilidad_gerencial": val.habilidad_gerencial if val else None,
                "rol_cargo": val.rol_cargo if val else None,
                "contacto": val.contacto if val else None,
                "frecuencia": val.frecuencia if val else None,
                "contenido_relaciones": val.contenido_relaciones if val else None,
                "complejidad_conceptual": val.complejidad_conceptual if val else None,
                "tendencia_cc": val.tendencia_cc if val else None,
                "guias_apoyo": val.guias_apoyo if val else None,
                "tendencia_ga": val.tendencia_ga if val else None,
                "impacto": val.impacto if val else None,
                "autonomia": val.autonomia if val else None,
                "magnitud": val.magnitud if val else None,
                "criterio_1": val.criterio_1 if val else 0,
                "criterio_2": val.criterio_2 if val else 0,
                "criterio_3": val.criterio_3 if val else 0,
                "editado_manual": val.editado_manual if val else False,
            } if val else None
        })
    return result

@app.patch("/valoracion/{cargo_id}")
def update_valoracion_manual(cargo_id: int, req: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Actualiza manualmente una valoración"""
    cargo = db.query(Cargo).get(cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    
    val = db.query(Valoracion).filter(Valoracion.cargo_id == cargo.id).first()
    if not val:
        val = Valoracion(cargo_id=cargo.id)
        db.add(val)
    
    # Actualizar campos
    for key, value in req.items():
        if hasattr(val, key):
            setattr(val, key, value)
    
    val.editado_manual = True
    db.commit()
    return {"message": "Valoración actualizada"}

@app.post("/webhook/n8n-valoracion")
def n8n_valoracion_webhook(data: dict, db: Session = Depends(get_db)):
    """
    Recibe resultados de valoración desde n8n.
    Expected: {
        "results": [
            {"cargo_id": 1, "conocimientos": "C", "experiencia": "o", ...},
            ...
        ]
    }
    """
    results = data.get("results", [])
    for res in results:
        cargo_id = res.get("cargo_id")
        cargo = db.query(Cargo).get(cargo_id)
        if not cargo:
            continue
        
        # Upsert valoracion
        val = db.query(Valoracion).filter(Valoracion.cargo_id == cargo.id).first()
        if not val:
            val = Valoracion(cargo_id=cargo.id)
            db.add(val)
        
        # Actualizar campos
        val.conocimientos = res.get("conocimientos")
        val.experiencia = res.get("experiencia")
        val.habilidad_gerencial = res.get("habilidad_gerencial")
        val.rol_cargo = res.get("rol_cargo")
        val.contacto = res.get("contacto")
        val.frecuencia = res.get("frecuencia")
        val.contenido_relaciones = res.get("contenido_relaciones")
        val.complejidad_conceptual = res.get("complejidad_conceptual")
        val.tendencia_cc = res.get("tendencia_cc")
        val.guias_apoyo = res.get("guias_apoyo")
        val.tendencia_ga = res.get("tendencia_ga")
        val.impacto = res.get("impacto")
        val.autonomia = res.get("autonomia")
        val.magnitud = res.get("magnitud")
        val.criterio_1 = res.get("criterio_1", 0)
        val.criterio_2 = res.get("criterio_2", 0)
        val.criterio_3 = res.get("criterio_3", 0)
        
        log = ProcessingLog(
            upload_id=cargo.upload_id,
            cargo_id=cargo.id,
            level="INFO",
            message=f"Valoración procesada por IA",
            raw_response=str(res)
        )
        db.add(log)
            
    db.commit()
    return {"status": "ok"}

@app.get("/descargar/{upload_id}")
def download_excel(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return export_to_excel(upload_id, db)


# ==========================================
# NUEVOS ENDPOINTS PARA PROCESO COMPLETO
# ==========================================

# Endpoint para cargar Excel de Requerimientos
@app.post("/procesar/formulario")
async def procesar_formulario(
    empresa: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cargar archivo Excel de Requerimientos y procesar"""
    
    # Validar API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY no configurada en el servidor"
        )
    
    # Crear empresa
    empresa_obj = Empresa(
        user_id=current_user.id,
        nombre_empresa=empresa.upper()
    )
    db.add(empresa_obj)
    db.commit()
    db.refresh(empresa_obj)
    
    # Guardar archivo temporal
    temp_path = os.path.join("/tmp", f"formulario_{empresa_obj.id}_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Procesar Excel
        datos = procesar_excel_formulario(temp_path)
        
        # Guardar en DB
        resultados = guardar_en_db(db, empresa_obj.id, datos)
        
        return {
            "empresa_id": empresa_obj.id,
            "mensaje": "Archivo procesado exitosamente",
            "datos": resultados
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass


# Obtener empresa con todos sus datos
@app.get("/empresas/{empresa_id}")
def get_empresa(empresa_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtener empresa con todos sus datos"""
    
    empresa = db.query(Empresa).filter(Empresa.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    # Obtener cargos
    cargos = db.query(CargoEmpresa).filter(CargoEmpresa.empresa_id == empresa_id).all()
    
    return {
        "id": empresa.id,
        "nombre_empresa": empresa.nombre_empresa,
        "nit": empresa.nit,
        "razon_social": empresa.razon_social,
        "direccion": empresa.direccion,
        "telefono": empresa.telefono,
        "departamento": empresa.departamento,
        "ciudad": empresa.ciudad,
        "sector_economico": empresa.sector_economico,
        "tipo_empresa": empresa.tipo_empresa,
        "num_personas_contratadas": empresa.num_personas_contratadas,
        "cargos": [
            {
                "id": c.id,
                "nombre_cargo": c.nombre_cargo,
                "area": c.area,
                "num_personas": c.num_personas,
                "basico": c.basico,
                "modalidad": c.modalidad,
                "estado": c.estado,
                "homologado": c.homologado,
            }
            for c in cargos
        ]
    }


# Obtener lista de empresas
@app.get("/empresas")
def list_empresas(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Listar todas las empresas"""
    empresas = db.query(Empresa).all()
    return [
        {
            "id": e.id,
            "nombre_empresa": e.nombre_empresa,
            "nit": e.nit,
            "ciudad": e.ciudad,
        }
        for e in empresas
    ]


@app.post("/homologacion/ejecutar")
def ejecutar_homologacion(
    upload_id: int,
    criterios: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ejecutar homologación para todos los cargos de un upload (usa modelo Cargo legacy)"""
    
    criterios = criterios or {}
    
    # Obtener todos los cargos del upload
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    print(f"=== Ejecutando homologación para {len(cargos)} cargos (upload {upload_id}) ===")
    
    # Obtener master_cargos para búsqueda exacta
    from ..models import MasterDescription
    masters = db.query(MasterDescription).all()
    print(f"=== Master descriptions disponibles: {len(masters)} ===")
    
    # Convertir a dict para búsqueda rápida
    master_dict = {m.nombre_cargo.upper().strip(): m for m in masters}
    
    results = []
    matched = 0
    not_matched = 0
    
    for cargo in cargos:
        nombre_busqueda = cargo.nombre_cargo.upper().strip()
        
        # Buscar coincidencia exacta en master
        master = master_dict.get(nombre_busqueda)
        
        if master:
            # Actualizar homologación existente o crear nueva
            homo = cargo.homologacion
            if homo:
                homo.cargo_homologado = master.nombre_cargo
                homo.justificacion = f"Coincidencia exacta en base maestra (área: {master.area})"
            else:
                homo = Homologacion(cargo_id=cargo.id, cargo_homologado=master.nombre_cargo, 
                                    justificacion=f"Coincidencia exacta en base maestra (área: {master.area})")
                db.add(homo)
            
            cargo.estado = "HOMOLOGADO"
            matched += 1
            results.append({"cargo": cargo.nombre_cargo, "status": "MATCHED", "master": master.nombre_cargo})
        else:
            cargo.estado = "SIN_COINCIDENCIA"
            not_matched += 1
            results.append({"cargo": cargo.nombre_cargo, "status": "NOT_FOUND"})
    
    db.commit()
    print(f"=== Homologación completa: {matched} coincidencia(s), {not_matched} sin coincidir ===")
    
    return {
        "mensaje": f"Se procesaron {len(cargos)} cargos",
        "matched": matched,
        "not_matched": not_matched,
        "upload_id": upload_id
    }


# Ejecutar evaluación
@app.post("/valoracion/ejecutar")
def ejecutar_valoracion(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ejecutar evaluación de 12 factores para todos los cargos"""
    
    resultados = valorar_lote(db, empresa_id)
    
    return {
        "mensaje": f"Se valoraron {len(resultados)} cargos",
        "resultados": len(resultados)
    }


# Análisis - Curvas
@app.post("/analisis/curvas/{empresa_id}")
def generar_curvas(empresa_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generar curvas de equidad"""
    curvas = calcular_curvas_equidad(db, empresa_id)
    return {"curvas_generadas": len(curvas)}


# Análisis - Equidad
@app.get("/analisis/equidad/{empresa_id}")
def get_equidad(empresa_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtener análisis de equidad"""
    return analizar_equidad(db, empresa_id)


# Análisis - Nivelación
@app.get("/analisis/nivelacion/{empresa_id}")
def get_nivelacion(empresa_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtener costos de nivelación"""
    return calcular_nivelacion(db, empresa_id)


# Reporte consolidado
@app.get("/analisis/reporte/{empresa_id}")
def get_reporte(empresa_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Obtener reporte consolidado"""
    return reporte_consolidado(db, empresa_id)
