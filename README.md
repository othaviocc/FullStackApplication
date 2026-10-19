# Consulta de Servidores Públicos — Executivo Federal

Aplicação full stack para consulta de dados de servidores ativos e aposentados do Poder Executivo Federal, a partir das bases públicas do **Portal Brasileiro de Dados Abertos** (dados.gov.br). Projeto desenvolvido para a disciplina de Sistemas para Internet II — 3º Bimestre.

## Sobre o projeto

O sistema permite consultar registros de servidores públicos federais por **nome (exato ou por similaridade)**, **cargo/profissão**, **estado (UF)** e **instituição/órgão**, com suporte a combinação de filtros e paginação de resultados. A aplicação é totalmente modularizada em contêineres Docker (banco de dados, back-end e front-end).

## Equipe

| Integrante | Função |
|---|---|
| [Othavio Christmann Correa] | Líder Técnico |
| [Matheus Nunes Buttow] | Desenvolvedor(a) |
| [Theo Corvello Soares] | Desenvolvedor(a) | 
| [Luis Henrique K. Reichow] | Desenvolvedor(a) | 

> O líder técnico é responsável pela divisão das tarefas diárias e pela liderança técnica de engenharia de software do projeto.
## Tecnologias utilizadas

**Back-end / API**
- Python + Flask + WSGI Gunicorn (multi-threading)

**Banco de dados**
- PostgreSQL

**Front-end**
- HTML/CSS/JavaScript + Framework web

**Infraestrutura**
- Docker e Docker Compose

## Estrutura de pastas

```
projeto/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── backend.py
│   ├── database.py
│   ├── Dockerfile
│   └── requirements.txt
├── db/
│   ├── APOSENTADOS_082026.csv
│   ├── Dockerfile
│   └── init.sql
├── docs/
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── main.jsx
│       ├── api/
│       │   ├── client.js
│       │   └── mock.js
│       ├── components/
│       │   ├── AvisoErro.jsx
│       │   ├── FormularioBusca.jsx
│       │   ├── Paginacao.jsx
│       │   └── ResultadosBusca.jsx
│       ├── hooks/
│       │   └── useBuscaServidores.js
│       └── styles/
│           ├── global.css
│           └── tokens.css
└── limpeza_dados/
    ├── carga_inicial.py
    ├── Dockerfile
    ├── importar_aposentados.py
    ├── importar_dados.py
    ├── relatando_limpeza.txt
    └── requirements.txt
```
