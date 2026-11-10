import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useApi(caminho) {
  const { token } = useAuth();

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(Boolean(caminho));
  const pedido = useRef(null);

  const recarregar = useCallback(async () => {
    pedido.current?.abort();
    const controlador = new AbortController();
    pedido.current = controlador;
    if (!caminho) { setDados(null); setErro(''); setACarregar(false); return; }
    setACarregar(true); setErro('');
    try {
      const resposta = await api(caminho, { token, signal: controlador.signal });
      if (!controlador.signal.aborted) setDados(resposta);
    } catch (err) {
      if (!controlador.signal.aborted) { setErro(err.message); setDados(null); }
    } finally {
      if (!controlador.signal.aborted) setACarregar(false);
    }
  }, [caminho, token]);

  useEffect(() => {
    setDados(null);
    recarregar();
    return () => { pedido.current?.abort(); };
  }, [recarregar]);

  return { dados, erro, aCarregar, recarregar, setDados };
}
