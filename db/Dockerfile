FROM postgres:16-alpine

# Variáveis podem ser sobrescritas pelo docker-compose.yml
ENV POSTGRES_DB=servidores_db
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=changeme
ENV LANG=pt_BR.UTF-8

# Scripts em /docker-entrypoint-initdb.d/ rodam automaticamente
# UMA VEZ, na primeira inicialização do volume de dados (container "vazio").
# Se você já criou o volume antes, apague-o (docker compose down -v)
# para o schema ser recriado.
COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 5432
