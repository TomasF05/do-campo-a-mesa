import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';
import { CATEGORIAS, EPOCAS } from '../../data/simulador.js';
import CartaoProduto from '../../components/CartaoProduto.jsx';
import EstadoPedido from '../../components/EstadoPedido.jsx';

const VAZIO = { nome: '', categoria: 'Hortícolas', preco: '', stock: '', unidade: 'kg', biologico: false, epocas: EPOCAS, imagemUrl: '' };
export default function ProdutosProdutor() {
  const { utilizador, token } = useAuth();
  const { dados, erro, aCarregar, recarregar } = useApi(`/products?produtor=${utilizador._id}`);
  const [form, setForm] = useState(VAZIO);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function guardar(e) {
    e.preventDefault(); setAGuardar(true); setFalha('');
    try {
      await api(form._id ? `/products/${form._id}` : '/products', { metodo: form._id ? 'PUT' : 'POST', token, utilizador, corpo: { ...form, preco: Number(form.preco), stock: Number(form.stock) } });
      setForm(VAZIO); setAviso('Produto guardado.'); recarregar();
    } catch (err) { setFalha(err.message); } finally { setAGuardar(false); }
  }
  async function remover(p) {
    setFalha('');
    try { await api(`/products/${p._id}`, { metodo: 'DELETE', token, utilizador }); setAviso(`${p.nome}: removido.`); recarregar(); }
    catch (err) { setFalha(err.message); }
  }
  return <>
    <header className="mb-4"><Link to="/produtor">Voltar ao painel</Link><h1>Os meus produtos</h1></header>
    <EstadoPedido aCarregar={aCarregar} erro={falha || erro} /><p role="status">{aviso}</p>
    <form className="card p-3 mb-4" onSubmit={guardar}>
      <h2 className="h4">{form._id ? 'Editar produto' : 'Novo produto'}</h2>
      <div className="formulario-grelha">
        <div><label className="form-label" htmlFor="produto-nome">Nome</label><input id="produto-nome" className="form-control" value={form.nome} onChange={mudar('nome')} required /></div>
        <div><label className="form-label" htmlFor="produto-categoria">Categoria</label><select id="produto-categoria" className="form-select" value={form.categoria} onChange={mudar('categoria')}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="form-label" htmlFor="produto-preco">Preço (€)</label><input id="produto-preco" type="number" min="0" step="0.01" className="form-control" value={form.preco} onChange={mudar('preco')} required /></div>
        <div><label className="form-label" htmlFor="produto-stock">Stock</label><input id="produto-stock" type="number" min="0" step="1" className="form-control" value={form.stock} onChange={mudar('stock')} required /></div>
        <div><label className="form-label" htmlFor="produto-unidade">Unidade</label><input id="produto-unidade" className="form-control" value={form.unidade} onChange={mudar('unidade')} required /></div>
        <div><label className="form-label" htmlFor="produto-imagem">URL da imagem (opcional)</label><input id="produto-imagem" type="url" className="form-control" value={form.imagemUrl} onChange={mudar('imagemUrl')} /></div>
      </div>
      <fieldset className="mt-3"><legend className="fs-6">Épocas</legend><div className="d-flex flex-wrap gap-3">{EPOCAS.map((e) => <label key={e}><input className="form-check-input me-1" type="checkbox" checked={form.epocas.includes(e)} onChange={(ev) => setForm((f) => ({ ...f, epocas: ev.target.checked ? [...f.epocas, e] : f.epocas.filter((v) => v !== e) }))} />{e}</label>)}</div></fieldset>
      <label className="my-3"><input type="checkbox" className="form-check-input me-2" checked={form.biologico} onChange={mudar('biologico')} />Produção biológica</label>
      <div className="d-flex gap-2"><button type="submit" className="btn btn-success" disabled={aGuardar}>Guardar produto</button>{form._id && <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(VAZIO)}>Cancelar edição</button>}</div>
    </form>
    <section className="grelha-produtos" aria-label="Produtos da exploração">{dados?.map((p) => <div key={p._id} className="d-flex flex-column">
      <CartaoProduto produto={p} className="flex-grow-1" /><p className="small mt-2">Stock: {p.stock} {p.unidade}</p>
      <div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setForm(p); window.scrollTo({ top: 0 }); }}>Editar {p.nome}</button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remover(p)}>Remover {p.nome}</button></div>
    </div>)}</section>
    {!aCarregar && !erro && dados?.length === 0 && <p>Ainda não tem produtos.</p>}
  </>;
}
