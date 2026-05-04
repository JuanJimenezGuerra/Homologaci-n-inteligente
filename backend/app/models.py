from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum, JSON, Float, Date
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

# ==========================================
# ENTIDADES ORGANIZACIONALES
# ==========================================

class Regional(Base):
    """Region geografica de la empresa (ej: Antioquia, Bogota, Costa)"""
    __tablename__ = "regionales"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sedes = relationship("Sede", back_populates="regional")
    empresas = relationship("Empresa", back_populates="regional")


class Sede(Base):
    """Sede fisica de la empresa (ej: Planta Itagui, Oficina Medellin)"""
    __tablename__ = "sedes"
    id = Column(Integer, primary_key=True, index=True)
    regional_id = Column(Integer, ForeignKey("regionales.id"), nullable=True)
    nombre = Column(String, nullable=False)
    direccion = Column(String, nullable=True)
    ciudad = Column(String, nullable=True)
    departamento = Column(String, nullable=True)
    tipo_sede = Column(String, nullable=True)  # Planta, Oficina, Almacen, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    regional = relationship("Regional", back_populates="sedes")
    areas = relationship("Area", back_populates="sede")


class Area(Base):
    """Area funcional/gerencia de la empresa (ej: Gestion Humana, Financiero, Produccion)"""
    __tablename__ = "areas"
    id = Column(Integer, primary_key=True, index=True)
    sede_id = Column(Integer, ForeignKey("sedes.id"), nullable=True)
    nombre = Column(String, nullable=False)
    nombre_corto = Column(String, nullable=True)  # GH, FIN, PROD
    tipo_area = Column(String, nullable=True)  # Gerencia, Direccion, Coordinacion, etc.
    area_padre_id = Column(Integer, ForeignKey("areas.id"), nullable=True)  # Jerarquia
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sede = relationship("Sede", back_populates="areas")
    area_padre = relationship("Area", remote_side=[id], backref="sub_areas")


# ==========================================
# MUESTRA/PERIODO: Tracking de empresas que vuelven cada ano
# ==========================================

class MuestraPeriodo(Base):
    """Cada vez que una empresa participa en el estudio (un ano/periodo).
    Permite comparar datos historicos de la misma empresa entre periodos."""
    __tablename__ = "muestras_periodo"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False)
    ano = Column(Integer, nullable=False)  # 2024, 2025, 2026
    periodo = Column(String, nullable=True)  # "2025-1", "2025-H1", etc.
    estado = Column(String, default="EN_PROCESO")  # EN_PROCESO, COMPLETADO, ARCHIVADO
    fecha_inicio = Column(Date, nullable=True)
    fecha_completado = Column(Date, nullable=True)
    observaciones = Column(Text, nullable=True)
    consultor = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    empresa = relationship("Empresa", back_populates="muestras")
    uploads = relationship("Upload", back_populates="muestra")


# ==========================================
# BLOQUE A: FORMULARIO DE REQUERIMIENTOS
# ==========================================

class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    regional_id = Column(Integer, ForeignKey("regionales.id"), nullable=True)
    sede_principal_id = Column(Integer, ForeignKey("sedes.id"), nullable=True)
    nit = Column(String, nullable=True, index=True)

    # Datos Generales
    fecha_diligenciamiento = Column(Date, nullable=True)
    consultor = Column(String, nullable=True)
    nombre_empresa = Column(String, nullable=False)
    razon_social = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    departamento = Column(String, nullable=True)
    ciudad = Column(String, nullable=True)
    persona_contacto = Column(String, nullable=True)
    cargo_contacto = Column(String, nullable=True)
    telefono_contacto = Column(String, nullable=True)
    email_contacto = Column(String, nullable=True)
    sector_economico = Column(String, nullable=True)
    actividad_economica = Column(String, nullable=True)
    tipo_empresa = Column(String, nullable=True)  # Privada, Publica, Mixta
    principales_productos = Column(Text, nullable=True)
    motivacion = Column(Text, nullable=True)
    num_personas_contratadas = Column(Integer, nullable=True)
    empleados_presenciales = Column(Integer, nullable=True)
    empleados_teletrabajo = Column(Integer, nullable=True)
    empleados_mixta = Column(Integer, nullable=True)

    # Tipos de contratos
    tipos_contratos = Column(Text, nullable=True)
    distribucion_contratos = Column(Text, nullable=True)

    # Datos financieros
    ventas_reales = Column(Float, nullable=True)
    ventas_presupuestadas = Column(Float, nullable=True)
    ingresos_reales = Column(Float, nullable=True)
    ingresos_presupuestados = Column(Float, nullable=True)
    excedentes_reales = Column(Float, nullable=True)
    excedentes_presupuestados = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    regional = relationship("Regional", back_populates="empresas")
    sede_principal = relationship("Sede")
    practicas = relationship("PracticaCompensacion", back_populates="empresa")
    cargos_empresa = relationship("CargoEmpresa", back_populates="empresa")
    muestras = relationship("MuestraPeriodo", back_populates="empresa")


