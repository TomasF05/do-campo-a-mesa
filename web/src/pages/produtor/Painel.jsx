// Produtor: painel de gestão
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useApiVisivel } from '../../hooks/useApiVisivel.js';
import { useLeiloesPublicos } from '../../hooks/useLeiloesPublicos.js';
import { useAtualizacaoSocket } from '../../hooks/useNotificacoes.js';
import { api } from '../../api/client.js';
import { euro, totalEncomenda } from '../../utils.js';
import Indicadores from '../../components/Indicadores.jsx';
import EstadoPedido from '../../components/EstadoPedido.jsx';
import { ListaLeiloesPainel } from '../../components/CartaoLeilao.jsx';

const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];
const DATA_ENCOMENDA = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
const ESTADO_CONTA = {
  pendente: 'A sua conta de produtor aguarda validação pelo administrador.',
  aprovado: 'A sua conta de produtor está aprovada.',
  rejeitado: 'A sua conta de produtor foi rejeitada pelo administrador.'
};
const EVENTOS_PERFIL = {
  'nova-encomenda': () => true,
  'conta-validada': () => true,
  'painel-atualizado': (e) => e?.recurso === 'encomendas' || e?.recurso === 'conta'
};

function EncomendaRecebida({ encomenda, avancar }) {
  const { comprador, estado, entrega, origem, createdAt, linhas, total } = encomenda;
  const indiceEstado = ESTADOS.indexOf(estado);
  const proximoEstado = indiceEstado >= 0 ? ESTADOS[indiceEstado + 1] : null;
  const rececao = entrega?.tipo === 'entrega' ? 'Entrega' : entrega?.tipo === 'levantamento' ? 'Recolha' : null;
  const morada = entrega?.tipo === 'entrega' ? entrega.morada?.trim() : null;
  const origemEncomenda = origem === 'leilao' ? 'Leilão' : origem === 'loja' ? 'Catálogo' : null;
  const data = Date.parse(createdAt);

  return (
    <li className="border-top py-3 text-break">
      <details>
        <summary>
          <strong>{comprador?.nome || 'Comprador não identificado'}</strong>
          {estado && <span> · {estado}</span>}
          {Number.isFinite(total) && <span> · Total: {euro(total)}</span>}
          <span className="small text-body-secondary"> · Detalhes</span>
        </summary>
        <dl className="row gx-3 gy-2 mx-0 my-2 small">
          {Number.isFinite(data) && <div className="col-12 col-sm-6">
            <dt>Data da encomenda</dt>
            <dd className="mb-0"><time dateTime={createdAt}>{DATA_ENCOMENDA.format(data)}</time></dd>
          </div>}
          {origemEncomenda && <div className="col-12 col-sm-6">
            <dt>Origem</dt><dd className="mb-0">{origemEncomenda}</dd>
          </div>}
          {rececao && <div className="col-12 col-sm-6">
            <dt>Modo de receção</dt><dd className="mb-0">{rececao}</dd>
          </div>}
          {morada && <div className="col-12">
            <dt>Morada de entrega</dt><dd className="mb-0">{morada}</dd>
          </div>}
        </dl>
        <h3 className="h6 mt-3">Artigos encomendados</h3>
        <ul className="list-group list-group-flush">
          {linhas.map((linha, indice) => {
            const temQuantidade = Number.isFinite(linha.quantidade);
            const temPreco = Number.isFinite(linha.precoUnit);
            return (
              <li key={linha._id ?? indice} className="list-group-item px-0">
                <strong>{linha.nome}</strong>
                <div className="d-flex flex-wrap gap-2 small">
                  {temQuantidade && <span>Quantidade: {linha.quantidade}{linha.unidade && ` ${linha.unidade}`}</span>}
                  {temPreco && <span>Preço unitário: {euro(linha.precoUnit)}</span>}
                  {temQuantidade && temPreco && <span>Subtotal: {euro(linha.quantidade * linha.precoUnit)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </details>
      {proximoEstado && <button className="btn btn-sm btn-outline-primary mt-2" type="button"
        onClick={() => avancar(encomenda._id, proximoEstado)}>Marcar {proximoEstado}</button>}
    </li>
  );
}

export default function PainelProdutor() {
  const { utilizador, token, estadoProdutor } = useAuth();
  const perfil = useApiVisivel(estadoProdutor === 'aprovado' ? `/producers/${encodeURIComponent(utilizador._id)}` : null,
    { token, eventos: EVENTOS_PERFIL });
  const encomendas = useApi('/orders');
  const leiloes = useLeiloesPublicos({ produtor: utilizador._id, avisarFalha: true });
  useAtualizacaoSocket('nova-encomenda|leilao-terminado|painel-atualizado', encomendas.recarregar);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const lista = encomendas.dados || [];
  const produtos = perfil.dados?.produtos;
  const stockBaixo = (produtos || []).filter((p) => p.stock < 10);
  const media = perfil.dados?.avaliacaoMedia;
  const totalAvaliacoes = perfil.dados?.totalAvaliacoes;
  const contagem = totalAvaliacoes === 1 ? '1 avaliação' : `${totalAvaliacoes} avaliações`;
  const avaliacoes = Number.isFinite(media) ? <>
    {media.toLocaleString('pt-PT')}/5 <small className="d-block fs-6 texto-secundario">{contagem}</small>
  </> : totalAvaliacoes === 0 ? '0 avaliações' : '—';
  async function avancar(id, estado) {
    try { await api(`/orders/${id}/estado`, { metodo: 'PATCH', token, corpo: { estado } }); setAviso('Estado da encomenda atualizado.'); encomendas.recarregar(); }
    catch (err) { setErro(err.message); }
  }
  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="mb-0">Painel do produtor</h1>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/produtor/perfil" className="btn btn-outline-primary">Editar perfil público</Link>
          {estadoProdutor === 'aprovado' && <><Link to="/produtor/produtos" className="btn btn-outline-primary">Os meus produtos</Link><Link to="/produtor/leiloes/novo" className="btn btn-success">Criar leilão</Link></>}
        </div>
      </div>
      <p className={estadoProdutor === 'aprovado' ? 'texto-secundario' : 'alert alert-warning'} role="status">{ESTADO_CONTA[estadoProdutor]}</p>
      <EstadoPedido aCarregar={perfil.aCarregar || encomendas.aCarregar} erro={erro || perfil.erro || encomendas.erro} />
      <p role="status">{aviso}</p>
      <Indicadores itens={[
        ['Produtos', produtos?.length ?? (estadoProdutor === 'aprovado' ? '—' : 0)], ['Por tratar', lista.filter((e) => e.estado !== 'entregue').length],
        ['Vendas entregues', euro(lista.filter((e) => e.estado === 'entregue').reduce((s, e) => s + totalEncomenda(e), 0))], ['Stock baixo', stockBaixo.length],
        ['Avaliações', avaliacoes]
      ]} />
      <div className="painel-colunas"><section className="card p-3" aria-labelledby="encomendas-recebidas">
        <h2 id="encomendas-recebidas" className="h4">Encomendas recebidas</h2>
        {lista.length > 0 && <ul className="list-unstyled mb-0">
          {lista.map((encomenda) => <EncomendaRecebida key={encomenda._id} encomenda={encomenda} avancar={avancar} />)}
        </ul>}
        {!encomendas.aCarregar && !lista.length && <p>Sem encomendas recebidas.</p>}
      </section><section aria-labelledby="resumo-exploracao"><h2 id="resumo-exploracao" className="h4">A exploração</h2>
        <h3 className="h6">Alertas de stock</h3>{stockBaixo.map((p) => <p className="alert alert-warning" key={p._id}>{p.nome}: {p.stock} {p.unidade}</p>)}
        {!stockBaixo.length && <p>Sem alertas de stock baixo.</p>}
        <section aria-labelledby="leiloes-produtor"><h3 id="leiloes-produtor" className="h5">Leilões</h3>
          <ListaLeiloesPainel {...leiloes} />
        </section>
      </section></div>
    </>
  );
}
