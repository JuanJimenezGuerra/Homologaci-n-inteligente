FROM n8nio/n8n:latest

USER root
RUN apk add --no-cache tzdata
ENV TZ=America/Bogota

USER node
EXPOSE 5678

CMD ["n8n", "start"]
