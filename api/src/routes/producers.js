// Páginas públicas dos produtores
const router = require('express').Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { a, erro, parametroId, query } = require('../utils/http');

router.param('id', parametroId);

// GET /api/producers?localidade=  -> 200 [produtores validados]
router.get('/', a(async (req, res) => {
  const { localidade } = query(req);
  const filtro = { papel: 'produtor', 'produtor.validado': true };
  if (localidade) filtro['produtor.localidade'] = localidade;
  res.json(await User.find(filtro).select('nome produtor').sort({ nome: 1 }));
}));

// GET /api/producers/:id  -> 200 { produtor, produtos, avaliacaoMedia }
router.get('/:id', a(async (req, res) => {
  const produtor = await User.findOne({ _id: req.params.id, papel: 'produtor', 'produtor.validado': true }).select('nome produtor');
  if (!produtor) throw erro(404, 'Produtor não encontrado');
  const [produtos, avaliacoes, resumo] = await Promise.all([
    Product.find({ produtor: produtor._id }).populate('produtor', 'nome produtor.localidade').sort({ nome: 1 }),
    Review.find({ produtor: produtor._id, visivel: true }).populate('autor', 'nome').sort({ createdAt: -1 }).limit(20),
    Review.aggregate([{ $match: { produtor: produtor._id, visivel: true } }, { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } }])
  ]);
  res.json({ produtor, produtos, avaliacaoMedia: resumo.length ? Number(resumo[0].media.toFixed(2)) : null,
    totalAvaliacoes: resumo[0]?.total || 0,
    avaliacoes: avaliacoes.map((r) => ({ ...r.toObject(), autor: r.autor?.nome || 'Comprador', texto: r.comentario })) });
}));

module.exports = router;
