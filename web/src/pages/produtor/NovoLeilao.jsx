// Produtor: criar leilão
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';
import EstadoPedido from '../../components/EstadoPedido.jsx';

export default function NovoLeilao() {
  const { utilizador, token } = useAuth();
  const navigate = useNavigate();
  const produtos = useApi(`/products?produtor=${utilizador._id}`);
  const [dados, setDados] = useState({ produto: '', lote: '', descricao: '', quantidade: '', precoBase: '', incremento: '5', duracao: '30', iniciaEm: '' });
  const [erro, setErro] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const mudar = (campo) => (e) => setDados((d) => ({ ...d, [campo]: e.target.value }));
  async function submeter(e) {
    e.preventDefault(); setErro(''); setAGuardar(true);
    try {
      const inicio = dados.iniciaEm ? new Date(dados.iniciaEm) : new Date();
      const leilao = await api('/auctions', { metodo: 'POST', token, utilizador, corpo: { ...dados, precoBase: Number(dados.precoBase), incremento: Number(dados.incremento), iniciaEm: inicio.toISOString(), terminaEm: new Date(inicio.getTime() + Number(dados.duracao) * 60000).toISOString() } });
      navigate(`/leiloes/${leilao._id}`);
    } catch (err) { setErro(err.message); } finally { setAGuardar(false); }
  }
  return (
    <div className="formulario-estreito">
      <h1>Criar leilão</h1>
      <Link to="/produtor">Voltar ao painel</Link>
      <EstadoPedido aCarregar={produtos.aCarregar} erro={erro || produtos.erro} />
      <form className="card p-3 mt-3" onSubmit={submeter}>
        <label className="form-label" htmlFor="leilao-produto">Produto</label><select id="leilao-produto" className="form-select mb-3" value={dados.produto} onChange={mudar('produto')} required><option value="">Escolha um produto</option>{produtos.dados?.map((p) => <option key={p._id} value={p._id}>{p.nome}</option>)}</select>
        <label className="form-label" htmlFor="lote">Nome do lote</label><input id="lote" className="form-control mb-3" value={dados.lote} onChange={mudar('lote')} required />
        <label className="form-label" htmlFor="descricao">Descrição</label><textarea id="descricao" className="form-control mb-3" value={dados.descricao} onChange={mudar('descricao')} />
        <label className="form-label" htmlFor="quantidade">Quantidade e unidade</label><input id="quantidade" className="form-control mb-3" placeholder="Ex.: 20 caixas de 10 kg" value={dados.quantidade} onChange={mudar('quantidade')} required />
        <div className="formulario-grelha">{[['precoBase','Preço base (€)','0','0.01'],['incremento','Incremento mínimo (€)','0.01','0.01'],['duracao','Duração (minutos)','1','1']].map(([campo,label,min,step]) => <div key={campo}><label className="form-label" htmlFor={campo}>{label}</label><input id={campo} type="number" min={min} step={step} className="form-control" value={dados[campo]} onChange={mudar(campo)} required /></div>)}</div>
        <label className="form-label mt-3" htmlFor="inicio">Início (vazio para começar agora)</label><input id="inicio" type="datetime-local" className="form-control mb-3" value={dados.iniciaEm} onChange={mudar('iniciaEm')} />
        <button className="btn btn-success" type="submit" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Criar leilão'}</button>
      </form>
    </div>
  );
}
