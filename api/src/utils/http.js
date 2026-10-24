const mongoose = require('mongoose');

// Express 4 precisa de encaminhar explicitamente as rejeições dos handlers async.
const a = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });

function id(valor) {
  if (!mongoose.isObjectIdOrHexString(valor)) throw erro(400, 'Identificador ou valor inválido');
  return valor;
}

function parametroId(req, res, next, valor) {
  try { id(valor); next(); } catch (err) { next(err); }
}

function campos(obj, permitidos) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw erro(400, 'Corpo JSON inválido');
  return Object.fromEntries(permitidos.filter((c) => obj[c] !== undefined).map((c) => [c, obj[c]]));
}

function query(req) {
  if (Object.values(req.query).some((v) => typeof v !== 'string')) throw erro(400, 'Parâmetros de pesquisa inválidos');
  return req.query;
}

function numero(valor, nome, minimo = 0) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo) throw erro(400, `${nome} inválido`);
  return valor;
}

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { a, erro, id, parametroId, campos, query, numero, escaparRegex };
