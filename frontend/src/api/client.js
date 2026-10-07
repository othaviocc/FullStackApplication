/*
 * Camada unica de acesso a API do back-end.
 *
 * Nenhum componente deve chamar fetch() direto: tudo passa por aqui. Assim o
 * tratamento de timeout, de erro e a traducao das mensagens ficam em um lugar
 * so, e trocar o mock pela API real nao exige mexer na interface.
 */

import { REGISTROS_MOCK } from './mock.js'

/* Enquanto o back-end nao estiver de pe, VITE_USAR_MOCK=true responde local. */
const USAR_MOCK = import.meta.env.VITE_USAR_MOCK === 'true'

/* Caminho relativo: o nginx (producao) e o proxy do Vite (dev) repassam
   /api para o container do back-end, entao nao existe problema de CORS. */
const URL_BASE = import.meta.env.VITE_API_URL || '/api'

/* O PDF define 100 como teto de resultados na busca por similaridade. */
export const LIMITE_MAXIMO = 100
export const ITENS_POR_PAGINA = 20

export const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

const TEMPO_LIMITE_MS = 15000

/* --------------------------------------------------------------------------
 * Erro da aplicacao
 * ----------------------------------------------------------------------- */

export class ErroApi extends Error {
  constructor(mensagem, codigo = 'desconhecido', status = null, detalhe = null) {
    super(mensagem)
    this.name = 'ErroApi'
    this.codigo = codigo
    this.status = status
    /* Mensagem especifica enviada pelo back-end (ex.: "UF invalida: XX"). */
    this.detalhe = detalhe
  }
}

/* Le a mensagem de erro do corpo JSON, se o back-end enviou uma. Respostas
   em HTML (ex.: pagina de erro do nginx quando a API cai) sao ignoradas. */
async function lerDetalheErro(resposta) {
  if (!resposta.headers.get('content-type')?.includes('application/json')) {
    return null
  }
  try {
    const corpo = await resposta.json()
    const detalhe =
      corpo?.erro ?? corpo?.mensagem ?? corpo?.message ?? corpo?.description ?? corpo?.error
    return typeof detalhe === 'string' && detalhe.trim() !== '' ? detalhe.trim() : null
  } catch {
    return null
  }
}

/* Traduz o status HTTP em uma mensagem que faz sentido para o usuario final.
   Os casos cobrem as situacoes que o enunciado exige tratar. */
function mensagemParaStatus(status) {
  switch (status) {
    case 400:
      return 'Parametros de busca invalidos. Revise os campos preenchidos.'
    case 404:
      return 'Nenhum registro encontrado para os filtros informados.'
    case 413:
      return `Busca ampla demais. Reduza o limite para no maximo ${LIMITE_MAXIMO} registros.`
    case 422:
      return 'Algum filtro contem caracteres nao permitidos.'
    case 429:
      return 'Muitas buscas em sequencia. Aguarde alguns instantes e tente novamente.'
    case 503:
      return 'O servico de consulta esta indisponivel no momento.'
    case 504:
      return 'A busca demorou mais que o esperado. Tente refinar os filtros.'
    default:
      if (status >= 500) return 'Erro interno no servidor de consulta.'
      return 'Nao foi possivel completar a busca.'
  }
}

/* --------------------------------------------------------------------------
 * Validacao no cliente
 *
 * Validar antes de enviar evita requisicao inutil e devolve o erro ao usuario
 * instantaneamente. O back-end valida de novo: o cliente nunca e a unica
 * barreira, ja que qualquer um pode chamar a API direto.
 * ----------------------------------------------------------------------- */

export function validarFiltros(filtros) {
  const erros = {}
  const { nome, similar, cargo, uf, orgao, limite } = filtros

  const temAlgumFiltro = [nome, similar, cargo, uf, orgao].some(
    (valor) => valor && String(valor).trim() !== ''
  )

  if (!temAlgumFiltro) {
    erros.geral = 'Informe pelo menos um criterio de busca.'
  }

  if (uf && !UFS_VALIDAS.includes(String(uf).toUpperCase())) {
    erros.uf = 'UF invalida. Use a sigla de duas letras de um estado brasileiro.'
  }

  if (limite !== undefined && limite !== '') {
    const numero = Number(limite)
    if (!Number.isInteger(numero) || numero < 1 || numero > LIMITE_MAXIMO) {
      erros.limite = `O limite deve ser um numero inteiro entre 1 e ${LIMITE_MAXIMO}.`
    }
  }

  for (const campo of ['nome', 'similar', 'cargo', 'orgao']) {
    const valor = filtros[campo]
    if (valor && String(valor).trim().length === 1) {
      erros[campo] = 'Informe ao menos dois caracteres.'
    }
  }

  return erros
}

/* --------------------------------------------------------------------------
 * Requisicao
 * ----------------------------------------------------------------------- */

function montarQuery(filtros, pagina, limite) {
  const parametros = new URLSearchParams()

  /* URLSearchParams ja faz o percent-encoding dos valores, o que neutraliza
     tentativas de injetar comandos via query string. */
  for (const campo of ['nome', 'similar', 'cargo', 'uf', 'orgao']) {
    const valor = filtros[campo]
    if (valor && String(valor).trim() !== '') {
      parametros.set(campo, String(valor).trim())
    }
  }

  parametros.set('page', String(pagina))
  parametros.set('limit', String(limite))

  return parametros.toString()
}

/*
 * Converte um registro da API para o formato usado pelos componentes.
 *
 * A view "servidores" do banco devolve cargo/orgao/remuneracao/situacao, mas
 * os nomes das colunas originais (descricao_cargo, orgao_atuacao...) tambem
 * sao aceitos, caso o back-end consulte as tabelas direto.
 */
