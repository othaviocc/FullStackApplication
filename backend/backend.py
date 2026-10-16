import database
from flask import Flask, request, jsonify, wrappers
from psycopg2.extensions import connection
from psycopg2.extras import RealDictCursor
from werkzeug.exceptions import HTTPException

app = Flask(__name__)

LIMITE_PADRAO = 20
LIMITE_MAXIMO = 100


def erro(mensagem: str, status: int) -> tuple[wrappers.Response, int]:
    return jsonify({"erro": mensagem}), status


def ler_inteiro(nome: str, padrao: int) -> int | None:
    valor = request.args.get(nome)
    if valor is None or valor.strip() == "":
        return padrao
    try:
        return int(valor)
    except ValueError:
        return None


def escapar_like(texto: str) -> str:
    # Faz % e _ digitados pelo usuario valerem como texto, e nao como curinga
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok"})


@app.route("/api/servidores")
def search() -> wrappers.Response:
    role = request.args.get("cargo", "").strip()
    uf = request.args.get("uf", "").strip().upper()
    org = request.args.get("orgao", "").strip()
    name = request.args.get("nome", "").strip()
    similar = request.args.get("similar", "").strip()
    limit = ler_inteiro("limit", LIMITE_PADRAO)
    page = ler_inteiro("page", 1)

    if limit is None or not 1 <= limit <= LIMITE_MAXIMO:
        return erro(f"O parametro limit deve ser um inteiro entre 1 e {LIMITE_MAXIMO}.", 400)
    if page is None or page < 1:
        return erro("O parametro page deve ser um inteiro maior que zero.", 400)
    if uf and len(uf) != 2:
        return erro("O parametro uf deve ter 2 letras (ex.: RS).", 400)

    # Monta o WHERE so com os filtros que vieram, em qualquer combinacao
    condicoes = []
    params = []

    if name:
        condicoes.append("UPPER(nome) = UPPER(%s)")
        params.append(name)
    if similar:
        # O usuario informa o padrao com % (ex.: %JOAO%SILVA%); sem % vira "contem"
        padrao = similar if "%" in similar else f"%{similar}%"
        condicoes.append("nome ILIKE %s")
        params.append(padrao)
    if role:
        condicoes.append("cargo ILIKE %s")
        params.append(f"%{escapar_like(role)}%")
    if uf:
        condicoes.append("uf = %s")
        params.append(uf)
    if org:
        condicoes.append("orgao ILIKE %s")
        params.append(f"%{escapar_like(org)}%")

    if not condicoes:
        return erro("Informe ao menos um filtro: nome, similar, cargo, uf ou orgao.", 400)

    where = " WHERE " + " AND ".join(condicoes)
    init = limit * (page - 1)

    conn: connection = database.get_db_connection() # Solicita conexão ao banco da pool
    if conn is None:
        return erro("Banco de dados indisponivel no momento. Tente novamente em instantes.", 503)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS total FROM servidores" + where, params)
            total = cur.fetchone()["total"]

            cur.execute(
                "SELECT * FROM servidores" + where + " ORDER BY nome, situacao, id LIMIT %s OFFSET %s",
                params + [limit, init],
            )
            data = cur.fetchall() #id, name, role, org, uf, sit, sal
        conn.rollback() # Encerra a transacao de leitura antes de devolver a conexao
    finally:
        database.release_db_connection(conn) # Devolve conexão do banco ao pool

    return jsonify({"dados": data, "total": total, "pagina": page}), 200


# Qualquer erro vira JSON {"erro": ...}, que e o formato que o front-end le
@app.errorhandler(HTTPException)
def erro_http(e: HTTPException):
    return erro(e.description, e.code)


@app.errorhandler(Exception)
def erro_interno(e: Exception):
    app.logger.exception(e)
    return erro("Erro interno no servidor.", 500)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
