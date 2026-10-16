"""
Carga inicial do banco, executada pelo servico "importador" do docker-compose.

Roda os dois scripts de importacao, mas so importa uma tabela se ela ainda
estiver vazia: assim um novo "docker compose up" nao duplica os registros.
Se o CSV de algum dataset nao existir, aquela importacao e pulada.
"""

import os

import psycopg2

import importar_aposentados
import importar_dados

CARGAS = [
    ("aposentados", importar_aposentados.APOSENTADOS_CSV, importar_aposentados.carregar_aposentados),
    ("servidores_ativos", importar_dados.CARREIRA_CSV, importar_dados.carregar_ativos),
]


def tabela_vazia(conn, tabela: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(f"SELECT NOT EXISTS (SELECT 1 FROM {tabela})")
        return cur.fetchone()[0]


def main():
    conn = psycopg2.connect(**importar_aposentados.DB_CONFIG)
    try:
        for tabela, arquivo, carregar in CARGAS:
            if not os.path.exists(arquivo):
                print(f"[{tabela}] {arquivo} nao encontrado, importacao pulada.")
            elif not tabela_vazia(conn, tabela):
                print(f"[{tabela}] ja possui dados, importacao pulada.")
            else:
                carregar(conn)
    finally:
        conn.close()
    print("Carga inicial concluida.")


if __name__ == "__main__":
    main()
