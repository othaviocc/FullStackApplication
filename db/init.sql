-- ============================================================
-- Schema: Gestão de Pessoas do Executivo Federal
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- Tabela: servidores_ativos (dataset CARREIRA-012017.csv)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servidores_ativos (
    id                  SERIAL PRIMARY KEY,
    nome                VARCHAR(255) NOT NULL,
    cpf                 VARCHAR(11),
    codigo_carreira     VARCHAR(20),
    descricao_cargo     VARCHAR(255),
    uf                  VARCHAR(2),
    orgao_atuacao       VARCHAR(255),
    mes_referencia      VARCHAR(10),
    valor_remuneracao   NUMERIC(12, 2)
);

CREATE INDEX IF NOT EXISTS idx_ativos_cargo ON servidores_ativos (descricao_cargo);
CREATE INDEX IF NOT EXISTS idx_ativos_orgao ON servidores_ativos (orgao_atuacao);
CREATE INDEX IF NOT EXISTS idx_ativos_uf ON servidores_ativos (uf);
CREATE INDEX IF NOT EXISTS idx_ativos_nome_trgm
    ON servidores_ativos USING GIN (nome gin_trgm_ops);

-- ------------------------------------------------------------
-- Tabela: aposentados (dataset APOSENTADOS_082026.csv)
-- CSV original sem cabeçalho; UF não existe nesse dataset.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aposentados (
    id                      SERIAL PRIMARY KEY,
    nome                    VARCHAR(255) NOT NULL,
    cpf                     VARCHAR(11),
    matricula               VARCHAR(20),
    orgao                   VARCHAR(255),
    orgao_sigla             VARCHAR(20),
    cod_uorg                VARCHAR(20),
    cargo                   VARCHAR(255),
    regime_juridico         VARCHAR(5),
    classe                  VARCHAR(10),
    padrao                  VARCHAR(10),
    nivel                   VARCHAR(10),
    tipo_aposentadoria      VARCHAR(100),
    fundamentacao_legal     VARCHAR(255),
    observacao              VARCHAR(255),
    data_aposentadoria      DATE,
    motivo_admissao         VARCHAR(255),
    data_ingresso           DATE,
    valor_remuneracao       NUMERIC(12, 2)
);

CREATE INDEX IF NOT EXISTS idx_aposentados_cargo ON aposentados (cargo);
CREATE INDEX IF NOT EXISTS idx_aposentados_orgao ON aposentados (orgao);
CREATE INDEX IF NOT EXISTS idx_aposentados_nome_trgm
    ON aposentados USING GIN (nome gin_trgm_ops);

-- ------------------------------------------------------------
-- Exemplos de busca que os índices aceleram:
-- SELECT * FROM servidores_ativos WHERE descricao_cargo = 'ANALISTA...';
-- SELECT * FROM servidores_ativos WHERE nome ILIKE '%SILVA%' LIMIT 100;


-- ------------------------------------------------------------
-- View unificada consumida pela API (/api/servidores)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW servidores AS
    SELECT
        id,
        nome,
        descricao_cargo AS cargo,
        orgao_atuacao    AS orgao,
        uf,
        'ATIVO'::VARCHAR(15) AS situacao,
        valor_remuneracao   AS remuneracao
    FROM servidores_ativos
    UNION ALL
    SELECT
        id,
        nome,
        cargo,
        orgao,
        NULL::VARCHAR(2) AS uf,  -- dataset de aposentados não possui UF
        'APOSENTADO'::VARCHAR(15) AS situacao,
        valor_remuneracao AS remuneracao
    FROM aposentados;