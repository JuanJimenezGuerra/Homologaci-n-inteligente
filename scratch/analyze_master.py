import pandas as pd
file_path = "d:/SHR Automatización/Herramienta de Homologacion de cargos.xlsx"
try:
    xl = pd.ExcelFile(file_path)
    print(f"Pestañas: {xl.sheet_names}")
    df = pd.read_excel(file_path)
    print("Columnas:", df.columns.tolist())
    print("Primeras filas:")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")
