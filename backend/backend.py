import database
from flask import Flask, request, jsonify, wrappers
from psycopg2.extensions import connection
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok"})

@app.route("/api/servidores")
def search() -> wrappers.Response:
    role = request.args.get("cargo", None)
    uf = request.args.get("uf", None)
    org = request.args.get("orgao", None)
    name = request.args.get("nome", None)
    similar = request.args.get("similar", None)
    limit = int(request.args.get("limit", None))
    page = int(request.args.get("page", None))

    queries = [name, similar, role, uf, org]
    
    conn: connection = database.get_db_connection() # Solicita conexão ao banco da pool

    QUERY = r"SELECT * FROM servidores"

    opt = int(sum([2 ** i if x is not None else 0 for i, x in enumerate(queries)])) # 1 = name apenas, 2 = similar, 4 = role, 29 = busca combinada
    init = limit * (page - 1)
    match opt:
        case 1:
            QUERY += " WHERE nome = %s LIMIT %s OFFSET %s"
            params = (name, limit, init)

        case 2:
            QUERY += " WHERE nome ILIKE %s LIMIT %s OFFSET %s"
            params = (similar, limit, init)

        case 4:
            QUERY += " WHERE cargo = %s LIMIT %s OFFSET %s"
            params = (role, limit, init)

        case 8:
            QUERY += " WHERE uf = %s LIMIT %s OFFSET %s"
            params = (uf, limit, init)

        case 16:
            QUERY += " WHERE orgao = %s LIMIT %s OFFSET %s"
            params = (org, limit, init)

        case 29:
            QUERY += " WHERE nome = %s AND cargo = %s AND uf = %s AND orgao = %s LIMIT %s OFFSET %s"
            params = (name, role, uf, org, limit, init)

    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(QUERY, params) #id, name, role, org, uf, sit, sal
        data = cur.fetchall()

    print(data)
    database.release_db_connection(conn) # Devolve conexão do banco ao pool
    
    return jsonify({"dados": data, "total": len(data), "pagina": page}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)