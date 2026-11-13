import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useSocket } from '../context/SocketContext.jsx';

const LIMITE_PEDIDO_MS = 10000;
const AGRUPAR_EVENTOS_MS = 100;
const SEM_EVENTOS = {};

export function useApiVisivel(caminho, { token, intervalo = 15000, eventos = SEM_EVENTOS } = {}) {
  const { socket } = useSocket();
  const [estado, setEstado] = useState(null);
  const atualizar = useRef(null);

  useEffect(() => {
    if (!caminho) return undefined;
    let temporizador;
    let pedido;

    function agendar(atraso) {
      clearTimeout(temporizador);
      if (document.visibilityState === 'visible') temporizador = setTimeout(carregar, atraso);
    }

    async function carregar() {
      const controlador = new AbortController();
      pedido = controlador;
      const limite = setTimeout(() => controlador.abort(), LIMITE_PEDIDO_MS);
      try {
        const dados = await api(caminho, { token, signal: controlador.signal });
        controlador.signal.throwIfAborted();
        if (pedido === controlador) setEstado({ caminho, token, dados, erro: '' });
      } catch (e) {
        if (pedido === controlador) {
          const erro = controlador.signal.aborted ? 'O pedido demorou demasiado tempo.' : e.message;
          setEstado((anterior) => ({ caminho, token, erro,
            dados: anterior?.caminho === caminho && anterior.token === token ? anterior.dados : null }));
        }
      } finally {
        clearTimeout(limite);
        if (pedido === controlador) {
          pedido = null;
          agendar(intervalo);
        }
      }
    }

    function cancelar() {
      clearTimeout(temporizador);
      pedido?.abort();
      pedido = null;
    }
    function invalidar() {
      cancelar();
      agendar(AGRUPAR_EVENTOS_MS);
    }

    atualizar.current = invalidar;
    document.addEventListener('visibilitychange', invalidar);
    window.addEventListener('online', invalidar);
    window.addEventListener('focus', invalidar);
    agendar(0);
    return () => {
      cancelar();
      document.removeEventListener('visibilitychange', invalidar);
      window.removeEventListener('online', invalidar);
      window.removeEventListener('focus', invalidar);
      atualizar.current = null;
    };
  }, [caminho, token, intervalo]);

  useEffect(() => {
    if (!socket || !caminho) return undefined;
    let jaLigou = socket.connected;
    const recuperar = () => {
      if (jaLigou) atualizar.current?.();
      jaLigou = true;
    };
    const handlers = Object.entries(eventos).map(([nome, aceitar]) => [nome, (dados) => {
      if (aceitar(dados)) atualizar.current?.();
    }]);
    for (const [nome, handler] of handlers) socket.on(nome, handler);
    socket.on('connect', recuperar);
    return () => {
      for (const [nome, handler] of handlers) socket.off(nome, handler);
      socket.off('connect', recuperar);
    };
  }, [socket, caminho, eventos]);

  const atual = caminho && estado?.caminho === caminho && estado.token === token ? estado : null;
  return { dados: atual?.dados ?? null, erro: atual?.erro ?? '', aCarregar: Boolean(caminho && !atual) };
}
