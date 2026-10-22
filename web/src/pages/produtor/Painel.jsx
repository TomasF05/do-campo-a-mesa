// Produtor: painel de gestão
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';
import { euro, totalEncomenda } from '../../data/simulador.js';
import Indicadores from '../../components/Indicadores.jsx';
import EstadoPedido from '../../components/EstadoPedido.jsx';
import CartaoLeilao from '../../components/CartaoLeilao.jsx';

export default function PainelProdutor() {
  const { utilizador, token } = useAuth();
  const produtos = useApi(`/products?produtor=${utilizador._id}`);
  const encomendas = useApi('/orders');
  const leiloes = useApi('/auctions');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const lista = encomendas.dados || [];
  const stockBaixo = (produtos.dados || []).filter((p) => p.stock < 10);
  const estados = ['pendente', 'confirmada', 'pronta', 'entregue'];
  async function avancar(e) {
    try { await api(`/orders/${e._id}/estado`, { metodo: 'PATCH', token, utilizador, corpo: { estado: estados[estados.indexOf(e.estado) + 1] } }); setAviso('Estado da encomenda atualizado.'); encomendas.recarregar(); }
    catch (err) { setErro(err.message); }
  }
  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="mb-0">Painel do produtor</h1>
        <div className="d-flex flex-wrap gap-2"><Link to="/produtor/produtos" className="btn btn-outline-primary">Os meus produtos</Link><Link to="/produtor/leiloes/novo" className="btn btn-success">Criar leilão</Link></div>
      </div>
      <EstadoPedido aCarregar={produtos.aCarregar || encomendas.aCarregar} erro={erro || produtos.erro || encomendas.erro} />
      <p role="status">{aviso}</p>
      <Indicadores itens={[
        ['Produtos', produtos.dados?.length ?? '—'], ['Por tratar', lista.filter((e) => e.estado !== 'entregue').length],
        ['Vendas entregues', euro(lista.filter((e) => e.estado === 'entregue').reduce((s, e) => s + totalEncomenda(e), 0))], ['Stock baixo', stockBaixo.length]
      ]} />
      <div className="painel-colunas"><section className="card p-3" aria-labelledby="encomendas-recebidas">
        <h2 id="encomendas-recebidas" className="h4">Encomendas recebidas</h2>
        <div className="table-responsive"><table className="table align-middle"><caption>Encomendas dos seus clientes.</caption>
          <thead><tr><th scope="col">Cliente</th><th scope="col">Total</th><th scope="col">Estado</th><th scope="col">Ação</th></tr></thead>
          <tbody>{lista.map((e) => <tr key={e._id}><th scope="row">{e.comprador.nome}</th><td>{euro(totalEncomenda(e))}</td><td>{e.estado}</td>
            <td>{e.estado !== 'entregue' && <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => avancar(e)}>Marcar {estados[estados.indexOf(e.estado) + 1]}</button>}</td></tr>)}</tbody>
        </table></div>{!encomendas.aCarregar && !lista.length && <p>Sem encomendas recebidas.</p>}
      </section><section aria-labelledby="resumo-exploracao"><h2 id="resumo-exploracao" className="h4">A exploração</h2>
        <h3 className="h6">Alertas de stock</h3>{stockBaixo.map((p) => <p className="alert alert-warning" key={p._id}>{p.nome}: {p.stock} {p.unidade}</p>)}
        {!stockBaixo.length && <p>Sem alertas de stock baixo.</p>}
        {(leiloes.dados || []).filter((l) => l.produtor._id === utilizador._id).map((l) => <div className="mb-3" key={l._id}><CartaoLeilao leilao={l} /></div>)}
      </section></div>
    </>
  );
}
