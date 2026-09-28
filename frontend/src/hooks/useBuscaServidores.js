/*
 * Hook que controla o ciclo de vida de uma busca na API.
 *
 * Os componentes so chamam buscar(filtros) e leem o estado; o hook cuida de
 * carregando/erro/resultado e de cancelar a requisicao anterior quando o
 * usuario dispara uma nova busca antes da primeira terminar. Sem isso, uma
 * resposta atrasada poderia sobrescrever o resultado mais recente.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarServidores, ErroApi, ITENS_POR_PAGINA } from '../api/client.js'

const ESTADO_INICIAL = {
  status: 'ocioso', // ocioso | carregando | sucesso | erro
  dados: null,
  erro: null,
  filtros: null
}

export function useBuscaServidores() {
  const [estado, setEstado] = useState(ESTADO_INICIAL)
  const controladorAtual = useRef(null)

  const buscar = useCallback(async (filtros, { pagina = 1 } = {}) => {
    controladorAtual.current?.abort()
    const controlador = new AbortController()
    controladorAtual.current = controlador

    /* Na similaridade o proprio usuario escolhe o teto de resultados; nos
       demais modos vale o tamanho de pagina padrao. */
    const { limite: limiteInformado, ...filtrosApi } = filtros
    const limite = limiteInformado ? Number(limiteInformado) : ITENS_POR_PAGINA

    setEstado((anterior) => ({
      ...anterior,
      status: 'carregando',
      erro: null,
      filtros
    }))

    try {
      const dados = await buscarServidores(filtrosApi, {
        pagina,
        limite,
        sinal: controlador.signal
      })

      if (controlador.signal.aborted) return

      setEstado({ status: 'sucesso', dados, erro: null, filtros })
    } catch (erro) {
      /* Busca cancelada por outra mais nova: o resultado dela ja nao importa. */
      if (controlador.signal.aborted) return

      setEstado({
        status: 'erro',
        dados: null,
        erro:
          erro instanceof ErroApi
            ? erro
            : new ErroApi('Erro inesperado ao realizar a busca.'),
        filtros
      })
    } finally {
      if (controladorAtual.current === controlador) {
        controladorAtual.current = null
      }
    }
  }, [])

  const limpar = useCallback(() => {
    controladorAtual.current?.abort()
    setEstado(ESTADO_INICIAL)
  }, [])

  /* Aborta a requisicao pendente se o componente sair da tela. */
  useEffect(() => () => controladorAtual.current?.abort(), [])

  return {
    ...estado,
    carregando: estado.status === 'carregando',
    buscar,
    limpar
  }
}
