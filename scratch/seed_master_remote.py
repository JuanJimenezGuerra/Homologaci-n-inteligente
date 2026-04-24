import pandas as pd
from sqlalchemy import create_engine, text
import os

# Database URL from env
db_url = "postgresql://postgres.mttizxynbskldwoxznva:shr2026SHR2020@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

engine = create_engine(db_url)

file_path = "d:/SHR Automatización/Herramienta de Homologacion de cargos.xlsx"
df = pd.read_excel(file_path)

# Normalize columns
df.columns = [c.lower().strip() for c in df.columns]
# Mapping to model names
df = df.rename(columns={'cargo': 'nombre_cargo'})

# Insert into master_descriptions table
try:
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM master_descriptions;"))
        conn.commit()
        print("Tabla maestra limpiada.")
    
    df.to_sql('master_descriptions', engine, if_exists='append', index=False)
    print(f"Se cargaron {len(df)} cargos maestros exitosamente.")
except Exception as e:
    print(f"Error inyectando datos: {e}")
