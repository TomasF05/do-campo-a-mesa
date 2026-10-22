import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import { USAR_DADOS_SIMULADOS } from '../api/client.js';
import contas from '../data/contas.json';

const INICIO = { comprador: '/', produtor: '/produtor', admin: '/admin' };

export default function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dados, setDados] = useState({ email: '', password: '' });
  const [erro, setErro] = useState('');
  const [aEntrar, setAEntrar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setAEntrar(true); setErro('');
    try {
      const u = await entrar(dados.email, dados.password);
      navigate(location.state?.de || INICIO[u.papel] || '/', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Entrar</h1>
      {USAR_DADOS_SIMULADOS && <aside className="alert alert-info" aria-label="Contas de demonstração">
        <p>Use as contas de exemplo do README. Password: <code>password123</code>.</p>
        <div className="d-flex flex-wrap gap-2">{contas.map((u) => <button key={u._id} type="button" className="btn btn-sm btn-outline-primary"
          onClick={() => setDados({ email: u.email, password: 'password123' })}>{u.email}</button>)}</div>
      </aside>}
      <label htmlFor="email" className="form-label">Email</label>
      <input id="email" type="email" autoComplete="username" className="form-control mb-3" required
        value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
      <label htmlFor="password" className="form-label">Password</label>
      <input id="password" type="password" autoComplete="current-password" className="form-control mb-3" required
        value={dados.password} onChange={(e) => setDados({ ...dados, password: e.target.value })} />
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      <button type="submit" className="btn btn-success w-100" disabled={aEntrar}>{aEntrar ? 'A entrar…' : 'Entrar'}</button>
      <p className="mt-3">Ainda não tem conta? <Link to="/registo">Registar</Link></p>
    </form>
  );
}
