import { Link } from 'react-router-dom';
import { euro } from '../utils.js';
import EstadoPedido from './EstadoPedido.jsx';

export default function CartaoLeilao({ leilao }) {
  const terminado = leilao.estado === 'terminado';
  const temVencedor = terminado && Boolean(leilao.licitacaoAtual?.comprador);
  const mostrarBase = leilao.estado === 'agendado' || (terminado && !temVencedor);
  const valor = mostrarBase ? leilao.precoBase : (leilao.licitacaoAtual?.valor ?? leilao.precoBase);
  const licitacoes = leilao.numLicitacoes ?? 0;

  return (
    <article className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span className={`badge ${ leilao.estado === 'ativo' ? 'text-bg-danger' : 'text-bg-secondary' }`}>
            {leilao.estado === 'ativo' ? 'Em direto' : leilao.estado === 'terminado' ? 'Terminado' : 'Agendado'}
          </span>
        </div>

        <h2 className="h5">
          {leilao.lote}
        </h2>

        <p className="texto-secundario small">
          {leilao.produtor?.nome}
          {' · '}
          {leilao.produtor?.produtor?.localidade}
        </p>

        <p className="mb-1 texto-secundario small">
          {mostrarBase ? 'Preço base' : temVencedor ? 'Valor final' : 'Licitação atual'}
        </p>

        <p className="fs-4 fw-bold">
          {euro(valor)}
        </p>

        <p className="small">{licitacoes} {licitacoes === 1 ? 'licitação' : 'licitações'}</p>
        {terminado
          ? <p className="small">{temVencedor ? `Vencedor: ${leilao.licitacaoAtual.nome || 'Comprador'}` : 'Sem vencedor'}</p>
          : <p className="small">Incremento mínimo: {euro(leilao.incremento)}</p>}

        <Link to={`/leiloes/${leilao._id}`} className="btn btn-success mt-auto" >
          Ver leilão
        </Link>
      </div>
    </article>
  );
}

export function ListaLeiloesPainel({ dados, erro, aCarregar }) {
  const leiloes = dados || [];
  const ordenados = [
    ...leiloes.filter((l) => l.estado === 'ativo'),
    ...leiloes.filter((l) => l.estado === 'agendado'),
    ...leiloes.filter((l) => l.estado === 'terminado').reverse()
  ];
  return <>
    <EstadoPedido aCarregar={aCarregar} erro={erro && (dados
      ? 'Não foi possível atualizar os leilões. A mostrar os últimos dados recebidos.' : erro)} />
    {dados && !ordenados.length && <p className="texto-secundario">Sem leilões.</p>}
    {ordenados.map((leilao) => <div key={leilao._id} className="mb-3"><CartaoLeilao leilao={leilao} /></div>)}
  </>;
}
