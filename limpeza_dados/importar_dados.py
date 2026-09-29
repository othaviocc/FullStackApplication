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

import csv
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

CARREIRA_CSV = os.getenv("CARREIRA_CSV", "../db/CARREIRA-012017.csv")

# Coloque um número pequeno (ex: 100) pra testar rápido primeiro.
# Deixe None pra importar o arquivo inteiro.
LIMITE_LINHAS_TESTE = None

CHUNKSIZE = 50_000  # o arquivo tem ~180MB, lemos em pedaços pra não estourar memória

# Os nomes de coluna do header vêm corrompidos no arquivo (acentos perdidos
# permanentemente nos bytes, não é problema de encoding de leitura). Por isso,
# em vez de renomear por NOME (que não bate), renomeamos por POSIÇÃO, já que
# a ordem das colunas é conhecida e estável:
# Nome;CPF;Código da carreira;Descrição do cargo emprego;UF da UPAG de
# vinculação;Denominação do órgão de atuação;Mês de referência;
# Valor da remuneração;(coluna vazia sobrando do ; final do header)
NOMES_POR_POSICAO = [
    "nome", "cpf", "codigo_carreira", "descricao_cargo",
    "uf", "orgao_atuacao", "mes_referencia", "valor_remuneracao",
    "_extra",  # coluna fantasma criada pelo ; sobrando no fim do header
]

COLUNAS_TABELA = [
    "nome", "cpf", "codigo_carreira", "descricao_cargo",
    "uf", "orgao_atuacao", "mes_referencia", "valor_remuneracao",
]

COLUNAS_TEXTO = ["nome", "cpf", "codigo_carreira", "descricao_cargo", "uf",
                 "orgao_atuacao", "mes_referencia"]

# Precisa bater com os tamanhos reais definidos no CREATE TABLE servidores_ativos
LIMITE_TAMANHO = {
    "nome": 255,
    "cpf": 11,
    "codigo_carreira": 20,
    "descricao_cargo": 255,
    "uf": 2,
    "orgao_atuacao": 255,
    "mes_referencia": 10,
}


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
    total_descartadas = [0]  # linhas sem nome
    total_campo_invalido = [{}]  # {nome_coluna: quantidade_anulada}
    total_linhas_lixo = [0]  # linhas completamente descartadas por erro de dado

    reader = pd.read_csv(
        CARREIRA_CSV,
        sep=";",
        encoding="latin1",   # o mesmo "28591 / ISO" que você usou no Power BI
        dtype=str,
        chunksize=CHUNKSIZE,
        quoting=csv.QUOTE_NONE,  # ignora aspas por completo - o arquivo não usa
                                 # aspas de verdade, e um '"' acidental (corrupção
                                 # de encoding) estava bagunçando linhas inteiras
    )

    with conn.cursor() as cur:
        for chunk in reader:
            # Renomeia pela posição (contorna header com acentos corrompidos)
            n = min(len(chunk.columns), len(NOMES_POR_POSICAO))
            chunk.columns = NOMES_POR_POSICAO[:n] + list(chunk.columns[n:])
            if "_extra" in chunk.columns:
                chunk = chunk.drop(columns=["_extra"])

            for col in COLUNAS_TEXTO:
                if col in chunk.columns:
                    chunk[col] = strip_str(chunk[col])

            chunk["valor_remuneracao"] = parse_valor_brl(chunk["valor_remuneracao"])

            # Descarta linhas sem nome (violaria o NOT NULL, e não são úteis
            # pra busca de qualquer forma - normalmente são registros "lixo"
            # do próprio dataset de origem, ex: CPF genérico + valor 0.00)
            antes = len(chunk)
            chunk = chunk[chunk["nome"].notna()]
            descartadas = antes - len(chunk)
            if descartadas > 0:
                total_descartadas[0] += descartadas

            # Valida o TAMANHO de qualquer coluna de texto contra o limite
            # real da tabela. Linhas desalinhadas no CSV (texto de uma coluna
            # "vazando" pra outra) podem estourar qualquer campo, não só UF -
            # em vez de travar o INSERT, o campo problemático vira NULL e a
            # ocorrência é contada.
            for col, tamanho_max in LIMITE_TAMANHO.items():
                se_existe = col in chunk.columns
                if not se_existe:
                    continue
                invalido = chunk[col].notna() & (chunk[col].str.len() > tamanho_max)
                qtd = int(invalido.sum())
                if qtd > 0:
                    total_campo_invalido[0][col] = total_campo_invalido[0].get(col, 0) + qtd
                    chunk.loc[invalido, col] = None

            # Corta pra teste, se configurado
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
                    f"INSERT INTO servidores_ativos ({', '.join(COLUNAS_TABELA)}) VALUES %s",
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
                                f"INSERT INTO servidores_ativos ({', '.join(COLUNAS_TABELA)}) VALUES %s",
                                [row],
                            )
                        conn.commit()
                        linhas_ok.append(row)
                    except psycopg2.errors.StringDataRightTruncation:
                        conn.rollback()
                        total_linhas_lixo[0] += 1
                        print(f"AVISO: linha descartada (dado inválido/lixo): {row}")
                rows = linhas_ok  # já foram inseridas uma a uma acima
            total += len(rows)
            print(f"  -> {total} registros inseridos até agora...")

            if LIMITE_LINHAS_TESTE is not None and total >= LIMITE_LINHAS_TESTE:
                break

    print(f"Total final: {total} registros em 'servidores_ativos'.")
    if total_descartadas[0] > 0:
        print(f"Atenção: {total_descartadas[0]} linha(s) descartada(s) por nome ausente.")
    for col, qtd in total_campo_invalido[0].items():
        print(f"Atenção: {qtd} valor(es) da coluna '{col}' excederam o tamanho e viraram NULL.")
    if total_linhas_lixo[0] > 0:
        print(f"Atenção: {total_linhas_lixo[0]} linha(s) totalmente descartada(s) por dado inválido/lixo.")


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        carregar_ativos(conn)
    finally:
        conn.close()
    print("Importação concluída.")


if __name__ == "__main__":
    main()
