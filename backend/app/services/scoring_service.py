"""Servicio de scoring para valoración de cargos - Metodología SHR/HAY."""

# ─── Puntos por factor (texto -> valor numérico) ───

PTS_CONOCIMIENTOS = {
    "Básico": 20, "Medio": 40, "Avanzado": 60, "Experto": 80,
}

PTS_EXPERIENCIA_MULT = {
    "Mínima": 0.6, "1-2 años": 0.8, "3-5 años": 1.0,
    "5-7 años": 1.2, "7+ años": 1.4,
}

PTS_HABILIDAD_GERENCIAL = {
    "No requiere": 10, "Baja": 20, "Media": 30, "Alta": 40,
}

PTS_ROL_CARGO = {
    "Individual": 10, "Supervisión": 15, "Táctico": 25,
    "Estratégico": 35, "Dirección": 45,
}

PTS_CONTACTO = {
    "Interno": 5, "Mixto": 10, "Externo": 15, "Cliente": 20,
}

PTS_FRECUENCIA = {
    "Esporádica": 2, "Mensual": 4, "Semanal": 6, "Diaria": 8, "Permanente": 10,
}

PTS_CONTENIDO_RELACIONES = {
    "Informativo": 5, "Coordinación": 10, "Negociación": 15, "Asesoría": 20,
}

PTS_COMPLEJIDAD_CONCEPTUAL = {
    "Repetitiva": 10, "Procedimental": 20, "Analítica": 30,
    "Creativa": 40, "Estratégica": 50,
}

PTS_TENDENCIA_MULT = {
    "Estable": 0.85, "Creciente": 1.0, "Decreciente": 1.15,
}

PTS_GUIAS_APOYO = {
    "Específicas": 10, "Generales": 20, "Políticas": 30, "Autonomía total": 40,
}

PTS_IMPACTO = {
    "Mínimo": 10, "Medio": 20, "Alto": 30, "Crítico": 40,
}

PTS_AUTONOMIA = {
    "Nula": 10, "Supervisada": 20, "Guiada": 30, "Total": 40,
}

PTS_MAGNITUD = {
    "Pequeña": 5, "Mediana": 10, "Grande": 15, "Corporativa": 20,
}


def _get(d, key, default=0):
    if not key:
        return default
    return d.get(key, default)


def calcular_puntaje(v) -> dict:
    """
    Calcula puntaje total y asignación de nivel según metodología SHR/HAY.
    Retorna dict con puntaje_total, nivel_shr, categoria.
    """
    f1_saber = (
        _get(PTS_CONOCIMIENTOS, v.conocimientos, 40) *
        _get(PTS_EXPERIENCIA_MULT, v.experiencia, 1.0) +
        _get(PTS_HABILIDAD_GERENCIAL, v.habilidad_gerencial, 20) +
        _get(PTS_ROL_CARGO, v.rol_cargo, 15)
    )

    f2_contacto = (
        _get(PTS_CONTACTO, v.contacto, 10) +
        _get(PTS_FRECUENCIA, v.frecuencia, 4) +
        _get(PTS_CONTENIDO_RELACIONES, v.contenido_relaciones, 10)
    )

    f3_complejidad = (
        _get(PTS_COMPLEJIDAD_CONCEPTUAL, v.complejidad_conceptual, 20) *
        _get(PTS_TENDENCIA_MULT, v.tendencia_cc, 1.0) +
        _get(PTS_GUIAS_APOYO, v.guias_apoyo, 20) *
        _get(PTS_TENDENCIA_MULT, v.tendencia_ga, 1.0)
    )

    f4_impacto = (
        _get(PTS_IMPACTO, v.impacto, 20) +
        _get(PTS_AUTONOMIA, v.autonomia, 20) +
        _get(PTS_MAGNITUD, v.magnitud, 10)
    )

    crit = (int(v.criterio_1 or 0) + int(v.criterio_2 or 0) + int(v.criterio_3 or 0))
    raw = f1_saber + f2_contacto + f3_complejidad + f4_impacto
    puntaje_total = round(raw * (1 + crit * 0.05))

    # Asignación de nivel SHR
    nivel_shr, categoria = _asignar_nivel(puntaje_total)

    return {
        "puntaje_total": puntaje_total,
        "nivel_shr": nivel_shr,
        "categoria": categoria,
    }


def _asignar_nivel(puntaje: int):
    """Asigna nivel SHR (I-VIII) y categoría según rango de puntaje."""
    if puntaje <= 100:
        return "Nivel I", 1
    elif puntaje <= 150:
        return "Nivel II", 2
    elif puntaje <= 200:
        return "Nivel III", 3
    elif puntaje <= 250:
        return "Nivel IV", 4
    elif puntaje <= 300:
        return "Nivel V", 5
    elif puntaje <= 350:
        return "Nivel VI", 6
    elif puntaje <= 400:
        return "Nivel VII", 7
    else:
        return "Nivel VIII", 8
