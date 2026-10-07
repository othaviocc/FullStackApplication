/*
 * Exibe o estado atual da busca: carregando, erro, sem resultados, um unico
 * registro (ficha detalhada, como pede o enunciado) ou lista de registros.
 *
 * A paginacao completa entra na proxima fase; por enquanto a lista mostra a
 * primeira pagina devolvida pela API e o total encontrado.
 */

import './ResultadosBusca.css'

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

function formatarRemuneracao(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  const numero = Number(valor)
  return Number.isFinite(numero) ? formatadorMoeda.format(numero) : '—'
}

function FichaServidor({ servidor }) {
  const linhas = [
    ['Cargo', servidor.cargo],
    ['Órgão', servidor.orgao],
    ['UF', servidor.uf],
    ['Remuneração', formatarRemuneracao(servidor.remuneracao)]
  ]

  return (
    <article className="ficha">
      <h3 className="ficha__nome">{servidor.nome}</h3>
      <dl className="ficha__dados">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="ficha__linha">
            <dt>{rotulo}</dt>
            <dd>{valor || '—'}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function TabelaServidores({ registros }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Cargo</th>
            <th scope="col">Órgão</th>
            <th scope="col">UF</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((servidor, indice) => (
            <tr key={servidor.chave ?? indice}>
              <td>{servidor.nome}</td>
              <td>{servidor.cargo}</td>
              <td>{servidor.orgao}</td>
              <td>{servidor.uf ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ResultadosBusca({ status, dados, erro, aoTentarNovamente }) {
  if (status === 'ocioso') return null

  if (status === 'carregando') {
    return (
      <section className="resultados resultados--carregando" aria-live="polite" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <p>Consultando servidores…</p>
      </section>
    )
  }

  if (status === 'erro') {
    return (
      <section className="resultados resultados--erro" role="alert">
        <p>{erro?.message}</p>
        {aoTentarNovamente && (
          <button type="button" className="botao botao--secundario" onClick={aoTentarNovamente}>
            Tentar novamente
          </button>
        )}
      </section>
    )
  }

  const registros = dados?.registros ?? []

  if (registros.length === 0) {
    return (
      <section className="resultados resultados--vazio" aria-live="polite">
        <p>Nenhum servidor encontrado para os filtros informados.</p>
      </section>
    )
  }

  const total = dados.total ?? registros.length

  return (
    <section className="resultados" aria-live="polite">
      <header className="resultados__cabecalho">
        <h2>Resultados</h2>
        <span className="resultados__total">
          {total === 1 ? '1 registro encontrado' : `${total.toLocaleString('pt-BR')} registros encontrados`}
        </span>
      </header>

      {total === 1 ? (
        <FichaServidor servidor={registros[0]} />
      ) : (
        <TabelaServidores registros={registros} />
      )}
    </section>
  )
}
