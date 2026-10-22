// Visitante: catálogo com pesquisa e filtros
import { useEffect, useState } from 'react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import CartaoLeilao from '../components/CartaoLeilao.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';
import { CATEGORIAS, EPOCAS } from '../data/simulador.js';

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState({ q: '', categoria: 'Todos', bio: false, produtor: '', localidade: '', epoca: '', precoMax: '', ordenar: 'nome' });
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);
  const [aviso, setAviso] = useState('');
  const { dados: leiloes } = useApi('/auctions');
  const { dados: produtores } = useApi('/producers');
  const destaque = leiloes?.find((l) => l.estado === 'ativo');
  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {
    const controlador = new AbortController();
    setACarregar(true); setErro('');
    const t = setTimeout(() => {
      const q = new URLSearchParams(
        Object.entries(filtro).filter(([, valor]) => valor !== '' && valor !== false
          )
      );

      api(`/products?${q}`, { signal: controlador.signal })
        .then((dados) => { if (!controlador.signal.aborted) setProdutos(dados); })
        .catch((e) => { if (!controlador.signal.aborted) { setErro(e.message); setProdutos([]); } })
        .finally(() => { if (!controlador.signal.aborted) setACarregar(false); });
    }, USAR_DADOS_SIMULADOS ? 0 : 300);

    return () => { clearTimeout(t); controlador.abort(); };
  }, [filtro]);

  const mudar = (campo) => (e) =>
    setFiltro((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <section className="destaque mb-4">
        <div>
        <h1>Direto de quem produz, para a sua mesa.</h1>
        <p className="texto-secundario">Produtores do Alto Minho. Encomende ou dispute os lotes da época nos leilões em direto.</p>
        </div>
        {destaque && <CartaoLeilao leilao={destaque} />}
      </section>

      <section className="filtros mb-3" aria-label="Filtros">
        <label className="visually-hidden" htmlFor="pesquisa">Pesquisar</label>
        <input id="pesquisa" type="search" className="form-control" placeholder="Pesquisar kiwi, mel, Alvarinho…"
          value={filtro.q} onChange={mudar('q')} />
        <div className="filtros__categorias d-flex flex-wrap gap-2">
          {['Todos', ...CATEGORIAS].map((c) => (
            <button key={c} type="button"
              className={`btn btn-sm ${filtro.categoria === c ? 'btn-dark' : 'btn-outline-secondary'}`}
              aria-pressed={filtro.categoria === c}
              onClick={() => setFiltro((f) => ({ ...f, categoria: c }))}>{c}</button>
          ))}
        </div>
        <div className="form-check">
          <input id="bio" className="form-check-input" type="checkbox" checked={filtro.bio} onChange={mudar('bio')} />
          <label className="form-check-label" htmlFor="bio">Só biológico</label>
        </div>
      </section>
      <div className="filtros-avancados mb-4">
        <div><label htmlFor="filtro-produtor" className="form-label">Produtor</label>
          <select id="filtro-produtor" className="form-select" value={filtro.produtor} onChange={mudar('produtor')}><option value="">Todos</option>
            {produtores?.map((p) => <option key={p._id} value={p._id}>{p.nome}</option>)}</select></div>
        <div><label htmlFor="localidade" className="form-label">Localidade</label>
          <select id="localidade" className="form-select" value={filtro.localidade} onChange={mudar('localidade')}><option value="">Todas</option>
            {[...new Set(produtores?.map((p) => p.produtor.localidade))].map((l) => <option key={l}>{l}</option>)}</select></div>
        <div><label htmlFor="epoca" className="form-label">Época</label><select id="epoca" className="form-select" value={filtro.epoca} onChange={mudar('epoca')}>
          <option value="">Todas</option>{EPOCAS.map((e) => <option key={e}>{e}</option>)}</select></div>
        <div><label htmlFor="preco-max" className="form-label">Preço máximo (€)</label><input id="preco-max" type="number" min="0" step="0.01" className="form-control" value={filtro.precoMax} onChange={mudar('precoMax')} /></div>
        <div><label htmlFor="ordenar" className="form-label">Ordenar</label><select id="ordenar" className="form-select" value={filtro.ordenar} onChange={mudar('ordenar')}>
          <option value="nome">Nome</option><option value="preco-asc">Preço crescente</option><option value="preco-desc">Preço decrescente</option></select></div>
      </div>

      <EstadoPedido aCarregar={aCarregar} erro={erro} />
      <p className="small texto-secundario" role="status">{aviso || (!aCarregar && !erro ? `${produtos.length} produtos encontrados.` : '')}</p>

      <section className="grelha-produtos" aria-labelledby="titulo-produtos">
        <h2 id="titulo-produtos" className="visually-hidden">Produtos</h2>
        {!aCarregar && !erro && produtos.map((p) => (
          <CartaoProduto key={p._id} produto={p}
            onAdicionar={utilizador?.papel === 'comprador' ? () => { carrinho.adicionar(p); setAviso(`Carrinho atualizado: ${p.nome}.`); } : undefined} />
        ))}
      </section>
      {!aCarregar && !erro && produtos.length === 0 && <p className="texto-secundario">Nenhum produto encontrado.</p>}
    </>
  );
}
