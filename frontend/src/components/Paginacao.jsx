/*
 * Navegacao entre paginas de resultados.
 *
 * Mostra sempre a primeira e a ultima pagina e uma janela ao redor da atual,
 * com reticencias no meio (1 … 4 5 6 … 20). Assim a barra nao estoura em
 * buscas amplas como "todos os servidores do DF".
 */

import './Paginacao.css'

const VIZINHOS = 1

function montarItens(pagina, totalPaginas) {
  const paginas = new Set([1, totalPaginas])
  for (let p = pagina - VIZINHOS; p <= pagina + VIZINHOS; p += 1) {
    if (p >= 1 && p <= totalPaginas) paginas.add(p)
  }

  const ordenadas = [...paginas].sort((a, b) => a - b)
  const itens = []

  ordenadas.forEach((p, indice) => {
    const anterior = ordenadas[indice - 1]
    if (anterior !== undefined && p - anterior > 1) {
      /* Se o buraco e de uma pagina so, vale mais mostrar o numero dela. */
      itens.push(p - anterior === 2 ? anterior + 1 : `reticencias-${p}`)
    }
    itens.push(p)
  })

  return itens
}

export default function Paginacao({ pagina, totalPaginas, aoMudarPagina, desabilitado = false }) {
  if (totalPaginas <= 1) return null

  const itens = montarItens(pagina, totalPaginas)

  return (
    <nav className="paginacao" aria-label="Paginação dos resultados">
      <button
        type="button"
        className="paginacao__botao"
        onClick={() => aoMudarPagina(pagina - 1)}
        disabled={desabilitado || pagina <= 1}
      >
        ‹ Anterior
      </button>

      <ul className="paginacao__lista" role="list">
        {itens.map((item) =>
          typeof item === 'string' ? (
            <li key={item} className="paginacao__reticencias" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className="paginacao__botao paginacao__numero"
                onClick={() => aoMudarPagina(item)}
                disabled={desabilitado}
                aria-current={item === pagina ? 'page' : undefined}
                aria-label={`Página ${item}`}
              >
                {item}
              </button>
            </li>
          )
        )}
      </ul>

      <button
        type="button"
        className="paginacao__botao"
        onClick={() => aoMudarPagina(pagina + 1)}
        disabled={desabilitado || pagina >= totalPaginas}
      >
        Próxima ›
      </button>

      <p className="paginacao__resumo">
        Página {pagina} de {totalPaginas.toLocaleString('pt-BR')}
      </p>
    </nav>
  )
}
