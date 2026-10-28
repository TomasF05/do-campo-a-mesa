// Dados de exemplo: npm run seed   (APAGA as coleções antes de inserir)
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Review = require('../models/Review');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const modelos = [User, Product, Order, Auction, Bid, Review];
  await Promise.all(modelos.map((M) => M.init()));
  await Promise.all(modelos.map((M) => M.deleteMany({})));

  const passwordHash = await bcrypt.hash('password123', 12);
  const [admin, horta, mel, comprador] = await User.create([
    { nome: 'Administração', email: 'admin@exemplo.pt', passwordHash, papel: 'admin' },
    { nome: 'Horta da Ribeira', email: 'horta@exemplo.pt', passwordHash, papel: 'produtor',
      produtor: { nomeExploracao: 'Horta da Ribeira', descricao: 'Fruta e hortícolas da época.', localidade: 'Ponte de Lima', validado: true } },
    { nome: 'Mel do Soajo', email: 'mel@exemplo.pt', passwordHash, papel: 'produtor',
      produtor: { nomeExploracao: 'Mel do Soajo', descricao: 'Mel de produção local.', localidade: 'Arcos de Valdevez', validado: true } },
    { nome: 'Tasca do Lima', email: 'tasca@exemplo.pt', passwordHash, papel: 'comprador' }
  ]);

  const [kiwi, , couve, urze] = await Product.create([
    { produtor: horta._id, nome: 'Kiwi Hayward', descricao: 'Kiwi da colheita da época.', categoria: 'Fruta', preco: 2.4, unidade: 'kg', stock: 300, biologico: true, epocas: ['Outono', 'Inverno'] },
    { produtor: horta._id, nome: 'Abóbora-menina', categoria: 'Hortícolas', preco: 1.2, unidade: 'kg', stock: 80, epocas: ['Outono'] },
    { produtor: horta._id, nome: 'Couve-galega', categoria: 'Hortícolas', preco: 1.5, unidade: 'molho', stock: 40, biologico: true, epocas: ['Outono', 'Inverno'] },
    { produtor: mel._id, nome: 'Mel de urze', categoria: 'Mel', preco: 7.5, unidade: '500 g', stock: 38 },
    { produtor: mel._id, nome: 'Mel de castanheiro', categoria: 'Mel', preco: 7.0, unidade: '500 g', stock: 21 }
  ]);

  const encomendas = await Order.create([
    {
      comprador: comprador._id, produtor: horta._id, estado: 'entregue',
      linhas: [kiwi, couve].map((p) => ({ produto: p._id, nome: p.nome, precoUnit: p.preco, unidade: p.unidade, quantidade: 2 })),
      entrega: { tipo: 'entrega', morada: 'Rua de exemplo, Ponte de Lima' }
    },
    {
      comprador: comprador._id, produtor: mel._id, estado: 'confirmada',
      linhas: [{ produto: urze._id, nome: urze.nome, precoUnit: urze.preco, unidade: urze.unidade, quantidade: 2 }],
      entrega: { tipo: 'levantamento' }
    }
  ]);
  await Promise.all(encomendas.flatMap((o) => o.linhas.map((linha) =>
    Product.updateOne({ _id: linha.produto }, { $inc: { stock: -linha.quantidade } })
  )));

  await Review.create([
    { autor: comprador._id, produtor: horta._id, produto: kiwi._id, encomenda: encomendas[0]._id, classificacao: 5, comentario: 'Kiwi fresco e saboroso.' },
    { autor: comprador._id, produtor: horta._id, encomenda: encomendas[0]._id, classificacao: 4, comentario: 'Encomenda entregue conforme combinado.', denuncias: 1 }
  ]);

  const agora = Date.now();
  const leilao = await Auction.create({
    produtor: horta._id, produto: kiwi._id, lote: '200 kg de kiwi Hayward, calibre A', quantidade: '200 kg',
    descricao: 'Lote da colheita da época, em caixas de 10 kg.',
    precoBase: 200, incremento: 5, licitacaoAtual: { valor: 200 },
    iniciaEm: new Date(agora - 2 * 60 * 1000), terminaEm: new Date(agora + 30 * 60 * 1000), estado: 'ativo'
  });
  const licitacoes = await Bid.create([
    { leilao: leilao._id, comprador: comprador._id, nome: comprador.nome, valor: 205, createdAt: new Date(agora - 60000) },
    { leilao: leilao._id, comprador: comprador._id, nome: comprador.nome, valor: 210, createdAt: new Date(agora - 30000) }
  ]);
  const ultima = licitacoes[licitacoes.length - 1];
  leilao.licitacaoAtual = { valor: ultima.valor, comprador: ultima.comprador, nome: ultima.nome, em: ultima.createdAt };
  leilao.numLicitacoes = licitacoes.length;
  await leilao.save();

  console.log('Seed concluído. Utilizadores (password: password123):');
  console.log([admin, horta, mel, comprador].map((u) => `  ${u.papel.padEnd(10)} ${u.email}`).join('\n'));
}

seed().finally(() => mongoose.disconnect()).catch((err) => { console.error(err); process.exitCode = 1; });
