from flask import Flask, request, jsonify, wrappers

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
    limit = request.args.get("limit", None)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)