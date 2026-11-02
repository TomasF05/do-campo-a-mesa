// Passo 6: autenticação por JWT + controlo de acesso por papel.
// Uso: router.post('/', auth('produtor'), handler)   -> só produtores
//      router.get('/', auth(), handler)              -> qualquer utilizador autenticado
const jwt = require('jsonwebtoken');
const { isObjectIdOrHexString } = require('mongoose');

module.exports = (...papeis) => (req, res, next) => {
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '')?.[1];
  try {
    const u = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof u.id !== 'string' || !isObjectIdOrHexString(u.id) || !['comprador', 'produtor', 'admin'].includes(u.papel) || !Number.isFinite(u.exp)) {
      throw new Error('Token inválido');
    }
    req.user = { id: u.id, papel: u.papel, nome: u.nome };
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou em falta' });
  }
  if (papeis.length && !papeis.includes(req.user.papel)) {
    return res.status(403).json({ erro: 'Sem permissão' });
  }
  next();
};
