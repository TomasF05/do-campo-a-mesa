// Cliente HTTP da API: junta o URL base e o token JWT a cada pedido
import { pedidoSimulado } from '../data/simulador.js';
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const USAR_DADOS_SIMULADOS = import.meta.env.VITE_USAR_DADOS_SIMULADOS === 'true';

export async function api(caminho, { metodo = 'GET', corpo, token, utilizador, signal } = {}) {
  if (USAR_DADOS_SIMULADOS) {
    return pedidoSimulado(caminho, { metodo, corpo, utilizador });
  }
  const resposta = await fetch(`${API_URL}/api${caminho}`, {
    method: metodo,
    signal,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('sessao-expirada', { detail: { token } }));
    }
    throw Object.assign(new Error(dados?.erro || `Erro ${resposta.status}`), { status: resposta.status, detalhes: dados?.detalhes });
  }
  return dados;
}
