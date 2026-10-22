import { useEffect, useState } from 'react';
import { euro } from '../data/simulador.js';

export default function PainelLeilao({ leilao, atual, participantes, podeLicitar, licitar, erro }) {
  const [valor, setValor] = useState('');
  const [agora, setAgora] = useState(Date.now());
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);

  const minimo = Number(((atual?.valor ?? leilao?.precoBase ?? 0) + (leilao?.incremento ?? 0.01)).toFixed(2));
  const segundos = Math.max(0, Math.ceil((Date.parse(leilao?.terminaEm) - agora) / 1000));
  const tempo = Number.isFinite(segundos) ? `${Math.floor(segundos / 86400)} d ${Math.floor(segundos % 86400 / 3600)} h ${Math.floor(segundos % 3600 / 60)} min ${segundos % 60} s` : '—';
  const ativo = podeLicitar && leilao?.estado === 'ativo' && segundos > 0;

  async function submeter(e) { e.preventDefault(); setAEnviar(true); try { await licitar(Number(valor)); setValor(''); } finally { setAEnviar(false); } }
  return <aside className="card p-3" aria-label="Painel de licitação">
    <p>{participantes} a assistir</p><p className="texto-secundario">Tempo restante: {tempo}</p>
    <p className="mb-0">Licitação atual</p><p className="valor-atual">{euro(atual?.valor ?? leilao?.precoBase ?? 0)}</p>
    <p className="small">Incremento mínimo: {euro(leilao?.incremento ?? 0)}</p>
    <form onSubmit={submeter}>
      <div className="d-flex flex-wrap gap-2 mb-3">{[5, 10, 25].map((v) => <button key={v} type="button" className="btn btn-sm btn-outline-primary" disabled={!ativo}
        onClick={() => setValor(Math.max(minimo, (Number(valor) || atual?.valor || leilao?.precoBase || 0) + v))}>+{v} €</button>)}</div>
      <label htmlFor="valor" className="form-label">O seu valor (€)</label>
      <input id="valor" type="number" step="0.01" min={minimo} className="form-control mb-2" value={valor} onChange={(e) => setValor(e.target.value)} disabled={!ativo} required />
      <p className="small">Valor mínimo: {euro(minimo)}</p>
      <button type="submit" className="btn btn-success w-100" disabled={!ativo || aEnviar}>{aEnviar ? 'A enviar…' : 'Licitar'}</button>
      {!podeLicitar && <p className="small mt-2">Apenas compradores podem licitar.</p>}
    </form>
    {erro && <div className="alert alert-warning mt-3 mb-0" role="alert">{erro}</div>}
  </aside>;
}
