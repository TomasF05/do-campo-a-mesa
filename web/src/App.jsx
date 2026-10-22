// Passo 2: routing no cliente
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Produtor from './pages/Produtor.jsx';
import Leiloes from './pages/Leiloes.jsx';
import SalaLeilao from './pages/SalaLeilao.jsx';
import Carrinho from './pages/Carrinho.jsx';
import Encomendas from './pages/Encomendas.jsx';
import Login from './pages/Login.jsx';
import Registo from './pages/Registo.jsx';
import PainelProdutor from './pages/produtor/Painel.jsx';
import NovoLeilao from './pages/produtor/NovoLeilao.jsx';
import PainelAdmin from './pages/admin/Painel.jsx';
import NaoEncontrado from './pages/NaoEncontrado.jsx';
import ProdutosProdutor from './pages/produtor/Produtos.jsx';
import { USAR_DADOS_SIMULADOS } from './api/client.js';

export default function App() {
  return (
    <>
    <a href="#conteudo" className="visually-hidden-focusable position-absolute p-2 bg-white">
      Saltar para o conteúdo
    </a>
        <Navbar />
      {USAR_DADOS_SIMULADOS && <div className="aviso-demo"><div className="container-xl">Demonstração local · dados e ações guardados apenas neste browser.</div></div>}
      <main id="conteudo" className="container-xl py-4">
        <Routes>
          {/* Visitante */}
          <Route path="/" element={<Catalogo />} />
          <Route path="/produtores/:id" element={<Produtor />} />
          <Route path="/leiloes" element={<Leiloes />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registo" element={<Registo />} />

          {/* Qualquer utilizador autenticado */}
          <Route element={<RotaProtegida />}>
            <Route path="/leiloes/:id" element={<SalaLeilao />} />
          </Route>

          {/* Comprador */}
          <Route element={<RotaProtegida papeis={['comprador']} />}>
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/encomendas" element={<Encomendas />} />
          </Route>

          {/* Produtor */}
          <Route element={<RotaProtegida papeis={['produtor']} />}>
            <Route path="/produtor" element={<PainelProdutor />} />
            <Route path="/produtor/produtos" element={<ProdutosProdutor />} />
            <Route path="/produtor/leiloes/novo" element={<NovoLeilao />} />
          </Route>

          {/* Administrador */}
          <Route element={<RotaProtegida papeis={['admin']} />}>
            <Route path="/admin" element={<PainelAdmin />} />
          </Route>

          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </main>
      <footer className="container-xl py-4 texto-secundario small">Do Campo à Mesa · Produtores locais do Alto Minho</footer>
    </>
  );
}
