import requests
import json

response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": "Bearer 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",
        "Content-Type": "application/json"
    },
    json={
        "model": "openrouter/free",
        "messages": [{"role": "user", "content": "Hola"}]
    }
)
print(response.status_code)
print(response.text)
