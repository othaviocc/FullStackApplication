"""
Importa o CSV de aposentados para a tabela `aposentados` no PostgreSQL.

Uso:
    python importar_aposentados.py

Variáveis de ambiente (mesmas do importar_dados.py):
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, APOSENTADOS_CSV
"""

import csv
import os
from datetime import datetime

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "dbname": os.getenv("DB_NAME", "servidores_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "estudo123"),
}

APOSENTADOS_CSV = os.getenv("APOSENTADOS_CSV", "../db/APOSENTADOS_082026.csv")
LIMITE_LINHAS_TESTE = None  # None = importa tudo
CHUNKSIZE = 50_000

# Ordem real das 18 colunas do arquivo (sem header no CSV original)
COLUNAS_TABELA = [
    "nome", "cpf", "matricula", "orgao", "orgao_sigla", "cod_uorg", "cargo",
    "regime_juridico", "classe", "padrao", "nivel", "tipo_aposentadoria",
    "fundamentacao_legal", "observacao", "data_aposentadoria",
    "motivo_admissao", "data_ingresso", "valor_remuneracao",
]

COLUNAS_TEXTO = [
    "nome", "cpf", "matricula", "orgao", "orgao_sigla", "cod_uorg", "cargo",
    "regime_juridico", "classe", "padrao", "nivel", "tipo_aposentadoria",
    "fundamentacao_legal", "observacao", "motivo_admissao",
]

LIMITE_TAMANHO = {
    "nome": 255, "cpf": 11, "matricula": 20, "orgao": 255, "orgao_sigla": 20,
    "cod_uorg": 20, "cargo": 255, "regime_juridico": 5, "classe": 10,
    "padrao": 10, "nivel": 10, "tipo_aposentadoria": 100,
    "fundamentacao_legal": 255, "observacao": 255, "motivo_admissao": 255,
}


def strip_str(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().replace({"": None, "nan": None})


def parse_data_ddmmyyyy(series: pd.Series):
    def _parse(v):
        v = str(v).strip()
        if not v or v.lower() == "nan" or len(v) != 8 or not v.isdigit():
            return None
        try:
            return datetime.strptime(v, "%d%m%Y").date()
        except ValueError:
            return None
    return series.map(_parse)


def parse_valor_brl(series: pd.Series):
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


def carregar_aposentados(conn):
    print(f"Lendo {APOSENTADOS_CSV} em chunks de {CHUNKSIZE} linhas...")
    total = 0
    total_descartadas = [0]
    total_campo_invalido = [{}]
    total_linhas_lixo = [0]

    reader = pd.read_csv(
        APOSENTADOS_CSV,
        sep=";",
        encoding="latin1",
        header=None,  # arquivo não tem cabeçalho
        dtype=str,
        chunksize=CHUNKSIZE,
        quoting=csv.QUOTE_NONE,
    )

    with conn.cursor() as cur:
        for chunk in reader:
            n = min(len(chunk.columns), len(COLUNAS_TABELA))
            chunk.columns = COLUNAS_TABELA[:n] + list(chunk.columns[n:])
            # descarta colunas extras além das 18 esperadas, se houver
            chunk = chunk[[c for c in COLUNAS_TABELA if c in chunk.columns]]

            for col in COLUNAS_TEXTO:
                if col in chunk.columns:
                    chunk[col] = strip_str(chunk[col])

            chunk["data_aposentadoria"] = parse_data_ddmmyyyy(chunk["data_aposentadoria"])
            chunk["data_ingresso"] = parse_data_ddmmyyyy(chunk["data_ingresso"])
            chunk["valor_remuneracao"] = parse_valor_brl(chunk["valor_remuneracao"])

            antes = len(chunk)
            chunk = chunk[chunk["nome"].notna()]
            descartadas = antes - len(chunk)
            if descartadas > 0:
                total_descartadas[0] += descartadas

            for col, tamanho_max in LIMITE_TAMANHO.items():
                if col not in chunk.columns:
                    continue
                invalido = chunk[col].notna() & (chunk[col].str.len() > tamanho_max)
                qtd = int(invalido.sum())
                if qtd > 0:
                    total_campo_invalido[0][col] = total_campo_invalido[0].get(col, 0) + qtd
                    chunk.loc[invalido, col] = None

            if LIMITE_LINHAS_TESTE is not None:
                restante = LIMITE_LINHAS_TESTE - total
                if restante <= 0:
                    break
                chunk = chunk.head(restante)

            rows = list(chunk[COLUNAS_TABELA].itertuples(index=False, name=None))
            if not rows:
                continue

            try:
                execute_values(
                    cur,
                    f"INSERT INTO aposentados ({', '.join(COLUNAS_TABELA)}) VALUES %s",
                    rows,
                    page_size=1000,
                )
                conn.commit()
            except psycopg2.errors.StringDataRightTruncation:
                conn.rollback()
                linhas_ok = []
                for row in rows:
                    try:
                        with conn.cursor() as cur_teste:
                            execute_values(
                                cur_teste,
                                f"INSERT INTO aposentados ({', '.join(COLUNAS_TABELA)}) VALUES %s",
                                [row],
                            )
                        conn.commit()
                        linhas_ok.append(row)
                    except psycopg2.errors.StringDataRightTruncation:
                        conn.rollback()
                        total_linhas_lixo[0] += 1
                        print(f"AVISO: linha descartada (dado inválido/lixo): {row}")
                rows = linhas_ok

            total += len(rows)
            print(f"  -> {total} registros inseridos até agora...")

            if LIMITE_LINHAS_TESTE is not None and total >= LIMITE_LINHAS_TESTE:
                break

    print(f"Total final: {total} registros em 'aposentados'.")
    if total_descartadas[0] > 0:
        print(f"Atenção: {total_descartadas[0]} linha(s) descartada(s) por nome ausente.")
    for col, qtd in total_campo_invalido[0].items():
        print(f"Atenção: {qtd} valor(es) da coluna '{col}' excederam o tamanho e viraram NULL.")
    if total_linhas_lixo[0] > 0:
        print(f"Atenção: {total_linhas_lixo[0]} linha(s) totalmente descartada(s) por dado inválido/lixo.")


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        carregar_aposentados(conn)
    finally:
        conn.close()
    print("Importação concluída.")


if __name__ == "__main__":
    main()