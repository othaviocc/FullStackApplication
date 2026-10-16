# Imagem do servico "importador": popula o banco com os CSVs do db/ e encerra.
# O contexto do build e a raiz do projeto (ver docker-compose.yml).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY limpeza_dados/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY limpeza_dados/*.py ./
COPY db/*.csv /dados/

CMD ["python", "carga_inicial.py"]