class PracticaCompensacion(Base):
    __tablename__ = "practicas_compensacion"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    muestra_id = Column(Integer, ForeignKey("muestras_periodo.id"), nullable=True)

    # Preguntas Si/No
    tiene_estructura_salarial = Column(String, nullable=True)
    ultima_actualizacion = Column(Integer, nullable=True)
    metodologia_valoracion = Column(String, nullable=True)
    tiene_bonos_resultados = Column(String, nullable=True)
    bonos_resultados_cargos = Column(Text, nullable=True)
    tiene_comisiones = Column(String, nullable=True)
    comisiones_cargos = Column(Text, nullable=True)
    tiene_compensacion_flexible = Column(String, nullable=True)
    compensacion_flexible_cargos = Column(Text, nullable=True)

    empresa = relationship("Empresa", back_populates="practicas")
    muestra = relationship("MuestraPeriodo")
    primas_extralegales = relationship("PrimaExtralegal", back_populates="practica")


class PrimaExtralegal(Base):
    __tablename__ = "primas_extralegales"
    id = Column(Integer, primary_key=True, index=True)
    practica_id = Column(Integer, ForeignKey("practicas_compensacion.id"))

    nombre_prima = Column(String)
    tipo = Column(String, nullable=True)
    dias_salario = Column(Integer, nullable=True)
    es_constitutivo = Column(String, nullable=True)

    ene = Column(String, nullable=True)
    feb = Column(String, nullable=True)
    mar = Column(String, nullable=True)
    abr = Column(String, nullable=True)
    may = Column(String, nullable=True)
    jun = Column(String, nullable=True)
    jul = Column(String, nullable=True)
    ago = Column(String, nullable=True)
    sep = Column(String, nullable=True)
    oct = Column(String, nullable=True)
    nov = Column(String, nullable=True)
    dic = Column(String, nullable=True)

    practica = relationship("PracticaCompensacion", back_populates="primas_extralegales")


