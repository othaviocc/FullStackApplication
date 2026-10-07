import './styles/global.css'
import './App.css'
import FormularioBusca from './components/FormularioBusca.jsx'
import ResultadosBusca from './components/ResultadosBusca.jsx'
import { useBuscaServidores } from './hooks/useBuscaServidores.js'

export default function App() {
  const { status, dados, erro, carregando, buscar, irParaPagina, tentarNovamente } =
    useBuscaServidores()

  return (
    <>
      <header className="topo">
        <div className="container">
          <p className="topo__sobretitulo">Poder Executivo Federal</p>
          <h1>Consulta de Servidores</h1>
          <p className="topo__subtitulo">
            Pesquise servidores ativos e aposentados por nome, cargo, estado ou órgão.
          </p>
        </div>
      </header>

      <main className="container conteudo">
        <FormularioBusca aoBuscar={buscar} carregando={carregando} />
        <ResultadosBusca
          status={status}
          dados={dados}
          erro={erro}
          aoTentarNovamente={tentarNovamente}
          aoMudarPagina={irParaPagina}
        />
      </main>

      <footer className="rodape">
        <div className="container">
          Dados: Portal Brasileiro de Dados Abertos (dados.gov.br)
        </div>
      </footer>
    </>
  )
}
