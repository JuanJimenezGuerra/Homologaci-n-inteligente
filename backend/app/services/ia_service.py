import os
import json
import time
import requests
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "microsoft/DialoGPT-medium")
BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")

HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/{HUGGINGFACE_MODEL}"

print(f"IA Service: HUGGINGFACE_API_KEY={'CONFIGURADA' if HUGGINGFACE_API_KEY else 'NO CONFIGURADA (usando gratis)'}")
print(f"IA Service: HUGGINGFACE_MODEL={HUGGINGFACE_MODEL}")


def call_huggingface(messages: list, max_tokens: int = 800, temperature: float = 0.1) -> Optional[str]:
    """Call Hugging Face Inference API (free, no credit card needed)."""
    try:
        print(f"HuggingFace: llamando {HUGGINGFACE_MODEL}")
        # Convert messages to prompt
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages]) + "\nassistant:"
        
        headers = {}
        if HUGGINGFACE_API_KEY:
            headers["Authorization"] = f"Bearer {HUGGINGFACE_API_KEY}"
        
        resp = requests.post(
            HUGGINGFACE_API_URL,
            headers=headers,
            json={
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": max_tokens,
                    "temperature": temperature,
                    "return_full_text": False,
                }
            },
            timeout=60,
        )
        if resp.ok:
            data = resp.json()
            # Handle different response formats
            if isinstance(data, list) and len(data) > 0:
                content = data[0].get("generated_text", "").strip()
            elif isinstance(data, dict):
                content = data.get("generated_text", "").strip()
            else:
                content = str(data).strip()
            
            if len(content) == 0:
                print(f"HuggingFace: {HUGGINGFACE_MODEL} devolvio respuesta vacia")
                return None
            print(f"HuggingFace: OK, respuesta {len(content)} chars")
            return content
        else:
            print(f"HuggingFace: HTTP {resp.status_code} - {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"HuggingFace: excepcion - {e}")
        return None


def call_ia(messages: list, max_tokens: int = 800, temperature: float = 0.1, timeout: int = 60) -> Optional[str]:
    """Usa OpenCode (gratuito, sin limite) como unico modelo."""
    import threading
    result = {"content": None}

    def _call():
        try:
            result["content"] = call_opencode(messages, max_tokens, temperature)
        except Exception as e:
            print(f"call_ia error: {e}")
            result["content"] = None

    thread = threading.Thread(target=_call)
    thread.daemon = True
    thread.start()
    thread.join(timeout)

    if thread.is_alive():
        print(f"call_ia: TIMEOUT tras {timeout}s")
        return None
    return result["content"]


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
    """Construye el prompt para homologación de cargos con IA."""
    
    masters_text = "\n".join([
        f"- {m['nombre'].upper() if m.get('nombre') else ''} | {m.get('area', '')}"
        for m in masters[:80]
    ])
    
    cargos_text = ""
    for c in cargos[:10]:
        desc = (c.get("descripcion", "") or c.get("descripcion_empresa", "") or "").upper()
        area = (c.get("area", "N/A") or "").upper()
        nombre = (c.get("nombre_cargo", "") or "").upper()
        cargos_text += f"""
ID: {c.get('id', '')}
CARGO: {nombre}
AREA: {area}
DESCRIPCION: {desc[:150]}
---
"""

    prompt = f"""Eres un experto en clasificacion y homologacion de cargos en Colombia bajo metodologia SHR/HAY.

Tu tarea es encontrar el cargo maestro MAS similar para cada cargo de la empresa.

=== CATALOGO MAESTRO DE CARGOS (referencia) ===
{masters_text}

=== CARGOS A HOMOLOGAR ===
{cargos_text}

INSTRUCCIONES:
1. Para cada cargo, selecciona el cargo maestro MAS similar del catalogo.
2. Usa la DESCRIPCION y el AREA del cargo para mejorar la precision.
3. Considera el nivel jerarquico (jefe, coordinador, analista, auxiliar) para seniority.
4. Si NO hay ningun cargo similar en el catalogo, responde "SIN COINCIDENCIA".
5. El nombre del cargo homologado debe ser EXACTAMENTE como aparece en el catalogo.

Responde SOLO con un array JSON valido:
[
  {{
    "id": ID_NUMERICO,
    "cargo_homologado": "NOMBRE EXACTO DEL CARGO MAESTRO O SIN COINCIDENCIA",
    "justificacion": "Razon breve (max 60 chars)",
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

    batch_size = 8
    print(f"homologar_con_ia: Procesando {len(cargos)} cargos en lotes de {batch_size}")

    resultados = []
    for i in range(0, len(cargos), batch_size):
        batch = cargos[i:i + batch_size]
        prompt = build_homologacion_prompt(batch, masters)
        prompt_len = len(prompt)
        lote_num = i // batch_size + 1
        print(f"homologar_con_ia: Lote {lote_num}, {len(batch)} cargos, prompt {prompt_len} chars")

        # Intentar con retry automatico si falla el primer modelo
        content = None
        max_retries = 2
        for attempt in range(max_retries):
            content = call_ia([{"role": "user", "content": prompt}], max_tokens=2000, timeout=90)
            if content:
                break
            print(f"homologar_con_ia: Lote {lote_num} intento {attempt + 1} fallo, reintentando...")
            time.sleep(2)

        if not content:
            ia_error = "Sin respuesta de IA tras reintentos."
            print(f"homologar_con_ia: Lote {lote_num} FALLO definitivo - sin respuesta de IA")
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
            print(f"homologar_con_ia: Lote {lote_num} OK - {len(parsed)} objetos, {matched_count}/{len(batch)} matchean")

            for res in parsed:
                resultados.append({
                    "id": res.get("id"),
                    "cargo_homologado": res.get("cargo_homologado", "SIN_COINCIDENCIA"),
                    "justificacion": res.get("justificacion", ""),
                    "confianza": res.get("confianza", 0.5),
                })

            for c in batch:
                if c.get("id") not in parsed_ids:
                    print(f"homologar_con_ia: Lote {lote_num} - cargo {c.get('id')} ({c.get('nombre_cargo')}) sin resultado")
                    resultados.append({
                        "id": c.get("id"),
                        "cargo_homologado": "SIN_COINCIDENCIA",
                        "justificacion": "Respuesta IA truncada (modelo gratuito con limite de tokens)",
                        "confianza": 0.0,
                        "_ia_error": "JSON truncado por modelo",
                    })
        else:
            print(f"homologar_con_ia: Lote {lote_num} FALLO parseo - contenido: {content[:200]}...")
            resultados.extend([
                {"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Error parseando respuesta IA", "confianza": 0.0, "_ia_error": "Error parseando respuesta IA"}
                for c in batch
            ])

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


def buscar_en_internet_y_homologar(cargo: dict, db) -> dict:
    """Busca funciones del cargo en internet y homologa contra la base maestra."""
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            logger.error("ddgs no instalado. Usando búsqueda web alternativa.")
            DDGS = None

    nombre_cargo = cargo.get("nombre_cargo", "")
    area = cargo.get("area", "")

    # 1. Buscar en internet las funciones del cargo
    search_query = f"funciones y responsabilidades del cargo {nombre_cargo}"
    search_url = f"https://duckduckgo.com/?q={requests.utils.quote(search_query)}"
    funciones_encontradas = ""

    if DDGS is not None:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(search_query, max_results=5))
                if results:
                    funciones_encontradas = "\n".join([
                        f"- {r.get('title', '')}: {r.get('body', '')[:300]}"
                        for r in results[:3]
                    ])
                    search_url = results[0].get("href", search_url)
        except Exception as e:
            logger.error(f"Error buscando en DuckDuckGo: {e}")
            # Fallback: usar URL de búsqueda estática
            search_url = f"https://duckduckgo.com/?q={requests.utils.quote(search_query)}"
    else:
        logger.warning("DuckDuckGo no disponible, usando información base")
        try:
            resp = requests.get(
                "https://html.duckduckgo.com/html/",
                params={"q": search_query},
                timeout=10,
                headers={"User-Agent": "Mozilla/5.0"}
            )
            if resp.ok:
                search_url = f"https://duckduckgo.com/?q={requests.utils.quote(search_query)}"
        except Exception as e2:
            logger.error(f"Error en fallback de búsqueda: {e2}")

    # 2. Cargar la base maestra completa
    masters = load_master_cargos(db)
    masters_text = "\n".join([
        f"- {m['nombre']} | Area: {m['area']} | Descripcion: {m['descripcion'][:200]}"
        for m in masters[:200]
    ])

    # 3. Prompt para que la IA haga el match con el contexto de internet
    prompt = f"""Eres un especialista en clasificacion de cargos para recursos humanos.

CARGO A HOMOLOGAR:
Nombre: {nombre_cargo}
Area: {area}

FUNCIONES ENCONTRADAS EN INTERNET:
{funciones_encontradas or "No se encontraron funciones especificas en internet. Usa tu conocimiento general sobre este cargo."}

BASE MAESTRA DE CARGOS (1057 cargos de referencia):
{masters_text}

INSTRUCCIONES:
1. Analiza las funciones encontradas en internet para el cargo "{nombre_cargo}"
2. Busca en la base maestra el cargo que MEJOR coincida con estas funciones
3. Si no encuentras un match exacto, elige el cargo mas cercano en terminos de funciones y nivel
4. Proporciona una justificacion clara de por que elegiste ese cargo

Responde SOLO con este formato JSON:
{{
  "cargo_homologado": "NOMBRE DEL CARGO MAESTRO EN MAYUSCULAS",
  "justificacion": "Explicacion de 2-3 lineas de por que este es el mejor match basado en las funciones encontradas",
  "url_busqueda": "{search_url}"
}}"""

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=500)

    if not content:
        raise ValueError("La IA no respondio la busqueda en internet")

    result = extract_json(content)
    if not result:
        raise ValueError(f"La IA no retorno JSON valido: {content[:200]}")

    return {
        "cargo_homologado": result.get("cargo_homologado", "").upper(),
        "justificacion": result.get("justificacion", ""),
        "url_busqueda": result.get("url_busqueda", search_url),
        "funciones_encontradas": funciones_encontradas,
    }
