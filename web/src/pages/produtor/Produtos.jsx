import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';
import { CATEGORIAS, EPOCAS } from '../../utils.js';
import CartaoProduto from '../../components/CartaoProduto.jsx';
import EstadoPedido from '../../components/EstadoPedido.jsx';

const VAZIO = { nome: '', categoria: 'Hortícolas', preco: '', stock: '', unidade: 'kg', biologico: false, epocas: EPOCAS };
const SEM_FOTOGRAFIA = { ficheiro: null, erro: '', aValidar: false };
const LIMITE_FOTOGRAFIA = 5 * 1024 * 1024;

async function formatoAceite(ficheiro) {
  const bytes = new Uint8Array(await ficheiro.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return png || jpeg || webp;
}

export default function ProdutosProdutor() {
  const { utilizador, token } = useAuth();
  const { dados, erro, aCarregar, recarregar } = useApi(`/products?produtor=${utilizador._id}`);
  const [form, setForm] = useState(VAZIO);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [selecao, setSelecao] = useState(SEM_FOTOGRAFIA);
  const [previsualizacao, setPrevisualizacao] = useState('');
  const [fotografiaPendente, setFotografiaPendente] = useState(false);
  const inputFotografia = useRef(null);
  const produtoOriginal = useRef(null);
  const { ficheiro } = selecao;
  const imagem = ficheiro ? previsualizacao : form.imagemUrl;

  useEffect(() => {
    if (!ficheiro) { setPrevisualizacao(''); return; }
    const url = URL.createObjectURL(ficheiro);
    setPrevisualizacao(url);
    return () => URL.revokeObjectURL(url);
  }, [ficheiro]);

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function limparSelecao() {
    if (inputFotografia.current) inputFotografia.current.value = '';
    setSelecao(SEM_FOTOGRAFIA);
  }

  function abrirFormulario(produto) {
    limparSelecao();
    produtoOriginal.current = produto._id ? produto : null;
    setForm(produto);
    setFotografiaPendente(false);
    setFalha('');
    setAviso('');
  }

  async function selecionarFotografia(e) {
    const input = e.currentTarget;
    const novo = input.files[0];
    if (!novo) { limparSelecao(); return; }
    setAviso('');
    if (novo.size >= LIMITE_FOTOGRAFIA) {
      setSelecao({ ...SEM_FOTOGRAFIA, erro: 'A fotografia tem de ter menos de 5 MB.' });
      return;
    }
    setSelecao({ ...SEM_FOTOGRAFIA, aValidar: true });
    try {
      const aceite = await formatoAceite(novo);
      if (input.files[0] !== novo) return;
      setSelecao(aceite ? { ...SEM_FOTOGRAFIA, ficheiro: novo } : { ...SEM_FOTOGRAFIA, erro: 'Escolha uma fotografia JPEG, PNG ou WebP.' });
    } catch {
      if (input.files[0] === novo) setSelecao({ ...SEM_FOTOGRAFIA, erro: 'Não foi possível ler a fotografia selecionada.' });
    }
  }

  async function guardar(e, apenasFotografia = false) {
    e.preventDefault();
    if (aGuardar || selecao.aValidar || selecao.erro || (apenasFotografia && !ficheiro)) return;
    setAGuardar(true); setFalha(''); setAviso('');
    let produto = form;
    let dadosGuardados = apenasFotografia;
    let guardouDados = false;
    try {
      if (!apenasFotografia) {
        const { nome, descricao, categoria, preco, stock, unidade, biologico, epocas } = form;
        const dadosProduto = { nome, descricao, categoria, preco: Number(preco), stock: Number(stock), unidade, biologico, epocas };
        const corpo = form._id ? Object.fromEntries(Object.entries(dadosProduto).filter(([campo, valor]) =>
          JSON.stringify(valor) !== JSON.stringify(produtoOriginal.current?.[campo]))) : dadosProduto;
        if (!form._id || Object.keys(corpo).length) {
          produto = await api(form._id ? `/products/${form._id}` : '/products', {
            metodo: form._id ? 'PUT' : 'POST', token, corpo
          });
          if (!produto?._id) throw new Error('Não foi possível confirmar o produto guardado. Consulte a lista antes de voltar a guardar.');
          produtoOriginal.current = produto;
          setForm(produto);
          guardouDados = true;
        }
        dadosGuardados = true;
      }
      if (ficheiro) {
        const corpo = new FormData();
        corpo.append('imagem', ficheiro);
        const resposta = await api(`/products/${produto._id}/imagem`, { metodo: 'POST', token, corpo });
        if (!resposta?.imagemUrl) throw new Error('A API não confirmou a fotografia.');
        if (apenasFotografia) setForm((f) => ({ ...f, imagemUrl: resposta.imagemUrl }));
      }
      limparSelecao();
      setFotografiaPendente(false);
      if (!apenasFotografia) {
        produtoOriginal.current = null;
        setForm(VAZIO);
      }
      setAviso(ficheiro ? (guardouDados ? 'Produto e fotografia guardados.' : 'Fotografia guardada.') : 'Produto guardado.');
    } catch (err) {
      if (dadosGuardados) {
        setFotografiaPendente(true);
        const motivo = err.status ? err.message : 'Verifique a ligação à API e tente novamente.';
        setFalha(`Os dados do produto foram guardados, mas não foi possível confirmar a fotografia. ${motivo}`);
      } else {
        setFalha(err.message);
      }
    } finally {
      if (dadosGuardados) recarregar();
      setAGuardar(false);
    }
  }
  async function remover(p) {
    setFalha('');
    try { await api(`/products/${p._id}`, { metodo: 'DELETE', token }); setAviso(`${p.nome}: removido.`); recarregar(); }
    catch (err) { setFalha(err.message); }
  }
  return <>
    <header className="mb-4"><Link to="/produtor">Voltar ao painel</Link><h1>Os meus produtos</h1></header>
    <EstadoPedido aCarregar={aCarregar} erro={erro} />
    {falha && <p className="alert alert-danger" role="alert">{falha}</p>}
    {aviso && <p role="status">{aviso}</p>}
    <form className="card p-3 mb-4" onSubmit={guardar}>
      <h2 className="h4">{form._id ? 'Editar produto' : 'Novo produto'}</h2>
      <fieldset disabled={aGuardar}>
        <div className="formulario-grelha">
          <div><label className="form-label" htmlFor="produto-nome">Nome</label><input id="produto-nome" className="form-control" value={form.nome} onChange={mudar('nome')} required /></div>
          <div><label className="form-label" htmlFor="produto-categoria">Categoria</label><select id="produto-categoria" className="form-select" value={form.categoria} onChange={mudar('categoria')}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="form-label" htmlFor="produto-preco">Preço (€)</label><input id="produto-preco" type="number" min="0" step="0.01" className="form-control" value={form.preco} onChange={mudar('preco')} required /></div>
          <div><label className="form-label" htmlFor="produto-stock">Stock</label><input id="produto-stock" type="number" min="0" step="1" className="form-control" value={form.stock} onChange={mudar('stock')} required /></div>
          <div><label className="form-label" htmlFor="produto-unidade">Unidade</label><input id="produto-unidade" className="form-control" value={form.unidade} onChange={mudar('unidade')} required /></div>
          <div>
            <label className="form-label" htmlFor="produto-imagem">Fotografia (opcional)</label>
            <input id="produto-imagem" ref={inputFotografia} type="file" className="form-control"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-describedby="produto-imagem-ajuda"
              aria-invalid={Boolean(selecao.erro)} onChange={selecionarFotografia} />
            <p id="produto-imagem-ajuda" className="form-text mb-0">JPEG, PNG ou WebP, com menos de 5 MB.</p>
            {selecao.erro && <p className="small text-danger mb-0" role="alert">{selecao.erro}</p>}
            {imagem && <img src={imagem} className="img-thumbnail mt-2 d-block" style={{ maxHeight: 180 }}
              alt={ficheiro ? 'Pré-visualização da fotografia selecionada' : 'Fotografia atual do produto'} />}
            {(ficheiro || selecao.erro || selecao.aValidar) && <button className="btn btn-sm btn-outline-secondary mt-2"
              type="button" onClick={limparSelecao}>Limpar seleção</button>}
          </div>
        </div>
        <fieldset className="mt-3"><legend className="fs-6">Épocas</legend><div className="d-flex flex-wrap gap-3">{EPOCAS.map((e) => <label key={e}><input className="form-check-input me-1" type="checkbox" checked={form.epocas.includes(e)} onChange={(ev) => setForm((f) => ({ ...f, epocas: ev.target.checked ? [...f.epocas, e] : f.epocas.filter((v) => v !== e) }))} />{e}</label>)}</div></fieldset>
        <label className="my-3"><input type="checkbox" className="form-check-input me-2" checked={form.biologico} onChange={mudar('biologico')} />Produção biológica</label>
        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-success" disabled={selecao.aValidar || Boolean(selecao.erro)}>{aGuardar ? 'A guardar…' : 'Guardar produto'}</button>
          {fotografiaPendente && ficheiro && <button type="button" className="btn btn-outline-primary"
            onClick={(e) => guardar(e, true)}>Tentar novamente a fotografia</button>}
          {form._id && <button type="button" className="btn btn-outline-secondary" onClick={() => abrirFormulario(VAZIO)}>Cancelar edição</button>}
        </div>
      </fieldset>
    </form>
    <section className="grelha-produtos" aria-label="Produtos da exploração">{dados?.map((p) => <div key={p._id} className="d-flex flex-column">
      <CartaoProduto produto={p} className="flex-grow-1" /><p className="small mt-2">Stock: {p.stock} {p.unidade}</p>
      <div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-sm btn-outline-primary" disabled={aGuardar} onClick={() => { abrirFormulario(p); window.scrollTo({ top: 0 }); }}>Editar {p.nome}</button>
        <button type="button" className="btn btn-sm btn-outline-danger" disabled={aGuardar} onClick={() => remover(p)}>Remover {p.nome}</button></div>
    </div>)}</section>
    {!aCarregar && !erro && dados?.length === 0 && <p>Ainda não tem produtos.</p>}
  </>;
}
