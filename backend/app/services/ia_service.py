import os
import json
import time
import requests
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

print(f"IA Service: OPENROUTER_API_KEY={'CONFIGURADA' if OPENROUTER_API_KEY else 'NO CONFIGURADA'}")
print(f"IA Service: OPENROUTER_MODEL={OPENROUTER_MODEL}")
print(f"IA Service: OPENAI_API_KEY={'CONFIGURADA' if OPENAI_API_KEY else 'NO CONFIGURADA'}")


def call_openrouter(messages: list, max_tokens: int = 800, temperature: float = 0.1) -> Optional[str]:
    if not OPENROUTER_API_KEY:
        print("OpenRouter: API key no configurada")
        return None
    try:
        models_to_try = [OPENROUTER_MODEL, "google/gemma-3-27b:free", "mistralai/mistral-small-3.1-24b-instruct:free", "meta-llama/llama-3.3-70b-instruct:free"]
        unique_models = list(dict.fromkeys(models_to_try))

        for model in unique_models:
            print(f"OpenRouter: probando modelo {model}")
            resp = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": BACKEND_URL,
                    "X-Title": "SHR Homologacion",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
                timeout=60,
            )
            if resp.ok:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content") or ""
                actual_model = data.get("model", model)
                if len(content.strip()) == 0:
                    print(f"OpenRouter: {actual_model} devolvio respuesta vacia, intentando otro modelo...")
                    continue
                print(f"OpenRouter: OK con {actual_model}, respuesta {len(content)} chars")
                return content
            elif resp.status_code == 401:
                print(f"OpenRouter: ERROR 401 - API key invalida.")
                return None
            else:
                print(f"OpenRouter: {model} fallo HTTP {resp.status_code} - {resp.text[:200]}")

        print("OpenRouter: TODOS los modelos gratuitos fallaron o devolvieron respuesta vacia")
        return None
    except Exception as e:
        print(f"OpenRouter: excepcion - {e}")
        logger.error(f"OpenRouter error: {e}")
    return None


