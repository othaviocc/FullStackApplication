/*
 * Dados falsos para desenvolver a interface enquanto o backend nao esta
 * pronto. As colunas seguem exatamente o schema definido em db/init.sql,
 * para que a troca do mock pela API real nao exija mudanca nos componentes.
 */

const ORGAOS = [
  { nome: 'MINISTERIO DA AGRICULTURA E PECUARIA', uf: 'DF' },
  { nome: 'MINISTERIO DA EDUCACAO', uf: 'DF' },
  { nome: 'UNIVERSIDADE FEDERAL DO RIO GRANDE DO SUL', uf: 'RS' },
  { nome: 'UNIVERSIDADE FEDERAL DE SANTA CATARINA', uf: 'SC' },
  { nome: 'INSTITUTO NACIONAL DO SEGURO SOCIAL', uf: 'SP' },
  { nome: 'MINISTERIO DA SAUDE', uf: 'RJ' },
  { nome: 'MINISTERIO DA FAZENDA', uf: 'DF' },
  { nome: 'UNIVERSIDADE FEDERAL DE MINAS GERAIS', uf: 'MG' }
]

const CARGOS = [
  'AGENTE ADMINISTRATIVO',
  'AUXILIAR OPERACIONAL EM AGROPECUARIA',
  'PROFESSOR DO MAGISTERIO SUPERIOR',
  'TECNICO DE ENFERMAGEM',
  'ANALISTA DE TECNOLOGIA DA INFORMACAO',
  'AUDITOR FISCAL DA RECEITA FEDERAL',
  'TECNICO EM CONTABILIDADE',
  'ASSISTENTE EM ADMINISTRACAO'
]

const PRENOMES = [
  'JULIO CESAR', 'CLERIO VICENTE', 'PEDRO', 'MARIA APARECIDA',
  'ANA LUCIA', 'JOSE CARLOS', 'FRANCISCA', 'ANTONIO MARCOS',
  'LUIZ HENRIQUE', 'SANDRA REGINA', 'PAULO ROBERTO', 'TEREZINHA'
]

const SOBRENOMES = [
  'REGO', 'SILVA', 'DIAS', 'OLIVEIRA', 'SOUZA', 'PEREIRA',
  'COSTA', 'RODRIGUES', 'ALMEIDA', 'NUNES', 'CARVALHO', 'REICHOW'
]

/*
 * Gerador pseudoaleatorio com semente fixa: a mesma semente produz sempre a
 * mesma lista, o que evita a tela mudar de conteudo a cada recarregamento
 * durante o desenvolvimento.
 */
function criarGerador(semente) {
  let estado = semente
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648
    return estado / 2147483648
  }
}

function gerarRegistros(quantidade = 240) {
  const sortear = criarGerador(42)
  const registros = []

  for (let i = 0; i < quantidade; i += 1) {
    const orgao = ORGAOS[Math.floor(sortear() * ORGAOS.length)]
    const prenome = PRENOMES[Math.floor(sortear() * PRENOMES.length)]
    const sobrenome = SOBRENOMES[Math.floor(sortear() * SOBRENOMES.length)]
    const ultimoSobrenome = SOBRENOMES[Math.floor(sortear() * SOBRENOMES.length)]

    registros.push({
      id: i + 1,
      nome: `${prenome} ${sobrenome} ${ultimoSobrenome}`,
      cpf: `***${Math.floor(sortear() * 900000) + 100000}**`,
      codigo_carreira: String(Math.floor(sortear() * 900000000) + 100000000),
      descricao_cargo: CARGOS[Math.floor(sortear() * CARGOS.length)],
      uf: orgao.uf,
      orgao_atuacao: orgao.nome,
      mes_referencia: '08/2026',
      valor_remuneracao: Number((sortear() * 18000 + 1500).toFixed(2))
    })
  }

  return registros
}

export const REGISTROS_MOCK = gerarRegistros()
