import os
import json
import time
import re

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def call_ia(messages, max_tokens=300, timeout=30):
    """Llama a OpenAI API."""
    if not OPENAI_API_KEY:
        print("[IA] ERROR: No hay OPENAI_API_KEY")
        return ""

    # Add system message to force short response
    if messages and messages[0].get("role") == "user":
        system_msg = {
            "role": "system",
            "content": "Eres un asistente que responde UNICAMENTE con JSON valido, sin texto adicional. Todos los pares clave-valor deben estar separados por comas, comillas dobles estandar. El JSON debe ser parseable por json.loads de Python. No expliques nada, no uses markdown."
        }
        messages = [system_msg] + messages

    try:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=timeout)

        print("[IA] Llamando " + OPENAI_MODEL + "...")
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.0
        )
        content = resp.choices[0].message.content.strip()
        if content:
            print("[IA] Respuesta recibida: " + str(len(content)) + " caracteres")
            return content
        else:
            print("[IA] Respuesta vacia")
    except Exception as e:
        print("[IA] Error: " + str(e))

    print("[IA] OpenAI fallo")
    return ""


def _fix_json_commas(text):
    """Fix missing commas in JSON text."""
    # Fix missing commas between number and quote: 123 "key" -> 123, "key"
    text = re.sub(r'(\d+)\s+(")', r'\1, \2', text)
    # Fix missing commas between quote and quote: "value" "key" -> "value", "key"
    text = re.sub(r'(")\s+(")', r'\1, \2', text)
    # Fix missing commas between objects in array: } { -> }, {
    text = re.sub(r'}\s*{', '}, {', text)
    return text.strip()


def extract_json(text):
    """Extrae JSON de la respuesta."""
    if not text:
        return None
    try:
        # Try direct parse first
        return json.loads(text)
    except:
        pass

    # Try to extract JSON object from text
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            candidate = text[start:end]
            candidate = _fix_json_commas(candidate)
            return json.loads(candidate)
    except:
        pass
    return None


def extract_json_array(text):
    """Extrae array JSON de la respuesta de la IA."""
    if not text:
        return None

    # First try direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except:
        pass

    # Extract array from text
    try:
        start = text.find("[")
        end = text.rfind("]") + 1
        if start == -1 or end <= start:
            print("[IA] No se encontro array JSON. Texto: " + text[:500])
            return None

        candidate = text[start:end]
        candidate = _fix_json_commas(candidate)

        print("[IA] Intentando parsear JSON array: " + candidate[:500] + "...")
        result = json.loads(candidate)
        if isinstance(result, list):
            return result
        else:
            print("[IA] El parseo no dio una lista: " + str(type(result)))
    except Exception as e:
        print("[IA] Error parseando JSON array: " + str(e) + " | Texto: " + text[:500])
    return None


def load_master_cargos(db):
    from ..models import MasterDescription, MasterCargo
    masters = []
    for m in db.query(MasterDescription).all():
        if m.nombre_cargo:
            masters.append({"nombre": m.nombre_cargo.upper()})
    for m in db.query(MasterCargo).all():
        if m.nombre:
            masters.append({"nombre": m.nombre.upper()})
    return masters


def _get_level_from_name(nombre):
    """Extract expected level from cargo name."""
    n = nombre.upper()
    if "VICEPRESIDENTE" in n or "VP" in n:
        return "vice"
    if "DIRECTOR" in n:
        return "director"
    if "GERENTE" in n or "SUBGERENTE" in n:
        return "gerente"
    if "COORDINADOR" in n or "JEFE DE AREA" in n or "SUPERVISOR" in n:
        return "coordinador"
    if "LIDER" in n or "PROGRAMADOR" in n or "ESPECIALISTA" in n:
        return "profesional"
    if "ANALISTA" in n or "TECNICO" in n or "TECNOLOGO" in n:
        return "profesional"
    if "AUXILIAR" in n or "ASISTENTE" in n or "APOYO" in n:
        return "operativo"
    return "unknown"