def call_openai(messages: list, max_tokens: int = 800, temperature: float = 0.1) -> Optional[str]:
    if not OPENAI_API_KEY:
        print("OpenAI: API key no configurada")
        return None
    try:
        print(f"OpenAI fallback: llamando con modelo {OPENAI_MODEL}")
        resp = requests.post(
            OPENAI_URL,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=60,
        )
        if resp.ok:
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            print(f"OpenAI fallback: OK, respuesta {len(content) if content else 0} chars")
            return content
        else:
            print(f"OpenAI fallback: HTTP {resp.status_code} - {resp.text[:300]}")
            logger.error(f"OpenAI HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"OpenAI fallback: excepcion - {e}")
        logger.error(f"OpenAI error: {e}")
    return None


def call_ia(messages: list, max_tokens: int = 800, temperature: float = 0.1) -> Optional[str]:
    """Intenta OpenRouter primero, fallback a OpenAI."""
    content = call_openrouter(messages, max_tokens, temperature)
    if content:
        return content
    print("OpenRouter fallo, intentando OpenAI fallback...")
    logger.info("OpenRouter fallo, intentando OpenAI fallback...")
    content = call_openai(messages, max_tokens, temperature)
    return content


def extract_json(text: str) -> Optional[dict]:
    """Extrae JSON de la respuesta de IA, manejando bloques markdown."""
    if not text:
        return None
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except (json.JSONDecodeError, IndexError) as e:
        logger.error(f"Error extrayendo JSON: {e}. Texto: {text[:300]}")
        return None


def extract_json_array(text: str) -> Optional[list]:
    """Extrae array JSON de la respuesta de IA, manejando respuestas truncadas/incompletas."""
    if not text:
        return None
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        text = text.strip()

        # Intento directo primero
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

        # Si fallo, intentar reparar JSON truncado
        repaired = _repair_truncated_json_array(text)
        if repaired:
            return repaired

        # Ultimo intento: extraer objetos JSON individuales del texto
        return _extract_individual_objects(text)

    except Exception as e:
        logger.error(f"Error extrayendo JSON array: {e}. Texto: {text[:300]}")
    return None


def _repair_truncated_json_array(text: str) -> Optional[list]:
    """Repara un array JSON truncado quitando el ultimo objeto incompleto."""
    text = text.strip()
    if not text.startswith("["):
        return None

    # Agregar cierre si falta
    if not text.endswith("]"):
        # Encontrar el ultimo objeto completo
        # Buscar patrones de } o numeros/cierres antes del corte
        last_complete = text.rfind("},")
        if last_complete == -1:
            # Quizas solo hay un objeto truncado
            last_complete = text.rfind("}")
            if last_complete > 0:
                repaired = text[:last_complete + 1] + "]"
            else:
                return None
        else:
            repaired = text[:last_complete + 1] + "\n]"

        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # Intentar con mas reparaciones: quitar comas sueltas
        repaired2 = repaired.rstrip(" ,\n") + "]"
        try:
            return json.loads(repaired2)
        except json.JSONDecodeError:
            pass

    return None


def _extract_individual_objects(text: str) -> Optional[list]:
    """Extrae objetos JSON individuales de texto con formato JSON."""
    results = []
    depth = 0
    start = -1

    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                obj_str = text[start:i + 1]
                try:
                    obj = json.loads(obj_str)
                    if isinstance(obj, dict) and "id" in obj:
                        results.append(obj)
                except json.JSONDecodeError:
                    pass
                start = -1

    return results if results else None


# ==========================================
# HOMOLOGACION CON IA
# ==========================================

MASTER_CARGOS_CACHE = None

def load_master_cargos(db) -> list:
    """Carga los cargos maestros de la base de datos."""
    from ..models import MasterDescription, MasterCargo

    masters = []
    md_list = db.query(MasterDescription).all()
    for m in md_list:
        masters.append({
            "nombre": m.nombre_cargo or "",
            "descripcion": m.descripcion or "",
            "area": m.area or "",
            "fuente": "master_descriptions",
        })

    mc_list = db.query(MasterCargo).all()
    for m in mc_list:
        masters.append({
            "nombre": m.nombre or "",
            "descripcion": m.descripcion or "",
            "area": f"{m.area_general or ''} - {m.area_especifica or ''}".strip(),
            "fuente": "master_cargos",
        })

    logger.info(f"Cargados {len(masters)} cargos maestros")
    return masters


def build_homologacion_prompt(cargos: list, masters: list) -> str:
    """Construye el prompt para homologacion de cargos con IA."""

    # Masters compactos para no exceder tokens de modelos gratuitos
    masters_text = "\n".join([
        f"- {m['nombre']} | {m['area']}"
        for m in masters[:80]
    ])

    cargos_text = ""
    for c in cargos[:5]:
        desc = c.get("descripcion", "") or c.get("descripcion_empresa", "") or ""
        area = c.get("area", "N/A")
        cargos_text += f"""
ID: {c['id']}
Cargo: {c['nombre_cargo']}
Area: {area}
Descripcion: {desc[:200]}
---
"""

    prompt = f"""Eres un experto en clasificacion y homologacion de cargos en Colombia bajo metodologia SHR/HAY.

Tu tarea es encontrar el cargo maestro mas similar para cada cargo de la empresa.

=== CATALOGO MAESTRO DE CARGOS (referencia) ===
{masters_text}

=== CARGOS A HOMOLOGAR ===
{cargos_text}

INSTRUCCIONES:
1. Para cada cargo, selecciona el cargo maestro MAS similar del catalogo.
2. Usa la DESCRIPCION del cargo para mejorar la precision, no solo el nombre.
3. Considera el nivel jerarquico (jefe inmediato, area) para determinar la seniority.
4. Si no hay ningun cargo similar en el catalogo, responde "SIN COINCIDENCIA".

Responde SOLO con un array JSON valido, sin texto adicional:
[
  {{
    "id": ID_NUMERICO,
    "cargo_homologado": "NOMBRE EXACTO DEL CARGO MAESTRO",
    "justificacion": "Razon breve de la coincidencia (max 80 caracteres)",
    "confianza": 0.0 a 1.0
  }}
]"""

    return prompt


def homologar_con_ia(db, cargos: list, masters: list = None) -> list:
    """Homologa un lote de cargos usando IA. Retorna lista de resultados."""
    ia_error = "sin_error"

    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        print("homologar_con_ia: NO hay API key de IA configurada (ni OpenRouter ni OpenAI)")
        ia_error = "Sin API key de IA configurada. Verifica OPENROUTER_API_KEY en Render."
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": ia_error, "confianza": 0.0, "_ia_error": ia_error} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)
    if not masters:
        print("homologar_con_ia: NO hay cargos maestros en la base de datos")
        ia_error = "Sin catalogo maestro en la base de datos"
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": ia_error, "confianza": 0.0, "_ia_error": ia_error} for c in cargos]

    print(f"homologar_con_ia: Procesando {len(cargos)} cargos en lotes de 5")

    resultados = []
    for i in range(0, len(cargos), 5):
        batch = cargos[i:i + 5]
        prompt = build_homologacion_prompt(batch, masters)
        prompt_len = len(prompt)
        lote_num = i // 10 + 1
        print(f"homologar_con_ia: Lote {lote_num}, {len(batch)} cargos, prompt {prompt_len} chars")

        content = call_ia([{"role": "user", "content": prompt}], max_tokens=1500)
        if not content:
            ia_error = "OpenRouter y OpenAI fallback fallaron. Revisa logs de Render para detalles."
            print(f"homologar_con_ia: Lote {lote_num} FALLO - sin respuesta de IA")
            resultados.extend([
                {"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": ia_error, "confianza": 0.0, "_ia_error": ia_error}
                for c in batch
            ])
            continue

        parsed = extract_json_array(content)
        if parsed and isinstance(parsed, list):
            parsed_ids = {r.get("id") for r in parsed}
            batch_ids = {c.get("id") for c in batch}
            matched_count = len(parsed_ids & batch_ids)
            print(f"homologar_con_ia: Lote {lote_num} OK - {len(parsed)} objetos parseados, {matched_count} matchean cargos del lote")

            for res in parsed:
                resultados.append({
                    "id": res.get("id"),
                    "cargo_homologado": res.get("cargo_homologado", "SIN_COINCIDENCIA"),
                    "justificacion": res.get("justificacion", ""),
                    "confianza": res.get("confianza", 0.5),
                })

            # Cargos del lote que no tuvieron respuesta
            for c in batch:
                if c.get("id") not in parsed_ids:
                    print(f"homologar_con_ia: Lote {lote_num} - cargo {c.get('id')} ({c.get('nombre_cargo')}) no tuvo resultado, posible JSON truncado")
                    resultados.append({
                        "id": c.get("id"),
                        "cargo_homologado": "SIN_COINCIDENCIA",
                        "justificacion": "Respuesta IA truncada (modelo gratuito con limite de tokens)",
                        "confianza": 0.0,
                        "_ia_error": "JSON truncado por modelo",
                    })
        else:
            print(f"homologar_con_ia: Lote {lote_num} FALLO parseo total - contenido: {content[:150]}...")
            resultados.extend([
                {"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Error parseando respuesta IA", "confianza": 0.0, "_ia_error": "Error parseando respuesta IA"}
                for c in batch
            ])

        if i + 10 < len(cargos):
            time.sleep(1.5)

    total_ok = len([r for r in resultados if r.get("_ia_error") is None])
    total_ia_error = len([r for r in resultados if r.get("_ia_error") is not None])
    print(f"homologar_con_ia: Completado - {total_ok}/{len(cargos)} exitosos, {total_ia_error} errores IA")
    return resultados


def homologar_con_ia_observaciones(db, cargos: list, masters: list = None, observaciones: str = "") -> list:
    """Homologa cargos con IA incluyendo observaciones del analista para reprocesamiento."""
    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        print("homologar_con_ia_observaciones: NO hay API key de IA")
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        from .ia_service import load_master_cargos
        masters = load_master_cargos(db)
    if not masters:
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Sin catalogo maestro", "confianza": 0.0} for c in cargos]

    print(f"homologar_con_ia_observaciones: Reprocesando {len(cargos)} cargos con observaciones del analista")

    # Build prompt with observations context
    obs_text = f"\nOBSERVACIONES DEL ANALISTA:\n{observaciones}\n" if observaciones else ""

    masters_text = "\n".join([
        f"- {m['nombre']} | {m['area']}"
        for m in masters[:80]
    ])

    cargos_text = ""
    for c in cargos[:5]:
        desc = c.get("descripcion", "") or c.get("descripcion_empresa", "") or ""
        area = c.get("area", "N/A")
        hom_actual = c.get("cargo_homologado_actual", "") or ""
        hom_note = f" (Homologado actual: {hom_actual})" if hom_actual and hom_actual != "SIN_COINCIDENCIA" else ""
        cargos_text += f"""
ID: {c['id']}
Cargo: {c['nombre_cargo']}{hom_note}
Area: {area}
Descripcion: {desc[:200]}
---
"""

    prompt = f"""Eres un experto en clasificacion y homologacion de cargos en Colombia bajo metodologia SHR/HAY.

Un analista ya reviso las homologaciones anteriores y tiene observaciones. Usa esas observaciones para mejorar los resultados.
{obs_text}
=== CATALOGO MAESTRO DE CARGOS ===
{masters_text}

=== CARGOS A REPROCESAR ===
{cargos_text}

INSTRUCCIONES:
1. Revisa las observaciones del analista y ajustalas a la seleccion del cargo maestro.
2. Si el analista indico que un cargo pertenece a otra area, busca en esa area del catalogo.
3. Si el analista menciono que el cargo tiene funciones diferentes, considera eso.
4. Responde SOLO con un array JSON valido.

[
  {{
    "id": ID_NUMERICO,
    "cargo_homologado": "NOMBRE EXACTO DEL CARGO MAESTRO",
    "justificacion": "Razon breve incluyendo las observaciones del analista (max 100 chars)",
    "confianza": 0.0 a 1.0
  }}
]"""

    messages = [{"role": "user", "content": prompt}]
    content = call_ia(messages, max_tokens=2000)

    if not content:
        print("homologar_con_ia_observaciones: Sin respuesta de IA")
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Error en IA", "confianza": 0.0} for c in cargos]

    parsed = extract_json_array(content)
    if parsed and isinstance(parsed, list):
        print(f"homologar_con_ia_observaciones: OK - {len(parsed)} resultados parseados")
        return [{
            "id": res.get("id"),
            "cargo_homologado": res.get("cargo_homologado", "SIN_COINCIDENCIA"),
            "justificacion": res.get("justificacion", ""),
            "confianza": res.get("confianza", 0.5),
        } for res in parsed]

    # Fallback: extract individual objects
    objects = _extract_individual_objects(content)
    if objects:
        print(f"homologar_con_ia_observaciones: OK - {len(objects)} objetos extraidos individualmente")
        return [{
            "id": res.get("id"),
            "cargo_homologado": res.get("cargo_homologado", "SIN_COINCIDENCIA"),
            "justificacion": res.get("justificacion", ""),
            "confianza": res.get("confianza", 0.5),
        } for res in objects]

    print(f"homologar_con_ia_observaciones: FALLO parseo - raw: {content[:150]}")
    return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Error parseando IA", "confianza": 0.0} for c in cargos]


# ==========================================
# VALORACION CON IA (12 criterios SHR/HAY)
# ==========================================

def build_valoracion_prompt(cargo: dict) -> str:
    """Construye el prompt para valoracion de un cargo con los 12 criterios."""

    nombre = cargo.get("nombre_cargo", "N/A")
    area = cargo.get("area", "N/A")
    homologado = cargo.get("cargo_homologado", "") or "No homologado"
    descripcion = cargo.get("descripcion", "") or cargo.get("descripcion_empresa", "") or "No disponible"
    jefe = cargo.get("cargo_jefe", "") or "No especificado"
    basico = cargo.get("basico", "No disponible")

    prompt = f"""Eres un experto en valoracion de cargos bajo la metodologia HAY/SHR en Colombia.

Debes evaluar el siguiente cargo asignando el nivel correcto para CADA UNO de los criterios y estimar su rango salarial.

=== INFORMACION DEL CARGO ===
Nombre: {nombre}
Area: {area}
Cargo Homologado: {homologado}
Jefe Inmediato: {jefe}
Salario Basico: {basico}
Descripcion: {descripcion}

=== CRITERIOS A EVALUAR ===

FACTOR 1 - CONOCIMIENTO & HABILIDAD GERENCIAL:
1. conocimientos: Elige entre A, B, C, D, E, F, G, H
   - A: Rutinas simples/manual | B: Procesos/equipos simples | C: Tecnica compleja
   - D: Teoria/principios profesionales | E: Ciencia/disciplina avanzada
   - F: Conocimiento profundo de disciplina | G: Maestria en disciplina
   - H: Maestria excepcional en todas las areas

2. experiencia: Elige entre -, o, +
   -: Menos de 6 meses (A-C) / menos de 2 anos (D-H)
   o: 6 meses-1 ano (A-C) / 2-5 anos (D-H)
   +: Mas de 1 ano (A-C) / mas de 5 anos (D-H)

3. habilidad_gerencial: Elige entre I, II, III, IV, V, VI, VII
   I: Inexistente | II: Minima | III: Moderada (coordinacion)
   IV: Media (direccion area) | V: Alta (varias areas)
   VI: Muy alta (toda empresa) | VII: Maxima (grupo corporativo)

4. rol_cargo: Elige entre 1, 2, 3, 4
   1: Miembro de equipo | 2: Miembro de varios equipos
   3: Lider de equipo | 4: Lider de varios equipos

FACTOR 2 - HABILIDADES DE COMUNICACION:
5. contacto: Elige entre A, B, C
   A: Interno (misma area) | B: Externo (otras areas/entidades)
   C: Ambos (interno y externo)

6. frecuenciaContacto: Elige entre 1, 2, 3, 4
   1: Ocasional | 2: Mensual | 3: Semanal | 4: Diario

7. contenidoRelaciones: Elige entre I, II, III, IV, V
   I: Basico (info rutinaria) | II: Moderado (indagar)
   III: Importante (negociar/persuadir) | IV: Superior (acuerdos alto impacto)
   V: Muy superior (negociacion estrategica)

FACTOR 3 - SOLUCION DE PROBLEMAS:
8. complejidadConceptual: Elige entre 1, 2, 3, 4, 5
   1: Identicos (simples/repetitivos) | 2: Semejantes (tipicos con nuevos)
   3: Diversos (varios frentes) | 4: Nuevos (sin solucion previa)
   5: Incertidumbre (alta complejidad)

9. tendenciaCC: Elige entre -, o, +
   -: Tendencia baja | o: Estandar | +: Tendencia alta

10. guiasApoyo: Elige entre A, B, C, D, E, F, G, H
    A: Instrucciones especificas | B: Instrucciones generales
    C: Normas estructuradas | D: Procedimientos definidos
    E: Politicas definidas | F: Politicas generales
    G: Global (asuntos complejos) | H: Abstracto

11. tendenciaGA: Elige entre -, o, +

FACTOR 4 - RESPONSABILIDAD SOBRE RESULTADOS:
12. impacto: Elige entre I, II, III, IV
    I: Informativo | II: Apoyo indirecto
    III: Apoyo directo (responsable resultados area)
    IV: Unicos (responsable resultados finales)

13. autonomia: Elige entre A, B, C, D, E, F, G
    A: Inexistente (aprobacion continua) | B: Restringida
    C: Normalizada | D: Estandarizada | E: Dirigida
    F: Orientada (afecta objetivos empresa) | G: Estrategica

14. magnitud: Elige entre 1 a 14
    1: $0 | 2: Hasta $0.5M | 3: $0.5-2M | 4: $2-6M
    5: $6-12M | 6: $12-24M | 7: $24-48M | 8: $48-96M
    9: $96-192M | 10: $192-384M | 11: $384-768M
    12: $768-1508M | 13: $1508-3072M | 14: Mas de $3072M

CRITERIOS DE CRITICIDAD (0 o 1):
- criterio1: 1 si requiere conocimientos especificos de estrategia del negocio
- criterio2: 1 si pertenece al core del negocio o procesos criticos
- criterio3: 1 si hay oferta escasa en mercado laboral para este cargo

ESTIMACION SALARIAL (en pesos colombianos COP mensual):
Basado en el nivel del cargo, estima:
- garantizado: Salario base garantizado (fijo mensual)
- garantizadoVariable: Salario garantizado + variable tipico (bonos/comisiones)
- compensacionTotal: Costo total empresa (incluye prestaciones, beneficios, etc.)

Referencias mercado Colombia 2025:
- Auxiliares: $1.5M - $2.5M garantizado
- Tecnicos: $2M - $3.5M garantizado
- Analistas: $3M - $5.5M garantizado
- Coordinadores: $4.5M - $8M garantizado
- Jefes: $6M - $10M garantizado
- Directores: $10M - $18M garantizado
- Gerentes: $15M - $35M+ garantizado

=== GUIA DE REFERENCIA RAPIDA ===
- Gerente General/CEO: conocimientos G-H, habilidad VI-VII, autonomia F-G, impacto IV
- Directores/Gerentes area: conocimientos F-G, habilidad IV-V, autonomia E-F, impacto III-IV
- Coordinadores/Jefes: conocimientos E-F, habilidad III-IV, autonomia D-E, impacto III
- Analistas/Especialistas: conocimientos D-E, habilidad I-II, autonomia C-D, impacto II
- Auxiliares/Tecnicos: conocimientos B-C, habilidad I, autonomia A-B, impacto I-II

Responde EXCLUSIVAMENTE con un objeto JSON valido, sin texto adicional:
{{
  "conocimientos": "E",
  "experiencia": "o",
  "habilidadGerencial": "IV",
  "rolCargo": "3",
  "contacto": "C",
  "frecuenciaContacto": "4",
  "contenidoRelaciones": "III",
  "complejidadConceptual": "3",
  "tendenciaCC": "o",
  "guiasApoyo": "E",
  "tendenciaGA": "o",
  "impacto": "III",
  "autonomia": "E",
  "magnitud": "7",
  "criterio1": 1,
  "criterio2": 1,
  "criterio3": 0,
  "garantizado": 4500000,
  "garantizadoVariable": 5400000,
  "compensacionTotal": 7200000,
  "justificacion": "Analisis breve del cargo en 2-3 lineas"
}}"""

    return prompt


def valorar_cargo_con_ia(cargo: dict) -> Optional[dict]:
    """Valora un solo cargo con IA. Retorna dict con los 17 campos."""
    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        raise ValueError("No hay API key de IA configurada (OPENROUTER_API_KEY o OPENAI_API_KEY)")

    prompt = build_valoracion_prompt(cargo)
    content = call_ia([{"role": "user", "content": prompt}], max_tokens=800)

    if not content:
        raise ValueError("Error al llamar a la IA - no se obtuvo respuesta")

    result = extract_json(content)
    if not result:
        raise ValueError(f"La IA no retorno JSON valido: {content[:200]}")

    # Normalizar campos (la IA puede usar diferentes nombres)
    normalized = {
        "conocimientos": result.get("conocimientos", result.get("conocimiento", "")),
        "experiencia": result.get("experiencia", ""),
        "habilidadGerencial": result.get("habilidadGerencial", result.get("habilidad_gerencial", "")),
        "rolCargo": result.get("rolCargo", result.get("rol_cargo", "")),
        "contacto": result.get("contacto", ""),
        "frecuenciaContacto": result.get("frecuenciaContacto", result.get("frecuencia", "")),
        "contenidoRelaciones": result.get("contenidoRelaciones", result.get("contenido_relaciones", "")),
        "complejidadConceptual": result.get("complejidadConceptual", result.get("complejidad_conceptual", "")),
        "tendenciaCC": result.get("tendenciaCC", result.get("tendencia_cc", "o")),
        "guiasApoyo": result.get("guiasApoyo", result.get("guias_apoyo", "")),
        "tendenciaGA": result.get("tendenciaGA", result.get("tendencia_ga", "o")),
        "impacto": result.get("impacto", ""),
        "autonomia": result.get("autonomia", ""),
        "magnitud": result.get("magnitud", ""),
        "criterio1": result.get("criterio1", result.get("criterio_1", 0)),
        "criterio2": result.get("criterio2", result.get("criterio_2", 0)),
        "criterio3": result.get("criterio3", result.get("criterio_3", 0)),
        "garantizado": result.get("garantizado"),
        "garantizadoVariable": result.get("garantizadoVariable", result.get("garantizado_variable")),
        "compensacionTotal": result.get("compensacionTotal", result.get("compensacion_total")),
        "justificacion": result.get("justificacion", result.get("justificacion", "")),
    }

    return normalized


def valorar_lote_con_ia(cargos: list) -> list:
    """Valora un lote de cargos con IA. Retorna lista de resultados."""
    if not OPENROUTER_API_KEY and not OPENAI_API_KEY:
        return [{"id": c.get("id"), "error": "Sin API key de IA"} for c in cargos]

    resultados = []
    for cargo in cargos:
        try:
            val = valorar_cargo_con_ia(cargo)
            val["id"] = cargo.get("id")
            val["estado"] = "valorado"
            resultados.append(val)
            time.sleep(1.5)
        except Exception as e:
            logger.error(f"Error valorando cargo {cargo.get('id')}: {e}")
            resultados.append({
                "id": cargo.get("id"),
                "estado": "error",
                "error": str(e),
            })

    return resultados
