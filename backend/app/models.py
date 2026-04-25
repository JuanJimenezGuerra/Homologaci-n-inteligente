from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class JobStatus(str, enum.Enum):
    PENDIENTE = "pendiente"
    PROCESANDO = "procesando"
    HOMOLOGADO = "homologado"
    SIN_COINCIDENCIA = "sin_coincidencia"
    ERROR = "error"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    empresa = Column(String, nullable=True) # Nombre de la empresa cliente
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pendiente") # overall status of the upload

    cargos = relationship("Cargo", back_populates="upload")

class Cargo(Base):
    __tablename__ = "cargos"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"))
    nombre_cargo = Column(String)
    area = Column(String)
    descripcion_empresa = Column(Text, nullable=True) # Contenido de archivos PDF/Word
    estado = Column(String, default="PENDIENTE")
    
    upload = relationship("Upload", back_populates="cargos")
    homologacion = relationship("Homologacion", back_populates="cargo", uselist=False)

class Homologacion(Base):
    __tablename__ = "homologaciones"
    id = Column(Integer, primary_key=True, index=True)
    cargo_id = Column(Integer, ForeignKey("cargos.id"))
    cargo_homologado = Column(String)
    justificacion = Column(Text, nullable=True) # Explicación de la IA
    datos_excel = Column(JSON, nullable=True) # Columnas A-AS
    editado_manual = Column(Boolean, default=False)
    
    cargo = relationship("Cargo", back_populates="homologacion")

class MasterDescription(Base):
    __tablename__ = "master_descriptions"
    id = Column(Integer, primary_key=True, index=True)
    nombre_cargo = Column(String, index=True)
    descripcion = Column(Text)
    area = Column(String)

class Valoracion(Base):
    __tablename__ = "valoraciones"
    id = Column(Integer, primary_key=True, index=True)
    cargo_id = Column(Integer, ForeignKey("cargos.id"))
    
    # Factor 1: Conocimiento & Habilidad
    conocimientos = Column(String, nullable=True)  # A-H
    experiencia = Column(String, nullable=True)    # -/o/+
    habilidad_gerencial = Column(String, nullable=True)  # I-VII
    rol_cargo = Column(String, nullable=True)      # 1-4
    
    # Factor 2: Comunicación
    contacto = Column(String, nullable=True)       # A/B/C
    frecuencia = Column(String, nullable=True)     # 1-4
    contenido_relaciones = Column(String, nullable=True)  # I-V
    
    # Factor 3: Solución de Problemas
    complejidad_conceptual = Column(String, nullable=True)  # 1-5
    tendencia_cc = Column(String, nullable=True)
    guias_apoyo = Column(String, nullable=True)    # A-H
    tendencia_ga = Column(String, nullable=True)
    
    # Factor 4: Responsabilidad
    impacto = Column(String, nullable=True)        # I-IV
    autonomia = Column(String, nullable=True)      # A-G
    magnitud = Column(String, nullable=True)       # 1-14
    
    # Criticidad
    criterio_1 = Column(Integer, default=0)        # 0 o 1
    criterio_2 = Column(Integer, default=0)
    criterio_3 = Column(Integer, default=0)
    
    editado_manual = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    cargo = relationship("Cargo", back_populates="valoracion")

# Agregar en Cargo (después de homologacion):
Cargo.valoracion = relationship("Valoracion", back_populates="cargo", uselist=False)

class ProcessingLog(Base):
    __tablename__ = "processing_logs"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"))
    cargo_id = Column(Integer, ForeignKey("cargos.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    level = Column(String) # INFO, ERROR, WARNING
    message = Column(Text)
    raw_response = Column(Text, nullable=True)
