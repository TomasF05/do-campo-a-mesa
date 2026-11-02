// Passo 7: ligação em tempo real a uma sala de leilão
import { useEffect, useRef, useState } from 'react';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useApi } from './useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export function useLeilao(id, token) {
  const { utilizador } = useAuth();
  const { socket, erro: erroSocket } = useSocket();
  const pedido = useApi(`/auctions/${encodeURIComponent(id)}`);
  const socketRef = useRef(null);
  const [leilao, setLeilao] = useState(null);
  const [atual, setAtual] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setLeilao(null); setAtual(null); setErro(''); setParticipantes(0);
    if (USAR_DADOS_SIMULADOS) return undefined;
    if (!token || !socket) return undefined;
    socketRef.current = { socket, id };
    // Guarda eventos que possam chegar enquanto o estado inicial ainda está a carregar.
    let novas = [];
    let revisao = 0;

    const entrar = () => socket.emit('entrar', id);
    socket.on('connect', entrar); // Também recupera a sala e o estado depois de uma reconexão.
    const onEstado = ({ leilao: l, licitacoes }) => {
      if (l._id !== id.toLowerCase()) return;
      const recentes = novas.filter((b) => b.numLicitacoes > l.numLicitacoes);
      const ultima = recentes[0];
      const versao = ultima?.numLicitacoes ?? l.numLicitacoes;
      if (versao < revisao) return;
      revisao = versao;
      const unicas = [...new Map([...recentes, ...licitacoes].map((b) => [b._id, b])).values()];
      const historico = unicas.slice(0, 20).map((b) => ({
        ...b, comprador: b.comprador?.nome || b.nome || 'Comprador', data: b.createdAt
      }));
      const atual = ultima ? { ...ultima, em: ultima.createdAt } : l.licitacaoAtual;
      setLeilao({ ...l, historico, licitacaoAtual: atual, numLicitacoes: versao });
      setAtual(atual);
    };
    const onNova = (b) => {
      if (b.leilaoId !== id.toLowerCase()) return;
      if (b.numLicitacoes <= revisao) return;
      revisao = b.numLicitacoes;
      novas = [b, ...novas].slice(0, 20);
      const atual = { ...b, em: b.createdAt };
      setAtual(atual);
      setLeilao((l) => !l || l.numLicitacoes >= b.numLicitacoes ? l : ({
        ...l, licitacaoAtual: atual, numLicitacoes: b.numLicitacoes,
        historico: [{ ...b, comprador: b.nome || 'Comprador', data: b.createdAt }, ...(l.historico || []).filter((n) => n._id !== b._id)].slice(0, 20)
      }));
    };
    socket.on('estado', onEstado);
    socket.on('nova-licitacao', onNova);
    socket.on('presenca', setParticipantes);
    socket.on('recusada', setErro);
    if (socket.connected) entrar();
    // TODO: evento de fim de leilão ('terminado')

    return () => {
      socketRef.current = null;
      socket.off('connect', entrar);
      socket.off('estado', onEstado);
      socket.off('nova-licitacao', onNova);
      socket.off('presenca', setParticipantes);
      socket.off('recusada', setErro);
      if (socket.connected) socket.emit('sair', id);
    };
  }, [id, token, socket]);

  const licitar = async (valor) => {
    setErro('');
    if (USAR_DADOS_SIMULADOS) {
      try {
        const dados = await api(`/auctions/${id}/bids`, { metodo: 'POST', corpo: { valor }, utilizador });
        pedido.setDados(dados);
      } catch (err) { setErro(err.message); }
      return;
    }
    const subscricao = socketRef.current;
    const socket = subscricao?.socket;
    if (!socket?.connected) { setErro('Sem ligação ao servidor. Aguarde a reconexão antes de licitar.'); return; }
    await new Promise((resolve) => {
      socket.timeout(8000).emit('licitar', { leilaoId: id, valor }, (err, resposta) => {
        // Uma resposta de uma sessão anterior não deve alterar a página atual.
        if (socketRef.current === subscricao) {
          if (err) setErro('Sem confirmação da licitação. Consulte o estado atual antes de tentar novamente.');
          else if (!resposta?.ok) setErro(resposta?.erro || 'Licitação recusada');
        }
        resolve();
      });
    });
  };

  const dados = USAR_DADOS_SIMULADOS ? pedido.dados : leilao || pedido.dados;
  return { leilao: dados,
    atual: USAR_DADOS_SIMULADOS ? dados?.licitacaoAtual : atual || dados?.licitacaoAtual,
    participantes: USAR_DADOS_SIMULADOS ? 1 : participantes,
    erro: erro || erroSocket || pedido.erro, aCarregar: pedido.aCarregar && !dados && !erro, licitar };
}
