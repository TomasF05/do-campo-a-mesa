import { useEffect, useState } from 'react';

// A âncora vem do servidor; o relógio monotónico não salta se a hora local mudar.
export function agoraServidor(relogio) {
  return relogio ? relogio.servidor + performance.now() - relogio.cliente : Date.now();
}

export function useContagem(ate, relogio = null) {
  const [, atualizar] = useState(0);
  useEffect(() => {
    const tick = () => atualizar((n) => n + 1);
    const timer = setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [ate, relogio]);
  const fim = Date.parse(ate);
  return Number.isFinite(fim) ? Math.max(0, fim - agoraServidor(relogio)) : null;
}

export function formatarTempo(ms) {
  if (ms === null || !Number.isFinite(ms)) return '—';
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor(s % 3600 / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
}
