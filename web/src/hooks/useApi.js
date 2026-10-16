import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useApi(caminho) {
  const { token } = useAuth();

  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(true);

  const recarregar = useCallback(async () => {
    if (!caminho) return;

    try {
      const resposta = await api(caminho, { token });

      setDados(resposta);
      setErro('');
    } catch (err) {
      setErro(err.message);
    } finally {
      setACarregar(false);
    }
  }, [caminho, token]);

  useEffect(() => {
    setACarregar(true);
    recarregar();
  }, [recarregar]);

  return { dados, erro, aCarregar, recarregar, setDados };
}