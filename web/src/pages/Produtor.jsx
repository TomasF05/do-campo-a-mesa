// Visitante: página pública do produtor
import { useParams } from 'react-router-dom';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';

export default function Produtor() {
  const { id } = useParams();

  const { dados, erro, aCarregar } = useApi(`/producers/${encodeURIComponent(id)}`);
  const { utilizador } = useAuth();
  const { adicionar } = useCarrinho();
  const produtosDoProdutor = dados?.produtos || [];
  const produtor = dados?.produtor;

  if (!produtor) {
    return (
      <>
        <h1>Produtor</h1>
        <EstadoPedido aCarregar={aCarregar} erro={erro} />
      </>
    );
  }

  return (
    <>
      <section className="mb-4">
        <h1>{produtor.nome}</h1>

        <p className="texto-secundario">
          {produtor.produtor?.localidade}
        </p>
        <p>{produtor.produtor?.descricao}</p>
        <a className="btn btn-outline-primary" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(produtor.produtor?.localidade || '')}`} target="_blank" rel="noreferrer">Ver localidade no mapa</a>
      </section>

      <section aria-labelledby="produtos-produtor">
        <h2 id="produtos-produtor">
          Produtos
        </h2>

        <div className="grelha-produtos">
          {produtosDoProdutor.map((produto) => (
            <CartaoProduto key={produto._id} produto={produto}
              onAdicionar={utilizador?.papel === 'comprador' ? () => adicionar(produto) : undefined} />
          ))}
        </div>
        {produtosDoProdutor.length === 0 && <p>Este produtor ainda não tem produtos disponíveis.</p>}
      </section>
      <section className="mt-4" aria-labelledby="avaliacoes-produtor"><h2 id="avaliacoes-produtor" className="h4">Avaliações · {dados.avaliacaoMedia}/5</h2>
        {dados.avaliacoes?.map((a) => <article key={a._id} className="card p-3 mb-2"><h3 className="h6">{a.autor} · {a.classificacao}/5</h3><p className="mb-0">{a.texto}</p></article>)}
      </section>
    </>
  );
}
