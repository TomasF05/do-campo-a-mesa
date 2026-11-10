import { Link } from 'react-router-dom';
import { useNotificacoes } from '../hooks/useNotificacoes.js';

export default function Notificacoes() {
  const { notificacoes, fechar } = useNotificacoes();
  if (!notificacoes.length) return null;
  return <aside className="position-fixed bottom-0 end-0 p-3" aria-label="Notificações" style={{ zIndex: 1080, width: '24rem', maxWidth: 'calc(100vw - 2rem)', maxHeight: '100vh', overflowY: 'auto' }}>
    {notificacoes.map((n) => <div key={n.id} className="toast show bg-body mb-2" role="status" aria-live="polite" aria-atomic="true">
      <div className="toast-header"><strong className="me-auto">Do Campo à Mesa</strong><button type="button" className="btn-close" aria-label="Fechar notificação" onClick={() => fechar(n.id)} /></div>
      <div className="toast-body"><p>{n.texto}</p><Link to={n.destino} onClick={() => fechar(n.id)}>Ver detalhes</Link></div>
    </div>)}
  </aside>;
}
