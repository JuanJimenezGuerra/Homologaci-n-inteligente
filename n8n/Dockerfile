FROM n8nio/n8n:latest

# Configurar zona horaria y optimización de memoria sin instalar paquetes del SO
ENV TZ=America/Bogota
ENV NODE_OPTIONS="--max-old-space-size=400"

CMD ["n8n", "start"]