def _is_level_allowed(original_name, homologado_name):
    """Check if homologado level matches original level EXACTLY.
    
    RULE: El nivel jerarquico se CONSERVA siempre, nunca cambia.
    - COORDINADOR -> COORDINADOR (NO gerente, NO profesional)
    - GERENTE -> GERENTE (NO director, NO coordinador)
    - DIRECTOR -> DIRECTOR (NO gerente, NO VP)
    - PROFESIONAL -> PROFESIONAL (NO operativo, NO coordinador)
    - OPERATIVO -> OPERATIVO (NO profesional)
    - AUXILIAR -> AUXILIAR (mantiene su nivel)
    """
    orig_level = _get_level_from_name(original_name)
    homo_level = _get_level_from_name(homologado_name)
    
    return orig_level == homo_level


def _find_homolog_by_level(nombre, area, masters):
    """Find homologado that matches EXACT level of original.
    
    RULE: Solo busca cargos del MISMO nivel jerárquico.
    - COORDINADOR busca solo COORDINADORES en el catálogo
    - GERENTE busca solo GERENTES en el catálogo
    """
    orig_level = _get_level_from_name(nombre)
    nombre_upper = nombre.upper()
    area_upper = area.upper() if area else ""
    
    def score_cargo(m):
        m_nombre = m["nombre"]
        m_level = _get_level_from_name(m_nombre)
        
        if m_level != orig_level:
            return -1
        
        s = 100
        
        if area_upper and area_upper in m_nombre:
            s += 50
        
        common_words = set(nombre_upper.split()) & set(m_nombre.split())
        s += len(common_words) * 3
        
        return s
    
    scored = [(score_cargo(m), m) for m in masters]
    scored = [(s, m) for s, m in scored if s > 0]
    scored.sort(key=lambda x: -x[0])
    
    if scored:
        return scored[0][1]["nombre"]
    
    return "SIN COINCIDENCIA"


def _level_priority(level):
    """Priority for sorting (lower = more preferred)."""
    order = {"operativo": 1, "profesional": 2, "coordinador": 3, "gerente": 4, "director": 5, "vice": 6, "unknown": 7}
    return order.get(level, 10)


