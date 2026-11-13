// Ponto de entrada: servidor HTTP partilhado pela API REST e pelo Socket.io
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const app = require('./app');
const { ligarBD } = require('./config/db');
const registarSockets = require('./sockets');
const { iniciarCiclo } = require('./services/cicloLeiloes');
const { validarArmazenamento } = require('./services/imagens');

const PORT = process.env.PORT || 3000;
const PRAZO_ENCERRAMENTO_MS = 25000;

async function iniciar() {
  validarArmazenamento();
  await ligarBD();

  let aEncerrar = false;
  const operacoesSocket = new Set();
  const server = http.createServer((req, res) => {
    if (aEncerrar) {
      res.setHeader('Connection', 'close');
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ erro: 'O servidor está a encerrar' }));
    }
    app(req, res);
  });
  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*' },
    allowRequest: (_req, aceitar) => aceitar(null, !aEncerrar)
  });

  // Disponibiliza o io às rotas (ex.: notificar o comprador quando a encomenda muda)
  app.set('io', io);
  io.use((_socket, next) => next(aEncerrar ? new Error('O servidor está a encerrar') : undefined));
  registarSockets(io, (socket, handler) => async (...args) => {
    if (aEncerrar) {
      const erro = 'O servidor está a encerrar';
      const ack = args.at(-1);
      if (typeof ack === 'function') ack({ ok: false, erro });
      else socket.emit('recusada', erro);
      return;
    }
    const operacao = handler(...args);
    operacoesSocket.add(operacao);
    try {
      await operacao;
    } catch (err) {
      console.error('Erro ao processar um evento Socket.io:', err);
    } finally {
      operacoesSocket.delete(operacao);
    }
  });
  const pararCiclo = await iniciarCiclo(io);

  async function encerrar() {
    if (aEncerrar) return;
    aEncerrar = true;
    const prazo = setTimeout(() => {
      console.error('O servidor excedeu o prazo de encerramento.');
      process.exit(1);
    }, PRAZO_ENCERRAMENTO_MS);
    try {
      const httpEncerrado = new Promise((resolve) => server.close(resolve));
      await Promise.all([pararCiclo(), Promise.allSettled(operacoesSocket)]);
      // As ligações Socket.io mantêm-se abertas até os eventos em curso terminarem.
      await io.close();
      await httpEncerrado;
      await mongoose.disconnect();
      console.log('Servidor encerrado.');
    } catch (err) {
      console.error('Erro ao encerrar o servidor:', err);
      process.exit(1);
    } finally {
      clearTimeout(prazo);
    }
  }
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);

  server.listen(PORT, () => {
    console.log(`API em http://localhost:${PORT}`);
    console.log(`Documentação em http://localhost:${PORT}/api-docs`);
  });
}

iniciar().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
