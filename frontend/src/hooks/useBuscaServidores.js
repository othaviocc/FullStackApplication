/*
 * Hook que controla o ciclo de vida de uma busca na API.
 *
 * Os componentes so chamam buscar(filtros) e leem o estado; o hook cuida de
 * carregando/erro/resultado e de cancelar a requisicao anterior quando o
 * usuario dispara uma nova busca antes da primeira terminar. Sem isso, uma
 * resposta atrasada poderia sobrescrever o resultado mais recente.
 *
 * Paginacao:
 *  - Buscas comuns: cada pagina e uma nova requisicao (?page=N&limit=20).
 *  - Similaridade: o "limit" e o teto de nomes escolhido pelo usuario (ate
 *    100), nao o tamanho da pagina. A API devolve tudo de uma vez e a
 *    paginacao acontece aqui no cliente, sem novas requisicoes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buscarServidores, ErroApi, ITENS_POR_PAGINA } from '../api/client.js'

const ESTADO_INICIAL = {
  status: 'ocioso', // ocioso | carregando | sucesso | erro
  dados: null,
  erro: null,
  filtros: null,
  paginaSolicitada: 1
}

export function useBuscaServidores() {
  const [estado, setEstado] = useState(ESTADO_INICIAL)
  const [paginaLocal, setPaginaLocal] = useState(1)
  const controladorAtual = useRef(null)

  const buscar = useCallback(async (filtros, { pagina = 1 } = {}) => {
    controladorAtual.current?.abort()
    const controlador = new AbortController()
    controladorAtual.current = controlador

    const { limite: limiteInformado, ...filtrosApi } = filtros
    const limite = limiteInformado ? Number(limiteInformado) : ITENS_POR_PAGINA

    setPaginaLocal(1)
    /* Trocar de pagina ou repetir a busca reaproveita o mesmo objeto de
       filtros: nesse caso os dados atuais continuam na tela enquanto a nova
       pagina carrega. Uma busca nova comeca do zero. */
    setEstado((anterior) => ({
      ...anterior,
      dados: anterior.filtros === filtros ? anterior.dados : null,
      status: 'carregando',
      erro: null,
      filtros,
      paginaSolicitada: pagina
    }))

    try {
      const dados = await buscarServidores(filtrosApi, {
        pagina,
        limite,
        sinal: controlador.signal
      })

      if (controlador.signal.aborted) return

      setEstado({ status: 'sucesso', dados, erro: null, filtros, paginaSolicitada: pagina })
    } catch (erro) {
      /* Busca cancelada por outra mais nova: o resultado dela ja nao importa. */
      if (controlador.signal.aborted) return

      setEstado((anterior) => ({
        status: 'erro',
        /* Na mesma busca, a ultima pagina valida continua visivel junto com
           a mensagem de erro. */
        dados: anterior.filtros === filtros ? anterior.dados : null,
        erro:
          erro instanceof ErroApi
            ? erro
            : new ErroApi('Erro inesperado ao realizar a busca.'),
        filtros,
        paginaSolicitada: pagina
      }))
    } finally {
      if (controladorAtual.current === controlador) {
        controladorAtual.current = null
      }
    }
  }, [])

  const limpar = useCallback(() => {
    controladorAtual.current?.abort()
    setPaginaLocal(1)
    setEstado(ESTADO_INICIAL)
  }, [])

  /* Aborta a requisicao pendente se o componente sair da tela. */
  useEffect(() => () => controladorAtual.current?.abort(), [])

  const paginacaoLocal = Boolean(estado.filtros?.limite)

  /* Dados prontos para a tela, sempre no mesmo formato, seja qual for o tipo
     de paginacao. */
  const dadosVisiveis = useMemo(() => {
    const { dados } = estado
    if (!dados || !paginacaoLocal) return dados

    const total = dados.registros.length
    const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA))
    const pagina = Math.min(paginaLocal, totalPaginas)
    const inicio = (pagina - 1) * ITENS_POR_PAGINA

    return {
      registros: dados.registros.slice(inicio, inicio + ITENS_POR_PAGINA),
      total,
      pagina,
      limite: ITENS_POR_PAGINA,
      totalPaginas
    }
  }, [estado, paginacaoLocal, paginaLocal])

  const irParaPagina = useCallback(
    (pagina) => {
      if (!estado.filtros || !dadosVisiveis) return
      if (pagina < 1 || pagina > dadosVisiveis.totalPaginas) return

      if (paginacaoLocal) {
        setPaginaLocal(pagina)
      } else {
        buscar(estado.filtros, { pagina })
      }
    },
    [estado.filtros, dadosVisiveis, paginacaoLocal, buscar]
  )

  /* Repete exatamente a ultima requisicao, inclusive a pagina. */
  const tentarNovamente = useCallback(() => {
    if (!estado.filtros) return
    buscar(estado.filtros, { pagina: estado.paginaSolicitada })
  }, [estado.filtros, estado.paginaSolicitada, buscar])

  return {
    ...estado,
    dados: dadosVisiveis,
    carregando: estado.status === 'carregando',
    buscar,
    irParaPagina,
    tentarNovamente,
    limpar
  }
}
