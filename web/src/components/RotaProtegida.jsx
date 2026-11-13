// Só deixa passar utilizadores autenticados com um dos papéis indicados
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RotaProtegida({ papeis = [], produtorAprovado = false }) {
  const { utilizador, estadoSessao, atualizar, estadoProdutor } = useAuth();
  const location = useLocation();

  if (estadoSessao === 'a-validar') return <p role="status">A validar sessão…</p>;
  if (estadoSessao === 'indisponivel') return <section className="alert alert-warning">
    <p role="alert">Não foi possível validar a sessão. Verifique a ligação à API e tente novamente.</p>
    <button type="button" className="btn btn-outline-primary" onClick={atualizar}>Tentar novamente</button>
  </section>;
  if (!utilizador) return <Navigate to="/login" state={{ de: location.pathname + location.search + location.hash }} replace />;
  if (papeis.length && !papeis.includes(utilizador.papel)) {
    const inicio = { comprador: '/', produtor: '/produtor', admin: '/admin' };
    return <Navigate to={inicio[utilizador.papel] || '/'} replace />;
  }
  if (produtorAprovado && estadoProdutor !== 'aprovado') return <Navigate to="/produtor" replace />;
  return <Outlet />;
}
