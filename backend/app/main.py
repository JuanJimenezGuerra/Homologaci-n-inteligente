from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import get_db, engine, Base
from .models import User, Upload, Cargo, Homologacion, JobStatus, ProcessingLog
from .auth import get_password_hash, create_access_token, verify_password, get_current_user
from .services.excel_processor import process_requirements_excel
from .services.master_data import process_master_excel
from .services.matcher import start_batch_processing
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
    # Verificar si el admin principal existe
    admin_email = "admin@shr.com"
    if not db.query(User).filter(User.email == admin_email).first():
        admin = User(email=admin_email, password_hash=get_password_hash("admin123"))
        db.add(admin)
        
        # Otros analistas de prueba
        analistas = [
            User(email="analista1@shr.com", password_hash=get_password_hash("admin123")),
            User(email="analista2@shr.com", password_hash=get_password_hash("admin123")),
        ]
        db.add_all(analistas)
        db.commit()
        print("Usuarios base creados (admin@shr.com / admin123)")
        
    # Verificar si la base maestra está vacía y cargarla automáticamente
    master_count = db.query(MasterDescription).count()
    if master_count == 0:
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
    # Create upload record
    upload = Upload(user_id=current_user.id, filename=file.filename, empresa=empresa.upper())
    db.add(upload)
    db.commit()
    db.refresh(upload)

    temp_path = os.path.join("/tmp", f"temp_req_{upload.id}_{file.filename.replace(' ', '_')}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        count = process_requirements_excel(temp_path, upload.id, db)
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

@app.get("/descargar/{upload_id}")
def download_excel(upload_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return export_to_excel(upload_id, db)
