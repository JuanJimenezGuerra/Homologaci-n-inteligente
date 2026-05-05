import os
import json
import time
import requests
import re

# Modelos gratuitos: openrouter/free como principal, MiniMax como respaldo
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY2", "")
OPENROUTER_MODELS = ["openrouter/free", "minimax/minimax-m2.5:free"]
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
URL = "https://openrouter.ai/api/v1/chat/completions"

print("=== ENV VARS DEBUG ===")
key2 = os.getenv("OPENROUTER_API_KEY2")
print("OPENROUTER_API_KEY2: " + ("OK" if key2 else "NO CONFIGURADA"))
print("OPENROUTER_API_KEY (lo que lee): " + ("OK" if OPENROUTER_API_KEY else "VACIA"))
print("OPENROUTER_MODEL: " + OPENROUTER_MODEL)
api_vars = [k for k in os.environ.keys() if "API" in k or "KEY" in k]
print("Todas las vars: " + str(api_vars))


def call_ia(messages, max_tokens=300, timeout=30):
    """Llama a OpenRouter usando openrouter/free y MiniMax como respaldo."""
    if not OPENROUTER_API_KEY:
        print("[IA] ERROR: No hay OPENROUTER_API_KEY")
        return ""

    # Agregar mensaje de sistema para forzar respuesta corta
    if messages and messages[0].get("role") == "user":
        system_msg = {
            "role": "system",
            "content": "Eres un asistente que responde UNICAMENTE con JSON valido, sin texto adicional. Respuestas cortas y precisas. No expliques nada."
        }
        messages = [system_msg] + messages

    for model in OPENROUTER_MODELS:
        for intento in range(3):
            try:
                print("[IA] Llamando " + model + " (intento " + str(intento + 1) + ")...")
                resp = requests.post(
                    URL,
                    headers={
                        "Authorization": "Bearer " + OPENROUTER_API_KEY,
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.0
                    },
                    timeout=timeout
                )
                if resp.ok:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    if content:
                        print("[IA] Respuesta recibida: " + str(len(content)) + " caracteres")
                        return content
                    else:
                        print("[IA] Respuesta vacia")
                elif resp.status_code == 429:
                    wait = 2 ** intento
                    print("[IA] Rate limit en " + model + ", esperando " + str(wait) + "s")
                    time.sleep(wait)
                    continue
                else:
                    print("[IA] HTTP " + str(resp.status_code) + ": " + resp.text[:150])
                    break
            except Exception as e:
                print("[IA] Error: " + str(e))
                if intento < 2:
                    time.sleep(2)

    print("[IA] Todos los modelos fallaron")
    return ""


def _limpiar_json(text):
    """Limpia el texto JSON antes del parseo."""
    # Remover marcadores markdown si existen
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    # Remover texto antes del primer { o [ y despues del ultimo } o ]
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        end = text.rfind(end_char) + 1
        if start != -1 and end > start:
            text = text[start:end]
            break
    return text.strip()


def extract_json(text):
    """Extrae JSON de la respuesta."""
    if not text:
        return None
    try:
        # Limpiar texto
        text = _limpiar_json(text)
        # Intentar parseo directo
        return json.loads(text)
    except:
        # Si falla, buscar objeto JSON en el texto
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                candidate = text[start:end]
                return json.loads(candidate)
        except:
            pass
    return None


