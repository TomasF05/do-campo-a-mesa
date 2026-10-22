// Administrador: validação de produtores, moderação e estatísticas
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';
import Indicadores from '../../components/Indicadores.jsx';
import EstadoPedido from '../../components/EstadoPedido.jsx';
import CartaoLeilao from '../../components/CartaoLeilao.jsx';

export default function PainelAdmin() {
  const { utilizador, token } = useAuth();
  const estatisticas = useApi('/admin/estatisticas');
  const pendentes = useApi('/admin/produtores/pendentes');
  const reviews = useApi('/admin/reviews/denunciadas');
  const leiloes = useApi('/auctions');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  async function decidir(caminho, corpo, mensagem) {
    setAGuardar(true); setErro('');
    try { await api(caminho, { metodo: 'PATCH', corpo, token, utilizador }); setAviso(mensagem); pendentes.recarregar(); reviews.recarregar(); }
    catch (err) { setErro(err.message); } finally { setAGuardar(false); }
  }
  return (
    <>
      <h1>Administração</h1>
      <EstadoPedido aCarregar={estatisticas.aCarregar || pendentes.aCarregar || reviews.aCarregar} erro={erro || estatisticas.erro || pendentes.erro || reviews.erro} />
      {estatisticas.dados && <Indicadores itens={[
        ['Utilizadores', estatisticas.dados.utilizadores], ['Produtores', estatisticas.dados.produtores], ['Encomendas', estatisticas.dados.encomendasHoje], ['Leilões ativos', estatisticas.dados.leiloesAtivos]
      ]} />}
      <p role="status">{aviso}</p>
      <div className="painel-colunas"><div>
        <section className="card p-3 mb-4" aria-labelledby="pendentes"><h2 id="pendentes" className="h4">Produtores por validar</h2>
          {pendentes.dados?.map((p) => <article className="mb-3" key={p._id}><h3 className="h6">{p.nome}</h3><p>{p.produtor.localidade}</p><div className="d-flex gap-2">
            <button className="btn btn-success" type="button" disabled={aGuardar} onClick={() => decidir(`/admin/produtores/${p._id}/validacao`, { aprovado: true }, `${p.nome}: aprovado.`)}>Aprovar</button>
            <button className="btn btn-outline-danger" type="button" disabled={aGuardar} onClick={() => decidir(`/admin/produtores/${p._id}/validacao`, { aprovado: false }, `${p.nome}: rejeitado.`)}>Rejeitar</button>
          </div></article>)}{pendentes.dados?.length === 0 && <p>Não há produtores por validar.</p>}
        </section>
        <section className="card p-3" aria-labelledby="denunciadas"><h2 id="denunciadas" className="h4">Avaliações denunciadas</h2>
          {reviews.dados?.map((r) => <article key={r._id} className="mb-3"><h3 className="h6">{r.produtor}</h3><p>{r.texto}</p>
            <button className="btn btn-outline-danger" type="button" disabled={aGuardar} onClick={() => decidir(`/admin/reviews/${r._id}`, { visivel: false }, 'Avaliação ocultada.')}>Ocultar avaliação</button>
          </article>)}{reviews.dados?.length === 0 && <p>Não há avaliações por rever.</p>}
        </section>
      </div><section aria-labelledby="leiloes-admin"><h2 id="leiloes-admin" className="h4">Leilões ativos</h2>
        {leiloes.dados?.filter((l) => l.estado === 'ativo').map((l) => <div key={l._id} className="mb-3"><CartaoLeilao leilao={l} /></div>)}
      </section></div>
    </>
  );
}
