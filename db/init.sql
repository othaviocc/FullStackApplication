-- Schema: Gestão de Pessoas do Executivo Federal
-- Tabela: servidores_ativos (dataset CARREIRA-012017.csv)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

#ta ficando maneiro essa parte aqui:

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

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_ativos_cargo ON servidores_ativos (descricao_cargo);
CREATE INDEX IF NOT EXISTS idx_ativos_orgao ON servidores_ativos (orgao_atuacao);
CREATE INDEX IF NOT EXISTS idx_ativos_uf ON servidores_ativos (uf);
CREATE INDEX IF NOT EXISTS idx_ativos_nome_trgm
    ON servidores_ativos USING GIN (nome gin_trgm_ops);

-- Exemplos de busca que os índices aceleram:
-- SELECT * FROM servidores_ativos WHERE descricao_cargo = 'ANALISTA...';
-- SELECT * FROM servidores_ativos WHERE nome ILIKE '%SILVA%' LIMIT 100;
-- SELECT * FROM servidores_ativos WHERE nome %% 'SILVA' ORDER BY similarity(nome,'SILVA') DESC LIMIT 100;

-- Tabela: aposentados (dataset APOSENTADOS_082026.csv) — PENDENTE
-- CREATE TABLE IF NOT EXISTS aposentados ( ... );