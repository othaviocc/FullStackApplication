import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

/* Fontes empacotadas no build (sem Google Fonts): o site nao depende de
   internet nem de servico externo para carregar a tipografia. */
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/public-sans'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