def extract_json_array(text):
    """Extrae array JSON de la respuesta de la IA."""
    if not text:
        return None
    try:
        text = text.strip()

        # Intentar parseo directo primero
        try:
            result = json.loads(text)
            if isinstance(result, list):
                return result
        except:
            pass

        # Buscar array JSON con estrategia mejorada
        start = text.find("[")
        end = text.rfind("]") + 1
        if start == -1 or end <= start:
            print("[IA] No se encontro array JSON. Texto: " + text[:500])
            return None

        candidate = text[start:end]
        # Limpiar caracteres problematicos antes del parseo
        candidate = _limpiar_json(candidate)

        print("[IA] Intentando parsear JSON array: " + candidate[:500] + "...")
        result = json.loads(candidate)
        if isinstance(result, list):
            return result
        else:
            print("[IA] El parseo no dio una lista: " + str(type(result)))
    except Exception as e:
        print("[IA] Error parseando JSON array: " + str(e) + " | Texto original: " + text[:500])
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
    if not OPENROUTER_API_KEY:
        return [{"id": c.get("id"), "cargo_homologado": "SIN COINCIDENCIA", "justificacion": "Sin API key", "confianza": 0.0} for c in cargos]

    if masters is None:
        masters = load_master_cargos(db)

    print("[HOMOLOGACION] Procesando " + str(len(cargos)) + " cargos")

    resultados = []
    for i in range(0, len(cargos), 8):
        batch = cargos[i:i+8]
        catalogo = "\n".join(["- " + m["nombre"] for m in masters[:80]])
        cargos_txt = "\n".join(["ID:" + str(c.get("id")) + " | " + str(c.get("nombre_cargo", "")).upper() for c in batch])

        prompt = "Eres experto en homologacion de cargos en Colombia.\n\n"
        prompt += "CATALOGO:\n" + catalogo + "\n\n"
        prompt += "CARGOS:\n" + cargos_txt + "\n\n"
        prompt += "INSTRUCCIONES ESTRICTAS:\n"
        prompt += "1. Para cada ID, busca el cargo mas similar en el catalogo.\n"
        prompt += "2. RESPONDE UNICAMENTE CON EL ARRAY JSON, SIN TEXTO ADICIONAL.\n"
        prompt += '3. Formato exacto: [{"id": 1, "cargo_homologado": "NOMBRE", "justificacion": "razon", "confianza": 0.5}]\n'
        prompt += '4. Si no hay coincidencia, usa "SIN COINCIDENCIA" como cargo_homologado.\n'
        prompt += "5. NO incluyas explicaciones, solo el JSON.\n"
        prompt += "6. NO uses markdown ni comillas especiales."

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
    if not OPENROUTER_API_KEY:
        return {"error": "Sin API key"}

    prompt = "Asigna niveles SHR/HAY para el cargo: " + str(cargo.get("nombre_cargo", "N/A")) + "\n\n"
    prompt += "INSTRUCCIONES ESTRICTAS:\n"
    prompt += "1. Responde UNICAMENTE con el objeto JSON, sin texto adicional.\n"
    prompt += "2. No uses markdown ni explicaciones.\n"
    prompt += '3. Formato exacto: {"conocimientos":"A-H","experiencia":"--/-/o/+","habilidades":"I-VII","responsabilidad":"1-4","contacto":"A-C","frecuencia":"1-4","contraste":"I-V","complejidad":"1-5","iniciativa":"I-IV","autonomia":"A-G","magnitud":"0-14","impacto":"I-VII","justificacion":"breve"}'

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
    if not content:
        return {"error": "Sin respuesta IA"}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
    return {"error": "Error parseo"}


def buscar_en_internet(cargo):
    if not OPENROUTER_API_KEY:
        return {"fuente": "Sin API key", "titulo": cargo.get("nombre_cargo", ""), "descripcion": "", "url": ""}

    nombre = cargo.get("nombre_cargo", "")
    prompt = 'Dame info del cargo "' + nombre + '" en Colombia.\n\n'
    prompt += "INSTRUCCIONES ESTRICTAS:\n"
    prompt += "1. Responde UNICAMENTE con el objeto JSON, sin texto adicional.\n"
    prompt += "2. No uses markdown ni explicaciones.\n"
    prompt += '3. Formato exacto: {"fuente":"Internet","titulo":"Cargo","descripcion":"Breve","url":"https://ejemplo.com"}'

    content = call_ia([{"role": "user", "content": prompt}], max_tokens=300)
    if not content:
        return {"fuente": "Error", "titulo": nombre, "descripcion": "Error IA", "url": ""}
    parsed = extract_json(content)
    if parsed and isinstance(parsed, dict):
        return parsed
    return {"fuente": "Error", "titulo": nombre, "descripcion": "Error parseo", "url": ""}
