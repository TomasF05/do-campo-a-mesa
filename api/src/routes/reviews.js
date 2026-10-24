const router = require('express').Router();
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { a, erro, id, parametroId, campos, query } = require('../utils/http');

router.param('id', parametroId);

// POST /api/reviews  (comprador, só após encomenda entregue)  -> 201
router.post('/', auth('comprador'), a(async (req, res) => {
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

// GET /api/reviews?produtor=&produto=  -> 200 [avaliações visíveis]
router.get('/', a(async (req, res) => {
  const { produtor, produto } = query(req);
  const filtro = { visivel: true };
  if (produtor) filtro.produtor = id(produtor);
  if (produto) filtro.produto = id(produto);
  res.json(await Review.find(filtro).populate('autor', 'nome').populate('produtor', 'nome').populate('produto', 'nome').sort({ createdAt: -1 }));
}));

// POST /api/reviews/:id/denuncia  -> 204
router.post('/:id/denuncia', auth(), a(async (req, res) => {
  const r = await Review.findOneAndUpdate({ _id: req.params.id, visivel: true }, { $inc: { denuncias: 1 } });
  if (!r) throw erro(404, 'Avaliação não encontrada');
  res.status(204).end();
}));

module.exports = router;
