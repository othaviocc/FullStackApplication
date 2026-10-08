import os
import psycopg2
from psycopg2 import pool
from dotenv import load_dotenv

# Carrega variáveis de ambiente de um arquivo .env 
load_dotenv()

# Ajuste com os dados do seu PostgreSQL
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "postgres") 
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")
DB_PORT = os.getenv("DB_PORT", "5432")

try:
    db_pool = psycopg2.pool.SimpleConnectionPool(
        1, 20,
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT
    )
except Exception as e:
    print("Erro ao conectar ao banco de dados:", e)
    db_pool = None

def get_db_connection():
    if db_pool:
        return db_pool.getconn()
    return None

def release_db_connection(conn):
    if db_pool and conn:
        db_pool.putconn(conn)