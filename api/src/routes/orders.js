// Encomendas
const router = require('express').Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { a, erro, id, parametroId, campos } = require('../utils/http');

router.param('id', parametroId);
const POPULATE = [
  { path: 'produtor', select: 'nome produtor.localidade' },
  { path: 'comprador', select: 'nome' }
];
const doUtilizador = (u) => u.papel === 'produtor' ? { produtor: u.id } : { comprador: u.id };

// POST /api/orders  (comprador)  -> 201
router.post('/', auth('comprador'), a(async (req, res) => {
  const corpo = campos(req.body, ['linhas', 'entrega']);
  if (!Array.isArray(corpo.linhas) || !corpo.linhas.length) throw erro(400, 'Indique os artigos da encomenda');
  const entrega = corpo.entrega === undefined ? {} : campos(corpo.entrega, ['tipo', 'morada']);
  entrega.tipo = entrega.tipo === undefined ? 'levantamento' : entrega.tipo;
  if (!['levantamento', 'entrega'].includes(entrega.tipo)) throw erro(400, 'Tipo de entrega inválido');
  if (entrega.morada !== undefined && typeof entrega.morada !== 'string') throw erro(400, 'Morada inválida');
  if (entrega.tipo === 'entrega' && !entrega.morada?.trim()) throw erro(400, 'Indique a morada de entrega');
  entrega.morada = entrega.tipo === 'entrega' ? entrega.morada.trim() : '';
  const quantidades = new Map();
  for (const linha of corpo.linhas) {
    campos(linha, ['produto', 'quantidade']);
    id(linha.produto);
    if (!Number.isSafeInteger(linha.quantidade) || linha.quantidade < 1) throw erro(400, 'Quantidade inválida');
    const q = (quantidades.get(linha.produto) || 0) + linha.quantidade;
    if (!Number.isSafeInteger(q)) throw erro(400, 'Quantidade inválida');
    quantidades.set(linha.produto, q);
  }
  const produtores = await User.find({ papel: 'produtor', 'produtor.validado': true }).distinct('_id');
  const reservas = [];
  const novas = [];
  try {
    const porProdutor = new Map();
    for (const [produto, q] of quantidades) {
      const p = await Product.findOneAndUpdate(
        { _id: produto, produtor: { $in: produtores }, stock: { $gte: q } },
        { $inc: { stock: -q } }, { new: true }
      );
      if (!p) {
        const existe = await Product.findOne({ _id: produto, produtor: { $in: produtores } }).select('nome');
        throw erro(existe ? 409 : 404, existe ? `Stock insuficiente: ${existe.nome}` : 'Produto não encontrado');
      }
      reservas.push({ id: p._id, q });
      const chave = p.produtor.toString();
      if (!porProdutor.has(chave)) porProdutor.set(chave, []);
      porProdutor.get(chave).push({ produto: p._id, nome: p.nome, precoUnit: p.preco, unidade: p.unidade, quantidade: q });
    }
    novas.push(...[...porProdutor].map(([produtor, linhas]) => ({
      _id: new mongoose.Types.ObjectId(), comprador: req.user.id, produtor, linhas, entrega
    })));
    const criadas = await Order.insertMany(novas);
    res.status(201).location('/api/orders').json(criadas);
  } catch (err) {
    // Compensação do guia: não deixar encomendas parciais nem stock reservado.
    if (novas.length) await Order.deleteMany({ _id: { $in: novas.map((o) => o._id) } });
    for (const r of reservas) await Product.updateOne({ _id: r.id }, { $inc: { stock: r.q } });
    throw err;
  }
}));

// GET /api/orders  -> 200 [encomendas do utilizador: como comprador ou como produtor]
router.get('/', auth(), a(async (req, res) => {
  const lista = await Order.find(doUtilizador(req.user)).populate(POPULATE).sort({ createdAt: -1 });
  res.json(lista);
}));

// GET /api/orders/:id  -> 200 | 404
router.get('/:id', auth(), a(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, ...doUtilizador(req.user) }).populate(POPULATE);
  if (!o) throw erro(404, 'Encomenda não encontrada');
  res.json(o);
}));

// PATCH /api/orders/:id/estado  (produtor)  -> 200
// TODO (Passo 7): depois de gravar, notificar o comprador em tempo real:
//   req.app.get('io').to(`user:${encomenda.comprador}`)
//     .emit('encomenda-atualizada', { id: encomenda._id, estado: encomenda.estado });
router.patch('/:id/estado', auth('produtor'), a(async (req, res) => {
  const { estado } = campos(req.body, ['estado']);
  const novo = Order.ESTADOS.indexOf(estado);
  if (novo < 0) throw erro(400, 'Estado inválido');
  const o = await Order.findOneAndUpdate(
    { _id: req.params.id, produtor: req.user.id, estado: { $in: Order.ESTADOS.slice(0, novo) } },
    { estado }, { new: true, runValidators: true }
  );
  if (!o) {
    const existe = await Order.exists({ _id: req.params.id, produtor: req.user.id });
    throw erro(existe ? 409 : 404, existe ? 'O estado só pode avançar' : 'Encomenda não encontrada');
  }
  res.json(o);
}));

module.exports = router;
