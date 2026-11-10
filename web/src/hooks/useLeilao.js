import { useEffect, useReducer, useRef } from 'react';
import { useApi } from './useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { agoraServidor } from './useContagem.js';

const ORDEM = { agendado: 0, ativo: 1, terminado: 2 };
const inicial = (chave) => ({ chave, leilao: null, novas: [], relogio: null, ligado: false, sincronizado: false, participantes: 0, aEnviar: false, erro: '', mensagem: '' });
const atualizacao = (l) => Date.parse(l.updatedAt || l.licitacaoAtual?.em) || 0;
const nomeBid = (b) => b.nome || b.comprador?.nome || (typeof b.comprador === 'string' && !/^[a-f\d]{24}$/i.test(b.comprador) ? b.comprador : 'Comprador');

function historico(...listas) {
  const unicas = new Map(listas.flat().map((b) => [String(b._id || b.valor), { _id: b._id, valor: b.valor, comprador: nomeBid(b), data: b.data || b.createdAt }]));
  // Os valores aceites são crescentes, mesmo entre servidores com relógios diferentes.
  return [...unicas.values()].sort((a, b) => b.valor - a.valor).slice(0, 20);
}

function integrar(s, l, bids) {
  const anterior = s.leilao;
  const antigo = anterior && (l.numLicitacoes < anterior.numLicitacoes || ORDEM[l.estado] < ORDEM[anterior.estado] ||
    (l.numLicitacoes === anterior.numLicitacoes && l.estado === anterior.estado && atualizacao(l) < atualizacao(anterior)));
  let escolhido = antigo ? anterior : { ...anterior, ...l };
  const recentes = s.novas.filter((b) => b.numLicitacoes > escolhido.numLicitacoes);
  if (recentes.length && escolhido.estado !== 'terminado') {
    const b = recentes[0];
    escolhido = { ...escolhido, estado: 'ativo', numLicitacoes: b.numLicitacoes, licitacaoAtual: { ...b, em: b.createdAt }, updatedAt: b.createdAt };
  }
  return { ...s, leilao: { ...escolhido, historico: historico(anterior?.historico || [], bids, s.novas) } };
}

function reduzir(s, a) {
  if (a.tipo === 'limpar') return inicial(a.chave);
  if (s.chave !== a.chave) return s;
  if (a.tipo === 'snapshot') {
    const novo = integrar(s, a.leilao, a.bids);
    if (!a.relogio) return novo;
    const recente = !s.relogio || a.relogio.servidor >= s.relogio.servidor;
    return { ...novo, sincronizado: recente || s.sincronizado, relogio: recente ? a.relogio : s.relogio };
  }
  if (a.tipo === 'bid') {
    const b = a.bid;
    if (s.leilao?.estado === 'terminado' || b.numLicitacoes <= (s.leilao?.numLicitacoes || 0) || b.numLicitacoes <= (s.novas[0]?.numLicitacoes || 0)) return s;
    const novo = { ...s, novas: [b, ...s.novas].slice(0, 20) };
    return s.leilao ? integrar(novo, { ...s.leilao, estado: 'ativo', numLicitacoes: b.numLicitacoes, licitacaoAtual: { ...b, em: b.createdAt }, updatedAt: b.createdAt }, [b]) : novo;
  }
  if (a.tipo === 'aberto') return !s.leilao || s.leilao.estado !== 'agendado' ? s : { ...s, leilao: { ...s.leilao, estado: 'ativo' } };
  if (a.tipo === 'terminado') {
    if (!s.leilao || a.resultado.numLicitacoes < s.leilao.numLicitacoes) return s;
    const r = a.resultado;
    return integrar(s, { ...s.leilao, estado: 'terminado', numLicitacoes: r.numLicitacoes, encomenda: r.encomenda,
      licitacaoAtual: { valor: r.valor, comprador: r.vencedor?.id, nome: r.vencedor?.nome } }, []);
  }
  return { ...s, ...a.dados };
}

