from sqlalchemy import create_engine, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shr_homologacion.db")

# Si es PostgreSQL (Supabase), ajustar el prefijo si es necesario (render a veces usa postgres://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine_args = {}
if DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL (Supabase) - pool de conexiones para produccion
    engine_args["pool_size"] = 5
    engine_args["max_overflow"] = 10
    engine_args["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """
    Agrega columnas faltantes a tablas existentes.
    SQLAlchemy create_all() NO agrega columnas a tablas ya creadas.
    """
    if not DATABASE_URL.startswith("postgresql"):
        print("Migraciones: No es PostgreSQL, saltando.")
        return

    print("Migraciones: Verificando esquema de base de datos...")

    migrations = {
        "uploads": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
        ],
        "cargos_empresa": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
            ("empresa_id", "INTEGER REFERENCES empresas(id)"),
            ("area_id", "INTEGER REFERENCES areas(id)"),
            ("numero", "INTEGER"),
            ("num_personas", "INTEGER"),
            ("impacto_directo", "VARCHAR"),
            ("tipo_impacto", "VARCHAR"),
            ("monto_anual", "DOUBLE PRECISION"),
            ("tipo_contrato", "VARCHAR"),
            ("modalidad", "VARCHAR"),
            ("cargo_jefe", "VARCHAR"),
            ("area", "VARCHAR"),
            ("descripcion", "TEXT"),
            ("pacto", "VARCHAR"),
            ("tipo_salario", "VARCHAR"),
            ("horas_mes", "INTEGER"),
            ("pct_arl", "DOUBLE PRECISION"),
            ("basico", "DOUBLE PRECISION"),
            ("cumplimiento_100", "DOUBLE PRECISION"),
            ("real_pagado", "DOUBLE PRECISION"),
            ("concepto_2", "DOUBLE PRECISION"),
            ("concepto_3", "DOUBLE PRECISION"),
            ("concepto_5", "DOUBLE PRECISION"),
            ("concepto_6", "DOUBLE PRECISION"),
            ("concepto_7", "DOUBLE PRECISION"),
            ("concepto_8", "DOUBLE PRECISION"),
            ("cumplimiento_100_2", "DOUBLE PRECISION"),
            ("real_pagado_anio", "DOUBLE PRECISION"),
            ("bono_trimestral", "DOUBLE PRECISION"),
            ("bono_antiguedad", "DOUBLE PRECISION"),
            ("columna16", "DOUBLE PRECISION"),
            ("concepto_1", "DOUBLE PRECISION"),
            ("concepto2", "DOUBLE PRECISION"),
            ("concepto3", "DOUBLE PRECISION"),
            ("concepto4", "DOUBLE PRECISION"),
            ("concepto5", "DOUBLE PRECISION"),
            ("prima_navidad", "DOUBLE PRECISION"),
            ("prima_vacaciones", "DOUBLE PRECISION"),
            ("columna10", "DOUBLE PRECISION"),
            ("columna11", "DOUBLE PRECISION"),
            ("prima_navidad_2", "DOUBLE PRECISION"),
            ("prima_vacaciones_2", "DOUBLE PRECISION"),
            ("columna124", "DOUBLE PRECISION"),
            ("estado", "VARCHAR"),
            ("homologado", "VARCHAR"),
        ],
        "colaboradores": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
            ("empresa_id", "INTEGER REFERENCES empresas(id)"),
            ("renglon", "INTEGER"),
            ("cedula", "VARCHAR"),
            ("nombres", "VARCHAR"),
            ("fecha_ingreso", "DATE"),
            ("fecha_nacimiento", "DATE"),
            ("cargo_nomina", "VARCHAR"),
            ("pacto", "VARCHAR"),
            ("cargo_valorado", "VARCHAR"),
            ("area", "VARCHAR"),
            ("area_funcional", "VARCHAR"),
            ("area_especifica", "VARCHAR"),
            ("ciudad", "VARCHAR"),
            ("segmentacion_individual", "VARCHAR"),
            ("segmentacion", "VARCHAR"),
            ("cargo_homologacion", "VARCHAR"),
            ("puntos_valoracion", "INTEGER"),
            ("categoria", "INTEGER"),
            ("nivel", "VARCHAR"),
            ("criticidad", "VARCHAR"),
            ("punto_medio", "DOUBLE PRECISION"),
            ("garantizado", "DOUBLE PRECISION"),
            ("variable", "DOUBLE PRECISION"),
            ("beneficios", "DOUBLE PRECISION"),
            ("base_prestaciones", "DOUBLE PRECISION"),
            ("basico", "DOUBLE PRECISION"),
            ("basico_actual", "DOUBLE PRECISION"),
            ("prima_1_ncs", "DOUBLE PRECISION"),
            ("prima_extralegal_1", "DOUBLE PRECISION"),
            ("prima_2_ncs", "DOUBLE PRECISION"),
            ("prima_extralegal_2", "DOUBLE PRECISION"),
            ("prima_3_ncs", "DOUBLE PRECISION"),
            ("prima_extralegal_3", "DOUBLE PRECISION"),
            ("prima_4_ncs", "DOUBLE PRECISION"),
            ("prima_extralegal_4", "DOUBLE PRECISION"),
            ("promedio_comisiones", "DOUBLE PRECISION"),
            ("bonificacion_anual", "DOUBLE PRECISION"),
            ("bonificacion_anual_2", "DOUBLE PRECISION"),
            ("bonificacion_anual_3", "DOUBLE PRECISION"),
            ("auxilio_gasolina", "DOUBLE PRECISION"),
            ("auxilio_educacion", "DOUBLE PRECISION"),
            ("otros_1", "DOUBLE PRECISION"),
            ("otros_2", "DOUBLE PRECISION"),
            ("otros_3", "DOUBLE PRECISION"),
            ("otros_4", "DOUBLE PRECISION"),
            ("otros_5", "DOUBLE PRECISION"),
            ("otros_6", "DOUBLE PRECISION"),
            ("otros_7", "DOUBLE PRECISION"),
            ("otros_8", "DOUBLE PRECISION"),
            ("otros_9", "DOUBLE PRECISION"),
            ("otros_10", "DOUBLE PRECISION"),
            ("pct_variable", "DOUBLE PRECISION"),
            ("pct_beneficios", "DOUBLE PRECISION"),
            ("geq", "DOUBLE PRECISION"),
            ("geqp", "DOUBLE PRECISION"),
            ("g_veq", "DOUBLE PRECISION"),
            ("g_veqp", "DOUBLE PRECISION"),
            ("cteq", "DOUBLE PRECISION"),
            ("cteqp", "DOUBLE PRECISION"),
            ("gq1", "DOUBLE PRECISION"),
            ("gq1p", "DOUBLE PRECISION"),
            ("g_vq1", "DOUBLE PRECISION"),
            ("g_vq1p", "DOUBLE PRECISION"),
            ("ctq1", "DOUBLE PRECISION"),
            ("ctq1p", "DOUBLE PRECISION"),
            ("gmd", "DOUBLE PRECISION"),
            ("gmdp", "DOUBLE PRECISION"),
            ("g_vmd", "DOUBLE PRECISION"),
            ("g_vmdp", "DOUBLE PRECISION"),
            ("ctmd", "DOUBLE PRECISION"),
            ("ctmdp", "DOUBLE PRECISION"),
            ("basico_md", "DOUBLE PRECISION"),
            ("pos_md", "DOUBLE PRECISION"),
            ("gq3", "DOUBLE PRECISION"),
            ("gq3p", "DOUBLE PRECISION"),
            ("g_vq3", "DOUBLE PRECISION"),
            ("g_vq3p", "DOUBLE PRECISION"),
            ("ctq3", "DOUBLE PRECISION"),
            ("ctq3p", "DOUBLE PRECISION"),
            ("salario_ordinario_min", "DOUBLE PRECISION"),
            ("salario_ordinario", "DOUBLE PRECISION"),
            ("salario_ordinario_p", "DOUBLE PRECISION"),
            ("salario_ordinario_max", "DOUBLE PRECISION"),
            ("salario_integral_min", "DOUBLE PRECISION"),
            ("salario_integral", "DOUBLE PRECISION"),
            ("salario_integral_p", "DOUBLE PRECISION"),
            ("salario_integral_max", "DOUBLE PRECISION"),
            ("gpol", "DOUBLE PRECISION"),
            ("gpolp", "DOUBLE PRECISION"),
            ("g_vpol", "DOUBLE PRECISION"),
            ("g_vpolp", "DOUBLE PRECISION"),
            ("ctpol", "DOUBLE PRECISION"),
            ("ctpolp", "DOUBLE PRECISION"),
            ("base_seguridad_actual", "DOUBLE PRECISION"),
            ("salud", "DOUBLE PRECISION"),
            ("pension", "DOUBLE PRECISION"),
            ("arl", "DOUBLE PRECISION"),
            ("parafiscales", "DOUBLE PRECISION"),
            ("costo_laboral_actual", "DOUBLE PRECISION"),
            ("costo_total_actual", "DOUBLE PRECISION"),
            ("costo_laboral_nuevo", "DOUBLE PRECISION"),
            ("costo_total_nuevo", "DOUBLE PRECISION"),
            ("costo_mensual_nivelacion", "DOUBLE PRECISION"),
            ("nivelacion_ct", "DOUBLE PRECISION"),
            ("nivelacion_cl", "DOUBLE PRECISION"),
            ("ct_mediana", "DOUBLE PRECISION"),
            ("equidad_80", "DOUBLE PRECISION"),
            ("equidad_120", "DOUBLE PRECISION"),
            ("costo_sobrepago", "DOUBLE PRECISION"),
        ],
        "practicas_compensacion": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
            ("empresa_id", "INTEGER REFERENCES empresas(id)"),
            ("tiene_estructura_salarial", "VARCHAR"),
            ("ultima_actualizacion", "INTEGER"),
            ("metodologia_valoracion", "VARCHAR"),
            ("tiene_bonos_resultados", "VARCHAR"),
            ("bonos_resultados_cargos", "TEXT"),
            ("tiene_comisiones", "VARCHAR"),
            ("comisiones_cargos", "TEXT"),
            ("tiene_compensacion_flexible", "VARCHAR"),
            ("compensacion_flexible_cargos", "TEXT"),
        ],
        "homologaciones_cargo": [
            ("master_cargo_id", "INTEGER REFERENCES master_cargos(id)"),
        ],
        "homologaciones": [
            ("observaciones_analista", "TEXT"),
        ],
        "valoraciones_cargo": [
            ("nivel_shr", "VARCHAR"),
            ("variable_target", "DOUBLE PRECISION"),
            ("variable_target_nc", "DOUBLE PRECISION"),
        ],
        "valoraciones": [
            ("justificacion_ia", "TEXT"),
            ("editado_manual", "BOOLEAN"),
            ("basico", "DOUBLE PRECISION"),
            ("real_pagado", "DOUBLE PRECISION"),
            ("garantizado", "DOUBLE PRECISION"),
            ("garantizado_variable", "DOUBLE PRECISION"),
            ("compensacion_total", "DOUBLE PRECISION"),
            ("punto_medio_referencia", "DOUBLE PRECISION"),
            ("posicion_equidad_pct", "DOUBLE PRECISION"),
        ],
        "empresas": [
            ("sede_principal_id", "INTEGER REFERENCES sedes(id)"),
            ("regional_id", "INTEGER REFERENCES regionales(id)"),
            ("nit", "VARCHAR"),
            ("fecha_diligenciamiento", "DATE"),
            ("consultor", "VARCHAR"),
            ("nombre_empresa", "VARCHAR"),
            ("razon_social", "VARCHAR"),
            ("direccion", "VARCHAR"),
            ("telefono", "VARCHAR"),
            ("departamento", "VARCHAR"),
            ("ciudad", "VARCHAR"),
            ("persona_contacto", "VARCHAR"),
            ("cargo_contacto", "VARCHAR"),
            ("telefono_contacto", "VARCHAR"),
            ("email_contacto", "VARCHAR"),
            ("sector_economico", "VARCHAR"),
            ("actividad_economica", "VARCHAR"),
            ("tipo_empresa", "VARCHAR"),
            ("principales_productos", "TEXT"),
            ("motivacion", "TEXT"),
            ("num_personas_contratadas", "INTEGER"),
            ("empleados_presenciales", "INTEGER"),
            ("empleados_teletrabajo", "INTEGER"),
            ("empleados_mixta", "INTEGER"),
            ("tipos_contratos", "TEXT"),
            ("distribucion_contratos", "TEXT"),
            ("ventas_reales", "DOUBLE PRECISION"),
            ("ventas_presupuestadas", "DOUBLE PRECISION"),
            ("ingresos_reales", "DOUBLE PRECISION"),
            ("ingresos_presupuestados", "DOUBLE PRECISION"),
            ("excedentes_reales", "DOUBLE PRECISION"),
            ("excedentes_presupuestados", "DOUBLE PRECISION"),
        ],
    }

    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        print(f"Migraciones: Tablas existentes: {existing_tables}")

        total_added = 0
        for table, columns in migrations.items():
            if table not in existing_tables:
                print(f"Migraciones: Tabla '{table}' no existe, se creara con create_all()")
                continue

            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            print(f"Migraciones: '{table}' tiene {len(existing_cols)} columnas actuales")

            for col_name, col_type in columns:
                if col_name not in existing_cols:
                    sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(sql))
                        print(f"Migraciones: OK - agregada '{col_name}' ({col_type}) a '{table}'")
                        total_added += 1
                    except Exception as e:
                        print(f"Migraciones: WARNING - '{table}.{col_name}': {e}")
                        existing_cols.add(col_name)

        print(f"Migraciones: Completadas. {total_added} columnas agregadas.")
    except Exception as e:
        print(f"Migraciones: ERROR CRITICO - {e}")
        import traceback
        traceback.print_exc()
