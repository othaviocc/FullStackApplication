"""
Importa o CSV de carreiras/ativos para a tabela `servidores_ativos` no PostgreSQL.

Uso:
    python importar_dados.py

Variáveis de ambiente (opcionais, têm valor padrão):
    DB_HOST (default: localhost)
    DB_PORT (default: 5432)
    DB_NAME (default: servidores_db)
    DB_USER (default: postgres)
    DB_PASSWORD (default: estudo123)
    CARREIRA_CSV (default: CARREIRA-012017.csv)

Requisitos: pandas, psycopg2-binary  (ver requirements.txt)
"""

import os

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# --------------------------------------------------------------
# Configuração — ajuste aqui se seu usuário/senha forem diferentes
# --------------------------------------------------------------
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "servidores_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "estudo123"),
}

CARREIRA_CSV = os.getenv("CARREIRA_CSV", "CARREIRA-012017.csv")

# Coloque um número pequeno (ex: 100) pra testar rápido primeiro.
# Deixe None pra importar o arquivo inteiro.
LIMITE_LINHAS_TESTE = 100

CHUNKSIZE = 50_000  # o arquivo tem ~180MB, lemos em pedaços pra não estourar memória

# Nomes das colunas no CSV (header original) -> nomes das colunas na tabela
RENAME_MAP = {
    "Nome": "nome",
    "CPF": "cpf",
    "Código da carreira": "codigo_carreira",
    "Descrição do cargo emprego": "descricao_cargo",
    "UF da UPAG de vinculação": "uf",
    "Denominação do órgão de atuação": "orgao_atuacao",
    "Mês de referência": "mes_referencia",
    "Valor da remuneração": "valor_remuneracao",
}

COLUNAS_TABELA = [
    "nome", "cpf", "codigo_carreira", "descricao_cargo",
    "uf", "orgao_atuacao", "mes_referencia", "valor_remuneracao",
]

COLUNAS_TEXTO = ["nome", "cpf", "codigo_carreira", "descricao_cargo", "uf",
                 "orgao_atuacao", "mes_referencia"]


# --------------------------------------------------------------
# Helpers de limpeza (mesma lógica que você já testou na mão no psql)
# --------------------------------------------------------------
def strip_str(series: pd.Series) -> pd.Series:
    """Remove espaços sobrando e transforma vazio/'nan' em None (NULL no banco)."""
    return series.astype(str).str.strip().replace({"": None, "nan": None})


def parse_valor_brl(series: pd.Series):
    """Converte '9.996,79' -> 9996.79 (float). Mesma correção que você fez na mão."""
    def _parse(v):
        v = str(v).strip()
        if not v or v.lower() == "nan":
            return None
        v = v.replace(".", "").replace(",", ".")
        try:
            return float(v)
        except ValueError:
            return None
    return series.map(_parse)


# --------------------------------------------------------------
# Carga
# --------------------------------------------------------------
def carregar_ativos(conn):
    print(f"Lendo {CARREIRA_CSV} em chunks de {CHUNKSIZE} linhas...")
    total = 0

    reader = pd.read_csv(
        CARREIRA_CSV,
        sep=";",
        encoding="latin1",   # o mesmo "28591 / ISO" que você usou no Power BI
        dtype=str,
        chunksize=CHUNKSIZE,
    )

    with conn.cursor() as cur:
        for chunk in reader:
            chunk = chunk.rename(columns=RENAME_MAP)

            for col in COLUNAS_TEXTO:
                if col in chunk.columns:
                    chunk[col] = strip_str(chunk[col])

            chunk["valor_remuneracao"] = parse_valor_brl(chunk["valor_remuneracao"])

            # Corta pra teste, se configurado
            if LIMITE_LINHAS_TESTE is not None:
                restante = LIMITE_LINHAS_TESTE - total
                if restante <= 0:
                    break
                chunk = chunk.head(restante)

            rows = list(chunk[COLUNAS_TABELA].itertuples(index=False, name=None))
            if not rows:
                continue

            execute_values(
                cur,
                f"INSERT INTO servidores_ativos ({', '.join(COLUNAS_TABELA)}) VALUES %s",
                rows,
                page_size=1000,
            )
            conn.commit()
            total += len(rows)
            print(f"  -> {total} registros inseridos até agora...")

            if LIMITE_LINHAS_TESTE is not None and total >= LIMITE_LINHAS_TESTE:
                break

    print(f"Total final: {total} registros em 'servidores_ativos'.")


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        carregar_ativos(conn)
    finally:
        conn.close()
    print("Importação concluída.")


if __name__ == "__main__":
    main()
