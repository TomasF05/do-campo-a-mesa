// Estado global da sessão (utilizador + token)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sessao'));
      if (!s?.utilizador || !['comprador', 'produtor', 'admin'].includes(s.utilizador.papel)) return null;
      return USAR_DADOS_SIMULADOS ? (s.simulada ? s : null) : (s.token && !s.simulada ? s : null);
    } catch { return null; }
  });
  const sessaoAtual = useRef(sessao);
  const [aCarregar, setACarregar] = useState(!USAR_DADOS_SIMULADOS && Boolean(sessao?.token));
  const [tokenValidado, setTokenValidado] = useState(null);

  const guardarSessao = useCallback((nova) => {
    const normalizada = nova ? {
      ...nova, utilizador: { ...nova.utilizador, _id: nova.utilizador._id || nova.utilizador.id }
    } : null;
    if (!normalizada || normalizada.token !== sessaoAtual.current?.token) setTokenValidado(null);
    if (!normalizada) setACarregar(false);
    sessaoAtual.current = normalizada;
    setSessao(normalizada);
    try {
      if (normalizada) localStorage.setItem('sessao', JSON.stringify(normalizada));
      else localStorage.removeItem('sessao');
    } catch { /* sessão em memória */ }
  }, []);

  const sair = useCallback(() => guardarSessao(null), [guardarSessao]);

  const atualizar = useCallback(async () => {
    const atual = sessaoAtual.current;
    if (USAR_DADOS_SIMULADOS || !atual?.token) return;
    try {
      const utilizador = await api('/auth/eu', { token: atual.token });
      if (sessaoAtual.current?.token === atual.token) {
        guardarSessao({ ...atual, utilizador });
        setTokenValidado(atual.token);
      }
    } catch (err) {
      if (err.status === 401 && sessaoAtual.current?.token === atual.token) sair();
    }
  }, [guardarSessao, sair]);

  useEffect(() => {
    let montado = true;
    const expirar = (e) => { if (e.detail?.token === sessaoAtual.current?.token) sair(); };
    window.addEventListener('sessao-expirada', expirar);
    atualizar().finally(() => { if (montado) setACarregar(false); });
    return () => { montado = false; window.removeEventListener('sessao-expirada', expirar); };
  }, [atualizar, sair]);

  useEffect(() => {
    if (USAR_DADOS_SIMULADOS || !sessao?.token || tokenValidado === sessao.token) return undefined;
    // Recupera a validação inicial se a API estava indisponível ao abrir a aplicação.
    const recuperar = () => { atualizar(); };
    window.addEventListener('online', recuperar);
    window.addEventListener('focus', recuperar);
    return () => { window.removeEventListener('online', recuperar); window.removeEventListener('focus', recuperar); };
  }, [sessao?.token, tokenValidado, atualizar]);

  async function entrar(email, password) {
    const nova = await api('/auth/login', { metodo: 'POST', corpo: { email, password } });
    guardarSessao(nova);
    setTokenValidado(nova.token || null);
    setACarregar(false);
    return nova.utilizador;
  }

  return (
    <AuthContext.Provider value={{
      utilizador: sessao?.utilizador || null,
      token: sessao?.token || null,
      entrar, sair, guardarSessao, atualizar, aCarregar,
      sessaoValidada: USAR_DADOS_SIMULADOS ? Boolean(sessao?.utilizador) : Boolean(sessao?.token && tokenValidado === sessao.token)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
