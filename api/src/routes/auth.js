// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { notificar } = require('../services/notificacoes');
const { a, erro, campos } = require('../utils/http');

function credenciais(corpo) {
  const { email, password } = campos(corpo, ['email', 'password']);
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw erro(400, 'Indique o email e a password');
  }
  return { email: email.trim().toLowerCase(), password };
}

// POST /api/auth/registo  -> 201 { id }
router.post('/registo', a(async (req, res) => {
  const dados = campos(req.body, ['nome', 'papel', 'produtor']);
  const { email, password } = credenciais(req.body);
  if (typeof dados.nome !== 'string' || !dados.nome.trim()) throw erro(400, 'Indique o nome');
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw erro(400, 'A password deve ter pelo menos 8 caracteres e no máximo 72 bytes');
  }
  const papel = dados.papel === undefined ? 'comprador' : dados.papel;
  if (!['comprador', 'produtor'].includes(papel)) throw erro(400, 'Papel inválido');
  let produtor;
  if (papel === 'produtor') {
    produtor = campos(dados.produtor, ['nomeExploracao', 'localidade']);
    for (const campo of ['nomeExploracao', 'localidade']) {
      if (typeof produtor[campo] !== 'string' || !produtor[campo].trim()) throw erro(400, 'Indique o nome da exploração e a localidade');
      produtor[campo] = produtor[campo].trim();
    }
    produtor.validado = false;
  }
  const u = new User({ nome: dados.nome.trim(), email, papel, produtor, passwordHash: 'por-calcular' });
  await u.validate();
  u.passwordHash = await bcrypt.hash(password, 12);
  await u.save();
  notificar(req.app.get('io'), 'admin', 'painel-atualizado', { recurso: 'utilizadores' });
  res.status(201).json({ id: u._id });
}));

// POST /api/auth/login  -> 200 { token, utilizador }
router.post('/login', a(async (req, res) => {
  const { email, password } = credenciais(req.body);
  const u = await User.findOne({ email }).select('+passwordHash');
  if (!u || Buffer.byteLength(password, 'utf8') > 72 || !(await bcrypt.compare(password, u.passwordHash))) {
    throw erro(401, 'Credenciais inválidas');
  }
  const token = jwt.sign({ id: u.id, papel: u.papel, nome: u.nome }, process.env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  });
  res.json({ token, utilizador: u.publico() });
}));

// GET /api/auth/eu  -> 200 dados do utilizador autenticado
router.get('/eu', auth(), a(async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!u) throw erro(401, 'Utilizador não encontrado');
  res.json(u.publico());
}));

module.exports = router;
