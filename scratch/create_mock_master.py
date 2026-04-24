import pandas as pd

# Mock data for "Herramienta de Homologación de cargos.xlsx"
# Sheet: "descripciones"
data = {
    'cargo': ['GERENTE COMERCIAL', 'GERENTE DE OPERACIONES', 'ANALISTA DE DATOS', 'COORDINADOR DE PRODUCCION'],
    'descripcion': [
        'Responsable de las ventas y estrategia de mercado.',
        'Supervisa la cadena de suministro y procesos internos.',
        'Analiza métricas de negocio y genera reportes.',
        'Planifica la producción diaria en planta.'
    ],
    'area': ['Ventas', 'Operaciones', 'TI', 'Producción']
}

df = pd.DataFrame(data)

with pd.ExcelWriter('Herramienta de Homologacion de cargos.xlsx', engine='openpyxl') as writer:
    df.to_excel(writer, index=False, sheet_name='descripciones')

print("Mock Master Excel created.")
