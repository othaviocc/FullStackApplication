/*
 * Exibe o estado atual da busca: carregando, erro, sem resultados, um unico
 * registro (ficha detalhada, como pede o enunciado) ou lista de registros.
 *
 * Com varios resultados, a tabela vem acompanhada da barra de paginacao.
 */

import { useRef } from 'react'
import Paginacao from './Paginacao.jsx'
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

/* A base de aposentados nao traz UF; explicar evita parecer dado faltando. */
const UF_AUSENTE = 'A base de aposentados não informa a UF'

function SeloSituacao({ situacao }) {
  if (!situacao) return '—'
  const classe = situacao === 'APOSENTADO' ? 'selo--aposentado' : 'selo--ativo'
  const rotulo = situacao === 'APOSENTADO' ? 'Aposentado' : 'Ativo'
  return <span className={`selo ${classe}`}>{rotulo}</span>
}

function FichaServidor({ servidor }) {
  const linhas = [
    ['Cargo', servidor.cargo],
    ['Órgão', servidor.orgao],
    ['UF', servidor.uf ?? (servidor.situacao === 'APOSENTADO' ? 'Não informada' : null)],
    ['Remuneração', formatarRemuneracao(servidor.remuneracao)]
  ]

  return (
    <article className="ficha">
      <header className="ficha__cabecalho">
        <h3 className="ficha__nome">{servidor.nome}</h3>
        <SeloSituacao situacao={servidor.situacao} />
      </header>
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
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((servidor, indice) => (
            <tr key={servidor.chave ?? indice}>
              <td>{servidor.nome}</td>
              <td>{servidor.cargo}</td>
              <td>{servidor.orgao}</td>
              <td title={servidor.uf ? undefined : UF_AUSENTE}>{servidor.uf ?? '—'}</td>
              <td>
                <SeloSituacao situacao={servidor.situacao} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ResultadosBusca({
  status,
  dados,
  erro,
  aoTentarNovamente,
  aoMudarPagina
}) {
  const secaoRef = useRef(null)

  if (status === 'ocioso') return null

  const registros = dados?.registros ?? []
  const temDados = registros.length > 0
  const carregando = status === 'carregando'

  /* Primeira carga de uma busca: ainda nao ha nada para mostrar. */
  if (carregando && !temDados) {
    return (
      <section className="resultados resultados--carregando" aria-live="polite" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <p>Consultando servidores…</p>
      </section>
    )
  }

  const avisoErro = status === 'erro' && (
    <div className="resultados__erro" role="alert">
      <p>{erro?.message}</p>
      {aoTentarNovamente && (
        <button type="button" className="botao botao--secundario" onClick={aoTentarNovamente}>
          Tentar novamente
        </button>
      )}
    </div>
  )

  if (status === 'erro' && !temDados) {
    return <section className="resultados resultados--erro">{avisoErro}</section>
  }

  if (!temDados) {
    return (
      <section className="resultados resultados--vazio" aria-live="polite">
        <p>Nenhum servidor encontrado para os filtros informados.</p>
      </section>
    )
  }

  const total = dados.total ?? registros.length

  /* Quem clica em "Proxima" esta no fim da tabela; levar a tela ao inicio
     dos resultados mostra o indicador de carregamento e o primeiro item. */
  function mudarPagina(pagina) {
    secaoRef.current?.scrollIntoView({ block: 'start' })
    aoMudarPagina(pagina)
  }

  return (
    <section ref={secaoRef} className="resultados" aria-live="polite" aria-busy={carregando}>
      <header className="resultados__cabecalho">
        <h2>Resultados</h2>
        <span className="resultados__total">
          {total === 1 ? '1 registro encontrado' : `${total.toLocaleString('pt-BR')} registros encontrados`}
        </span>
      </header>

      {avisoErro}

      {/* Ao trocar de pagina a anterior continua visivel, esmaecida, ate a
          nova chegar: a tela nao "pisca" e o usuario nao perde a posicao. */}
      <div className={`resultados__corpo${carregando ? ' resultados__corpo--carregando' : ''}`}>
        {carregando && (
          <div className="resultados__sobreposicao">
            <span className="spinner" aria-hidden="true" />
            <span className="apenas-leitor-tela">Carregando página…</span>
          </div>
        )}

        {total === 1 ? (
          <FichaServidor servidor={registros[0]} />
        ) : (
          <TabelaServidores registros={registros} />
        )}
      </div>

      {total > 1 && (
        <Paginacao
          pagina={dados.pagina}
          totalPaginas={dados.totalPaginas}
          aoMudarPagina={mudarPagina}
          desabilitado={carregando}
        />
      )}
    </section>
  )
}