def homologar_con_ia(db, cargos, masters=None):
    if not OPENAI_API_KEY:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    print("[HOMOLOGACION] Procesando " + str(len(cargos)) + " cargos")

    resultados = []
    batch_size = 5
    for i in range(0, len(cargos), batch_size):
        batch = cargos[i:i+batch_size]
        catalogo = "\n".join(["- " + m["nombre"] for m in masters[:150]])
        cargos_txt = "\n".join(["ID:" + str(c.get("id")) + " | " + str(c.get("nombre_cargo", "")).upper() + " | Area:" + str(c.get("area", "")) for c in batch])

        prompt = "Eres experto en homologacion de cargos en Colombia con experiencia en estructuras salariales y niveles jerarquicos.\n\n"
        prompt += "CATALOGO MAESTRO (" + str(len(masters[:150])) + " cargos):\n" + catalogo + "\n\n"
        prompt += "CARGOS A HOMOLOGAR:\n" + cargos_txt + "\n\n"
        prompt += "REGLAS DE JERARQUIA SALARIAL (OBLIGATORIAS - NO VIOLAR):\n"
        prompt += "1. CONSERVAR NIVEL JERARQUICO: Cada cargo se homologa a uno de SIMILAR nivel, NUNCA superior.\n"
        prompt += "   - AUXILIAR/ASISTENTE/APOYO -> solo opciones de nivel operativo (ej: Auxiliar de Contabilidad, Asistente Administrativo)\n"
        prompt += "   - ANALISTA/ESPECIALISTA -> solo opciones de nivel profesional (ej: Analista de Contabilidad)\n"
        prompt += "   - COORDINADOR/JEFE -> solo opciones de nivel coordinacion/jefatura (ej: Coordinador de Ventas)\n"
        prompt += "   - GERENTE -> solo opciones de nivel gerencial (ej: Gerente de Ventas)\n"
        prompt += "   - DIRECTOR -> solo opciones de nivel director (ej: Director de Finanzas)\n"
        prompt += "   - LIDER/PROGRAMADOR -> nivel profesional/coordinacion segun contexto\n"
        prompt += "2. AREA FUNCIONAL: Si el cargo tiene area (Contabilidad, Ventas, etc), buscar homologado CON area similar en catalogo.\n"
        prompt += "   - \"Auxiliar Contable\" -> buscar \"Auxiliar de Contabilidad\" o similar, NO \"Auxiliar General\"\n"
        prompt += "   - \"Analista de Marketing\" -> buscar \"Analista de Marketing\" o similar, NO \"Analista\" generico\n"
        prompt += "3. EVITAR DUPLICADOS: No asignar el mismo cargo homologado a múltiples cargos originales diferentes.\n"
        prompt += "   - \"Analista Junior\" y \"Analista Senior\" deben tener homologados diferentes si existen niveles distintos\n"
        prompt += "4. SOLO SIMILITUD ALTO: Confianza >= 0.7 para asignar homologacion. Sino usar \"SIN COINCIDENCIA\".\n\n"
        prompt += "NIVELES DE CARGOS EN COLOMBIA (referencia):\n"
        prompt += "- OPERATIVO: Auxiliar, Asistente, Apoyo, Tecnico (sin titulo profesional)\n"
        prompt += "- PROFESIONAL: Analista, Especialistas, Tecnologo, Profesional (con titulo profesional)\n"
        prompt += "- COORDINACION: Coordinador, Jefe de Area, Supervisor (mando medio)\n"
        prompt += "- GERENCIAL: Gerente, Subgerente (directivos menores)\n"
        prompt += "- DIRECTOR: Director, VP, Vicepresidente (alta direccion)\n\n"
        prompt += "INSTRUCCIONES:\n"
        prompt += "1. Identificar el nivel del cargo original (usando keywords: AUXILIAR, ANALISTA, COORDINADOR, etc)\n"
        prompt += "2. Buscar en el catalogo SOLO cargos del MISMO nivel y area similar\n"
        prompt += "3. RESPUESTA: Array JSON, SIN texto adicional, cada objeto separado por coma\n"
        prompt += '   Formato: [{"id": 1, "cargo_homologado": "NOMBRE_CATALOGO", "justificacion": "nivel+area", "confianza": 0.85}]\n'
        prompt += "4. Si NO existe cargo de mismo nivel+area en catalogo -> \"SIN COINCIDENCIA\" con confianza 0.0\n"
        prompt += "5. IMPORTANTE: Un COORDINADOR debe homologar a COORDINADOR o similar, NO a GERENTE\n"
        prompt += "6. IMPORTANTE: Un GERENTE debe homologar a GERENTE o similar, NO a DIRECTOR\n"
        prompt += "7. CADA PAR CLAVE-VALOR SEPARADO POR COMA. No omitir comas."

        content = ""
        for intento in range(2):
            content = call_ia([{"role": "user", "content": prompt}], max_tokens=500)
            if content:
                break
            time.sleep(2)

        if not content:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "confianza": 0.0} for c in batch])
            continue

        print("[HOMOLOGACION] Respuesta IA completa: " + content[:1000])

        parsed = extract_json_array(content)
        if parsed and isinstance(parsed, list):
            cargo_map = {str(c.get("id")): c for c in batch}
            for r in parsed:
                cargo_id = r.get("id")
                ai_homologado = r.get("cargo_homologado", "SIN COINCIDENCIA")
                orig_cargo = cargo_map.get(str(cargo_id))
                
                if orig_cargo and ai_homologado != "SIN COINCIDENCIA":
                    orig_name = orig_cargo.get("nombre_cargo", "")
                    if not _is_level_allowed(orig_name, ai_homologado):
                        print(f"[HOMOLOGACION] IA violo jerarquia: {orig_name} -> {ai_homologado}, buscando nivel correcto...")
                        nivel_final = _get_level_from_name(orig_name)
                        nuevo_homologado = _find_homolog_by_level(orig_name, orig_cargo.get("area", ""), masters)
                        ai_homologado = nuevo_homologado
                        print(f"[HOMOLOGACION] Corregido a: {nuevo_homologado}")
                
                resultados.append({
                    "id": cargo_id,
                    "cargo_homologado": ai_homologado,
                    "justificacion": str(r.get("justificacion", ""))[:60],
                    "confianza": float(r.get("confianza", 0.5)),
                })
        else:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseo", "confianza": 0.0} for c in batch])

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print("[HOMOLOGACION] " + str(exitos) + "/" + str(len(cargos)) + " exitos")
    return resultados