export function useLeilao(id, token) {
  const { utilizador } = useAuth();
  const { socket, erro: erroSocket } = useSocket();
  const pedido = useApi(`/auctions/${encodeURIComponent(id)}`);
  const leilaoId = id.toLowerCase();
  const chave = `${leilaoId}:${token || ''}`;
  const [estado, dispatch] = useReducer(reduzir, chave, inicial);
  const subscricao = useRef(null);
  const envio = useRef(null);
  const acao = (tipo, dados = {}) => dispatch({ tipo, chave, ...dados });

  useEffect(() => { dispatch({ tipo: 'limpar', chave }); }, [chave]);
  useEffect(() => {
    if (pedido.dados?._id?.toLowerCase() === leilaoId) dispatch({ tipo: 'snapshot', chave, leilao: pedido.dados, bids: pedido.dados.historico || [] });
  }, [pedido.dados, leilaoId, chave]);

  useEffect(() => {
    if (!token || !socket) return undefined;
    const atual = { socket, chave };
    subscricao.current = atual;
    const mudar = (dados) => dispatch({ tipo: 'estado', chave, dados });
    const entrar = () => { mudar({ ligado: true, sincronizado: false, erro: '' }); socket.emit('entrar', leilaoId); };
    const onEstado = ({ agora, leilao, licitacoes }) => {
      if (!socket.connected || leilao._id !== leilaoId) return;
      const servidor = Date.parse(agora);
      dispatch({ tipo: 'snapshot', chave, leilao, bids: licitacoes, relogio: Number.isFinite(servidor) ? { servidor, cliente: performance.now() } : null });
    };
    const onNova = (bid) => { if (bid.leilaoId === leilaoId) dispatch({ tipo: 'bid', chave, bid }); };
    const onPresenca = (participantes) => mudar({ participantes });
    const onRecusada = (erro) => mudar({ erro, mensagem: '' });
    const onAberto = (r) => { if (r.id === leilaoId) { dispatch({ tipo: 'aberto', chave }); entrar(); } };
    const onTerminado = (resultado) => { if (resultado.id === leilaoId) { dispatch({ tipo: 'terminado', chave, resultado }); entrar(); } };
    const onDisconnect = () => {
      mudar({ ligado: false, sincronizado: false, participantes: 0 });
      envio.current?.finalizar({ ok: false, erro: 'Ligação interrompida sem confirmação. Consulte o estado atual antes de voltar a licitar.' });
    };
    const eventos = { connect: entrar, disconnect: onDisconnect, estado: onEstado, 'nova-licitacao': onNova, presenca: onPresenca, recusada: onRecusada, aberto: onAberto, terminado: onTerminado };
    for (const [evento, handler] of Object.entries(eventos)) socket.on(evento, handler);
    if (socket.connected) entrar();
    return () => {
      subscricao.current = null;
      envio.current?.finalizar({ ok: false, erro: 'A sala ou a sessão mudou antes da confirmação.' });
      mudar({ aEnviar: false, ligado: false, sincronizado: false, participantes: 0 });
      for (const [evento, handler] of Object.entries(eventos)) socket.off(evento, handler);
      if (socket.connected) socket.emit('sair', leilaoId);
    };
  }, [chave, leilaoId, token, socket]);

  const dados = estado.chave === chave ? estado : inicial(chave);
  const ligado = Boolean(socket?.connected && dados.ligado);
  const podeLicitar = ligado && dados.sincronizado && Boolean(dados.relogio);
  const licitar = (valor) => {
    if (envio.current) return envio.current.promessa;
    const l = dados.leilao;
    let erro;
    if (utilizador?.papel !== 'comprador') erro = 'Apenas compradores podem licitar.';
    else if (!podeLicitar) erro = 'Sem ligação sincronizada ao servidor. Aguarde antes de licitar.';
    else if (l?.estado !== 'ativo' || Date.parse(l.terminaEm) <= agoraServidor(dados.relogio)) erro = 'O leilão não está ativo ou o prazo terminou.';
    else if (!Number.isFinite(valor) || valor <= 0 || Number(valor.toFixed(2)) !== valor || !Number.isSafeInteger(Math.round(valor * 100))) erro = 'Indique um valor válido com, no máximo, duas casas decimais.';
    else if (Math.round(valor * 100) < Math.round(l.licitacaoAtual.valor * 100) + Math.round(l.incremento * 100)) erro = 'O valor indicado é inferior à licitação mínima.';
    if (erro) { acao('estado', { dados: { erro, mensagem: '' } }); return Promise.resolve({ ok: false, erro }); }

    const origem = subscricao.current;
    const pedidoEnvio = {};
    envio.current = pedidoEnvio;
    acao('estado', { dados: { aEnviar: true, erro: '', mensagem: '' } });
    pedidoEnvio.promessa = new Promise((resolve) => {
      let concluido = false;
      pedidoEnvio.finalizar = (resposta) => {
        if (concluido) return;
        concluido = true;
        if (envio.current === pedidoEnvio) envio.current = null;
        if (subscricao.current === origem) {
          if (resposta.ok && resposta.licitacao) acao('bid', { bid: resposta.licitacao });
          acao('estado', { dados: { aEnviar: false, erro: resposta.ok ? '' : resposta.erro, mensagem: resposta.ok ? 'Licitação aceite pelo servidor.' : '' } });
        }
        resolve(resposta);
      };
      socket.timeout(8000).emit('licitar', { leilaoId, valor }, (err, resposta) => pedidoEnvio.finalizar(err ? {
        ok: false, erro: 'Sem confirmação da licitação. Consulte o estado atual antes de tentar novamente.'
      } : resposta?.ok ? resposta : { ok: false, erro: resposta?.erro || 'Licitação recusada.' }));
    });
    return pedidoEnvio.promessa;
  };

  return { leilao: dados.leilao, atual: dados.leilao?.licitacaoAtual, participantes: dados.participantes,
    relogio: dados.relogio, ligado, sincronizado: dados.sincronizado, podeLicitar, aEnviar: dados.aEnviar,
    erro: dados.erro || (!dados.leilao ? pedido.erro : ''), mensagem: dados.mensagem,
    aviso: !ligado ? `${erroSocket || 'Sem ligação em tempo real.'} Os dados da API continuam disponíveis; as licitações estão desativadas.` : !dados.sincronizado ? 'A sincronizar o estado e a hora com o servidor. As licitações estão desativadas.' : '',
    aCarregar: !dados.leilao && pedido.aCarregar && !dados.erro, licitar, recarregar: pedido.recarregar };
}
