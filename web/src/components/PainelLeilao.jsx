import { useEffect, useState } from 'react';
import { euro } from '../data/simulador.js';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';

export default function PainelLeilao({ leilao, atual, participantes, podeLicitar, comprador, licitar, erro, mensagem, aviso, relogio, ligado, aEnviar }) {
  const [valor, setValor] = useState('');
  const restante = useContagem(leilao.estado === 'agendado' ? leilao.iniciaEm : leilao.terminaEm, relogio);
  const atualCentimos = Math.round((atual?.valor ?? leilao.precoBase) * 100);
  const incremento = Math.round(leilao.incremento * 100);
  const minimo = atualCentimos + incremento;
  const ativo = comprador && podeLicitar && leilao.estado === 'ativo' && restante > 0 && Number.isSafeInteger(minimo) && incremento > 0;
  useEffect(() => { setValor((minimo / 100).toFixed(2)); }, [leilao._id, minimo]);

  async function submeter(e) {
    e.preventDefault();
    if (!ativo || aEnviar) return;
    await licitar(Number(valor));
  }
  return <aside className="card p-3" aria-label="Painel de licitação">
    <p>{ligado ? `${participantes} a assistir` : 'Participantes indisponíveis'}</p>
    <p className="texto-secundario">{leilao.estado === 'terminado' ? 'Leilão terminado' : `${leilao.estado === 'agendado' ? 'Começa em' : 'Tempo restante'}: ${formatarTempo(restante)}`}</p>
    {!relogio && leilao.estado !== 'terminado' && <p className="small">Tempo estimado: hora do servidor ainda indisponível.</p>}
    {relogio && leilao.estado !== 'terminado' && <p className="small">Contagem baseada na última sincronização com o servidor.</p>}
    <p className="mb-0">{leilao.estado === 'terminado' ? 'Valor final' : 'Licitação atual'}</p><p className="valor-atual">{euro(atual?.valor ?? leilao.precoBase)}</p>
    <p>{leilao.numLicitacoes || 0} licitações</p>
    {leilao.estado !== 'terminado' && restante === 0 && <p role="status">{leilao.estado === 'agendado' ? 'A aguardar abertura pelo servidor.' : 'Prazo atingido. A aguardar confirmação do servidor.'}</p>}
    <p className="small">Incremento mínimo: {euro(leilao.incremento)}</p>
    {leilao.estado !== 'terminado' && <form onSubmit={submeter}>
      <div className="d-flex flex-wrap gap-2 mb-3">{[1, 2, 5].map((k) => <button key={k} type="button" className="btn btn-sm btn-outline-primary" disabled={!ativo || aEnviar}
        onClick={() => setValor(((atualCentimos + k * incremento) / 100).toFixed(2))}>+{euro(k * incremento / 100)}</button>)}</div>
      <label htmlFor="valor" className="form-label">O seu valor (€)</label>
      <input id="valor" type="number" step="0.01" min={minimo / 100} className="form-control mb-2" value={valor} onChange={(e) => setValor(e.target.value)} disabled={!ativo || aEnviar} required />
      <p className="small">Valor mínimo: {euro(minimo / 100)}</p>
      <button type="submit" className="btn btn-success w-100" disabled={!ativo || aEnviar}>{aEnviar ? 'A enviar…' : 'Licitar'}</button>
      {!comprador && <p className="small mt-2">Apenas compradores podem licitar.</p>}
    </form>}
    {aviso && <div className="alert alert-warning mt-3 mb-0" role="status">{aviso}</div>}
    {erro && <div className="alert alert-warning mt-3 mb-0" role="alert">{erro}</div>}
    {mensagem && <div className="alert alert-success mt-3 mb-0" role="status">{mensagem}</div>}
  </aside>;
}
