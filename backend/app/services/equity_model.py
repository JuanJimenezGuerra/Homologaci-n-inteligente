import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def calcular_equidad(df: pd.DataFrame) -> dict:
    """
    Reproduce logica del Excel "02 - Herramienta de Equidad" con Piecewise Linear Regression.
    
    Input columns expected:
        id_cargo, nombre_cargo, area, puntos, salario_g, salario_gv, salario_ct
    
    Returns dict with:
        resultados: list of dicts per cargo
        regresiones: model params per segment per variable
        indicadores: summary metrics
        curvas: smooth curve data for charting
    """
    required_cols = ["id_cargo", "nombre_cargo", "puntos"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Columna requerida faltante: {col}")

    # Ensure salary columns exist (may be NaN)
    for col in ["salario_g", "salario_gv", "salario_ct"]:
        if col not in df.columns:
            df[col] = np.nan

    # Filter out rows without points or salary
    valid = df.dropna(subset=["puntos"])
    has_salary = valid[valid["salario_g"].notna() | valid["salario_gv"].notna() | valid["salario_ct"].notna()].copy()
    
    if len(has_salary) < 3:
        return {
            "resultados": [],
            "regresiones": {},
            "indicadores": {"total_cargos": len(df), "con_salario": len(has_salary), "error": "Muy pocos datos con salario (min 3)"},
            "curvas": {"g": [], "gv": [], "ct": []},
        }

    # 1. Sort by points
    has_salary = has_salary.sort_values("puntos").reset_index(drop=True)

    # 2. Segmentation by percentiles (33% and 66%)
    p1 = has_salary["puntos"].quantile(0.33)
    p2 = has_salary["puntos"].quantile(0.66)

    has_salary["segmento"] = np.select(
        [
            has_salary["puntos"] <= p1,
            (has_salary["puntos"] > p1) & (has_salary["puntos"] <= p2),
            has_salary["puntos"] > p2
        ],
        [1, 2, 3]
    )

    # 3. Linear regression per segment for each salary variable
    salary_vars = {
        "g": "salario_g",
        "gv": "salario_gv",
        "ct": "salario_ct",
    }

    regresiones = {}
    curves_data = {}

    for var_key, var_col in salary_vars.items():
        models = {}
        prev_segment_end_salary = None
        prev_segment_end_points = None

        for seg in [1, 2, 3]:
            seg_data = has_salary[has_salary["segmento"] == seg]
            seg_valid = seg_data[seg_data[var_col].notna()]
            
            if len(seg_valid) < 2:
                # Not enough data for this segment, use global slope
                all_valid = has_salary[has_salary[var_col].notna()]
                if len(all_valid) < 2:
                    models[seg] = {"m": 0, "b": 0, "r2": 0, "n": 0}
                    continue
                X = all_valid[["puntos"]].values
                y = all_valid[var_col].values
            else:
                X = seg_valid[["puntos"]].values
                y = seg_valid[var_col].values

            model = LinearRegression()
            model.fit(X, y)
            m = model.coef_[0]
            b = model.intercept_
            r2 = model.score(X, y) if len(seg_valid) >= 2 else 0

            # Ensure positive slope
            if m < 0:
                m = abs(m)

            # Continuity between segments: adjust intercept
            if prev_segment_end_points is not None and prev_segment_end_salary is not None:
                b = prev_segment_end_salary - m * prev_segment_end_points

            models[seg] = {"m": round(m, 4), "b": round(b, 2), "r2": round(r2, 4), "n": int(len(seg_valid))}

            # Track segment end for continuity
            if len(seg_valid) > 0:
                last_row = seg_valid.iloc[-1]
                # Calculate expected at last point of this segment
                prev_segment_end_points = float(last_row["puntos"])
                prev_segment_end_salary = m * prev_segment_end_points + b

        regresiones[var_key] = models

        # 4. Generate expected salaries using segment models
        has_salary[f"{var_col}_esperado"] = has_salary.apply(
            lambda row: models[row["segmento"]]["m"] * row["puntos"] + models[row["segmento"]]["b"],
            axis=1
        )

        # 5. Monotonicity: ensure expected salary never decreases as points increase
        has_salary[f"{var_col}_esperado"] = np.maximum.accumulate(
            has_salary[f"{var_col}_esperado"].values
        )

        # 6. Deviations
        has_salary[f"desviacion_{var_key}"] = has_salary[var_col] - has_salary[f"{var_col}_esperado"]
        has_salary[f"ratio_{var_key}"] = np.where(
            has_salary[f"{var_col}_esperado"] > 0,
            has_salary[var_col] / has_salary[f"{var_col}_esperado"],
            np.nan
        )

        # 7. Salary adjustment (only raise if below expected)
        has_salary[f"{var_col}_ajustado"] = np.where(
            has_salary[var_col] < has_salary[f"{var_col}_esperado"],
            has_salary[f"{var_col}_esperado"],
            has_salary[var_col]
        )

        has_salary[f"ajuste_{var_key}"] = has_salary[f"{var_col}_ajustado"] - has_salary[var_col]

        # Generate smooth curve data for charting
        if len(has_salary) > 0:
            pts_range = np.linspace(
                has_salary["puntos"].min(),
                has_salary["puntos"].max(),
                100
            )
            curve_pts = []
            for pt in pts_range:
                seg = 1
                if pt > p2:
                    seg = 3
                elif pt > p1:
                    seg = 2
                expected = models[seg]["m"] * pt + models[seg]["b"]
                curve_pts.append({"puntos": round(float(pt), 1), "valor": round(float(expected), 2)})
            
            curves_data[var_key] = curve_pts

    # Build resultados
    resultados = []
    for _, row in has_salary.iterrows():
        resultados.append({
            "id_cargo": int(row["id_cargo"]),
            "nombre_cargo": row["nombre_cargo"],
            "area": row.get("area", ""),
            "puntos": float(row["puntos"]),
            "segmento": int(row["segmento"]),
            "salario_g": float(row["salario_g"]) if pd.notna(row.get("salario_g")) else None,
            "salario_g_esperado": float(row["salario_g_esperado"]) if "salario_g_esperado" in row.index and pd.notna(row["salario_g_esperado"]) else None,
            "salario_g_ajustado": float(row["salario_g_ajustado"]) if "salario_g_ajustado" in row.index and pd.notna(row["salario_g_ajustado"]) else None,
            "desviacion_g": float(row["desviacion_g"]) if "desviacion_g" in row.index and pd.notna(row["desviacion_g"]) else None,
            "ratio_g": float(row["ratio_g"]) if "ratio_g" in row.index and pd.notna(row["ratio_g"]) else None,
            "ajuste_g": float(row["ajuste_g"]) if "ajuste_g" in row.index and pd.notna(row["ajuste_g"]) else None,
            "salario_gv": float(row["salario_gv"]) if pd.notna(row.get("salario_gv")) else None,
            "salario_gv_esperado": float(row["salario_gv_esperado"]) if "salario_gv_esperado" in row.index and pd.notna(row["salario_gv_esperado"]) else None,
            "salario_gv_ajustado": float(row["salario_gv_ajustado"]) if "salario_gv_ajustado" in row.index and pd.notna(row["salario_gv_ajustado"]) else None,
            "desviacion_gv": float(row["desviacion_gv"]) if "desviacion_gv" in row.index and pd.notna(row["desviacion_gv"]) else None,
            "ratio_gv": float(row["ratio_gv"]) if "ratio_gv" in row.index and pd.notna(row["ratio_gv"]) else None,
            "salario_ct": float(row["salario_ct"]) if pd.notna(row.get("salario_ct")) else None,
            "salario_ct_esperado": float(row["salario_ct_esperado"]) if "salario_ct_esperado" in row.index and pd.notna(row["salario_ct_esperado"]) else None,
            "salario_ct_ajustado": float(row["salario_ct_ajustado"]) if "salario_ct_ajustado" in row.index and pd.notna(row["salario_ct_ajustado"]) else None,
            "desviacion_ct": float(row["desviacion_ct"]) if "desviacion_ct" in row.index and pd.notna(row["desviacion_ct"]) else None,
            "ratio_ct": float(row["ratio_ct"]) if "ratio_ct" in row.index and pd.notna(row["ratio_ct"]) else None,
        })

    # 8. Summary indicators
    g_ratios = [r["ratio_g"] for r in resultados if r.get("ratio_g") is not None]
    
    pct_subpago = len([r for r in g_ratios if r < 0.80]) / len(g_ratios) * 100 if g_ratios else 0
    pct_competitivo = len([r for r in g_ratios if 0.80 <= r <= 1.20]) / len(g_ratios) * 100 if g_ratios else 0
    pct_sobrepago = len([r for r in g_ratios if r > 1.20]) / len(g_ratios) * 100 if g_ratios else 0

    total_ajuste_g = sum(r["ajuste_g"] for r in resultados if r.get("ajuste_g") is not None and r["ajuste_g"] > 0)

    indicadores = {
        "total_cargos": len(resultados),
        "cargos_con_salario": len(g_ratios),
        "pct_subpago": round(pct_subpago, 1),
        "pct_competitivo": round(pct_competitivo, 1),
        "pct_sobrepago": round(pct_sobrepago, 1),
        "subpago_count": len([r for r in g_ratios if r < 0.80]),
        "competitivo_count": len([r for r in g_ratios if 0.80 <= r <= 1.20]),
        "sobrepago_count": len([r for r in g_ratios if r > 1.20]),
        "costo_ajuste_anual_g": round(total_ajuste_g * 12, 2),
        "costo_ajuste_mensual_g": round(total_ajuste_g, 2),
        "p1_segmento": round(float(p1), 1),
        "p2_segmento": round(float(p2), 1),
    }

    # Format regresiones for output
    regresiones_out = {}
    for var_key, models in regresiones.items():
        regresiones_out[var_key] = {
            str(seg): {"m": m["m"], "b": m["b"], "r2": m["r2"], "n": m["n"]}
            for seg, m in models.items()
        }

    return {
        "resultados": resultados,
        "regresiones": regresiones_out,
        "indicadores": indicadores,
        "curvas": curves_data,
    }
