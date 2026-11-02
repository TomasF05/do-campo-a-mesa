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

    socket.emit('entrar', id);
    socket.on('estado', ({ leilao: l, licitacoes }) => {
      const historico = licitacoes.map((b) => ({
        ...b, comprador: b.comprador?.nome || b.nome || 'Comprador', data: b.createdAt
      }));
      setLeilao({ ...l, historico });
      setAtual(l.licitacaoAtual);
    });
    socket.on('nova-licitacao', setAtual);
    socket.on('presenca', setParticipantes);
    socket.on('recusada', setErro);
    socket.on('connect_error', (e) => setErro(e.message));
    // TODO: evento de fim de leilão ('terminado') e histórico de licitações

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
    socketRef.current?.emit('licitar', { leilaoId: id, valor });
  };

  const dados = USAR_DADOS_SIMULADOS ? pedido.dados : leilao || pedido.dados;
  return { leilao: dados,
    atual: USAR_DADOS_SIMULADOS ? dados?.licitacaoAtual : atual || dados?.licitacaoAtual,
    participantes: USAR_DADOS_SIMULADOS ? 1 : participantes,
    erro: erro || pedido.erro, aCarregar: pedido.aCarregar && !dados && !erro, licitar };
}
