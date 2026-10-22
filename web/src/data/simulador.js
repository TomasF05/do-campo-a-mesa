// Protótipo M1: dados locais. Não fornece autenticação nem consistência de um servidor.
import produtosBase from './produtos.json';
import leiloesBase from './leiloes.json';
import contas from './contas.json';

export const CATEGORIAS = ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
export const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export const euro = (valor) => Number(valor).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
export const totalEncomenda = (e) => e.linhas.reduce((s, l) => s + l.precoUnit * l.quantidade, 0);
export const normalizar = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const produtosIniciais = produtosBase.map((p, i) => ({ ...p,
  stock: [120, 25, 0, 40, 8, 12, 5, 20][i],
  epocas: ['Fruta', 'Outros'].includes(p.categoria) ? ['Outono', 'Inverno'] : EPOCAS
}));
const produtores = [...new Map(produtosBase.map((p) => [p.produtor._id, p.produtor])).values()];
const encomendasIniciais = [
  { _id: 'E001', comprador: contas[3], produtor: produtores[0], estado: 'pronta', entrega: { tipo: 'levantamento' }, linhas: [{ produto: 'p1', nome: 'Kiwi Hayward', precoUnit: 2.4, quantidade: 5 }] },
  { _id: 'E002', comprador: contas[3], produtor: produtores[1], estado: 'pendente', entrega: { tipo: 'entrega', morada: 'Morada de demonstração' }, linhas: [{ produto: 'p2', nome: 'Mel de urze', precoUnit: 7.5, quantidade: 2 }] },
  { _id: 'E003', comprador: contas[3], produtor: produtores[0], estado: 'entregue', entrega: { tipo: 'levantamento' }, linhas: [{ produto: 'p4', nome: 'Abóbora-menina', precoUnit: 1.2, quantidade: 10 }] }
];
const pendentesIniciais = [{ _id: 'prod-pendente', nome: 'Quinta do Vale', produtor: { localidade: 'Valença' } }];
const reviewsIniciais = [{ _id: 'r1', autor: 'Cliente de demonstração', texto: 'Exemplo de avaliação denunciada para revisão.', produtor: 'Horta da Ribeira' }];
const chave = (recurso) => `dcm-demo-v1-${recurso}`;
function ler(recurso, inicial) {
  try { const dados = JSON.parse(localStorage.getItem(chave(recurso))); return Array.isArray(dados) ? dados : structuredClone(inicial); }
  catch { return structuredClone(inicial); }
}
function guardar(recurso, dados) {
  try { localStorage.setItem(chave(recurso), JSON.stringify(dados)); }
  catch { throw new Error('Não foi possível guardar a demonstração neste browser.'); }
  window.dispatchEvent(new Event('dados-simulados-alterados'));
}
function exigir(utilizador, papel) {
  if (!utilizador || (papel && utilizador.papel !== papel)) throw new Error('Sem permissão para esta ação.');
}
const novoId = (prefixo) => `${prefixo}-${crypto.randomUUID()}`;