class CargoEmpresa(Base):
    __tablename__ = "cargos_empresa"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    muestra_id = Column(Integer, ForeignKey("muestras_periodo.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)

    # Informacion basica
    numero = Column(Integer, nullable=True)
    nombre_cargo = Column(String, nullable=False)
    num_personas = Column(Integer, nullable=True)
    impacto_directo = Column(String, nullable=True)
    tipo_impacto = Column(String, nullable=True)
    monto_anual = Column(Float, nullable=True)
    tipo_contrato = Column(String, nullable=True)
    modalidad = Column(String, nullable=True)
    cargo_jefe = Column(String, nullable=True)
    area = Column(String, nullable=True)  # Texto libre para compatibilidad
    descripcion = Column(Text, nullable=True)
    pacto = Column(String, nullable=True)
    tipo_salario = Column(String, nullable=True)
    horas_mes = Column(Integer, nullable=True)
    pct_arl = Column(Float, nullable=True)

    # Compensacion
    basico = Column(Float, nullable=True)
    cumplimiento_100 = Column(Float, nullable=True)
    real_pagado = Column(Float, nullable=True)
    concepto_2 = Column(Float, nullable=True)
    concepto_3 = Column(Float, nullable=True)
    concepto_5 = Column(Float, nullable=True)
    concepto_6 = Column(Float, nullable=True)
    concepto_7 = Column(Float, nullable=True)
    concepto_8 = Column(Float, nullable=True)
    cumplimiento_100_2 = Column(Float, nullable=True)
    real_pagado_anio = Column(Float, nullable=True)
    bono_trimestral = Column(Float, nullable=True)
    bono_antiguedad = Column(Float, nullable=True)
    columna16 = Column(Float, nullable=True)
    concepto_1 = Column(Float, nullable=True)
    concepto2 = Column(Float, nullable=True)
    concepto3 = Column(Float, nullable=True)
    concepto4 = Column(Float, nullable=True)
    concepto5 = Column(Float, nullable=True)
    prima_navidad = Column(Float, nullable=True)
    prima_vacaciones = Column(Float, nullable=True)
    columna10 = Column(Float, nullable=True)
    columna11 = Column(Float, nullable=True)
    prima_navidad_2 = Column(Float, nullable=True)
    prima_vacaciones_2 = Column(Float, nullable=True)
    columna124 = Column(Float, nullable=True)

    # Estado
    estado = Column(String, default="PENDIENTE")
    homologado = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    empresa = relationship("Empresa", back_populates="cargos_empresa")
    muestra = relationship("MuestraPeriodo")
    area_obj = relationship("Area")
    homologacion = relationship("HomologacionCargo", back_populates="cargo_empresa", uselist=False)
    valoracion = relationship("ValoracionCargo", back_populates="cargo_empresa", uselist=False)


# ==========================================
# BLOQUE B: HOMOLOGACION - Catalogo Maestro
# ==========================================

class MasterCargo(Base):
    __tablename__ = "master_cargos"
    id = Column(Integer, primary_key=True, index=True)

    codigo_2017 = Column(String, nullable=True)
    nombre = Column(String, nullable=False)
    codigo_area = Column(Integer, nullable=True)
    area_general = Column(String, nullable=True)
    subarea = Column(String, nullable=True)
    area_especifica = Column(String, nullable=True)
    codigo_nivel = Column(Integer, nullable=True)
    nivel_actual = Column(String, nullable=True)
    descripcion = Column(Text, nullable=True)
    reporta_a = Column(String, nullable=True)
    estudios_requeridos = Column(String, nullable=True)
    experiencia_requerida = Column(String, nullable=True)
    segundo_idioma = Column(String, nullable=True)


class Categoria(Base):
    __tablename__ = "categorias"
    id = Column(Integer, primary_key=True, index=True)
    categoria = Column(Integer)
    ruta_carrera_gerencial = Column(String, nullable=True)
    ruta_carrera_individual = Column(String, nullable=True)
    pista = Column(String, nullable=True)


class Nivel(Base):
    __tablename__ = "niveles"
    id = Column(Integer, primary_key=True, index=True)
    categoria = Column(Integer)
    nivel = Column(String, nullable=True)
    propuesta = Column(String, nullable=True)


# ==========================================
# BLOQUE B: HOMOLOGACION - Resultados
# ==========================================

class HomologacionCargo(Base):
    __tablename__ = "homologaciones_cargo"
    id = Column(Integer, primary_key=True, index=True)
    cargo_empresa_id = Column(Integer, ForeignKey("cargos_empresa.id"))
    master_cargo_id = Column(Integer, ForeignKey("master_cargos.id"), nullable=True)

    cargo_valorado = Column(String, nullable=True)
    cargo_homologado_1 = Column(String, nullable=True)
    descripcion_1 = Column(Text, nullable=True)
    cargo_homologado_2 = Column(String, nullable=True)
    descripcion_2 = Column(Text, nullable=True)
    observaciones = Column(Text, nullable=True)

    editado_manual = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cargo_empresa = relationship("CargoEmpresa", back_populates="homologacion")


# ==========================================
# BLOQUE C: ESTRUCTURA SALARIAL - Valoracion
# ==========================================

class ValoracionCargo(Base):
    __tablename__ = "valoraciones_cargo"
    id = Column(Integer, primary_key=True, index=True)
    cargo_empresa_id = Column(Integer, ForeignKey("cargos_empresa.id"))

    cargo = Column(String, nullable=True)
    taller = Column(String, nullable=True)
    area_especifica = Column(String, nullable=True)
    area = Column(String, nullable=True)
    cargo_homologado = Column(String, nullable=True)

    puntos = Column(Integer, nullable=True)
    conocimientos = Column(String, nullable=True)
    experiencia = Column(String, nullable=True)
    habilidad_gerencial = Column(String, nullable=True)
    rol_cargo = Column(Integer, nullable=True)
    puntos_c_h = Column(Integer, nullable=True)

    contacto = Column(String, nullable=True)
    frecuencia = Column(Integer, nullable=True)
    contenido_relaciones = Column(String, nullable=True)
    puntos_hc = Column(Integer, nullable=True)
    total_puntos_1 = Column(Integer, nullable=True)

    complejidad_conceptual = Column(Integer, nullable=True)
    tendencia_cc = Column(String, nullable=True)
    guias_apoyo = Column(String, nullable=True)
    tendencia_ga = Column(String, nullable=True)
    porcentaje = Column(Float, nullable=True)
    total_puntos_2 = Column(Integer, nullable=True)

    impacto = Column(String, nullable=True)
    autonomia = Column(String, nullable=True)
    magnitud = Column(Integer, nullable=True)
    puntos_rr = Column(Integer, nullable=True)

    criterio_1 = Column(Integer, default=0)
    criterio_2 = Column(Integer, default=0)
    criterio_3 = Column(Integer, default=0)

    categoria = Column(Integer, nullable=True)
    criticidad = Column(String, nullable=True)
    nivel = Column(String, nullable=True)
    frecuencia_val = Column(Integer, nullable=True)

    g = Column(Float, nullable=True)
    g_v = Column(Float, nullable=True)
    ct = Column(Float, nullable=True)

    nivel_forzado = Column(String, nullable=True)
    puntos_f = Column(Integer, nullable=True)
    categoria_f = Column(Integer, nullable=True)
    nivel_f = Column(String, nullable=True)
    criticidad_f = Column(String, nullable=True)

    nivel_shr = Column(String, nullable=True)
    variable_target = Column(Float, nullable=True)
    variable_target_nc = Column(Float, nullable=True)
    observacion = Column(Text, nullable=True)

    editado_manual = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cargo_empresa = relationship("CargoEmpresa", back_populates="valoracion")


# ==========================================
# COLABORADORES / BASE DE DATOS
# ==========================================

class Colaborador(Base):
    __tablename__ = "colaboradores"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    muestra_id = Column(Integer, ForeignKey("muestras_periodo.id"), nullable=True)

    renglon = Column(Integer, nullable=True)
    cedula = Column(String, nullable=True)
    nombres = Column(String, nullable=True)
    fecha_ingreso = Column(Date, nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)

    cargo_nomina = Column(String, nullable=True)
    pacto = Column(String, nullable=True)
    cargo_valorado = Column(String, nullable=True)

    area = Column(String, nullable=True)
    area_funcional = Column(String, nullable=True)
    area_especifica = Column(String, nullable=True)
    ciudad = Column(String, nullable=True)
    segmentacion_individual = Column(String, nullable=True)
    segmentacion = Column(String, nullable=True)

    cargo_homologacion = Column(String, nullable=True)
    puntos_valoracion = Column(Integer, nullable=True)
    categoria = Column(Integer, nullable=True)
    nivel = Column(String, nullable=True)
    criticidad = Column(String, nullable=True)
    punto_medio = Column(Float, nullable=True)

    garantizado = Column(Float, nullable=True)
    variable = Column(Float, nullable=True)
    beneficios = Column(Float, nullable=True)
    base_prestaciones = Column(Float, nullable=True)
    basico = Column(Float, nullable=True)
    basico_actual = Column(Float, nullable=True)

    prima_1_ncs = Column(Float, nullable=True)
    prima_extralegal_1 = Column(Float, nullable=True)
    prima_2_ncs = Column(Float, nullable=True)
    prima_extralegal_2 = Column(Float, nullable=True)
    prima_3_ncs = Column(Float, nullable=True)
    prima_extralegal_3 = Column(Float, nullable=True)
    prima_4_ncs = Column(Float, nullable=True)
    prima_extralegal_4 = Column(Float, nullable=True)

    promedio_comisiones = Column(Float, nullable=True)
    bonificacion_anual = Column(Float, nullable=True)
    bonificacion_anual_2 = Column(Float, nullable=True)
    bonificacion_anual_3 = Column(Float, nullable=True)

    auxilio_gasolina = Column(Float, nullable=True)
    auxilio_educacion = Column(Float, nullable=True)
    otros_1 = Column(Float, nullable=True)
    otros_2 = Column(Float, nullable=True)
    otros_3 = Column(Float, nullable=True)
    otros_4 = Column(Float, nullable=True)
    otros_5 = Column(Float, nullable=True)
    otros_6 = Column(Float, nullable=True)
    otros_7 = Column(Float, nullable=True)
    otros_8 = Column(Float, nullable=True)
    otros_9 = Column(Float, nullable=True)
    otros_10 = Column(Float, nullable=True)

    pct_variable = Column(Float, nullable=True)
    pct_beneficios = Column(Float, nullable=True)

    geq = Column(Float, nullable=True)
    geqp = Column(Float, nullable=True)
    g_veq = Column(Float, nullable=True)
    g_veqp = Column(Float, nullable=True)
    cteq = Column(Float, nullable=True)
    cteqp = Column(Float, nullable=True)

    gq1 = Column(Float, nullable=True)
    gq1p = Column(Float, nullable=True)
    g_vq1 = Column(Float, nullable=True)
    g_vq1p = Column(Float, nullable=True)
    ctq1 = Column(Float, nullable=True)
    ctq1p = Column(Float, nullable=True)

    gmd = Column(Float, nullable=True)
    gmdp = Column(Float, nullable=True)
    g_vmd = Column(Float, nullable=True)
    g_vmdp = Column(Float, nullable=True)
    ctmd = Column(Float, nullable=True)
    ctmdp = Column(Float, nullable=True)
    basico_md = Column(Float, nullable=True)
    pos_md = Column(Float, nullable=True)

    gq3 = Column(Float, nullable=True)
    gq3p = Column(Float, nullable=True)
    g_vq3 = Column(Float, nullable=True)
    g_vq3p = Column(Float, nullable=True)
    ctq3 = Column(Float, nullable=True)
    ctq3p = Column(Float, nullable=True)

    salario_ordinario_min = Column(Float, nullable=True)
    salario_ordinario = Column(Float, nullable=True)
    salario_ordinario_p = Column(Float, nullable=True)
    salario_ordinario_max = Column(Float, nullable=True)
    salario_integral_min = Column(Float, nullable=True)
    salario_integral = Column(Float, nullable=True)
    salario_integral_p = Column(Float, nullable=True)
    salario_integral_max = Column(Float, nullable=True)

    gpol = Column(Float, nullable=True)
    gpolp = Column(Float, nullable=True)
    g_vpol = Column(Float, nullable=True)
    g_vpolp = Column(Float, nullable=True)
    ctpol = Column(Float, nullable=True)
    ctpolp = Column(Float, nullable=True)

    base_seguridad_actual = Column(Float, nullable=True)
    salud = Column(Float, nullable=True)
    pension = Column(Float, nullable=True)
    arl = Column(Float, nullable=True)
    parafiscales = Column(Float, nullable=True)
    costo_laboral_actual = Column(Float, nullable=True)
    costo_total_actual = Column(Float, nullable=True)
    costo_laboral_nuevo = Column(Float, nullable=True)
    costo_total_nuevo = Column(Float, nullable=True)

    costo_mensual_nivelacion = Column(Float, nullable=True)
    nivelacion_ct = Column(Float, nullable=True)
    nivelacion_cl = Column(Float, nullable=True)
    ct_mediana = Column(Float, nullable=True)
    equidad_80 = Column(Float, nullable=True)
    equidad_120 = Column(Float, nullable=True)
    costo_sobrepago = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==========================================
# CURVAS Y REFERENCIAS
# ==========================================

class Curva(Base):
    __tablename__ = "curvas"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True)
    muestra_id = Column(Integer, ForeignKey("muestras_periodo.id"), nullable=True)

    categoria = Column(Integer)
    qi_garantizado = Column(Float, nullable=True)
    qi_g_v = Column(Float, nullable=True)
    qi_ct = Column(Float, nullable=True)
    med_garantizado = Column(Float, nullable=True)
    med_g_v = Column(Float, nullable=True)
    med_ct = Column(Float, nullable=True)
    qiii_garantizado = Column(Float, nullable=True)
    qiii_g_v = Column(Float, nullable=True)
    qiii_ct = Column(Float, nullable=True)

    pendiente = Column(Float, nullable=True)
    intercepto = Column(Float, nullable=True)
    punto_medio = Column(Float, nullable=True)


# ==========================================
# MODELOS ORIGINALES (backwards compatibility)
# ==========================================

class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    muestra_id = Column(Integer, ForeignKey("muestras_periodo.id"), nullable=True)
    filename = Column(String, nullable=False)
    empresa = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pendiente", nullable=False)

    muestra = relationship("MuestraPeriodo", back_populates="uploads")
    cargos = relationship("Cargo", back_populates="upload")


class Cargo(Base):
    __tablename__ = "cargos"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"))
    nombre_cargo = Column(String)
    area = Column(String)
    descripcion_empresa = Column(Text, nullable=True)
    estado = Column(String, default="PENDIENTE")

    upload = relationship("Upload", back_populates="cargos")
    homologacion = relationship("Homologacion", back_populates="cargo", uselist=False)


class Homologacion(Base):
    __tablename__ = "homologaciones"
    id = Column(Integer, primary_key=True, index=True)
    cargo_id = Column(Integer, ForeignKey("cargos.id"))
    cargo_homologado = Column(String)
    justificacion = Column(Text, nullable=True)
    observaciones_analista = Column(Text, nullable=True)
    datos_excel = Column(JSON, nullable=True)
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
    conocimientos = Column(String, nullable=True)
    experiencia = Column(String, nullable=True)
    habilidad_gerencial = Column(String, nullable=True)
    rol_cargo = Column(String, nullable=True)
    contacto = Column(String, nullable=True)
    frecuencia = Column(String, nullable=True)
    contenido_relaciones = Column(String, nullable=True)
    complejidad_conceptual = Column(String, nullable=True)
    tendencia_cc = Column(String, nullable=True)
    guias_apoyo = Column(String, nullable=True)
    tendencia_ga = Column(String, nullable=True)
    impacto = Column(String, nullable=True)
    autonomia = Column(String, nullable=True)
    magnitud = Column(String, nullable=True)
    criterio_1 = Column(Integer, default=0)
    criterio_2 = Column(Integer, default=0)
    criterio_3 = Column(Integer, default=0)
    justificacion_ia = Column(Text, nullable=True)
    editado_manual = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Campos salariales (pasan a Analisis)
    basico = Column(Float, nullable=True)
    real_pagado = Column(Float, nullable=True)
    garantizado = Column(Float, nullable=True)
    garantizado_variable = Column(Float, nullable=True)
    compensacion_total = Column(Float, nullable=True)
    punto_medio_referencia = Column(Float, nullable=True)
    posicion_equidad_pct = Column(Float, nullable=True)

    cargo = relationship("Cargo", back_populates="valoracion")

Cargo.valoracion = relationship("Valoracion", back_populates="cargo", uselist=False)


class ProcessingLog(Base):
    __tablename__ = "processing_logs"
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id"))
    cargo_id = Column(Integer, ForeignKey("cargos.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    level = Column(String)
    message = Column(Text)
    raw_response = Column(Text, nullable=True)
