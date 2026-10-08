import math
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import get_db_connection, release_db_connection
import psycopg2.extras

app = FastAPI(title="API Gestão de Pessoas")

# Permite que o frontend (Vite) acesse a API sem erros de CORS durante o desenvolvimento
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UFS_VALIDAS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

@app.get("/api/servidores")
def buscar_servidores(
    nome: str = Query(None),
    similar: str = Query(None),
    cargo: str = Query(None),
    uf: str = Query(None),
    orgao: str = Query(None),
    page: int = Query(1, alias="page", ge=1),
    limit: int = Query(20, alias="limit", ge=1)
):
    # Regras e validações que casam com os erros do client.js
    if limit > 100:
        return JSONResponse(
            status_code=413, 
            content={"erro": "Busca ampla demais. Reduza o limite para no maximo 100 registros."}
        )

    if uf and uf.upper() not in UFS_VALIDAS:
        return JSONResponse(
            status_code=400, 
            content={"erro": "UF invalida. Use a sigla de duas letras de um estado brasileiro."}
        )

    if not any([nome, similar, cargo, uf, orgao]):
        return JSONResponse(
            status_code=400, 
            content={"erro": "Informe pelo menos um criterio de busca."}
        )

    # Construção dinâmica da query SQL
    base_query = "FROM servidores WHERE 1=1"
    conditions = []
    params = []

    # Como o banco usa pg_trgm, ILIKE resolve a maioria das buscas parciais
    if nome:
        conditions.append("nome ILIKE %s")
        params.append(nome.strip())
        
    if similar:
        # Pega a string e transforma no formato para o ILIKE
        texto_similar = f"%{similar.strip()}%".replace("%%", "%")
        conditions.append("nome ILIKE %s")
        params.append(texto_similar)

    if cargo:
        conditions.append("cargo ILIKE %s")
        params.append(f"%{cargo.strip()}%")

    if uf:
        conditions.append("uf = %s")
        params.append(uf.upper().strip())

    if orgao:
        conditions.append("orgao ILIKE %s")
        params.append(f"%{orgao.strip()}%")

    if conditions:
        base_query += " AND " + " AND ".join(conditions)

    count_query = f"SELECT COUNT(*) {base_query}"
    data_query = f"SELECT id, nome, cargo, orgao, uf, situacao, remuneracao {base_query} ORDER BY nome LIMIT %s OFFSET %s"
    
    offset = (page - 1) * limit
    data_params = params + [limit, offset]

    conn = get_db_connection()
    if not conn:
        return JSONResponse(status_code=503, content={"erro": "O servico de consulta esta indisponivel no momento."})

    try:
        # O RealDictCursor faz com que as linhas do banco voltem como Dicionários em vez de Tuplas
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Conta o total de registros reais para a paginação
            cur.execute(count_query, params)
            total_registros = cur.fetchone()['count']

            if total_registros == 0:
                return JSONResponse(status_code=404, content={"erro": "Nenhum registro encontrado para os filtros informados."})

            # Busca os dados limitados da página atual
            cur.execute(data_query, data_params)
            registros = cur.fetchall()

            total_paginas = max(1, math.ceil(total_registros / limit))

            # Resposta estruturada exatamente como o client.js -> normalizarResposta() espera
            return {
                "registros": registros,
                "total": total_registros,
                "pagina": page,
                "limite": limit,
                "totalPaginas": total_paginas
            }

    except Exception as e:
        print(f"Erro na consulta SQL: {e}")
        return JSONResponse(status_code=500, content={"erro": "Erro interno no servidor de consulta."})
    finally:
        release_db_connection(conn)

if __name__ == "__main__":
    import uvicorn
    # Inicia o servidor na porta 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)