def _validar_valor_unico(valor, opciones_validas, campo):
    """Valida que un valor sea una opcion unica valida, no un rango."""
    if not valor or not isinstance(valor, str):
        return None
    v = valor.strip()
    if v in opciones_validas:
        return v
    return None


def _sanitizar_valoracion(resultado):
    """Sanitiza y valida la respuesta de IA, asegurando valores unicos."""
    if not resultado or not isinstance(resultado, dict):
        return resultado

    VALIDOS = {
        "conocimientos": ["A", "B", "C", "D", "E", "F", "G", "H"],
        "experiencia": ["-", "o", "+"],
        "habilidadGerencial": ["I", "II", "III", "IV", "V", "VI", "VII"],
        "rolCargo": ["1", "2", "3", "4"],
        "contacto": ["A", "B", "C"],
        "frecuenciaContacto": ["1", "2", "3", "4"],
        "contenidoRelaciones": ["I", "II", "III", "IV", "V"],
        "complejidadConceptual": ["1", "2", "3", "4", "5"],
        "tendenciaCC": ["-", "o", "+"],
        "guiasApoyo": ["A", "B", "C", "D", "E", "F", "G", "H"],
        "tendenciaGA": ["-", "o", "+"],
        "impacto": ["I", "II", "III", "IV"],
        "autonomia": ["A", "B", "C", "D", "E", "F", "G"],
    }
    MAGNITUD_VALIDOS = [str(i) for i in range(1, 15)]

    for campo in VALIDOS:
        valor = resultado.get(campo)
        if isinstance(valor, str):
            # Detectar rangos como "A-H", "I-VII", "+/+/+" y tomar solo el primer valor
            if "-" in valor or "/" in valor or "," in valor:
                partes = valor.replace("/", "-").replace(",", "-").split("-")
                primer_valor = partes[0].strip() if partes else None
                if primer_valor in VALIDOS[campo]:
                    resultado[campo] = primer_valor
                else:
                    resultado[campo] = VALIDOS[campo][0]
            elif valor not in VALIDOS[campo]:
                resultado[campo] = VALIDOS[campo][0]

    # Validar magnitud
    magnitud = resultado.get("magnitud")
    if isinstance(magnitud, str):
        if "-" in magnitud or "/" in magnitud or "," in magnitud:
            partes = magnitud.replace("/", "-").replace(",", "-").split("-")
            resultado["magnitud"] = partes[0].strip() if partes[0].strip() in MAGNITUD_VALIDOS else "5"
        elif magnitud not in MAGNITUD_VALIDOS:
            resultado["magnitud"] = "5"

    # Validar criterios - SOLO 0 o 1
    for c in ["criterio1", "criterio2", "criterio3"]:
        v = resultado.get(c)
        try:
            val = int(v)
            if val not in (0, 1):
                resultado[c] = 0
        except (ValueError, TypeError):
            resultado[c] = 0

    return resultado


