import sys
import os

# Add backend to path
sys.path.append(os.path.abspath('backend'))

from app.database import SessionLocal, engine, Base
from app.models import User, Upload, Cargo, MasterDescription, JobStatus
from app.services.master_data import process_master_excel
from app.services.excel_processor import process_requirements_excel
from app.services.matcher import prefilter_candidates

# 1. Initialize DB
print("Initializing Database...")
Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    # 2. Seed Master Descriptions
    print("Seeding Master Data from 'Herramienta de Homologacion de cargos.xlsx'...")
    # Adjust sheet name to match what we created in mock
    master_count = process_master_excel('Herramienta de Homologacion de cargos.xlsx', db)
    print(f"Master descriptions seeded: {master_count}")

    # 3. Create a dummy user and upload
    user = User(email="test@shr.com", password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    upload = Upload(user_id=user.id, filename="Formulario de requerimientos V2.xlsx")
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # 4. Process Requirements Excel
    print("Processing Requirements from 'Formulario de requerimientos V2.xlsx'...")
    # Note: I noticed in my inspection that the sheet is "Informacin de cargo" (encoding issues often result in this)
    # My service currently expects "Información de cargo". I might need to adjust it to be more flexible.
    req_count = process_requirements_excel('Formulario de requerimientos V2.xlsx', upload.id, db)
    print(f"Requirement cargos created: {req_count}")

    # 5. Test Prefiltering for a specific cargo
    # Let's take the first cargo created
    sample_cargo = db.query(Cargo).filter(Cargo.upload_id == upload.id).first()
    if sample_cargo:
        print(f"\nTesting matching for: '{sample_cargo.nombre_cargo}'")
        candidates = prefilter_candidates(sample_cargo.nombre_cargo, db)
        print("Top candidates found:")
        for c in candidates:
            print(f"- {c['nombre']} (Score: {c['score']})")
    else:
        print("\nNo cargos found to test matching.")

finally:
    db.close()
