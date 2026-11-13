const router = require('express').Router();
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { notificar } = require('../services/notificacoes');
const { a, erro, id, parametroId, campos, query } = require('../utils/http');

router.param('id', parametroId);
const comprador = auth('comprador');

// POST /api/reviews  (comprador, só após encomenda entregue)  -> 201
router.post('/', comprador, a(async (req, res) => {
  const dados = campos(req.body, ['encomenda', 'produto', 'classificacao', 'comentario']);
  id(dados.encomenda);
  if (dados.produto !== undefined) id(dados.produto);
  if (!Number.isInteger(dados.classificacao) || dados.classificacao < 1 || dados.classificacao > 5) throw erro(400, 'Classificação inválida (1 a 5)');
  if (dados.comentario !== undefined && typeof dados.comentario !== 'string') throw erro(400, 'Comentário inválido');
  const encomenda = await Order.findOne({ _id: dados.encomenda, comprador: req.user.id });
  if (!encomenda) throw erro(404, 'Encomenda não encontrada');
  if (encomenda.estado !== 'entregue') throw erro(409, 'Só pode avaliar uma encomenda entregue');
  if (dados.produto && !encomenda.linhas.some((l) => l.produto?.toString() === dados.produto.toLowerCase())) throw erro(400, 'O produto não pertence à encomenda');
  const chave = { autor: req.user.id, encomenda: encomenda._id, produto: dados.produto || null };
  if (await Review.exists(chave)) throw erro(409, 'Esta encomenda ou produto já foi avaliado');
  const avaliacao = await Review.create({ ...dados, ...chave, produtor: encomenda.produtor });
  res.status(201).json(avaliacao);
}));

// A consulta privada inclui as avaliações ocultadas para preservar a elegibilidade.
router.get('/', (req, res, next) => req.query.minhas === 'true' ? comprador(req, res, next) : next(), a(async (req, res) => {
  const { produtor, produto, minhas } = query(req);
  if (minhas === 'true') {
    res.set('Cache-Control', 'private, no-store');
    return res.json(await Review.find({ autor: req.user.id }).select('encomenda produto').lean());
  }
  const filtro = { visivel: true };
  if (produtor) filtro.produtor = id(produtor);
  if (produto) filtro.produto = id(produto);
  res.json(await Review.find(filtro).populate('autor', 'nome').populate('produtor', 'nome').populate('produto', 'nome').sort({ createdAt: -1 }));
}));

// POST /api/reviews/:id/denuncia  -> 204
router.post('/:id/denuncia', auth(), a(async (req, res) => {
  const visivel = { _id: req.params.id, visivel: true };
  // A condição e as duas escritas são atómicas no mesmo documento.
  const resultado = await Review.updateOne({ ...visivel, denunciantes: { $ne: req.user.id } }, {
    $addToSet: { denunciantes: req.user.id }, $inc: { denuncias: 1 }
  });
  if (resultado.modifiedCount) notificar(req.app.get('io'), 'admin', 'painel-atualizado', { recurso: 'avaliacoes' });
  else if (!await Review.exists(visivel)) throw erro(404, 'Avaliação não encontrada');
  res.status(204).end();
}));

module.exports = router;
