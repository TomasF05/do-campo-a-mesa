// Passo 7: autenticação dos sockets com o mesmo JWT da API
const jwt = require('jsonwebtoken');
const { isObjectIdOrHexString } = require('mongoose');
const registarLeiloes = require('./leiloes');

module.exports = (io) => {
  io.use((socket, next) => {
    try {
      const u = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof u.id !== 'string' || !isObjectIdOrHexString(u.id) || !['comprador', 'produtor', 'admin'].includes(u.papel) || !Number.isFinite(u.exp)) {
        throw new Error('Token inválido');
      }
      socket.user = { id: u.id.toLowerCase(), papel: u.papel, nome: u.nome, exp: u.exp };
      next();
    } catch {
      const erro = new Error('Token inválido ou em falta');
      erro.data = { status: 401 };
      next(erro);
    }
  });

  io.on('connection', (socket) => {
    // Sala pessoal: permite notificar este utilizador (ex.: estado da encomenda)
    socket.join(`user:${socket.user.id}`);
    // Apenas JWTs de administradores dão acesso aos avisos de atualização do painel.
    if (socket.user.papel === 'admin') socket.join('admin');

    let temporizador;
    const expirar = (ack) => {
      const erro = 'Sessão expirada. Inicie sessão novamente.';
      if (typeof ack === 'function') ack({ ok: false, erro });
      else socket.emit('recusada', erro);
      socket.disconnect(true);
    };
    const vigiarExpiracao = () => {
      const restante = socket.user.exp * 1000 - Date.now();
      if (restante <= 0) return expirar();
      // O limite evita que tokens de longa duração façam o temporizador transbordar.
      temporizador = setTimeout(vigiarExpiracao, Math.min(restante, 2147483647));
      temporizador.unref();
    };
    socket.on('disconnect', () => clearTimeout(temporizador));
    socket.use((evento, next) => {
      // Também bloqueia eventos se o temporizador estiver atrasado pelo event loop.
      if (Date.now() >= socket.user.exp * 1000) {
        expirar(evento[0] === 'licitar' ? evento.at(-1) : null);
      }
      next(); // O Socket.io só entrega o evento se a ligação continuar aberta.
    });

    registarLeiloes(io, socket);
    vigiarExpiracao();
  });
};
