// Visitante: página pública do produtor
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';
import { api } from '../api/client.js';

export default function Produtor() {
  const { id } = useParams();

  const { dados, erro, aCarregar, setDados, recarregar } = useApi(`/producers/${encodeURIComponent(id)}`);
  const { utilizador, token, sessaoValidada } = useAuth();
  const { adicionar } = useCarrinho();
  const [aDenunciar, setADenunciar] = useState(null);
  const [falhaDenuncia, setFalhaDenuncia] = useState('');
  const produtosDoProdutor = dados?.produtos || [];
  const produtor = dados?.produtor;

  async function denunciar(avaliacao) {
    if (!sessaoValidada || aDenunciar || avaliacao.denunciadaPorMim) return;
    setADenunciar(avaliacao._id); setFalhaDenuncia('');
    try {
      await api(`/reviews/${avaliacao._id}/denuncia`, { metodo: 'POST', token });
      setDados((atuais) => atuais && { ...atuais, avaliacoes: atuais.avaliacoes.map((a) => a._id === avaliacao._id ? { ...a, denunciadaPorMim: true } : a) });
      recarregar();
    } catch (err) {
      setFalhaDenuncia(err.message);
      if (err.status === 404) recarregar();
    } finally { setADenunciar(null); }
  }

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
        {produtor.produtor?.nomeExploracao && produtor.produtor.nomeExploracao !== produtor.nome && <p className="fw-semibold mb-1">{produtor.produtor.nomeExploracao}</p>}
        {produtor.produtor?.localidade && <p className="texto-secundario">{produtor.produtor.localidade}</p>}
        {produtor.produtor?.descricao && <p className="text-break">{produtor.produtor.descricao}</p>}
        {produtor.produtor?.localidade && <a className="btn btn-outline-primary" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(produtor.produtor.localidade)}`} target="_blank" rel="noreferrer">Ver localidade no mapa</a>}
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
      <section className="mt-4" aria-labelledby="avaliacoes-produtor">
        <h2 id="avaliacoes-produtor" className="h4">Avaliações{Number.isFinite(dados.avaliacaoMedia) && ` · ${dados.avaliacaoMedia.toLocaleString('pt-PT')}/5`}</h2>
        {falhaDenuncia && <p className="alert alert-danger" role="alert">{falhaDenuncia}</p>}
        {dados.avaliacoes?.length === 0 && <p>Ainda não existem avaliações.</p>}
        {dados.avaliacoes?.map((a) => {
          const produto = produtosDoProdutor.find((p) => p._id === a.produto);
          return <article key={a._id} className="card p-3 mb-2 text-break">
            <h3 className="h6">{a.autor} · {a.classificacao}/5</h3>
            <p className="small texto-secundario mb-1">{a.produto ? (produto?.nome || 'Avaliação de produto') : 'Avaliação do produtor'}</p>
            {a.texto && <p className="mb-0">{a.texto}</p>}
            {sessaoValidada && (a.denunciadaPorMim
              ? <p className="small mt-2 mb-0" role="status">Denúncia registada.</p>
              : <div className="mt-2"><button type="button" className="btn btn-sm btn-outline-secondary"
                  disabled={Boolean(aDenunciar)} onClick={() => denunciar(a)}>{aDenunciar === a._id ? 'A denunciar…' : 'Denunciar avaliação'}</button></div>)}
          </article>;
        })}
      </section>
    </>
  );
}
