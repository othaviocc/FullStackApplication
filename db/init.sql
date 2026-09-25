CREATE TABLE servidores_ativos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(11),
    codigo_carreira VARCHAR(20),
    descricao_cargo VARCHAR(255),
    uf VARCHAR(2),
    orgao_atuacao VARCHAR(255),
    mes_referencia VARCHAR(10),
    valor_remuneracao NUMERIC(12, 2)
);