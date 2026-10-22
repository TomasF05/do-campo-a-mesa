// Comprador: sala de leilão em tempo real
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import PainelLeilao from '../components/PainelLeilao.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';
import { euro } from '../data/simulador.js';

export default function SalaLeilao() {
  const { id } = useParams();
  const { token, utilizador } = useAuth();
  const { leilao, atual, participantes, erro, aCarregar, licitar } = useLeilao(id, token);
  if (!leilao) return <><h1>Leilão</h1><EstadoPedido aCarregar={aCarregar} erro={erro} /><Link to="/leiloes">Voltar aos leilões</Link></>;

  return (
    <div className="sala-leilao">
      <section>
        <h1>{leilao?.lote || 'Leilão'}</h1>
        <p>{leilao.descricao}</p><p>Quantidade: {leilao.quantidade}</p>
        <p><Link to={`/produtores/${leilao.produtor._id}`}>{leilao.produtor.nome}</Link> · {leilao.produtor.produtor?.localidade}</p>
        <p>Estado: {leilao.estado}</p><p>Termina em: {new Date(leilao.terminaEm).toLocaleString('pt-PT')}</p>
        <section aria-labelledby="historico-licitacoes"><h2 id="historico-licitacoes" className="h4">Histórico de licitações</h2>
          {leilao.historico?.length ? <ol className="list-group">{leilao.historico.map((b, i) => <li key={i} className="list-group-item">{b.comprador} · {euro(b.valor)} · {new Date(b.data).toLocaleTimeString('pt-PT')}</li>)}</ol> : <p>Ainda não existem licitações registadas nesta demonstração.</p>}
        </section>
      </section>

      <PainelLeilao leilao={leilao} atual={atual} participantes={participantes} erro={erro} licitar={licitar} podeLicitar={utilizador?.papel === 'comprador'} />
    </div>
  );
}