def valorar_cargo_con_ia(cargo):
    """Valora un cargo usando IA siguiendo metodologia SHR/HAY."""
    if not OPENAI_API_KEY:
        return {"error": "Sin API key"}

    nombre = cargo.get("nombre_cargo", "N/A")
    homologado = cargo.get("cargo_homologado", "")
    descripcion = cargo.get("descripcion_empresa", "")

    prompt = "Eres experto en valoracion de cargos SHR/HAY en Colombia.\n\n"
    prompt += "CARGO A VALORAR: " + nombre + "\n"
    if homologado:
        prompt += "CARGO HOMOLOGADO: " + homologado + "\n"
    if descripcion:
        prompt += "DESCRIPCION: " + descripcion + "\n"
    prompt += "\nINSTRUCCIONES ESTRICTAS:\n"
    prompt += "1. Responde UNICAMENTE con el objeto JSON, sin texto adicional.\n"
    prompt += "2. No uses markdown ni explicaciones.\n"
    prompt += "3. Asigna EXACTAMENTE UN (1) valor por cada factor. NO uses rangos ni multiple valores.\n"
    prompt += '4. Formato exacto (elige SOLO UNA opcion de cada una):\n'
    prompt += '   {"conocimientos":"A","experiencia":"o","habilidadGerencial":"III","rolCargo":"2",\n'
    prompt += '    "contacto":"B","frecuenciaContacto":"3","contenidoRelaciones":"III",\n'
    prompt += '    "complejidadConceptual":"3","tendenciaCC":"o","guiasApoyo":"C","tendenciaGA":"o",\n'
    prompt += '    "impacto":"II","autonomia":"D","magnitud":"5",\n'
    prompt += '    "criterio1":0,"criterio2":0,"criterio3":0,"justificacion":"breve analisis"}\n'
    prompt += "5. Opciones validas para cada factor:\n"
    prompt += "   conocimientos: A, B, C, D, E, F, G, H (SOLO UNA LETRA)\n"
    prompt += "   experiencia: -, o, + (SOLO UN SIMBOLO)\n"
    prompt += "   habilidadGerencial: I, II, III, IV, V, VI, VII (SOLO UN NUMERO ROMANO)\n"
    prompt += "   rolCargo: 1, 2, 3, 4 (SOLO UN DIGITO)\n"
    prompt += "   contacto: A, B, C\n"
    prompt += "   frecuenciaContacto: 1, 2, 3, 4\n"
    prompt += "   contenidoRelaciones: I, II, III, IV, V\n"
    prompt += "   complejidadConceptual: 1, 2, 3, 4, 5\n"
    prompt += "   tendenciaCC: -, o, +\n"
    prompt += "   guiasApoyo: A, B, C, D, E, F, G, H\n"
    prompt += "   tendenciaGA: -, o, +\n"
    prompt += "   impacto: I, II, III, IV\n"
    prompt += "   autonomia: A, B, C, D, E, F, G\n"
    prompt += "   magnitud: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14\n"
    prompt += "   criterio1/2/3: SOLO 0 o 1 (NUNCA uses 2 o 3)\n"
    prompt += "6. CRITICO: criterio1, criterio2, criterio3 solo aceptan 0 o 1. NUNCA uses otros numeros.\n"
    prompt += "7. magnitud: 1=Hasta 50M, 14=Mas de 500,000M.\n"
    prompt += "8. Cada valor debe ser UNA SOLA OPCION valida de la lista. NUNCA concatenes opciones."

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=400)
    if not content:
        return {"error": "Sin respuesta IA"}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return _sanitizar_valoracion(parsed)
    return {"error": "Error parseo"}


def buscar_en_internet(cargo):
    """Busca informacion del cargo en internet para mejorar homologacion."""
    if not OPENAI_API_KEY:
        return {"fuente": "Sin API key", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "", "url": ""}

    nombre = cargo.get("nombre_cargo", "")
    prompt = "Busca informacion del cargo '" + nombre + "' en Colombia.\n\n"
    prompt += "INSTRUCCIONES:\n"
    prompt += "1. Da una descripcion BREVE (max 50 palabras) de las funciones principales.\n"
    prompt += '2. Responde UNICAMENTE con JSON: {"fuente":"Internet","titulo":"' + nombre + '","descripcion":"funciones principales","url":"https://ejemplo.com"}\n'
    prompt += "3. Si no encuentras info, usa descripcion generica basada en el nombre del cargo."

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=200)
    if not content:
        return {"fuente": "Error", "titulo": nombre, "descripcion": "Error IA", "url": ""}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
    return {"fuente": "Error", "titulo": nombre, "descripcion": "Error parseo", "url": ""}


