// Só deixa passar utilizadores autenticados com um dos papéis indicados
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RotaProtegida({ papeis = [] }) {
  const { utilizador, aCarregar } = useAuth();
  const location = useLocation();

  if (aCarregar) return <p role="status">A validar sessão…</p>;
  if (!utilizador) return <Navigate to="/login" state={{ de: location.pathname + location.search + location.hash }} replace />;
  if (papeis.length && !papeis.includes(utilizador.papel)) {
    const inicio = { comprador: '/', produtor: '/produtor', admin: '/admin' };
    return <Navigate to={inicio[utilizador.papel] || '/'} replace />;
  }
  return <Outlet />;
}
