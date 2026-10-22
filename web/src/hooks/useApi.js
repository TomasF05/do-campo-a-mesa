import { useCallback, useEffect, useRef, useState } from 'react';

import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useApi(caminho) {
  const { token, utilizador } = useAuth();

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
      const resposta = await api(caminho, { token, utilizador, signal: controlador.signal });
      if (!controlador.signal.aborted) setDados(resposta);
    } catch (err) {
      if (!controlador.signal.aborted) { setErro(err.message); setDados(null); }
    } finally {
      if (!controlador.signal.aborted) setACarregar(false);
    }
  }, [caminho, token, utilizador]);

  useEffect(() => {
    setDados(null);
    recarregar();
    if (USAR_DADOS_SIMULADOS) window.addEventListener('dados-simulados-alterados', recarregar);
    return () => { pedido.current?.abort(); window.removeEventListener('dados-simulados-alterados', recarregar); };
  }, [recarregar]);

  return { dados, erro, aCarregar, recarregar, setDados };
}
