import pandas as pd

file_path = "Formulario de requerimientos V2.xlsx"

try:
    xl = pd.ExcelFile(file_path)
    print("Sheet Names:")
    print(xl.sheet_names)
    
    # Try to find a sheet that looks like "Información de cargo"
    sheet_name = next((s for s in xl.sheet_names if "Informaci" in s and "cargo" in s.lower()), None)
    
    if sheet_name:
        df = pd.read_excel(file_path, sheet_name=sheet_name, skiprows=4)
        print(f"\nStructure for sheet: {sheet_name}")
        print("Column Names:")
        print(df.columns.tolist())
        print("\nFirst 5 rows (Col D and L):")
        # Col D is index 3, Col L is index 11
        print(df.iloc[:5, [3, 11]])
    else:
        print("\nCould not find 'Información de cargo' sheet.")
except Exception as e:
    print(f"Error: {e}")