function normalizarRegistro(registro) {
  const situacao = registro.situacao ? String(registro.situacao).toUpperCase() : null

  return {
    ...registro,
    nome: registro.nome ?? '',
    cargo: registro.cargo ?? registro.descricao_cargo ?? null,
    orgao: registro.orgao ?? registro.orgao_atuacao ?? null,
    uf: registro.uf ?? null,
    situacao,
    remuneracao: registro.remuneracao ?? registro.valor_remuneracao ?? null,
    /* Ativos e aposentados vem de tabelas diferentes, cada uma com seu SERIAL,
       entao o id sozinho pode se repetir entre as duas. */
    chave: `${situacao ?? 'X'}-${registro.id ?? registro.nome}`
  }
}

/*
 * Normaliza a resposta do back-end.
 *
 * O formato exato ainda nao foi fechado com o time de API, entao aceitamos as
 * variacoes mais provaveis (envelope com "dados"/"resultados"/"servidores" ou
 * um array puro) e devolvemos sempre a mesma forma para os componentes.
 */
function normalizarResposta(corpo, pagina, limite) {
  const lista = Array.isArray(corpo)
    ? corpo
    : corpo?.dados ?? corpo?.resultados ?? corpo?.servidores ?? []

  const total = Number(corpo?.total ?? corpo?.total_registros ?? lista.length)

  return {
    registros: lista.map(normalizarRegistro),
    total,
    pagina: Number(corpo?.pagina ?? corpo?.page ?? pagina),
    limite: Number(corpo?.limite ?? corpo?.limit ?? limite),
    totalPaginas: Math.max(1, Math.ceil(total / limite))
  }
}

export async function buscarServidores(
  filtros = {},
  { pagina = 1, limite = ITENS_POR_PAGINA, sinal } = {}
) {
  if (USAR_MOCK) {
    return buscarNoMock(filtros, pagina, limite)
  }

  /* AbortController garante que a requisicao nao fique pendurada para sempre:
     passado o tempo limite ela e cancelada e vira um erro tratado. */
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS)

  /* Se a tela cancelar a busca (nova pesquisa antes da anterior terminar),
     o sinal externo tambem aborta esta requisicao. */
  if (sinal) {
    sinal.addEventListener('abort', () => controlador.abort(), { once: true })
  }

  try {
    const query = montarQuery(filtros, pagina, limite)
    const resposta = await fetch(`${URL_BASE}/servidores?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controlador.signal
    })

    if (!resposta.ok) {
      throw new ErroApi(
        mensagemParaStatus(resposta.status),
        `http_${resposta.status}`,
        resposta.status,
        await lerDetalheErro(resposta)
      )
    }

    let corpo
    try {
      corpo = await resposta.json()
    } catch {
      /* Sem isso, um corpo que nao e JSON cairia no catch de baixo e seria
         reportado como "API fora do ar", o que confundiria o diagnostico. */
      throw new ErroApi(
        'A API respondeu em um formato inesperado.',
        'resposta_invalida',
        resposta.status
      )
    }
    return normalizarResposta(corpo, pagina, limite)
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro

    if (erro.name === 'AbortError') {
      throw new ErroApi(
        'A busca excedeu o tempo limite. Tente refinar os filtros.',
        'timeout'
      )
    }

    /* fetch so rejeita por falha de rede; qualquer status HTTP ja foi tratado
       acima. Entao aqui a API esta fora do ar ou inacessivel. */
    throw new ErroApi(
      'Nao foi possivel conectar a API. Verifique se o back-end esta no ar.',
      'rede'
    )
  } finally {
    clearTimeout(temporizador)
  }
}

/* --------------------------------------------------------------------------
 * Mock
 * ----------------------------------------------------------------------- */

/* Converte "%JOAO%SILVA%" no equivalente em expressao regular, imitando o
   comportamento do LIKE do PostgreSQL que o back-end vai usar. */
function padraoSimilaridadeParaRegex(padrao) {
  const escapado = padrao
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
  return new RegExp(`^${escapado}$`, 'i')
}

async function buscarNoMock(filtros, pagina, limite) {
  /* Atraso artificial para que os estados de carregamento sejam visiveis
     durante o desenvolvimento. */
  await new Promise((resolver) => setTimeout(resolver, 350))

  let resultado = REGISTROS_MOCK

  if (filtros.nome) {
    const alvo = filtros.nome.trim().toLowerCase()
    resultado = resultado.filter((r) => r.nome.toLowerCase() === alvo)
  }

  if (filtros.similar) {
    const expressao = padraoSimilaridadeParaRegex(filtros.similar)
    resultado = resultado.filter((r) => expressao.test(r.nome))
  }

  if (filtros.cargo) {
    const alvo = filtros.cargo.trim().toLowerCase()
    resultado = resultado.filter((r) =>
      r.cargo.toLowerCase().includes(alvo)
    )
  }

  if (filtros.uf) {
    const alvo = filtros.uf.trim().toUpperCase()
    resultado = resultado.filter((r) => r.uf === alvo)
  }

  if (filtros.orgao) {
    const alvo = filtros.orgao.trim().toLowerCase()
    resultado = resultado.filter((r) =>
      r.orgao.toLowerCase().includes(alvo)
    )
  }

  const total = resultado.length
  const inicio = (pagina - 1) * limite

  return {
    registros: resultado.slice(inicio, inicio + limite).map(normalizarRegistro),
    total,
    pagina,
    limite,
    totalPaginas: Math.max(1, Math.ceil(total / limite))
  }
}
