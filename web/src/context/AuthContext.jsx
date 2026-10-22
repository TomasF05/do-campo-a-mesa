// Estado global da sessão (utilizador + token)
import { createContext, useContext, useState } from 'react';
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

  async function entrar(email, password) {
    const nova = await api('/auth/login', { metodo: 'POST', corpo: { email, password } });
    guardarSessao(nova);
    return nova.utilizador;
  }

  function sair() {
    try { localStorage.removeItem('sessao'); } catch { /* armazenamento indisponível */ }
    setSessao(null);
  }

  function guardarSessao(nova) {
    try { localStorage.setItem('sessao', JSON.stringify(nova)); } catch { /* sessão em memória */ }
    setSessao(nova);
  }

  return (
    <AuthContext.Provider value={{
      utilizador: sessao?.utilizador || null,
      token: sessao?.token || null,
      entrar, sair, guardarSessao
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
