import os
import json
import re
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_URL", "https://shr-backend-prod.onrender.com")


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


# ==========================================
# HOMOLOGACION CON COINCIDENCIA LOCAL
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


def homologar_con_ia(db, cargos: list, masters: list = None) -> list:
    """Homologa cargos usando coincidencia de texto local (sin IA externa)."""
    
    if masters is None:
        masters = load_master_cargos(db)
    if not masters:
        print("homologar_con_ia: NO hay cargos maestros en la base de datos")
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Sin catalogo maestro", "confianza": 0.0} for c in cargos]
    
    print(f"homologar_con_ia: Procesando {len(cargos)} cargos con coincidencia de texto local")
    
    import re
    
    def normalize(text):
        """Normaliza texto para comparacion."""
        if not text:
            return ""
        text = text.upper()
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def match_score(cargo_name, master_name, cargo_desc="", master_desc=""):
        """Calcula score de coincidencia entre cargo y master."""
        n_cargo = normalize(cargo_name)
        n_master = normalize(master_name)
        
        if not n_cargo or not n_master:
            return 0.0
        
        # Coincidencia exacta
        if n_cargo == n_master:
            return 1.0
        
        # Coincidencia de palabras
        cargo_words = set(n_cargo.split())
        master_words = set(n_master.split())
        
        if len(cargo_words) == 0 or len(master_words) == 0:
            return 0.0
        
        # Palabras en comun
        common = cargo_words & master_words
        score_words = len(common) / max(len(cargo_words), len(master_words))
        
        # Bonus si una es substring de la otra
        if n_cargo in n_master or n_master in n_cargo:
            score_words = max(score_words, 0.8)
        
        # Verificar jerarquia (jefe, coordinador, analista, auxiliar)
        jerarquia = ["JEFE", "DIRECTOR", "GERENTE", "COORDINADOR", "SUPERVISOR", "ANALISTA", "ESPECIALISTA", "TECNICO", "AUXILIAR", "ASISTENTE"]
        cargo_jer = next((j for j in jerarquia if j in n_cargo), None)
        master_jer = next((j for j in jerarquia if j in n_master), None)
        
        # Penalizar si la jerarquia no coincide
        if cargo_jer and master_jer and cargo_jer != master_jer:
            score_words *= 0.6
        
        return round(score_words, 2)
    
    resultados = []
    for c in cargos:
        cargo_name = c.get("nombre_cargo", "")
        cargo_desc = c.get("descripcion", "") or c.get("descripcion_empresa", "") or ""
        
        best_match = None
        best_score = 0.0
        
        for m in masters:
            master_name = m.get("nombre", "")
            master_desc = m.get("descripcion", "")
            
            score = match_score(cargo_name, master_name, cargo_desc, master_desc)
            
            if score > best_score:
                best_score = score
                best_match = master_name
        
        if best_match and best_score >= 0.3:
            resultados.append({
                "id": c.get("id"),
                "cargo_homologado": best_match,
                "justificacion": f"Coincidencia texto ({int(best_score*100)}%)",
                "confianza": best_score,
            })
        else:
            resultados.append({
                "id": c.get("id"),
                "cargo_homologado": "SIN_COINCIDENCIA",
                "justificacion": "Sin coincidencia en catalogo",
                "confianza": 0.0,
            })
    
    total_ok = len([r for r in resultados if r["cargo_homologado"] != "SIN_COINCIDENCIA"])
    print(f"homologar_con_ia: Completado - {total_ok}/{len(cargos)} coincidencias encontradas")
    return resultados


def homologar_con_ia_observaciones(db, cargos: list, masters: list = None, observaciones: str = "") -> list:
    """Homologa cargos con coincidencia local, considerando observaciones del analista."""
    
    if masters is None:
        masters = load_master_cargos(db)
    if not masters:
        return [{"id": c.get("id"), "cargo_homologado": "SIN_COINCIDENCIA", "justificacion": "Sin catalogo maestro", "confianza": 0.0} for c in cargos]

    print(f"homologar_con_ia_observaciones: Reprocesando {len(cargos)} cargos con observaciones")

    import re

    def normalize(text):
        if not text:
            return ""
        text = text.upper()
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def match_score(cargo_name, master_name):
        n_cargo = normalize(cargo_name)
        n_master = normalize(master_name)

        if not n_cargo or not n_master:
            return 0.0

        if n_cargo == n_master:
            return 1.0

        cargo_words = set(n_cargo.split())
        master_words = set(n_master.split())

        if len(cargo_words) == 0 or len(master_words) == 0:
            return 0.0

        common = cargo_words & master_words
        score_words = len(common) / max(len(cargo_words), len(master_words))

        if n_cargo in n_master or n_master in n_cargo:
            score_words = max(score_words, 0.8)

        return round(score_words, 2)

    # Parse observaciones to improve matching
    obs_lower = observaciones.upper() if observaciones else ""

    resultados = []
    for c in cargos:
        cargo_name = c.get("nombre_cargo", "")

        best_match = None
        best_score = 0.0

        for m in masters:
            master_name = m.get("nombre", "")
            score = match_score(cargo_name, master_name)

            # Boost score if observaciones mention this master
            if obs_lower and normalize(master_name) in obs_lower:
                score = max(score, 0.7)

            if score > best_score:
                best_score = score
                best_match = master_name

        if best_match and best_score >= 0.3:
            justificacion = f"Coincidencia texto ({int(best_score*100)}%)"
            if obs_lower and normalize(best_match) in obs_lower:
                justificacion += " + obs. analista"
            resultados.append({
                "id": c.get("id"),
                "cargo_homologado": best_match,
                "justificacion": justificacion,
                "confianza": best_score,
            })
        else:
            resultados.append({
                "id": c.get("id"),
                "cargo_homologado": "SIN_COINCIDENCIA",
                "justificacion": "Sin coincidencia en catalogo",
                "confianza": 0.0,
            })

    total_ok = len([r for r in resultados if r["cargo_homologado"] != "SIN_COINCIDENCIA"])
    print(f"homologar_con_ia_observaciones: Completado - {total_ok}/{len(cargos)} coincidencias encontradas")
    return resultados


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
