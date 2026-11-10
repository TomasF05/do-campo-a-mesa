// Passo 7: ciclo de vida dos leilões. Desativado por omissão durante o desenvolvimento.
const Auction = require('../models/Auction');
const Order = require('../models/Order');
const { notificar } = require('./notificacoes');

async function abrirAgendados(io) {
  const filtro = { estado: 'agendado', $expr: { $lte: ['$iniciaEm', '$$NOW'] } };
  const lista = await Auction.find(filtro).select('_id').lean();
  let abertos = 0;
  for (const { _id } of lista) {
    try {
      const leilao = await Auction.findOneAndUpdate({ _id, ...filtro }, {
        $set: { estado: 'ativo' }
      }, { new: true, writeConcern: { w: 'majority' }, timeoutMS: 5000 }).lean();
      if (!leilao) continue; // Outra execução já alterou este leilão.
      abertos++;
      notificar(io, `leilao:${_id}`, 'aberto', { id: _id.toString() });
      notificar(io, `user:${leilao.produtor}`, 'painel-atualizado', { recurso: 'leiloes' });
      notificar(io, 'admin', 'painel-atualizado', { recurso: 'leiloes' });
    } catch (err) {
      console.error(`Erro ao abrir o leilão ${_id}:`, err);
    }
  }
  return abertos;
}

async function fecharExpirados(io) {
  const filtro = { estado: 'ativo', $expr: { $lte: ['$terminaEm', '$$NOW'] } };
  const lista = await Auction.find(filtro).select('_id').lean();
  let terminados = 0;
  for (const { _id } of lista) {
    try {
      const resultado = await Auction.db.transaction(async (session) => {
        // A licitação também escreve em Auction: um conflito obriga a reler o vencedor.
        const leilao = await Auction.findOneAndUpdate({ _id, ...filtro }, {
          $set: { estado: 'terminado' }
        }, { new: true, session, runValidators: true }).lean();
        if (!leilao) return null;

        let encomenda = null;
        if (leilao.licitacaoAtual?.comprador) {
          const [nova] = await Order.create([{
            comprador: leilao.licitacaoAtual.comprador, produtor: leilao.produtor,
            linhas: [{
              produto: leilao.produto, nome: `Lote: ${leilao.lote}`,
              precoUnit: leilao.licitacaoAtual.valor, unidade: 'lote', quantidade: 1
            }],
            estado: 'confirmada', origem: 'leilao', leilao: leilao._id
          }], { session });
          encomenda = nova._id;
          const ligacao = await Auction.updateOne({ _id, estado: 'terminado' }, {
            $set: { encomenda }
          }, { session, runValidators: true });
          if (ligacao.matchedCount !== 1) throw new Error('Não foi possível associar a encomenda ao leilão');
        }
        return { leilao, encomenda };
      }, {
        readPreference: 'primary', readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' }, timeoutMS: 5000
      });
      if (!resultado) continue;

      // Os eventos ficam fora da transação, para não se repetirem nos retries.
      const { leilao, encomenda } = resultado;
      const comprador = leilao.licitacaoAtual?.comprador;
      const vencedor = comprador ? { id: comprador.toString(), nome: leilao.licitacaoAtual.nome } : null;
      const dados = {
        id: _id.toString(), lote: leilao.lote, vencedor,
        valor: leilao.licitacaoAtual?.valor ?? leilao.precoBase,
        encomenda: encomenda?.toString() ?? null, numLicitacoes: leilao.numLicitacoes
      };
      terminados++;
      const { encomenda: _privada, ...publicos } = dados;
      notificar(io, `leilao:${_id}`, 'terminado', publicos);
      if (comprador) notificar(io, `user:${comprador}`, 'leilao-ganho', dados);
      notificar(io, `user:${leilao.produtor}`, 'leilao-terminado', dados);
      notificar(io, 'admin', 'painel-atualizado', { recurso: 'leiloes' });
    } catch (err) {
      // Um erro num leilão não impede os restantes; o próximo ciclo volta a tentar.
      console.error(`Erro ao fechar o leilão ${_id}:`, err);
    }
  }
  return terminados;
}

async function executarCiclo(io) {
  const abertos = await abrirAgendados(io);
  const terminados = await fecharExpirados(io);
  return { abertos, terminados };
}

async function iniciarCiclo(io) {
  // Exige ativação explícita. Sem esta opção, não há consultas, escritas nem temporizador.
  if (process.env.CICLO_LEILOES_ATIVO !== 'true') return async () => {};
  // Confirma a proteção de unicidade antes de permitir o processamento automático.
  // createIndexes não elimina índices existentes, ao contrário de syncIndexes.
  await Order.createIndexes();
  let parado = false;
  let execucao = null;
  const temporizador = setInterval(() => {
    if (parado || execucao) return;
    execucao = executarCiclo(io)
      .catch((err) => console.error('Erro no ciclo dos leilões:', err))
      .finally(() => { execucao = null; });
  }, 2000);
  temporizador.unref();
  return async () => {
    parado = true;
    clearInterval(temporizador);
    await execucao;
  };
}

module.exports = { executarCiclo, iniciarCiclo };