def buscar_en_internet_y_homologar(cargo_dict, db):
    """Busca info en internet y luego homologa el cargo."""
    info = buscar_en_internet(cargo_dict)
    masters = load_master_cargos(db)

    nombre = cargo_dict.get("nombre_cargo", "")
    area = cargo_dict.get("area", "")
    descripcion = info.get("descripcion", "")

    catalogo = "\n".join(["- " + m["nombre"] for m in masters[:100]])

    prompt = "Eres experto en homologacion de cargos en Colombia con experiencia en estructuras salariales y niveles jerarquicos.\n\n"
    prompt += "CARGO: " + nombre + "\n"
    prompt += "AREA: " + area + "\n"
    prompt += "INFO INTERNET: " + descripcion + "\n\n"
    prompt += "CATALOGO:\n" + catalogo + "\n\n"
    prompt += "REGLAS DE JERARQUIA (OBLIGATORIAS - NO VIOLAR):\n"
    prompt += "- AUXILIAR/ASISTENTE/APOYO -> NIVEL OPERATIVO (ej: Auxiliar Contable, Asistente Administrativo)\n"
    prompt += "- ANALISTA/ESPECIALISTA -> NIVEL PROFESIONAL (ej: Analista de Contabilidad)\n"
    prompt += "- COORDINADOR/JEFE -> NIVEL COORDINACION (ej: Coordinador de Ventas, Jefe de Taller)\n"
    prompt += "- GERENTE -> NIVEL GERENCIAL (ej: Gerente de Ventas)\n"
    prompt += "- DIRECTOR -> NIVEL DIRECTOR (ej: Director de Finanzas)\n"
    prompt += "- LIDER/PROGRAMADOR -> NIVEL PROFESIONAL/COORDINACION segun contexto\n"
    prompt += "- EVITAR SUBIR NIVEL: Un coordinador NO se homologa a gerente.\n\n"
    prompt += "INSTRUCCIONES:\n"
    prompt += "1. Identificar nivel del cargo original y buscar en catalogo opciones DEL MISMO NIVEL.\n"
    prompt += "2. RESPUESTA: JSON, SIN texto adicional.\n"
    prompt += '   Formato: {"cargo_homologado": "NOMBRE_CATALOGO", "justificacion": "nivel+area", "confianza": 0.85}\n'
    prompt += '3. Si NO existe cargo de nivel+area en catalogo -> "SIN COINCIDENCIA" con confianza 0.0\n'
    prompt += '4. Confianza >= 0.7 para asignar homologacion, sino "SIN COINCIDENCIA".\n'
    prompt += "5. COORDINADOR -> COORDINADOR (no Gerente). GERENTE -> GERENTE (no Director).\n"

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
    if content:
        parsed = extract_json(content)
        if parsed and isinstance(parsed, dict):
            ai_homologado = parsed.get("cargo_homologado", "SIN COINCIDENCIA")
            justificacion = parsed.get("justificacion", "Info de internet")
            
            if ai_homologado != "SIN COINCIDENCIA" and not _is_level_allowed(nombre, ai_homologado):
                print(f"[HOMOLOGACION] Internet: IA violo jerarquia {nombre} -> {ai_homologado}, corrigiendo...")
                ai_homologado = _find_homolog_by_level(nombre, area, masters)
                justificacion = "corregido_nivel"
            
            return {
                "cargo_homologado": ai_homologado,
                "justificacion": justificacion,
                "url_busqueda": info.get("url", "https://duckduckgo.com/?q=" + nombre.replace(" ", "+")),
            }

    return {
        "cargo_homologado": "SIN COINCIDENCIA",
        "justificacion": "Error en busqueda y homologacion",
        "url_busqueda": info.get("url", "https://duckduckgo.com/?q=" + nombre.replace(" ", "+")),
    }


