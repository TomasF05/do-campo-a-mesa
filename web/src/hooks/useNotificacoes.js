import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket, useEventoSocket } from '../context/SocketContext.jsx';
import { euro } from '../data/simulador.js';

// Os eventos invalidam os dados; o REST continua a ser a fonte de recuperação.
export function useAtualizacaoSocket(eventos, atualizar) {
  const { socket } = useSocket();
  useEffect(() => {
    let pendente;
    const agendar = () => {
      clearTimeout(pendente);
      pendente = setTimeout(() => { Promise.resolve(atualizar()).catch(() => {}); }, 50);
    };
    const visivel = () => { if (document.visibilityState === 'visible') agendar(); };
    for (const evento of eventos.split('|')) socket?.on(evento, agendar);
    socket?.on('connect', agendar);
    window.addEventListener('focus', visivel);
    document.addEventListener('visibilitychange', visivel);
    const intervalo = setInterval(() => { if (!socket?.connected) visivel(); }, 30000);
    if (socket?.connected) agendar();
    return () => {
      clearTimeout(pendente); clearInterval(intervalo);
      for (const evento of eventos.split('|')) socket?.off(evento, agendar);
      socket?.off('connect', agendar);
      window.removeEventListener('focus', visivel);
      document.removeEventListener('visibilitychange', visivel);
    };
  }, [socket, eventos, atualizar]);
}

export function useNotificacoes() {
  const { token, utilizador, atualizar } = useAuth();
  const { socket } = useSocket();
  const [estado, setEstado] = useState({ token, lista: [] });
  const vistos = useRef(new Map());
  const temporizadores = useRef(new Map());
  const papel = utilizador?.papel;
  const meuId = utilizador?._id || utilizador?.id;
  useEffect(() => {
    vistos.current.clear();
    setEstado({ token, lista: [] });
    const timers = temporizadores.current;
    return () => { for (const t of timers.values()) clearTimeout(t); timers.clear(); };
  }, [token]);

  const fechar = useCallback((id) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setEstado((s) => s.token === token ? { ...s, lista: s.lista.filter((n) => n.id !== id) } : s);
  }, [token]);

  const mostrar = useCallback((id, texto, destino, prioridade = 1) => {
    if (!token) return;
    const anterior = vistos.current.get(id);
    if (anterior !== undefined && anterior >= prioridade) return;
    vistos.current.set(id, prioridade);
    if (vistos.current.size > 200) vistos.current.delete(vistos.current.keys().next().value);
    const nova = { id, texto, destino };
    setEstado((s) => {
      if (s.token !== token) return s;
      // O resultado privado melhora o mesmo aviso público, sem gerar outro toast.
      return { ...s, lista: anterior === undefined ? [nova, ...s.lista].slice(0, 5) : s.lista.map((n) => n.id === id ? nova : n) };
    });
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.set(id, setTimeout(() => fechar(id), 10000));
  }, [token, fechar]);

  useEventoSocket('encomenda-atualizada', useCallback((e) => {
    if (papel === 'comprador') mostrar(`encomenda:${e.id}:${e.estado}`, `${e.produtor || 'O produtor'} marcou a sua encomenda como \"${e.estado}\".`, '/encomendas');
  }, [papel, mostrar]));
  useEventoSocket('nova-encomenda', useCallback((e) => {
    if (papel === 'produtor') mostrar(`nova:${e.id}`, `Recebeu uma nova encomenda de ${euro(e.total)}.`, '/produtor');
  }, [papel, mostrar]));
  useEventoSocket('leilao-ganho', useCallback((e) => {
    if (papel === 'comprador') mostrar(`fim:${e.id}`, `Ganhou o leilão \"${e.lote}\" por ${euro(e.valor)}. A encomenda está confirmada.`, '/encomendas', 2);
  }, [papel, mostrar]));
  useEventoSocket('leilao-terminado', useCallback((e) => {
    if (papel === 'produtor') mostrar(`fim:${e.id}`, `O seu leilão \"${e.lote}\" terminou ${e.vencedor ? `por ${euro(e.valor)}` : 'sem vencedor'}.`, '/produtor', 2);
  }, [papel, mostrar]));
  useEventoSocket('conta-validada', useCallback((e) => {
    if (papel !== 'produtor' || e.id !== meuId) return;
    mostrar(`conta:${e.id}:${e.updatedAt}`, 'A sua conta de produtor foi aprovada.', '/produtor');
    atualizar();
  }, [papel, meuId, mostrar, atualizar]));
  useEventoSocket('aberto', useCallback((e) => {
    mostrar(`aberto:${e.id}`, 'O leilão que está a acompanhar abriu.', `/leiloes/${e.id}`);
  }, [mostrar]));
  useEventoSocket('terminado', useCallback((e) => {
    mostrar(`fim:${e.id}`, `O leilão \"${e.lote}\" terminou${e.vencedor ? ` por ${euro(e.valor)}` : ' sem vencedor'}.`, `/leiloes/${e.id}`);
  }, [mostrar]));
  useEventoSocket('painel-atualizado', useCallback((e) => {
    if (papel === 'produtor' && e.recurso === 'conta') atualizar();
  }, [papel, atualizar]));

  useEffect(() => {
    if (papel !== 'produtor' || !socket) return undefined;
    const recuperar = () => { atualizar(); };
    socket.on('connect', recuperar);
    window.addEventListener('focus', recuperar);
    return () => { socket.off('connect', recuperar); window.removeEventListener('focus', recuperar); };
  }, [socket, papel, atualizar]);

  return { notificacoes: estado.token === token ? estado.lista : [], fechar };
}
