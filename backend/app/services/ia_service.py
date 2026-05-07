import os
import json
import time
import re

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

print("=== ENV VARS DEBUG ===")
print("OPENAI_API_KEY: " + ("OK" if OPENAI_API_KEY else "NO CONFIGURADA"))
print("OPENAI_MODEL: " + OPENAI_MODEL)
api_vars = [k for k in os.environ.keys() if "API" in k or "KEY" in k]
print("Todas las vars: " + str(api_vars))


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

        prompt = "Eres experto en homologacion de cargos en Colombia. Analiza SIMILITUD SEMANTICA.\n\n"
        prompt += "CATALOGO MAESTRO (" + str(len(masters[:150])) + " cargos):\n" + catalogo + "\n\n"
        prompt += "CARGOS A HOMOLOGAR:\n" + cargos_txt + "\n\n"
        prompt += "INSTRUCCIONES PRIORITARIAS:\n"
        prompt += "1. Busca el cargo mas SIMILAR semanticamente en el catalogo, no solo coincidencia exacta.\n"
        prompt += "2. Ejemplos: 'Auxiliar' = 'Asistente', 'Coord' = 'Coordinador', 'Jefe' = 'Gerente'.\n"
        prompt += "3. RESPONDE UNICAMENTE CON EL ARRAY JSON, SIN TEXTO ADICIONAL.\n"
        prompt += '4. Formato: [{"id": 1, "cargo_homologado": "NOMBRE_EXACTO_CATALOGO", "justificacion": "similitud", "confianza": 0.8}]\n'
        prompt += '5. Si no hay similitud usa "SIN COINCIDENCIA". Confianza: 0.0-1.0.\n'
        prompt += "6. NO expliques, SOLO JSON.\n"
        prompt += "7. CADA PAR CLAVE-VALOR SEPARADO POR COMAS.\n"

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
            for r in parsed:
                resultados.append({
                    "id": r.get("id"),
                    "cargo_homologado": r.get("cargo_homologado", "SIN COINCIDENCIA"),
                    "justificacion": str(r.get("justificacion", ""))[:60],
                    "confianza": float(r.get("confianza", 0.5)),
                })
        else:
            resultados.extend([{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error parseo", "confianza": 0.0} for c in batch])

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print("[HOMOLOGACION] " + str(exitos) + "/" + str(len(cargos)) + " exitos")
    return resultados


def valorar_con_ia(cargo):
    if not OPENAI_API_KEY:
        return {"error": "Sin API key"}

    prompt = "Asigna niveles SHR/HAY para el cargo: " + str(cargo.get("nombre_cargo", "N/A")) + "\n\n"
    prompt += "INSTRUCCIONES ESTRICTAS:\n"
    prompt += "1. Responde UNICAMENTE con el objeto JSON, sin texto adicional.\n"
    prompt += "2. No uses markdown ni explicaciones.\n"
    prompt += '3. Formato exacto: {"conocimientos":"A-H","experiencia":"--/-/o/+","habilidad":"I-VII","responsabilidad":"1-4","contacto":"A-C","frecuencia":"1-4","contraste":"I-V","complejidad":"1-5","iniciativa":"I-IV","autonomia":"A-G","magnitud":"0-14","impacto":"I-VII","justificacion":"breve"}'

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
    if not content:
        return {"error": "Sin respuesta IA"}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
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
    descripcion = info.get("descripcion", "")

    prompt = "Eres experto en homologacion de cargos en Colombia.\n\n"
    prompt += "CARGO A HOMOLOGAR: " + nombre + "\n"
    prompt += "INFO ENCONTRADA: " + descripcion + "\n\n"
    prompt += "CATALOGO (primeros 50):\n"
    prompt += "\n".join(["- " + m["nombre"] for m in masters[:50]]) + "\n\n"
    prompt += "INSTRUCCIONES:\n"
    prompt += "1. Busca el cargo mas similar en el catalogo.\n"
    prompt += '2. Responde UNICAMENTE con JSON: {"cargo_homologado": "NOMBRE", "justificacion": "razon", "confianza": 0.5}\n'
    prompt += '3. Si no hay coincidencia usa "SIN COINCIDENCIA".'

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
    if content:
        parsed = extract_json(content)
        if parsed and isinstance(parsed, dict):
            resultado = {
                "cargo_homologado": parsed.get("cargo_homologado", "SIN COINCIDENCIA"),
                "justificacion": parsed.get("justificacion", "Info de internet"),
                "url_busqueda": info.get("url", "https://duckduckgo.com/?q=" + nombre.replace(" ", "+")),
            }
            return resultado

    return {
        "cargo_homologado": "SIN COINCIDENCIA",
        "justificacion": "Error en busqueda y homologacion",
        "url_busqueda": info.get("url", "https://duckduckgo.com/?q=" + nombre.replace(" ", "+")),
    }


def homologar_con_ia_observaciones(db, cargos_batch, masters, observaciones):
    """Homologa cargos usando IA con observaciones del analista."""
    if not OPENAI_API_KEY:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos_batch]

    print("[HOMOLOGACION] Reprocesando " + str(len(cargos_batch)) + " cargos con observaciones")

    resultados = []
    for cargo in cargos_batch:
        nombre = cargo.get("nombre_cargo", "")
        area = cargo.get("area", "")
        descripcion = cargo.get("descripcion_empresa", "")
        homologado_actual = cargo.get("cargo_homologado_actual", "")

        catalogo = "\n".join(["- " + m["nombre"] for m in masters[:50]])

        prompt = "Eres experto en homologacion de cargos en Colombia.\n\n"
        prompt += "CARGO A HOMOLOGAR: " + nombre + "\n"
        prompt += "AREA: " + area + "\n"
        prompt += "DESCRIPCION: " + descripcion + "\n"
        prompt += "HOMOLOGADO ACTUAL: " + homologado_actual + "\n\n"
        prompt += "OBSERVACIONES DEL ANALISTA: " + observaciones + "\n\n"
        prompt += "CATALOGO (primeros 50):\n" + catalogo + "\n\n"
        prompt += "INSTRUCCIONES:\n"
        prompt += "1. Usa las observaciones del analista para mejorar la homologacion.\n"
        prompt += '2. Responde UNICAMENTE con JSON: {"cargo_homologado": "NOMBRE", "justificacion": "razon", "confianza": 0.5}\n'
        prompt += '3. Si no hay coincidencia usa "SIN COINCIDENCIA".'

        content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
        if content:
            parsed = extract_json(content)
            if parsed and isinstance(parsed, dict):
                resultados.append({
                    "id": cargo.get("id"),
                    "cargo_homologado": parsed.get("cargo_homologado", "SIN COINCIDENCIA"),
                    "justificacion": str(parsed.get("justificacion", ""))[:60],
                    "confianza": float(parsed.get("confianza", 0.5)),
                })
                continue

        resultados.append({"id": cargo.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Error IA", "confianza": 0.0})

    exitos = sum(1 for r in resultados if r["cargo_homologado"] != "SIN COINCIDENCIA")
    print("[HOMOLOGACION] Reproceso: " + str(exitos) + "/" + str(len(cargos_batch)) + " exitos")
    return resultados
