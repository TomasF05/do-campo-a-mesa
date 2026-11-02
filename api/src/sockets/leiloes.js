// Passo 7: leilões em tempo real
// Eventos do cliente:   'entrar' (leilaoId), 'sair' (leilaoId), 'licitar' ({ leilaoId, valor })
// Eventos do servidor:  'estado' ({ agora, leilao, licitacoes }), 'presenca' (n.º), 'nova-licitacao', 'recusada' (mensagem)
const { isObjectIdOrHexString } = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

const sala = (leilaoId) => `leilao:${leilaoId}`;
const idValido = (id) => typeof id === 'string' && isObjectIdOrHexString(id);
const POPULATE = [{ path: 'produtor', select: 'nome produtor.localidade' }, { path: 'produto', select: 'nome unidade imagemUrl' }];

function emitirPresenca(io, leilaoId) {
  const n = io.sockets.adapter.rooms.get(sala(leilaoId))?.size ?? 0;
  io.to(sala(leilaoId)).emit('presenca', n);
}

module.exports = (io, socket) => {
  // Identifica cada pedido para não entrar numa sala depois de sair ou mudar de pedido.
  const entradas = new Map();

  socket.on('entrar', async (leilaoId) => {
    if (!idValido(leilaoId)) return socket.emit('recusada', 'Identificador de leilão inválido');
    leilaoId = leilaoId.toLowerCase();
    const pedido = Symbol();
    entradas.set(leilaoId, pedido);
    const aindaAtual = () => socket.connected && entradas.get(leilaoId) === pedido && Date.now() < socket.user.exp * 1000;

    try {
      if (!await Auction.exists({ _id: leilaoId })) {
        if (aindaAtual()) {
          entradas.delete(leilaoId);
          socket.emit('recusada', 'Leilão não encontrado');
        }
        return;
      }
      if (!aindaAtual()) return;
      const jaEstava = socket.rooms.has(sala(leilaoId));
      await socket.join(sala(leilaoId));
      if (!aindaAtual()) return;
      if (!jaEstava) emitirPresenca(io, leilaoId);

      const [leilao, licitacoes] = await Promise.all([
        Auction.findById(leilaoId).populate(POPULATE).lean(),
        Bid.find({ leilao: leilaoId }).populate('comprador', 'nome').sort({ createdAt: -1, _id: -1 }).limit(20).lean()
      ]);
      if (!aindaAtual()) return;
      if (!leilao) {
        entradas.delete(leilaoId);
        await socket.leave(sala(leilaoId));
        emitirPresenca(io, leilaoId);
        socket.emit('recusada', 'Leilão não encontrado');
        return;
      }
      socket.emit('estado', { agora: new Date(), leilao, licitacoes });
    } catch (err) {
      if (!aindaAtual()) return;
      entradas.delete(leilaoId);
      await socket.leave(sala(leilaoId));
      emitirPresenca(io, leilaoId);
      console.error('Erro ao carregar o estado do leilão:', err);
      socket.emit('recusada', 'Não foi possível carregar o leilão');
    }
  });

  socket.on('sair', async (leilaoId) => {
    if (!idValido(leilaoId)) return socket.emit('recusada', 'Identificador de leilão inválido');
    leilaoId = leilaoId.toLowerCase();
    entradas.delete(leilaoId);
    if (socket.rooms.has(sala(leilaoId))) {
      await socket.leave(sala(leilaoId));
      emitirPresenca(io, leilaoId);
    }
  });

  socket.on('licitar', () => {
    // TODO (desafio central): validar e gravar a licitação numa ÚNICA operação atómica
    //   Auction.findOneAndUpdate(
    //     { _id, estado: 'ativo', terminaEm: { $gt: agora },
    //       $expr: { $gte: [valor, { $add: ['$licitacaoAtual.valor', '$incremento'] }] } },
    //     { licitacaoAtual: { valor, comprador: socket.user.id } }, { new: true })
    //   - se devolver null  -> socket.emit('recusada', '…')
    //   - senão             -> Bid.create(…) e io.to(sala).emit('nova-licitacao', …)
    socket.emit('recusada', 'Licitação ainda não implementada');
  });

  // Atualizar a presença quando o utilizador fecha a página
  socket.on('disconnecting', () => {
    entradas.clear();
    for (const s of socket.rooms) {
      if (s.startsWith('leilao:')) {
        setImmediate(() => emitirPresenca(io, s.slice('leilao:'.length)));
      }
    }
  });

  // TODO: fechar os leilões expirados (estado 'terminado') e avisar a sala e o vencedor
};
