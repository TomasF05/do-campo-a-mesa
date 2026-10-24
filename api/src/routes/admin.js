// Painel do administrador
const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');
const { a, erro, parametroId, campos } = require('../utils/http');

router.use(auth('admin'));
router.param('id', parametroId);

// GET /api/admin/estatisticas  -> 200 { utilizadores, produtores, encomendasHoje, leiloesAtivos }
router.get('/estatisticas', a(async (req, res) => {
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio); fim.setDate(fim.getDate() + 1);
  const [utilizadores, produtores, encomendasHoje, leiloesAtivos] = await Promise.all([
    User.countDocuments(), User.countDocuments({ papel: 'produtor', 'produtor.validado': true }),
    Order.countDocuments({ createdAt: { $gte: inicio, $lt: fim } }),
    Auction.countDocuments({ estado: 'ativo', terminaEm: { $gt: new Date() } })
  ]);
  res.json({ utilizadores, produtores, encomendasHoje, leiloesAtivos });
}));

// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]
router.get('/produtores/pendentes', a(async (req, res) => {
  res.json(await User.find({ papel: 'produtor', 'produtor.validado': false }).select('nome email produtor').sort({ createdAt: 1 }));
}));

// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200
router.patch('/produtores/:id/validacao', a(async (req, res) => {
  const { aprovado } = campos(req.body, ['aprovado']);
  if (typeof aprovado !== 'boolean') throw erro(400, 'Indique aprovado como true ou false');
  const produtor = await User.findOneAndUpdate({ _id: req.params.id, papel: 'produtor' }, { 'produtor.validado': aprovado }, { new: true, runValidators: true }).select('nome email produtor');
  if (!produtor) throw erro(404, 'Produtor não encontrado');
  res.json(produtor);
}));

// GET /api/admin/reviews/denunciadas  -> 200
router.get('/reviews/denunciadas', a(async (req, res) => {
  res.json(await Review.find({ denuncias: { $gt: 0 }, visivel: true }).populate('autor', 'nome').populate('produtor', 'nome').sort({ denuncias: -1 }));
}));

// PATCH /api/admin/reviews/:id  { visivel: false }  -> 200
router.patch('/reviews/:id', a(async (req, res) => {
  const { visivel } = campos(req.body, ['visivel']);
  if (typeof visivel !== 'boolean') throw erro(400, 'Indique visivel como true ou false');
  const review = await Review.findByIdAndUpdate(req.params.id, { visivel }, { new: true, runValidators: true });
  if (!review) throw erro(404, 'Avaliação não encontrada');
  res.json(review);
}));

module.exports = router;
