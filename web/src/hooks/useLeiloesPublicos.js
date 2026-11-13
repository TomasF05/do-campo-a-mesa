import { useApiVisivel } from './useApiVisivel.js';

const EVENTOS_LEILOES = {
  'painel-atualizado': (e) => e?.recurso === 'leiloes',
  'leilao-ganho': () => true,
  'leilao-terminado': () => true
};

export function useLeiloesPublicos({ produtor, avisarFalha = false } = {}) {
  const caminho = produtor ? `/auctions?produtor=${encodeURIComponent(produtor)}` : '/auctions';
  const consulta = useApiVisivel(caminho, { intervalo: 5000, eventos: EVENTOS_LEILOES });
  // As páginas públicas continuam a mostrar a última lista em falhas temporárias.
  return !avisarFalha && consulta.dados ? { ...consulta, erro: '' } : consulta;
}
