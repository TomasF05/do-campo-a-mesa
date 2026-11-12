import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { api } from '../api/client.js';

export default function FinalizarCarrinho() {
  const { token } = useAuth();
  const { linhas, esvaziar } = useCarrinho();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const tentativa = useRef(null);
  async function submeter(e) {
    e.preventDefault(); setAEnviar(true); setErro('');
    try {
      const corpo = { linhas: linhas.map((l) => ({ produto: l.produto._id, quantidade: l.quantidade })), entrega: { tipo, morada: tipo === 'entrega' ? morada : '' } };
      const assinatura = JSON.stringify(corpo);
      if (tentativa.current?.assinatura !== assinatura) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const chave = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        tentativa.current = { assinatura, chave };
      }
      await api('/orders', { metodo: 'POST', token, corpo, chaveIdempotencia: tentativa.current.chave });
      tentativa.current = null;
      esvaziar(); navigate('/encomendas');
    } catch (err) {
      setErro(!err.status || err.status >= 500
        ? 'Não foi possível confirmar a encomenda. Consulte as suas encomendas antes de tentar novamente.'
        : err.message);
    } finally { setAEnviar(false); }
  }
  if (!linhas.length) return null;
  return <form className="card p-3 formulario-estreito" onSubmit={submeter}>
    <h2 className="h4">Receber os produtos</h2>
    <label htmlFor="entrega-tipo" className="form-label">Modo de receção</label><select id="entrega-tipo" className="form-select mb-3" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="levantamento">Levantamento no produtor</option><option value="entrega">Entrega</option></select>
    {tipo === 'entrega' && <><label htmlFor="morada" className="form-label">Morada de entrega</label><textarea id="morada" className="form-control mb-3" value={morada} onChange={(e) => setMorada(e.target.value)} required /></>}
    <p className="small texto-secundario">Os artigos são agrupados numa encomenda por produtor.</p>
    {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
    <button className="btn btn-success" disabled={aEnviar} type="submit">{aEnviar ? 'A enviar…' : 'Confirmar encomenda'}</button>
  </form>;
}
