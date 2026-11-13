// Administrador: validação de produtores, moderação e estatísticas
import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useApiVisivel } from '../../hooks/useApiVisivel.js';
import { useLeiloesPublicos } from '../../hooks/useLeiloesPublicos.js';
import { useAtualizacaoSocket } from '../../hooks/useNotificacoes.js';
import { api } from '../../api/client.js';
import Indicadores from '../../components/Indicadores.jsx';
import EstadoPedido from '../../components/EstadoPedido.jsx';
import { ListaLeiloesPainel } from '../../components/CartaoLeilao.jsx';

const EVENTOS_ESTATISTICAS = {
  'painel-atualizado': (e) => ['utilizadores', 'produtores', 'encomendas', 'leiloes'].includes(e?.recurso)
};

export default function PainelAdmin() {
  const { token } = useAuth();
  const estatisticas = useApiVisivel('/admin/estatisticas', { token, eventos: EVENTOS_ESTATISTICAS });
  const pendentes = useApi('/admin/produtores/pendentes');
  const reviews = useApi('/admin/reviews/denunciadas');
  const leiloes = useLeiloesPublicos({ avisarFalha: true });
  const atualizarPainel = useCallback(() => Promise.all([pendentes.recarregar(), reviews.recarregar()]), [pendentes.recarregar, reviews.recarregar]);
  useAtualizacaoSocket('painel-atualizado', atualizarPainel);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  async function decidir(caminho, corpo, mensagem) {
    setAGuardar(true); setErro(''); setAviso('');
    try { await api(caminho, { metodo: 'PATCH', corpo, token }); setAviso(mensagem); atualizarPainel(); }
    catch (err) { setErro(err.message); if (err.status === 409) atualizarPainel(); } finally { setAGuardar(false); }
  }
  return (
    <>
      <h1>Administração</h1>
      <EstadoPedido aCarregar={estatisticas.aCarregar || pendentes.aCarregar || reviews.aCarregar} erro={erro || estatisticas.erro || pendentes.erro || reviews.erro} />
      {estatisticas.dados && <Indicadores itens={[
        ['Utilizadores', estatisticas.dados.utilizadores], ['Produtores', estatisticas.dados.produtores], ['Encomendas hoje', estatisticas.dados.encomendasHoje], ['Leilões ativos', estatisticas.dados.leiloesAtivos]
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
          {reviews.dados?.map((r) => <article key={r._id} className="mb-3"><h3 className="h6">{typeof r.produtor === 'object' ? r.produtor?.nome : r.produtor}</h3><p>{r.comentario || r.texto}</p>
            <button className="btn btn-outline-danger" type="button" disabled={aGuardar} onClick={() => decidir(`/admin/reviews/${r._id}`, { visivel: false }, 'Avaliação ocultada.')}>Ocultar avaliação</button>
          </article>)}{reviews.dados?.length === 0 && <p>Não há avaliações por rever.</p>}
        </section>
      </div><section aria-labelledby="leiloes-admin"><h2 id="leiloes-admin" className="h4">Leilões</h2>
        <ListaLeiloesPainel {...leiloes} />
      </section></div>
    </>
  );
}
