// Páginas públicas dos produtores
const router = require('express').Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const { a, erro, parametroId, query, campos } = require('../utils/http');

router.param('id', parametroId);
const sessao = auth();
const CAMPOS_PUBLICOS = ['nome', 'nomeExploracao', 'localidade', 'descricao'];

// GET /api/producers?localidade=  -> 200 [produtores validados]
router.get('/', a(async (req, res) => {
  const { localidade } = query(req);
  const filtro = { papel: 'produtor', 'produtor.validado': true };
  if (localidade) filtro['produtor.localidade'] = localidade;
  res.json(await User.find(filtro).select('nome produtor').sort({ nome: 1 }));
}));

// GET /api/producers/:id  -> 200 { produtor, produtos, avaliacaoMedia }
router.get('/:id', (req, res, next) => req.get('Authorization') ? sessao(req, res, next) : next(), a(async (req, res) => {
  res.vary('Authorization');
  const produtor = await User.findOne({ _id: req.params.id, papel: 'produtor', 'produtor.validado': true }).select('nome produtor');
  if (!produtor) throw erro(404, 'Produtor não encontrado');
  const recentes = Review.find({ produtor: produtor._id, visivel: true }).populate('autor', 'nome').sort({ createdAt: -1 }).limit(20);
  if (req.user) recentes.select('+denunciantes');
  const [produtos, avaliacoes, resumo] = await Promise.all([
    Product.find({ produtor: produtor._id }).populate('produtor', 'nome produtor.localidade').sort({ nome: 1 }),
    recentes,
    Review.aggregate([{ $match: { produtor: produtor._id, visivel: true } }, { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } }])
  ]);
  res.json({ produtor, produtos, avaliacaoMedia: resumo.length ? Number(resumo[0].media.toFixed(2)) : null,
    totalAvaliacoes: resumo[0]?.total || 0,
    avaliacoes: avaliacoes.map((r) => {
      const { denunciantes, ...avaliacao } = r.toObject();
      return { ...avaliacao, autor: r.autor?.nome || 'Comprador', texto: r.comentario,
        ...(req.user && { denunciadaPorMim: denunciantes?.some((id) => id.toString() === req.user.id.toLowerCase()) ?? false }) };
    }) });
}));

router.patch('/:id', auth('produtor'), a(async (req, res) => {
  if (req.params.id.toLowerCase() !== req.user.id.toLowerCase()) throw erro(404, 'Produtor não encontrado');
  const dados = campos(req.body, CAMPOS_PUBLICOS);
  const chaves = Object.keys(dados);
  if (!chaves.length || chaves.length !== Object.keys(req.body).length) throw erro(400, 'Indique apenas os campos públicos do perfil');

  const alteracoes = {};
  for (const [campo, valor] of Object.entries(dados)) {
    if (typeof valor !== 'string' || (campo !== 'descricao' && !valor.trim())) throw erro(400, `Valor inválido para ${campo}`);
    alteracoes[campo === 'nome' ? campo : `produtor.${campo}`] = valor.trim();
  }
  const produtor = await User.findOneAndUpdate({ _id: req.user.id, papel: 'produtor' }, { $set: alteracoes },
    { new: true, runValidators: true });
  if (!produtor) throw erro(404, 'Produtor não encontrado');
  res.json(produtor.publico());
}));

module.exports = router;
