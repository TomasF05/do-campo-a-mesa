// Uma ligação partilhada por sessão autenticada nesta aba.
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, erro: '' });

export function SocketProvider({ children }) {
  const { token, utilizador, aCarregar, sessaoValidada } = useAuth();
  const [ligacao, setLigacao] = useState(null);
  const [erro, setErro] = useState('');
  const utilizadorId = utilizador?._id || utilizador?.id;
  const podeLigar = !USAR_DADOS_SIMULADOS && !aCarregar && sessaoValidada && Boolean(token && utilizadorId);

  useEffect(() => {
    setErro('');
    if (!podeLigar) { setLigacao(null); return undefined; }

    let expiraEm;
    try {
      // A API já validou o JWT; aqui só se lê o prazo para terminar a ligação mesmo sem rede.
      const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!Number.isFinite(exp)) throw new Error('Prazo inválido');
      expiraEm = exp * 1000;
    } catch {
      window.dispatchEvent(new CustomEvent('sessao-expirada', { detail: { token } }));
      return undefined;
    }

    const socket = io(API_URL, { autoConnect: false, forceNew: true, auth: { token } });
    let ativo = true;
    let prazo;
    let inicio;
    const expirar = () => {
      if (!ativo) return;
      ativo = false;
      clearTimeout(prazo); clearTimeout(inicio);
      socket.disconnect();
      setLigacao(null);
      window.dispatchEvent(new CustomEvent('sessao-expirada', { detail: { token } }));
    };
    const vigiarPrazo = () => {
      const restante = expiraEm - Date.now();
      if (restante <= 0) return expirar();
      prazo = setTimeout(vigiarPrazo, Math.min(restante, 2147483647));
    };
    const onConnect = () => { if (ativo) setErro(''); };
    const onErro = (e) => {
      if (!ativo) return;
      if (e.data?.status === 401) expirar();
      else setErro(e.message || 'Não foi possível ligar ao servidor');
    };
    const onDisconnect = (motivo) => {
      if (!ativo) return;
      if (motivo === 'io server disconnect') expirar();
      else setErro('Ligação interrompida. A tentar restabelecer a ligação.');
    };
    socket.on('connect', onConnect);
    socket.on('connect_error', onErro);
    socket.on('disconnect', onDisconnect);
    setLigacao({ socket, token, utilizadorId });
    vigiarPrazo();
    // O cleanup do primeiro efeito em StrictMode cancela este arranque antes da ligação.
    inicio = setTimeout(() => { if (ativo) socket.connect(); }, 0);

    return () => {
      ativo = false;
      clearTimeout(inicio); clearTimeout(prazo);
      socket.off('connect', onConnect);
      socket.off('connect_error', onErro);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
      socket.removeAllListeners();
    };
  }, [token, utilizadorId, podeLigar]);

  // Não expõe a ligação antiga enquanto o efeito da mudança de sessão ainda está a limpar.
  const atual = podeLigar && ligacao?.token === token && ligacao.utilizadorId === utilizadorId;
  return <SocketContext.Provider value={{ socket: atual ? ligacao.socket : null, erro: atual ? erro : '' }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

export function useEventoSocket(evento, handler) {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on(evento, handler);
    return () => socket.off(evento, handler);
  }, [socket, evento, handler]);
}