def parse_quick_filters(observaciones):
    """Parse quick filter rules from observations text."""
    filters = {
        "produccion_a_operaciones": False,
        "jefe_coordinador_nivel_superior": False,
        "administrativo_no_tecnico": False,
        "buscar_sin_coincidencia_internet": False,
    }

    obs_upper = observaciones.upper()

    if "PRODUCCION" in obs_upper and "OPERACION" in obs_upper:
        filters["produccion_a_operaciones"] = True
    if "JEFE" in obs_upper or "COORDINADOR" in obs_upper:
        if "NIVEL" in obs_upper or "SUPERIOR" in obs_upper:
            filters["jefe_coordinador_nivel_superior"] = True
    if "ADMINISTRATIVO" in obs_upper and "TECNICO" in obs_upper:
        filters["administrativo_no_tecnico"] = True
    if "SIN COINCIDENCIA" in obs_upper and "INTERNET" in obs_upper:
        filters["buscar_sin_coincidencia_internet"] = True

    return filters


def apply_produccion_operaciones(nombre_cargo, masters):
    """Change PRODUCCION to OPERACIONES in cargo name before matching."""
    nombre_upper = nombre_cargo.upper()
    if "PRODUCCION" in nombre_upper:
        nuevo_nombre = nombre_upper.replace("PRODUCCION", "OPERACIONES")
        return nuevo_nombre
    return nombre_upper


def apply_jefe_coordinador_nivel_superior(nombre_cargo, masters):
    """Map JEFE/COORDINADOR to higher level positions."""
    nombre_upper = nombre_cargo.upper()
    if "JEFE" in nombre_upper or "COORDINADOR" in nombre_upper:
        for m in masters:
            m_nombre = m["nombre"].upper()
            if "GERENTE" in m_nombre and any(word in nombre_upper for word in ["JEFE", "COORDINADOR"]):
                return m["nombre"]
    return None


def apply_administrativo_no_tecnico(nombre_cargo, cargo_homologado):
    """Ensure ADMINISTRATIVO is not matched with TECNICO."""
    nombre_upper = nombre_cargo.upper()
    homologado_upper = cargo_homologado.upper() if cargo_homologado else ""

    if "ADMINISTRATIV" in nombre_upper and "TECNIC" in homologado_upper:
        return False
    return True


