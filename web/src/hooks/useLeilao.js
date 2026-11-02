// Passo 7: ligação em tempo real a uma sala de leilão
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL, USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useApi } from './useApi.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useLeilao(id, token) {
  const { utilizador } = useAuth();
  const pedido = useApi(`/auctions/${encodeURIComponent(id)}`);
  const socketRef = useRef(null);
  const [leilao, setLeilao] = useState(null);
  const [atual, setAtual] = useState(null);
  const [participantes, setParticipantes] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setLeilao(null); setAtual(null); setErro(''); setParticipantes(0);
    if (USAR_DADOS_SIMULADOS) return undefined;
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;
    // Guarda eventos que possam chegar enquanto o estado inicial ainda está a carregar.
    let novas = [];
    let revisao = 0;

    const entrar = () => socket.emit('entrar', id);
    socket.on('connect', entrar); // Também recupera a sala e o estado depois de uma reconexão.
    socket.on('estado', ({ leilao: l, licitacoes }) => {
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
    });
    socket.on('nova-licitacao', (b) => {
      if (b.numLicitacoes <= revisao) return;
      revisao = b.numLicitacoes;
      novas = [b, ...novas].slice(0, 20);
      const atual = { ...b, em: b.createdAt };
      setAtual(atual);
      setLeilao((l) => !l || l.numLicitacoes >= b.numLicitacoes ? l : ({
        ...l, licitacaoAtual: atual, numLicitacoes: b.numLicitacoes,
        historico: [{ ...b, comprador: b.nome || 'Comprador', data: b.createdAt }, ...(l.historico || []).filter((n) => n._id !== b._id)].slice(0, 20)
      }));
    });
    socket.on('presenca', setParticipantes);
    socket.on('recusada', setErro);
    socket.on('connect_error', (e) => setErro(e.message));
    // TODO: evento de fim de leilão ('terminado')

    return () => {
      socket.emit('sair', id);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id, token]);

  const licitar = async (valor) => {
    setErro('');
    if (USAR_DADOS_SIMULADOS) {
      try {
        const dados = await api(`/auctions/${id}/bids`, { metodo: 'POST', corpo: { valor }, utilizador });
        pedido.setDados(dados);
      } catch (err) { setErro(err.message); }
      return;
    }
    const socket = socketRef.current;
    if (!socket?.connected) { setErro('Sem ligação ao servidor. Aguarde a reconexão antes de licitar.'); return; }
    await new Promise((resolve) => {
      socket.timeout(8000).emit('licitar', { leilaoId: id, valor }, (err, resposta) => {
        // Uma resposta de uma sessão anterior não deve alterar a página atual.
        if (socketRef.current === socket) {
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
    erro: erro || pedido.erro, aCarregar: pedido.aCarregar && !dados && !erro, licitar };
}
