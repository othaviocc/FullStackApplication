/*
 * Mensagem de erro da busca, adaptada ao tipo de falha.
 *
 * Cada situacao que o enunciado pede para tratar ganha um titulo e uma
 * orientacao do que o usuario pode fazer. "Tentar novamente" so aparece
 * quando repetir a mesma busca tem chance de funcionar: com filtro invalido,
 * por exemplo, o certo e corrigir o formulario.
 */

import './AvisoErro.css'

const TIPOS = {
  indisponivel: {
    titulo: 'Serviço de consulta fora do ar',
    dica: 'Não foi possível falar com a API. Aguarde um instante e tente novamente.',
    repetir: true
  },
  lento: {
    titulo: 'A busca demorou demais',
    dica: 'Tente filtros mais específicos, como combinar cargo com UF.',
    repetir: true
  },
  sobrecarga: {
    titulo: 'Muitas buscas ao mesmo tempo',
    dica: 'O servidor está limitando as requisições. Aguarde alguns segundos.',
    repetir: true
  },
  invalido: {
    titulo: 'Filtros inválidos',
    dica: 'Revise os campos do formulário e busque de novo.',
    repetir: false
  },
  generico: {
    titulo: 'Não foi possível completar a busca',
    dica: null,
    repetir: true
  }
}

function classificar(erro) {
  if (erro?.codigo === 'rede') return 'indisponivel'
  if (erro?.codigo === 'timeout') return 'lento'

  switch (erro?.status) {
    case 502:
    case 503:
      return 'indisponivel'
    case 504:
      return 'lento'
    case 429:
      return 'sobrecarga'
    case 400:
    case 413:
    case 422:
      return 'invalido'
    default:
      return 'generico'
  }
}

export default function AvisoErro({ erro, aoTentarNovamente, compacto = false }) {
  const tipo = TIPOS[classificar(erro)]

  /* O detalhe do back-end ("UF invalida: XX") e o mais especifico. Sem ele,
     a mensagem padrao so aparece quando o tipo nao tem dica propria, para
     nao repetir a mesma ideia duas vezes. */
  const descricao = erro?.detalhe ?? (tipo.dica ? null : erro?.message)

  return (
    <div className={`aviso-erro${compacto ? ' aviso-erro--compacto' : ''}`} role="alert">
      <span className="aviso-erro__icone" aria-hidden="true">!</span>
      <div className="aviso-erro__texto">
        <p className="aviso-erro__titulo">{tipo.titulo}</p>
        {descricao && <p>{descricao}</p>}
        {tipo.dica && <p className="aviso-erro__dica">{tipo.dica}</p>}
      </div>
      {tipo.repetir && aoTentarNovamente && (
        <button type="button" className="botao botao--secundario" onClick={aoTentarNovamente}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}
