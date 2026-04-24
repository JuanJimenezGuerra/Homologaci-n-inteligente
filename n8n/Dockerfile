FROM n8nio/n8n:latest

USER root
# Instalar zona horaria y herramientas básicas
RUN apk add --no-cache tzdata
ENV TZ=America/Bogota

# Optimización para Render Free Tier (512MB)
# Limitamos la memoria de Node.js para que no lo maten
ENV NODE_OPTIONS="--max-old-space-size=400"

USER node

# n8n por defecto usa el puerto de la variable $PORT que Render asigna
# Pero forzamos que lea N8N_PORT como $PORT si está disponible
CMD ["n8n", "start"]
