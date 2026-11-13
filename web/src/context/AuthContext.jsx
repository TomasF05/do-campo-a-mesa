// Estado global da sessão (utilizador + token)
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);
const PRAZO_VALIDACAO_MS = 10000;

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('sessao'));
      if (!s?.utilizador || !['comprador', 'produtor', 'admin'].includes(s.utilizador.papel)) return null;
      return s.token ? s : null;
    } catch { return null; }
  });
  const sessaoAtual = useRef(sessao);
  const pedidoValidacao = useRef(null);
  const [tokenValidado, setTokenValidado] = useState(null);
  const [tokenComFalha, setTokenComFalha] = useState(null);

  const guardarSessao = useCallback((nova) => {
    const normalizada = nova ? {
      ...nova, utilizador: { ...nova.utilizador, _id: nova.utilizador._id || nova.utilizador.id }
    } : null;
    if (!normalizada || normalizada.token !== sessaoAtual.current?.token) {
      pedidoValidacao.current?.abort();
      pedidoValidacao.current = null;
      setTokenValidado(null);
      setTokenComFalha(null);
    }
    sessaoAtual.current = normalizada;
    setSessao(normalizada);
    try {
      if (normalizada) localStorage.setItem('sessao', JSON.stringify(normalizada));
      else localStorage.removeItem('sessao');
    } catch { /* sessão em memória */ }
  }, []);

  const sair = useCallback(() => guardarSessao(null), [guardarSessao]);

  const atualizar = useCallback(async ({ substituir = false } = {}) => {
    const atual = sessaoAtual.current;
    if (!atual?.token || (pedidoValidacao.current && !substituir)) return;
    pedidoValidacao.current?.abort();
    const controlador = new AbortController();
    pedidoValidacao.current = controlador;
    setTokenComFalha(null);
    const prazo = setTimeout(() => controlador.abort(), PRAZO_VALIDACAO_MS);
    try {
      const utilizador = await api('/auth/eu', { token: atual.token, signal: controlador.signal });
      if (pedidoValidacao.current !== controlador) return;
      controlador.signal.throwIfAborted();
      if (!(utilizador?.id || utilizador?._id)) throw new Error('Resposta de sessão inválida');
      guardarSessao({ ...atual, utilizador });
      setTokenValidado(atual.token);
    } catch (err) {
      if (pedidoValidacao.current !== controlador) return;
      if (err.status === 401) sair();
      else setTokenComFalha(atual.token);
    } finally {
      clearTimeout(prazo);
      if (pedidoValidacao.current === controlador) pedidoValidacao.current = null;
    }
  }, [guardarSessao, sair]);

  useEffect(() => {
    const expirar = (e) => { if (e.detail?.token === sessaoAtual.current?.token) sair(); };
    window.addEventListener('sessao-expirada', expirar);
    const inicio = setTimeout(atualizar, 0);
    return () => {
      clearTimeout(inicio);
      window.removeEventListener('sessao-expirada', expirar);
      pedidoValidacao.current?.abort();
      pedidoValidacao.current = null;
    };
  }, [atualizar, sair]);

  useEffect(() => {
    if (!sessao?.token || tokenValidado === sessao.token) return undefined;
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
    return nova.utilizador;
  }

  const token = sessao?.token;
  const sessaoValidada = Boolean(token && tokenValidado === token);
  const utilizador = sessaoValidada ? sessao.utilizador : null;
  const estadoSessao = !token ? 'sem-sessao' : sessaoValidada ? 'validada' : tokenComFalha === token ? 'indisponivel' : 'a-validar';
  const produtor = utilizador?.produtor;
  const estadoProdutor = utilizador?.papel === 'produtor'
    ? produtor?.estadoValidacao ?? (produtor?.validado ? 'aprovado' : 'pendente') : null;

  return (
    <AuthContext.Provider value={{
      utilizador, token: sessaoValidada ? token : null,
      entrar, sair, atualizar, aCarregar: estadoSessao === 'a-validar',
      estadoSessao, sessaoValidada, estadoProdutor
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
