// Comprador: acompanhamento das encomendas
import { useState } from 'react';
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import EstadoPedido from '../components/EstadoPedido.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAtualizacaoSocket } from '../hooks/useNotificacoes.js';
import { api } from '../api/client.js';
import { euro, totalEncomenda } from '../utils.js';

function AvaliacaoEncomenda({ encomenda, avaliadas, token, guardarAvaliacao, recarregarAvaliacoes }) {
  const [destino, setDestino] = useState('');
  const [nota, setNota] = useState('');
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const opcoes = new Map([['produtor', 'Produtor']]);
  for (const linha of encomenda.linhas) {
    if (linha.produto) opcoes.set(linha.produto, linha.nome);
  }
  for (const produto of avaliadas || []) opcoes.delete(produto || 'produtor');
  const selecionado = opcoes.has(destino) ? destino : '';
  const id = encomenda._id;
  const mudar = (atualizar) => (e) => { atualizar(e.target.value); setErro(''); setAviso(''); };

  async function submeter(e) {
    e.preventDefault();
    if (aEnviar) return;
    setErro(''); setAviso('');
    const classificacao = Number(nota);
    if (!selecionado || !Number.isInteger(classificacao) || classificacao < 1 || classificacao > 5) {
      setErro('Escolha o que quer avaliar e uma classificação de 1 a 5.');
      return;
    }
    if (comentario.length > 1000) { setErro('O comentário pode ter até 1000 caracteres.'); return; }
    const produto = selecionado === 'produtor' ? undefined : selecionado;
    setAEnviar(true);
    try {
      await api('/reviews', { metodo: 'POST', token, corpo: { encomenda: id, produto, classificacao, comentario: comentario.trim() } });
      guardarAvaliacao(id, produto);
      setDestino(''); setNota(''); setComentario('');
      setAviso('Avaliação publicada.');
    } catch (err) {
      setErro(err.message);
      if (err.status === 409) recarregarAvaliacoes();
    } finally { setAEnviar(false); }
  }

  return <div className="border-top mt-3 pt-3">
    {opcoes.size > 0 ? <details>
      <summary className="fw-semibold">Avaliar encomenda</summary>
      <form className="mt-2" onSubmit={submeter}>
        <fieldset disabled={aEnviar}>
          <label className="form-label" htmlFor={`avaliacao-destino-${id}`}>O que quer avaliar?</label>
          <select id={`avaliacao-destino-${id}`} className="form-select mb-2" required value={selecionado} onChange={mudar(setDestino)}>
            <option value="">Escolher produtor ou produto</option>
            {[...opcoes].map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
          <label className="form-label" htmlFor={`avaliacao-nota-${id}`}>Classificação</label>
          <select id={`avaliacao-nota-${id}`} className="form-select mb-2" required value={nota} onChange={mudar(setNota)}>
            <option value="">Escolher de 1 a 5</option>
            {[1, 2, 3, 4, 5].map((valor) => <option key={valor} value={valor}>{valor} / 5</option>)}
          </select>
          <label className="form-label" htmlFor={`avaliacao-comentario-${id}`}>Comentário (opcional)</label>
          <textarea id={`avaliacao-comentario-${id}`} className="form-control mb-2" rows={3} maxLength={1000}
            value={comentario} onChange={mudar(setComentario)} />
          <button type="submit" className="btn btn-primary btn-sm">{aEnviar ? 'A publicar…' : 'Publicar avaliação'}</button>
        </fieldset>
      </form>
    </details> : <p className="small mb-0">Já fez todas as avaliações disponíveis para esta encomenda.</p>}
    {erro && <p className="alert alert-danger mt-2 mb-0" role="alert">{erro}</p>}
    {aviso && <p className="small mt-2 mb-0" role="status">{aviso}</p>}
  </div>;
}

export default function Encomendas() {
  const { token, utilizador, sessaoValidada } = useAuth();
  const { dados, erro, aCarregar, recarregar } = useApi('/orders');
  useAtualizacaoSocket('encomenda-atualizada|leilao-ganho|painel-atualizado', recarregar);
  const podeAvaliar = sessaoValidada && utilizador?.papel === 'comprador' && dados?.some((e) => e.estado === 'entregue');
  const minhas = useApi(podeAvaliar ? '/reviews?minhas=true' : null);
  const avaliadas = new Map();
  for (const { encomenda, produto } of minhas.dados || []) {
    if (!avaliadas.has(encomenda)) avaliadas.set(encomenda, []);
    avaliadas.get(encomenda).push(produto);
  }
  function guardarAvaliacao(encomenda, produto) {
    minhas.setDados((atuais) => [...(atuais || []), { encomenda, produto }]);
    minhas.recarregar();
  }
  return (
    <>
      <h1>Encomendas</h1>
      <EstadoPedido aCarregar={aCarregar} erro={erro} />
      {podeAvaliar && <EstadoPedido aCarregar={minhas.aCarregar && !minhas.dados} erro={minhas.erro} />}
      <section className="lista-encomendas align-items-start" aria-label="As suas encomendas">{dados?.map((e) => <article key={e._id} className="card p-3">
        <h2 className="h5">{e.produtor.nome}</h2><EstadoEncomenda estado={e.estado} />
        <ul className="mt-3">{e.linhas.map((l, i) => <li key={i}>{l.quantidade} × {l.nome} · {euro(l.precoUnit)}</li>)}</ul>
        <p>Receção: {e.entrega.tipo}{e.entrega.morada && ` · ${e.entrega.morada}`}</p><p className="fw-bold mb-0">Total: {euro(totalEncomenda(e))}</p>
        {podeAvaliar && e.estado === 'entregue' && minhas.dados && <AvaliacaoEncomenda encomenda={e} avaliadas={avaliadas.get(e._id)} token={token}
          guardarAvaliacao={guardarAvaliacao} recarregarAvaliacoes={minhas.recarregar} />}
      </article>)}</section>
      {!aCarregar && !erro && dados?.length === 0 && <p>Ainda não tem encomendas.</p>}
    </>
  );
}
