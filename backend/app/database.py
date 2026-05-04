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
        return  # SQLite no necesita migraciones

    migrations = {
        "uploads": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
        ],
        "cargos_empresa": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
        ],
        "colaboradores": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
        ],
        "practicas_compensacion": [
            ("muestra_id", "INTEGER REFERENCES muestras_periodo(id)"),
        ],
        "homologaciones_cargo": [
            ("master_cargo_id", "INTEGER REFERENCES master_cargos(id)"),
        ],
        "valoraciones_cargo": [
            ("nivel_shr", "VARCHAR"),
            ("variable_target", "DOUBLE PRECISION"),
            ("variable_target_nc", "DOUBLE PRECISION"),
        ],
        "empresas": [
            ("sede_principal_id", "INTEGER REFERENCES sedes(id)"),
            ("regional_id", "INTEGER REFERENCES regionales(id)"),
        ],
    }

    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        with engine.connect() as conn:
            for table, columns in migrations.items():
                if table not in existing_tables:
                    continue

                existing_cols = {c["name"] for c in inspector.get_columns(table)}

                for col_name, col_type in columns:
                    if col_name not in existing_cols:
                        sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                        try:
                            conn.execute(text(sql))
                            conn.commit()
                            logger.info(f"Migracion: agregada columna '{col_name}' a '{table}'")
                        except Exception as e:
                            logger.warning(f"Migracion '{table}.{col_name}': {e}")
                            conn.rollback()
    except Exception as e:
        logger.error(f"Error en migraciones: {e}")
