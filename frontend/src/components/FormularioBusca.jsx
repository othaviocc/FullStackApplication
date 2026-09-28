/*
 * Formulario de busca de servidores.
 *
 * Cada modo corresponde a um requisito funcional do enunciado (nome exato,
 * similaridade, cargo, UF, orgao e combinada). O modo so decide quais campos
 * aparecem: no envio, o componente entrega um objeto de filtros no mesmo
 * formato que buscarServidores() espera, e quem decide o que fazer com ele e
 * o componente pai.
 */

import { useState } from 'react'
import { LIMITE_MAXIMO, UFS_VALIDAS, validarFiltros } from '../api/client.js'
import './FormularioBusca.css'

const MODOS = [
  { id: 'nome', rotulo: 'Nome exato', campos: ['nome'] },
  { id: 'similar', rotulo: 'Similaridade', campos: ['similar', 'limite'] },
  { id: 'cargo', rotulo: 'Cargo', campos: ['cargo'] },
  { id: 'uf', rotulo: 'Estado (UF)', campos: ['uf'] },
  { id: 'orgao', rotulo: 'Órgão', campos: ['orgao'] },
  {
    id: 'combinada',
    rotulo: 'Busca combinada',
    campos: ['nome', 'cargo', 'uf', 'orgao']
  }
]

const VALORES_INICIAIS = {
  nome: '',
  similar: '',
  limite: String(LIMITE_MAXIMO),
  cargo: '',
  uf: '',
  orgao: ''
}

/* Texto de ajuda exibido abaixo de cada campo. */
const DICAS = {
  similar: 'Use % como curinga. Ex.: %JOAO%SILVA%, MARIA SOUZA% ou ANA%COSTA',
  limite: `Quantidade máxima de nomes retornados (1 a ${LIMITE_MAXIMO}).`,
  combinada: 'Preencha dois ou mais campos para refinar a busca.'
}

export default function FormularioBusca({ aoBuscar, carregando = false }) {
  const [modo, setModo] = useState('nome')
  const [valores, setValores] = useState(VALORES_INICIAIS)
  const [erros, setErros] = useState({})

  const camposVisiveis = MODOS.find((m) => m.id === modo).campos

  function trocarModo(novoModo) {
    setModo(novoModo)
    setErros({})
  }

  function atualizarCampo(evento) {
    const { name, value } = evento.target
    setValores((anteriores) => ({ ...anteriores, [name]: value }))

    /* Apaga o erro do campo assim que o usuario comeca a corrigir. */
    if (erros[name] || erros.geral) {
      setErros((anteriores) => ({ ...anteriores, [name]: undefined, geral: undefined }))
    }
  }

  function limpar() {
    setValores(VALORES_INICIAIS)
    setErros({})
  }

  function enviar(evento) {
    evento.preventDefault()

    /* Somente os campos do modo atual vao para a busca: um valor digitado em
       outra aba nao deve filtrar o resultado sem o usuario perceber. */
    const filtros = {}
    for (const campo of camposVisiveis) {
      filtros[campo] = valores[campo]
    }

    const encontrados = validarFiltros(filtros)
    if (Object.keys(encontrados).length > 0) {
      setErros(encontrados)
      return
    }

    aoBuscar(filtros)
  }

  function renderizarCampo(campo) {
    const id = `campo-${campo}`
    const idErro = `${id}-erro`
    const idDica = `${id}-dica`
    const erro = erros[campo]

    const atributosComuns = {
      id,
      name: campo,
      value: valores[campo],
      onChange: atualizarCampo,
      disabled: carregando,
      'aria-invalid': Boolean(erro),
      'aria-describedby': [erro && idErro, DICAS[campo] && idDica]
        .filter(Boolean)
        .join(' ') || undefined
    }

    let rotulo
    let controle

    switch (campo) {
      case 'nome':
        rotulo = 'Nome completo'
        controle = (
          <input {...atributosComuns} type="text" placeholder="Ex.: MARIA APARECIDA SILVA" autoComplete="off" />
        )
        break
      case 'similar':
        rotulo = 'Padrão do nome'
        controle = (
          <input {...atributosComuns} type="text" placeholder="%NOME%SOBRENOME%" autoComplete="off" />
        )
        break
      case 'limite':
        rotulo = 'Limite de resultados'
        controle = (
          <input {...atributosComuns} type="number" min="1" max={LIMITE_MAXIMO} step="1" inputMode="numeric" />
        )
        break
      case 'cargo':
        rotulo = 'Cargo / profissão'
        controle = (
          <input {...atributosComuns} type="text" placeholder="Ex.: PROFESSOR DO MAGISTERIO SUPERIOR" autoComplete="off" />
        )
        break
      case 'uf':
        rotulo = 'Estado (UF)'
        controle = (
          <select {...atributosComuns}>
            <option value="">Selecione…</option>
            {UFS_VALIDAS.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
        )
        break
      case 'orgao':
        rotulo = 'Instituição / órgão'
        controle = (
          <input {...atributosComuns} type="text" placeholder="Ex.: UNIVERSIDADE FEDERAL" autoComplete="off" />
        )
        break
      default:
        return null
    }

    return (
      <div key={campo} className={`campo campo--${campo}`}>
        <label htmlFor={id}>{rotulo}</label>
        {controle}
        {DICAS[campo] && (
          <small id={idDica} className="campo__dica">
            {DICAS[campo]}
          </small>
        )}
        {erro && (
          <small id={idErro} className="campo__erro" role="alert">
            {erro}
          </small>
        )}
      </div>
    )
  }

  return (
    <form className="formulario-busca" onSubmit={enviar} noValidate>
      <div className="formulario-busca__modos" role="tablist" aria-label="Tipo de busca">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={modo === m.id}
            className="formulario-busca__modo"
            onClick={() => trocarModo(m.id)}
            disabled={carregando}
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      {modo === 'combinada' && (
        <p className="formulario-busca__descricao">{DICAS.combinada}</p>
      )}

      <div className={`formulario-busca__campos formulario-busca__campos--${modo}`}>
        {camposVisiveis.map(renderizarCampo)}
      </div>

      {erros.geral && (
        <p className="formulario-busca__erro-geral" role="alert">
          {erros.geral}
        </p>
      )}

      <div className="formulario-busca__acoes">
        <button type="button" className="botao botao--secundario" onClick={limpar} disabled={carregando}>
          Limpar
        </button>
        <button type="submit" className="botao botao--primario" disabled={carregando}>
          {carregando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
    </form>
  )
}
