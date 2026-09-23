import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import abort

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=os.environ.get('DB_HOST', 'db-server'),
            port=os.environ.get('DB_PORT', '5432'),
            dbname=os.environ.get('DB_NAME', 'servidores_db'),
            user=os.environ.get('DB_USER', 'admin_executivo'),
            password=os.environ.get('DB_PASS', 'senha_segura'),
            connect_timeout=10 # Tratamento de tempo de busca excedendo o timeout
        )
        return conn
    except psycopg2.OperationalError as e:
        abort(503, description="Tempo de conexão excedido ou falha no banco de dados.")