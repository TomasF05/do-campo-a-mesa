// Comprador: sala de leilão em tempo real
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import PainelLeilao from '../components/PainelLeilao.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';
import { euro } from '../utils.js';

export default function SalaLeilao() {
  const { id } = useParams();
  const { token, utilizador } = useAuth();
  const { leilao, atual, participantes, erro, mensagem, aviso, relogio, ligado, podeLicitar, aEnviar, aCarregar, licitar, recarregar } = useLeilao(id, token);
  if (!leilao) return <><h1>Leilão</h1><EstadoPedido aCarregar={aCarregar} erro={erro} /><Link to="/leiloes">Voltar aos leilões</Link></>;
  const meuId = utilizador?._id || utilizador?.id;
  const vencedorId = atual?.comprador?._id || atual?.comprador;
  const lider = vencedorId ? (vencedorId === meuId ? 'A sua licitação' : atual.nome || 'Comprador') : null;

  return (
    <div className="sala-leilao">
      <section>
        <h1>{leilao?.lote || 'Leilão'}</h1>
        <p>{leilao.descricao}</p><p>Quantidade: {leilao.quantidade}</p>
        {leilao.produtor && <p><Link to={`/produtores/${leilao.produtor._id}`}>{leilao.produtor.nome}</Link> · {leilao.produtor.produtor?.localidade}</p>}
        <p>Estado: {leilao.estado}</p><p>Termina em: {new Date(leilao.terminaEm).toLocaleString('pt-PT')}</p>
        {leilao.estado === 'terminado' ? <div className="alert alert-info" role="status">
          <h2 className="h4">Resultado do leilão</h2>
          <p>{lider ? (vencedorId === meuId ? 'Ganhou este leilão.' : `Vencedor: ${atual.nome || 'Comprador'}.`) : 'O leilão terminou sem licitações e sem vencedor.'}</p>
          {lider && <p>Valor final: {euro(atual.valor)}</p>}
          {vencedorId === meuId && leilao.encomenda && <Link to="/encomendas">Ver a encomenda do lote</Link>}
        </div> : <p>{lider ? (vencedorId === meuId ? 'A sua licitação é a mais alta.' : `A liderar: ${lider}.`) : 'Ainda não existe uma licitação vencedora.'}</p>}
        {!ligado && <button type="button" className="btn btn-outline-primary mb-3" onClick={recarregar}>Atualizar dados pela API</button>}
        <section aria-labelledby="historico-licitacoes"><h2 id="historico-licitacoes" className="h4">Histórico de licitações</h2>
          {leilao.historico?.length ? <ol className="list-group">{leilao.historico.map((b) => <li key={b._id || b.valor} className="list-group-item">{b.comprador} · {euro(b.valor)} · {new Date(b.data).toLocaleTimeString('pt-PT')}</li>)}</ol> : <p>Ainda não existem licitações registadas.</p>}
        </section>
      </section>

      <PainelLeilao leilao={leilao} atual={atual} participantes={participantes} erro={erro} mensagem={mensagem} aviso={aviso} relogio={relogio} ligado={ligado} aEnviar={aEnviar} licitar={licitar} podeLicitar={podeLicitar} comprador={utilizador?.papel === 'comprador'} />
    </div>
  );
}
