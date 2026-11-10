// Passo 7: leilões em tempo real
// Eventos do cliente:   'entrar' (leilaoId), 'sair' (leilaoId), 'licitar' ({ leilaoId, valor })
// Eventos do servidor:  'estado' ({ agora, leilao, licitacoes }), 'presenca' (n.º), 'nova-licitacao', 'recusada' (mensagem)
const { isObjectIdOrHexString } = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const { notificar } = require('../services/notificacoes');

const sala = (leilaoId) => `leilao:${leilaoId}`;
const idValido = (id) => typeof id === 'string' && isObjectIdOrHexString(id);
const POPULATE = [{ path: 'produtor', select: 'nome produtor.localidade' }, { path: 'produto', select: 'nome unidade imagemUrl' }];
const filas = new Map();
const recusa = (mensagem) => Object.assign(new Error(mensagem), { recusa: true });

function centimos(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || !/^\d+(\.\d{1,2})?$/.test(String(valor))) return null;
  const [euros, fracao = ''] = String(valor).split('.');
  const casas = fracao.padEnd(2, '0');
  const inteiro = Number(euros + casas);
  // Rejeita também montantes tão grandes que já não representam os cêntimos corretamente.
  return Number.isSafeInteger(inteiro) && valor.toFixed(2) === `${euros}.${casas}` ? inteiro : null;
}

function emFila(id, executar) {
  const anterior = filas.get(id) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(executar);
  filas.set(id, atual);
  return atual.finally(() => { if (filas.get(id) === atual) filas.delete(id); });
}

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

  socket.on('licitar', async (...args) => {
    const ack = typeof args.at(-1) === 'function' ? args.pop() : null;
    const responder = (resposta) => {
      if (!socket.connected) return;
      if (ack) ack(resposta);
      else if (!resposta.ok) socket.emit('recusada', resposta.erro);
    };
    // Inclui o tempo na fila: pedidos antigos não ficam à espera para licitar mais tarde.
    const limite = Date.now() + 5000;
    const validarLigacao = () => {
      if (!socket.connected) throw recusa('Ligação interrompida');
      if (Date.now() >= socket.user.exp * 1000) throw recusa('Sessão expirada. Inicie sessão novamente.');
      if (Date.now() >= limite) throw recusa('O pedido expirou. Consulte o estado atual do leilão.');
    };

    try {
      validarLigacao();
      if (socket.user.papel !== 'comprador') throw recusa('Apenas compradores podem licitar');
      const dados = args[0];
      if (args.length !== 1 || !dados || typeof dados !== 'object' || Array.isArray(dados)) throw recusa('Pedido de licitação inválido');
      if (!idValido(dados.leilaoId)) throw recusa('Identificador de leilão inválido');
      const leilaoId = dados.leilaoId.toLowerCase();
      const valorCentimos = centimos(dados.valor);
      if (valorCentimos === null || valorCentimos <= 0) throw recusa('Indique um valor positivo, com no máximo duas casas decimais');
      const valor = valorCentimos / 100;

      await emFila(leilaoId, async () => {
        validarLigacao();
        if (Auction.db.readyState !== 1) throw new Error('Base de dados indisponível');
        // O driver repete a transação em conflitos transitórios; cada repetição revalida tudo.
        const nova = await Auction.db.transaction(async (session) => {
          validarLigacao();
          const base = await Auction.findById(leilaoId).select('estado iniciaEm terminaEm licitacaoAtual incremento').session(session).lean();
          validarLigacao();
          if (!base) throw recusa('Leilão não encontrado');
          const agora = new Date();
          if (base.estado !== 'ativo' || base.iniciaEm > agora || base.terminaEm <= agora) throw recusa('O leilão não está ativo');
          const atual = centimos(base.licitacaoAtual?.valor);
          const incremento = centimos(base.incremento);
          if (atual === null || incremento === null || incremento < 1 || !Number.isSafeInteger(atual + incremento)) throw recusa('Os valores monetários deste leilão são inválidos');
          const minimo = atual + incremento;
          if (valorCentimos < minimo) throw recusa(`Licitação mínima: ${(minimo / 100).toFixed(2).replace('.', ',')} €`);

          const leilao = await Auction.findOneAndUpdate({
            _id: leilaoId, estado: 'ativo', incremento: base.incremento,
            'licitacaoAtual.valor': { $lte: (valorCentimos - incremento) / 100 },
            // O prazo é confirmado pelo MongoDB no momento da escrita.
            $expr: { $and: [{ $lte: ['$iniciaEm', '$$NOW'] }, { $gt: ['$terminaEm', '$$NOW'] }] }
          }, {
            $set: { licitacaoAtual: { valor, comprador: socket.user.id, nome: socket.user.nome, em: agora } },
            $inc: { numLicitacoes: 1 }
          }, { new: true, session, runValidators: true }).lean();
          if (!leilao) throw recusa('O leilão já não está ativo ou a licitação deixou de ser válida');

          const [bid] = await Bid.create([{
            leilao: leilaoId, comprador: socket.user.id, nome: socket.user.nome, valor
          }], { session });
          validarLigacao();
          return {
            _id: bid._id, leilaoId, valor, comprador: socket.user.id, nome: socket.user.nome,
            createdAt: bid.createdAt, numLicitacoes: leilao.numLicitacoes
          };
        }, {
          readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
          timeoutMS: Math.max(1, limite - Date.now())
        });

        // Sem efeitos externos dentro da transação: um rollback nunca emite uma licitação.
        notificar(io, sala(leilaoId), 'nova-licitacao', nova);
        responder({ ok: true, valor: nova.valor, licitacao: nova });
      });
    } catch (err) {
      if (!err.recusa) console.error('Erro ao processar a licitação:', err);
      responder({ ok: false, erro: err.recusa ? err.message : 'Não foi possível confirmar a licitação. Consulte o estado atual antes de tentar novamente.' });
    }
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
