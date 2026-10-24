// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const auth = require('../middleware/auth');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Product = require('../models/Product');
const produtorValidado = require('../middleware/produtorValidado');
const { a, erro, id, parametroId, campos, query, numero } = require('../utils/http');

router.param('id', parametroId);
const POPULATE = [{ path: 'produtor', select: 'nome produtor.localidade' }, { path: 'produto', select: 'nome unidade imagemUrl' }];
const licitacoes = (leilao, limite) => {
  const pedido = Bid.find({ leilao }).populate('comprador', 'nome').sort({ createdAt: -1, _id: -1 });
  return limite ? pedido.limit(limite) : pedido;
};

// GET /api/auctions?estado=ativo  -> 200 [leilões]
router.get('/', a(async (req, res) => {
  const { estado, produtor } = query(req);
  const filtro = {};
  if (estado) {
    if (!['ativo', 'agendado', 'terminado'].includes(estado)) throw erro(400, 'Estado inválido');
    filtro.estado = estado;
  }
  if (produtor) filtro.produtor = id(produtor);
  res.json(await Auction.find(filtro).populate(POPULATE).sort({ terminaEm: 1, _id: 1 }));
}));

// GET /api/auctions/:id  -> 200 leilão + últimas licitações
router.get('/:id', a(async (req, res) => {
  const leilao = await Auction.findById(req.params.id).populate(POPULATE);
  if (!leilao) throw erro(404, 'Leilão não encontrado');
  const historico = await licitacoes(leilao._id, 20);
  res.json({ ...leilao.toObject(), historico: historico.map((b) => ({ ...b.toObject(), comprador: b.comprador?.nome || 'Comprador', data: b.createdAt })) });
}));

// POST /api/auctions  (produtor)  -> 201
router.post('/', auth('produtor'), produtorValidado, a(async (req, res) => {
  const dados = campos(req.body, ['produto', 'lote', 'quantidade', 'precoBase', 'incremento', 'iniciaEm', 'terminaEm', 'duracao']);
  numero(dados.precoBase, 'Preço base'); numero(dados.incremento, 'Incremento', 0.01);
  if (dados.produto) {
    id(dados.produto);
    if (!await Product.exists({ _id: dados.produto, produtor: req.user.id })) throw erro(404, 'Produto não encontrado');
  }
  const inicio = dados.iniciaEm === undefined ? Date.now() : (typeof dados.iniciaEm === 'string' ? Date.parse(dados.iniciaEm) : NaN);
  let fim = typeof dados.terminaEm === 'string' ? Date.parse(dados.terminaEm) : NaN;
  if (dados.duracao !== undefined) {
    const duracao = typeof dados.duracao === 'number' || (typeof dados.duracao === 'string' && dados.duracao.trim()) ? Number(dados.duracao) : NaN;
    numero(duracao, 'Duração', 1);
    fim = inicio + duracao * 60000;
  }
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio || fim <= Date.now() || !Number.isFinite(new Date(fim).getTime())) throw erro(400, 'Datas do leilão inválidas');
  const leilao = await Auction.create({
    ...campos(dados, ['produto', 'lote', 'quantidade', 'precoBase', 'incremento']),
    produtor: req.user.id, iniciaEm: new Date(inicio), terminaEm: new Date(fim),
    licitacaoAtual: { valor: dados.precoBase }, estado: inicio > Date.now() ? 'agendado' : 'ativo'
  });
  res.status(201).location(`/api/auctions/${leilao._id}`).json(leilao);
}));

// GET /api/auctions/:id/bids  -> 200 [licitações]
router.get('/:id/bids', a(async (req, res) => {
  if (!await Auction.exists({ _id: req.params.id })) throw erro(404, 'Leilão não encontrado');
  res.json(await licitacoes(req.params.id));
}));

module.exports = router;
