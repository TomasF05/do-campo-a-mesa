// Encomendas
const { createHash } = require('node:crypto');
const router = require('express').Router();
const auth = require('../middleware/auth');
const Checkout = require('../models/Checkout');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { notificar } = require('../services/notificacoes');
const { a, erro, id, parametroId, campos } = require('../utils/http');

router.param('id', parametroId);
const POPULATE = [
  { path: 'produtor', select: 'nome produtor.localidade' },
  { path: 'comprador', select: 'nome' }
];
const doUtilizador = (u) => u.papel === 'produtor' ? { produtor: u.id } : { comprador: u.id };

async function repetirCheckout(registo, assinatura, session = null) {
  if (registo.assinatura !== assinatura) throw erro(409, 'Esta chave de checkout já foi utilizada com outros dados');
  const encomendas = await Order.find({ _id: { $in: registo.encomendas } }).session(session);
  const porId = new Map(encomendas.map((e) => [e.id, e]));
  return { encomendas: registo.encomendas.map((id) => porId.get(id.toString())), novo: false };
}

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
    const produto = id(linha.produto).toLowerCase();
    if (!Number.isSafeInteger(linha.quantidade) || linha.quantidade < 1) throw erro(400, 'Quantidade inválida');
    const q = (quantidades.get(produto) || 0) + linha.quantidade;
    if (!Number.isSafeInteger(q)) throw erro(400, 'Quantidade inválida');
    quantidades.set(produto, q);
  }
  const chave = req.get('Idempotency-Key');
  if (chave !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(chave)) throw erro(400, 'Chave de checkout inválida');
  const checkoutId = chave && `${req.user.id}:${chave}`;
  const assinatura = checkoutId && createHash('sha256')
    .update(JSON.stringify([[...quantidades].sort(), entrega.tipo, entrega.morada])).digest('hex');

  let resultado;
  try {
    resultado = await Order.db.transaction(async (session) => {
      if (checkoutId) {
        const registo = await Checkout.findById(checkoutId).session(session).lean();
        if (registo) return repetirCheckout(registo, assinatura, session);
        await Checkout.create([{ _id: checkoutId, assinatura }], { session });
      }
      const produtores = await User.find({ papel: 'produtor', 'produtor.validado': true }).distinct('_id').session(session);
      const porProdutor = new Map();
      for (const [produto, q] of quantidades) {
        const p = await Product.findOneAndUpdate(
          { _id: produto, produtor: { $in: produtores }, stock: { $gte: q } },
          { $inc: { stock: -q } }, { new: true, session }
        );
        if (!p) {
          const existe = await Product.findOne({ _id: produto, produtor: { $in: produtores } }).select('nome').session(session);
          throw erro(existe ? 409 : 404, existe ? `Stock insuficiente: ${existe.nome}` : 'Produto não encontrado');
        }
        const produtor = p.produtor.toString();
        if (!porProdutor.has(produtor)) porProdutor.set(produtor, []);
        porProdutor.get(produtor).push({ produto: p._id, nome: p.nome, precoUnit: p.preco, unidade: p.unidade, quantidade: q });
      }
      const novas = [...porProdutor].map(([produtor, linhas]) => ({ comprador: req.user.id, produtor, linhas, entrega }));
      const encomendas = await Order.insertMany(novas, { session });
      if (checkoutId) {
        await Checkout.updateOne({ _id: checkoutId }, { $set: { encomendas: encomendas.map((e) => e._id) } }, { session });
      }
      return { encomendas, novo: true };
    }, {
      readPreference: 'primary', readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }, timeoutMS: 15000
    });
  } catch (err) {
    // Outra transação pode ter confirmado esta chave entretanto.
    if (!checkoutId || err.code !== 11000) throw err;
    const registo = await Checkout.findById(checkoutId).readConcern('majority').lean();
    if (!registo) throw err;
    resultado = await repetirCheckout(registo, assinatura);
  }

  // A transação pode repetir o callback ou o commit. Só notifica após a confirmação.
  if (resultado.novo) {
    const io = req.app.get('io');
    for (const e of resultado.encomendas) notificar(io, `user:${e.produtor}`, 'nova-encomenda', { id: e._id, total: e.total });
    notificar(io, `user:${req.user.id}`, 'painel-atualizado', { recurso: 'encomendas' });
    notificar(io, 'admin', 'painel-atualizado', { recurso: 'encomendas' });
  }
  res.status(201).location('/api/orders').json(resultado.encomendas);
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
  notificar(req.app.get('io'), `user:${o.comprador}`, 'encomenda-atualizada', { id: o._id, estado: o.estado, produtor: req.user.nome });
  notificar(req.app.get('io'), `user:${o.produtor}`, 'painel-atualizado', { recurso: 'encomendas' });
  res.json(o);
}));

module.exports = router;