def homologar_con_ia_observaciones(db, cargos_batch, masters, observaciones, selected_ids=None):
    """Homologa cargos usando IA con observaciones del analista.

    Args:
        selected_ids: Lista de IDs de cargos seleccionados con checkbox.
                      Si es None, procesa todos.
    """
    if not OPENAI_API_KEY:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos_batch]

    # Filtrar por IDs seleccionados si se proporcionan
    if selected_ids is not None:
        cargos_batch = [c for c in cargos_batch if c.get("id") in selected_ids]
        if not cargos_batch:
            return []

    print("[HOMOLOGACION] Reprocesando " + str(len(cargos_batch)) + " cargos con observaciones")

    # Parse quick filters
    filters = parse_quick_filters(observaciones)
    print("[HOMOLOGACION] Filtros activos: " + str(filters))

    resultados = []
    for cargo in cargos_batch:
        nombre = cargo.get("nombre_cargo", "")
        area = cargo.get("area", "")
        descripcion = cargo.get("descripcion_empresa", "")
        homologado_actual = cargo.get("cargo_homologado_actual", "")

        # Apply quick filters to nombre_cargo
        nombre_modificado = nombre
        if filters["produccion_a_operaciones"]:
            nombre_modificado = apply_produccion_operaciones(nombre, masters)
            if nombre_modificado != nombre.upper():
                print("[FILTRO] PRODUCCION->OPERACIONES: " + nombre + " -> " + nombre_modificado)

        # Check JEFE/COORDINADOR nivel superior
        sugerencia_nivel_superior = None
        if filters["jefe_coordinador_nivel_superior"]:
            sugerencia_nivel_superior = apply_jefe_coordinador_nivel_superior(nombre, masters)

        catalogo = "\n".join(["- " + m["nombre"] for m in masters[:50]])

        prompt = "Eres experto en homologacion de cargos en Colombia con experiencia en estructuras salariales y niveles jerarquicos.\n\n"
        prompt += "CARGO A HOMOLOGAR: " + nombre_modificado + "\n"
        prompt += "AREA: " + area + "\n"
        prompt += "DESCRIPCION: " + descripcion + "\n"
        prompt += "HOMOLOGADO ACTUAL: " + homologado_actual + "\n\n"

        if filters["produccion_a_operaciones"]:
            prompt += "FILTRO: Trata 'PRODUCCION' como 'OPERACIONES'.\n"
        if filters["jefe_coordinador_nivel_superior"] and sugerencia_nivel_superior:
            prompt += "FILTRO: 'JEFE/COORDINADOR' a nivel superior. Sugerencia: " + sugerencia_nivel_superior + "\n"
        if filters["administrativo_no_tecnico"]:
            prompt += "FILTRO: ADMINISTRATIVO != TECNICO.\n"
        if filters["buscar_sin_coincidencia_internet"]:
            prompt += "FILTRO: 'SIN COINCIDENCIA' -> buscar en internet.\n"

        prompt += "\nREGLAS DE JERARQUIA (OBLIGATORIAS - NO VIOLAR):\n"
        prompt += "1. CONSERVAR NIVEL: Cada cargo -> mismo nivel en catalogo.\n"
        prompt += "   - AUXILIAR/ASISTENTE/APOYO -> nivel operativo\n"
        prompt += "   - ANALISTA/ESPECIALISTA -> nivel profesional\n"
        prompt += "   - COORDINADOR/JEFE -> nivel coordinacion/jefatura (NO a Gerente)\n"
        prompt += "   - GERENTE -> nivel gerencial (NO a Director/VP)\n"
        prompt += "   - DIRECTOR -> nivel director (NO a VP)\n"
        prompt += "2. AREA: Homologar a cargo CON area similar.\n"
        prompt += "3. EVITAR DUPLICADOS: No asignar mismo homologado a distintos originales.\n"
        prompt += "4. CONFIAZA >= 0.7 para asignar, sino 'SIN COINCIDENCIA'.\n\n"

        prompt += "OBSERVACIONES DEL ANALISTA: " + observaciones + "\n\n"
        prompt += "CATALOGO (primeros 50):\n" + catalogo + "\n\n"
        prompt += "INSTRUCCIONES:\n"
        prompt += "1. Identificar nivel del cargo original.\n"
        prompt += "2. Buscar en catalogo SOLO opciones del MISMO nivel.\n"
        prompt += "3. RESPUESTA: JSON sin texto adicional.\n"
        prompt += '   Formato: {"cargo_homologado": "NOMBRE", "justificacion": "nivel+area", "confianza": 0.85}\n'
        prompt += '4. Si NO existe nivel+area -> "SIN COINCIDENCIA" confianza 0.0\n'
        prompt += "5. COORDINADOR -> COORDINADOR (NO Gerente). GERENTE -> GERENTE (NO Director).\n"

        content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
        if content:
            parsed = extract_json(content)
            if parsed and isinstance(parsed, dict):
                ai_homologado = parsed.get("cargo_homologado", "SIN COINCIDENCIA")
                justificacion = str(parsed.get("justificacion", ""))[:60]
                confianza = float(parsed.get("confianza", 0.5))

                if filters["administrativo_no_tecnico"]:
                    if not apply_administrativo_no_tecnico(nombre, ai_homologado):
                        ai_homologado = "SIN COINCIDENCIA"
                        justificacion = "Filtro: Administrativo != Tecnico"
                        confianza = 0.0

                if ai_homologado != "SIN COINCIDENCIA" and not _is_level_allowed(nombre, ai_homologado):
                    print(f"[HOMOLOGACION] IA violo jerarquia obs: {nombre} -> {ai_homologado}, corrigiendo...")
                    ai_homologado = _find_homolog_by_level(nombre, area, masters)
                    confianza = 0.6
                    justificacion = "corregido_nivel"

                resultados.append({
                    "id": cargo.get("id"),
                    "cargo_homologado": ai_homologado,
                    "justificacion": justificacion,
                    "confianza": confianza,
                })
                continue

        resultados.append({"id": cargo.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "confianza": 0.0})

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print("[HOMOLOGACION] Reproceso: " + str(exitos) + "/" + str(len(cargos_batch)) + " exitos")
    return resultados
