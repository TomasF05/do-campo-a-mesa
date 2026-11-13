// Passo 3: recurso /api/products
const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const produtorValidado = require('../middleware/produtorValidado');
const { guardarImagem, removerOrfa } = require('../services/imagens');
const { a, erro, id, parametroId, campos, query, numero, escaparRegex } = require('../utils/http');

// Multer 2 aceita o tamanho exato do limite. Preservar o contrato de menos de 5 MiB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 - 1 } });
const CAMPOS = ['nome', 'descricao', 'categoria', 'preco', 'unidade', 'stock', 'biologico', 'epocas'];
const POPULATE = 'nome produtor.localidade produtor.nomeExploracao';
const ORDENACAO = {
  nome: { nome: 1, _id: 1 }, recentes: { createdAt: -1, _id: -1 },
  preco_asc: { preco: 1, _id: 1 }, 'preco-asc': { preco: 1, _id: 1 },
  preco_desc: { preco: -1, _id: 1 }, 'preco-desc': { preco: -1, _id: 1 }
};
router.param('id', parametroId);

function validarPreco(valor, campo) {
  numero(valor, campo);
  const texto = String(valor);
  const [euros, fracao = ''] = texto.split('.');
  const casas = fracao.padEnd(2, '0');
  if (!/^\d+(\.\d{1,2})?$/.test(texto) || !Number.isSafeInteger(Number(euros + casas)) || valor.toFixed(2) !== `${euros}.${casas}`) {
    throw erro(400, `${campo} deve ser representável em cêntimos, com no máximo duas casas decimais`);
  }
  return valor;
}

function dadosProduto(corpo) {
  const dados = campos(corpo, CAMPOS);
  if (!Object.keys(dados).length) throw erro(400, 'Indique os dados do produto');
  if (dados.preco !== undefined) validarPreco(dados.preco, 'Preço');
  if (dados.stock !== undefined) numero(dados.stock, 'Stock');
  if (dados.biologico !== undefined && typeof dados.biologico !== 'boolean') throw erro(400, 'Modo biológico inválido');
  return dados;
}

// GET /api/products?q=&categoria=&precoMax=&bio=&epoca=  -> 200 [produtos]
router.get('/', a(async (req, res) => {
  const { q, categoria, precoMax, bio, epoca, produtor, localidade, ordenar } = query(req);
  if (produtor) id(produtor);
  if (bio !== undefined && !['true', 'false'].includes(bio)) throw erro(400, 'Filtro biológico inválido');
  if (ordenar && !Object.hasOwn(ORDENACAO, ordenar)) throw erro(400, 'Ordenação inválida');
  let limitePreco;
  if (precoMax !== undefined && precoMax !== '') {
    const texto = precoMax.trim();
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(texto)) throw erro(400, 'Preço máximo inválido. Use até duas casas decimais');
    limitePreco = validarPreco(Number(texto), 'Preço máximo');
  }
  const filtroProdutores = { papel: 'produtor', 'produtor.validado': true };
  if (localidade) filtroProdutores['produtor.localidade'] = localidade;
  const produtores = await User.find(filtroProdutores).select('_id nome');
  const ids = produtores.map((p) => p._id);
  if (produtor && !ids.some((p) => p.toString() === produtor.toLowerCase())) return res.json([]);
  const filtro = { produtor: produtor || { $in: ids } };
  if (q) {
    const regex = new RegExp(escaparRegex(q.trim()), 'i');
    filtro.$or = [{ nome: regex }, { descricao: regex }, { produtor: { $in: produtores.filter((p) => regex.test(p.nome)).map((p) => p._id) } }];
  }
  if (categoria && categoria !== 'Todos') filtro.categoria = categoria;
  if (limitePreco !== undefined) filtro.preco = { $lte: limitePreco };
  if (bio === 'true') filtro.biologico = true;
  if (epoca) filtro.epocas = { $in: [epoca] };
  res.json(await Product.find(filtro).sort(ORDENACAO[ordenar] || ORDENACAO.recentes).populate('produtor', POPULATE));
}));

// GET /api/products/:id  -> 200 | 404
router.get('/:id', a(async (req, res) => {
  const p = await Product.findById(req.params.id).populate('produtor', `${POPULATE} produtor.validado`);
  if (!p || !p.produtor?.produtor?.validado) throw erro(404, 'Produto não encontrado');
  res.json(p);
}));

// POST /api/products  (produtor)  -> 201 + Location
router.post('/', auth('produtor'), produtorValidado, a(async (req, res) => {
  const p = await Product.create({ ...dadosProduto(req.body), produtor: req.user.id });
  res.status(201).location(`/api/products/${p._id}`).json(p);
}));

// PUT /api/products/:id  (produtor dono)  -> 200 | 404
router.put('/:id', auth('produtor'), a(async (req, res) => {
  const p = await Product.findOneAndUpdate({ _id: req.params.id, produtor: req.user.id }, dadosProduto(req.body), { new: true, runValidators: true });
  if (!p) throw erro(404, 'Produto não encontrado');
  res.json(p);
}));

// DELETE /api/products/:id  (produtor dono)  -> 204 | 404
router.delete('/:id', auth('produtor'), a(async (req, res) => {
  const r = await Product.deleteOne({ _id: req.params.id, produtor: req.user.id });
  if (!r.deletedCount) throw erro(404, 'Produto não encontrado');
  res.status(204).end();
}));

// POST /api/products/:id/imagem  (multipart, campo "imagem")  -> 200 { imagemUrl }
router.post('/:id/imagem', auth('produtor'), a(async (req, res, next) => {
  req.produto = await Product.findOne({ _id: req.params.id, produtor: req.user.id });
  if (!req.produto) throw erro(404, 'Produto não encontrado');
  next();
}), upload.single('imagem'), a(async (req, res) => {
  const buffer = req.file?.buffer;
  if (!buffer) throw erro(400, 'Envie uma imagem no campo imagem');
  let extensao;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) extensao = 'png';
  else if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) extensao = 'jpg';
  else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') extensao = 'webp';
  if (!extensao) throw erro(400, 'Use uma imagem JPEG, PNG ou WebP');
  const origem = req.protocol + '://' + req.get('host');
  const { imagemUrl, remover } = await guardarImagem(buffer, extensao, origem);
  try {
    req.produto.imagemUrl = imagemUrl;
    await req.produto.save();
  } catch (err) {
    // Uma falha de rede ou de confirmação pode ter ocorrido depois da gravação.
    // Nesses casos é mais seguro manter a nova imagem para uma reconciliação posterior.
    const resultadoIncerto = /Network|Timeout|WriteConcern/.test(err.name || '') || err.code === 64 ||
      err.hasErrorLabel?.('RetryableWriteError');
    if (!resultadoIncerto) {
      await removerOrfa(async () => {
        const emUso = await Product.exists({ imagemUrl }).read('primary').maxTimeMS(3000);
        if (!emUso) await remover();
      });
    }
    throw err;
  }
  res.json({ imagemUrl });
}));

module.exports = router;
