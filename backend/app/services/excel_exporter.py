import pandas as pd
from sqlalchemy.orm import Session
from ..models import Cargo, Homologacion
import io
from fastapi.responses import StreamingResponse

def export_to_excel(upload_id: int, db: Session):
    """
    Generates Excel with two sheets:
    Sheet 1: Original Jobs
    Sheet 2: Normalization Results
    """
    cargos = db.query(Cargo).filter(Cargo.upload_id == upload_id).all()
    
    # Sheet 1: Original
    original_data = []
    for c in cargos:
        original_data.append({
            "ID": c.id,
            "Nombre Cargo": c.nombre_cargo,
            "Área": c.area,
            "Estado": c.estado
        })
    df_original = pd.DataFrame(original_data)
    
    # Sheet 2: Homologación
    homo_data = []
    for c in cargos:
        homo = c.homologacion
        homo_data.append({
            "Cargo Original": c.nombre_cargo,
            "Cargo Homologado": homo.cargo_homologado if homo else "",
            "Justificación": homo.justificacion if homo else "",
            "Editado Manual": homo.editado_manual if homo else False,
            "Estado Final": c.estado
        })
    df_homo = pd.DataFrame(homo_data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_original.to_excel(writer, index=False, sheet_name="Original")
        df_homo.to_excel(writer, index=False, sheet_name="Homologación")
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=resultado_homologacion_{upload_id}.xlsx"}
    )