export async function pedidoSimulado(caminho, { metodo = 'GET', corpo, utilizador } = {}) {
  const url = new URL(caminho, 'http://simulado.local');
  const partes = url.pathname.split('/').filter(Boolean);
  const q = url.searchParams;
  if (url.pathname === '/auth/login' && metodo === 'POST') {
    const conta = contas.find((u) => u.email === corpo.email.trim().toLowerCase());
    if (!conta || corpo.password !== 'password123') throw new Error('Email ou password inválidos.');
    return { utilizador: conta, token: null, simulada: true };
  }
  let produtos = ler('produtos', produtosIniciais);
  const leiloes = ler('leiloes', leiloesBase);
  const encomendas = ler('encomendas', encomendasIniciais);
  if (partes[0] === 'products') {
    if (metodo === 'GET') {
      const texto = normalizar(q.get('q'));
      const lista = produtos.filter((p) =>
        normalizar(`${p.nome} ${p.produtor.nome}`).includes(texto) &&
        (!q.get('produtor') || p.produtor._id === q.get('produtor')) &&
        (!q.get('localidade') || p.produtor.produtor.localidade === q.get('localidade')) &&
        (!q.get('categoria') || q.get('categoria') === 'Todos' || p.categoria === q.get('categoria')) &&
        (!q.get('epoca') || p.epocas.includes(q.get('epoca'))) &&
        (!q.get('precoMax') || p.preco <= Number(q.get('precoMax'))) &&
        (q.get('bio') !== 'true' || p.biologico));
      if (q.get('ordenar') === 'preco-asc') lista.sort((a, b) => a.preco - b.preco);
      else if (q.get('ordenar') === 'preco-desc') lista.sort((a, b) => b.preco - a.preco);
      else lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
      return lista;
    }
    exigir(utilizador, 'produtor');
    if (metodo === 'DELETE') {
      const produto = produtos.find((p) => p._id === partes[1] && p.produtor._id === utilizador._id);
      if (!produto) throw new Error('Produto não encontrado.');
      guardar('produtos', produtos.filter((p) => p._id !== produto._id)); return null;
    }
    if (!corpo.nome?.trim() || !CATEGORIAS.includes(corpo.categoria) || !Number.isFinite(corpo.preco) || corpo.preco < 0 || !Number.isInteger(corpo.stock) || corpo.stock < 0) throw new Error('Verifique o nome, categoria, preço e stock.');
    const existente = produtos.find((p) => p._id === partes[1]);
    if (metodo === 'PUT' && (!existente || existente.produtor._id !== utilizador._id)) throw new Error('Produto não encontrado.');
    const produto = { ...corpo, _id: existente?._id || novoId('p'), produtor: produtores.find((p) => p._id === utilizador._id) };
    produtos = existente ? produtos.map((p) => p._id === existente._id ? produto : p) : [...produtos, produto];
    guardar('produtos', produtos); return produto;
  }
  if (partes[0] === 'producers' && metodo === 'GET') {
    if (!partes[1]) return produtores;
    const produtor = produtores.find((p) => p._id === partes[1]);
    if (!produtor) throw new Error('Produtor não encontrado.');
    return { produtor: { ...produtor, produtor: { ...produtor.produtor, descricao: `Produção local de ${produtor.produtor.localidade}. Produtos da época preparados com cuidado e proximidade.`, validado: true } },
      produtos: produtos.filter((p) => p.produtor._id === produtor._id), avaliacaoMedia: 4.8,
      avaliacoes: [{ _id: 'exemplo', autor: 'Cliente de demonstração', classificacao: 5, texto: 'Produtos frescos e atendimento cuidado.' }] };
  }
  if (partes[0] === 'auctions') {
    if (metodo === 'GET') {
      if (!partes[1]) return leiloes;
      const leilao = leiloes.find((l) => l._id === partes[1]);
      if (!leilao) throw new Error('Leilão não encontrado.');
      return leilao;
    }
    if (partes[2] === 'bids') {
      exigir(utilizador, 'comprador');
      const leilao = leiloes.find((l) => l._id === partes[1]);
      if (!leilao || leilao.estado !== 'ativo' || Date.parse(leilao.terminaEm) <= Date.now()) throw new Error('O leilão não está ativo.');
      const minimo = Number(((leilao.licitacaoAtual?.valor ?? leilao.precoBase) + leilao.incremento).toFixed(2));
      if (!Number.isFinite(corpo.valor) || corpo.valor < minimo) throw new Error(`O valor mínimo é ${euro(minimo)}.`);
      const bid = { valor: corpo.valor, comprador: utilizador.nome, data: new Date().toISOString() };
      leilao.licitacaoAtual = bid; leilao.historico = [bid, ...(leilao.historico || [])];
      guardar('leiloes', leiloes); return leilao;
    }
    exigir(utilizador, 'produtor');
    if (!corpo.lote?.trim() || !Number.isFinite(corpo.precoBase) || corpo.precoBase < 0 || !Number.isFinite(corpo.incremento) || corpo.incremento < 0.01 || !Number.isFinite(Date.parse(corpo.iniciaEm)) || Date.parse(corpo.terminaEm) <= Date.parse(corpo.iniciaEm)) throw new Error('Verifique os dados do leilão.');
    const leilao = { ...corpo, _id: novoId('l'), produtor: produtores.find((p) => p._id === utilizador._id), estado: Date.parse(corpo.iniciaEm) > Date.now() ? 'agendado' : 'ativo', licitacaoAtual: { valor: corpo.precoBase } };
    guardar('leiloes', [...leiloes, leilao]); return leilao;
  }
  if (partes[0] === 'orders') {
    exigir(utilizador);
    if (metodo === 'GET') return encomendas.filter((e) => utilizador.papel === 'produtor' ? e.produtor._id === utilizador._id : e.comprador._id === utilizador._id);
    if (metodo === 'PATCH') {
      exigir(utilizador, 'produtor');
      const e = encomendas.find((e) => e._id === partes[1] && e.produtor._id === utilizador._id);
      const estados = ['pendente', 'confirmada', 'pronta', 'entregue'];
      if (!e || estados.indexOf(corpo.estado) !== estados.indexOf(e.estado) + 1) throw new Error('Mudança de estado inválida.');
      e.estado = corpo.estado; guardar('encomendas', encomendas); return e;
    }
    exigir(utilizador, 'comprador');
    if (!corpo.linhas?.length || !['levantamento', 'entrega'].includes(corpo.entrega?.tipo) || (corpo.entrega.tipo === 'entrega' && !corpo.entrega.morada?.trim())) throw new Error('Verifique os artigos e os dados de entrega.');
    const grupos = new Map();
    for (const linha of corpo.linhas) {
      const p = produtos.find((p) => p._id === linha.produto);
      if (!p || !Number.isInteger(linha.quantidade) || linha.quantidade < 1 || linha.quantidade > p.stock) throw new Error('Um dos artigos já não tem stock suficiente.');
      p.stock -= linha.quantidade;
      if (!grupos.has(p.produtor._id)) grupos.set(p.produtor._id, { _id: novoId('E'), comprador: utilizador, produtor: p.produtor, estado: 'pendente', entrega: corpo.entrega, linhas: [] });
      grupos.get(p.produtor._id).linhas.push({ produto: p._id, nome: p.nome, precoUnit: p.preco, quantidade: linha.quantidade });
    }
    const novas = [...grupos.values()];
    guardar('produtos', produtos); guardar('encomendas', [...novas, ...encomendas]); return novas;
  }
  if (partes[0] === 'admin') {
    exigir(utilizador, 'admin');
    if (partes[1] === 'estatisticas') return { utilizadores: contas.length + produtores.length - 2, produtores: produtores.length, encomendasHoje: encomendas.length, leiloesAtivos: leiloes.filter((l) => l.estado === 'ativo').length };
    const recurso = partes[1] === 'produtores' ? 'pendentes' : 'reviews';
    const lista = ler(recurso, recurso === 'pendentes' ? pendentesIniciais : reviewsIniciais);
    if (metodo === 'GET') return lista;
    guardar(recurso, lista.filter((p) => p._id !== partes[2])); return null;
  }
  throw new Error('Esta operação ainda não está disponível na demonstração.');
}
