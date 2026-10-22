// Comprador: acompanhamento das encomendas
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';
import { useApi } from '../hooks/useApi.js';
import { euro, totalEncomenda } from '../data/simulador.js';

export default function Encomendas() {
  const { dados, erro, aCarregar } = useApi('/orders');
  return (
    <>
      <h1>Encomendas</h1>
      <EstadoPedido aCarregar={aCarregar} erro={erro} />
      <section className="lista-encomendas" aria-label="As suas encomendas">{dados?.map((e) => <article key={e._id} className="card p-3">
        <h2 className="h5">{e.produtor.nome}</h2><EstadoEncomenda estado={e.estado} />
        <ul className="mt-3">{e.linhas.map((l, i) => <li key={i}>{l.quantidade} × {l.nome} · {euro(l.precoUnit)}</li>)}</ul>
        <p>Receção: {e.entrega.tipo}{e.entrega.morada && ` · ${e.entrega.morada}`}</p><p className="fw-bold mb-0">Total: {euro(totalEncomenda(e))}</p>
      </article>)}</section>
      {!aCarregar && !erro && dados?.length === 0 && <p>Ainda não tem encomendas.</p>}
    </>
  );
}
