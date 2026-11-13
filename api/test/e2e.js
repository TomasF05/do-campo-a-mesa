// npm test: requer mongod no PATH ou MONGOD_BINARY com o caminho do executável.
// A suite cria a sua própria API, base de dados, utilizadores e credenciais.
const assert = require('node:assert/strict');
const { fork, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { existsSync, readdirSync } = require('node:fs');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: esperar } = require('node:timers/promises');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { mongo: { MongoClient, ObjectId } } = require('mongoose');
const { io } = require('socket.io-client');

const TIMEOUT = 8000;
const HOST = '127.0.0.1';
const REPLICA = 'dcmE2E';
const API = path.resolve(__dirname, '../src/server.js');
const NOME_INDICE = 'uma_encomenda_por_leilao';

if (process.argv[2] === '--api-isolada') {
  // O processo de teste transmite apenas os valores gerados nesta execução.
  if (!process.send || !/^mongodb:\/\/127\.0\.0\.1:\d+\/dcm_e2e_[a-f0-9]+\?replicaSet=dcmE2E$/.test(process.env.MONGODB_URI || '')) {
    throw new Error('A API de teste só pode arrancar com o replica set temporário em loopback');
  }
  process.once('message', mensagem => {
    if (mensagem === 'encerrar') {
      process.disconnect();
      process.emit('SIGTERM');
    }
  });
  // O servidor normal escuta em todas as interfaces para poder correr no Render.
  // Neste processo, restringir exclusivamente o listener da API ao loopback.
  const { Server } = require('node:http');
  const escutar = Server.prototype.listen;
  Server.prototype.listen = function (porta, callback) {
    if (porta !== process.env.PORT) return escutar.apply(this, arguments);
    return escutar.call(this, Number(porta), HOST, () => {
      process.send('api-isolada-pronta');
      callback();
    });
  };
  require(API);
} else {
  executar().catch(() => {
    console.error('FAIL — não foi possível executar a suite');
    process.exitCode = 1;
  });
}

function binarioMongo() {
  if (process.env.MONGOD_BINARY) return process.env.MONGOD_BINARY;
  if (process.platform === 'win32' && process.env.ProgramFiles) {
    const pasta = path.join(process.env.ProgramFiles, 'MongoDB', 'Server');
    if (existsSync(pasta)) {
      const versoes = readdirSync(pasta).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      const instalado = versoes.map(v => path.join(pasta, v, 'bin', 'mongod.exe')).find(existsSync);
      if (instalado) return instalado;
    }
  }
  return 'mongod';
}

async function portaLivre() {
  const servidor = net.createServer();
  await new Promise((resolve, reject) => servidor.once('error', reject).listen(0, HOST, resolve));
  const { port } = servidor.address();
  await new Promise(resolve => servidor.close(resolve));
  return port;
}

async function aguardar(procurar, mensagem, limite = TIMEOUT) {
  const prazo = Date.now() + limite;
  do {
    const valor = await procurar();
    if (valor) return valor;
    await esperar(80);
  } while (Date.now() < prazo);
  throw new Error(mensagem);
}

function vigiarProcesso(processo) {
  const estado = { processo };
  estado.fim = new Promise(resolve => {
    processo.once('error', err => { estado.erro = err.code; resolve(null); });
    processo.once('exit', code => { estado.saiu = true; resolve(code); });
  });
  return estado;
}

async function esperarSaida(estado, ms) {
  const espera = new AbortController();
  try {
    return await Promise.race([estado.fim, esperar(ms, undefined, { signal: espera.signal })]);
  } finally {
    espera.abort();
  }
}

function criarClienteSocket(base, token, sockets) {
  const socket = io(base, {
    auth: { token }, transports: ['websocket'], autoConnect: false,
    forceNew: true, reconnection: false, timeout: TIMEOUT
  });
  const eventos = [];
  socket.onAny((nome, dados) => eventos.push({ nome, dados }));
  sockets.push(socket);
  return {
    socket,
    eventos,
    ligar() {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => terminar(new Error('Tempo limite a ligar o Socket.io')), TIMEOUT);
        const conectado = () => terminar(null, 200);
        const falhou = err => terminar(err.data?.status === 401 ? null : new Error('Erro no transporte Socket.io'), 401);
        function terminar(erro, status) {
          clearTimeout(timer);
          socket.off('connect', conectado).off('connect_error', falhou);
          if (erro) reject(erro);
          else resolve(status);
        }
        socket.once('connect', conectado).once('connect_error', falhou).connect();
      });
    },
    evento(nome, filtro, desde = 0, limite = TIMEOUT) {
      return aguardar(() => eventos.slice(desde).find(e => e.nome === nome && filtro(e.dados)),
        'Evento Socket.io em falta: ' + nome, limite).then(e => e.dados);
    },
    async entrar(leilaoId) {
      const desde = eventos.length;
      socket.emit('entrar', leilaoId);
      return this.evento('estado', e => e.leilao._id === leilaoId, desde);
    },
    licitar(leilaoId, valor) {
      return socket.timeout(TIMEOUT).emitWithAck('licitar', { leilaoId, valor });
    }
  };
}

async function executar() {
  let aprovadas = 0;
  let falhadas = 0;
  let pasta, api, mongodb, cliente, db, versaoMongo;
  const sockets = [];
  const raizTemp = await fs.realpath(os.tmpdir());
  const segredo = randomUUID();
  const sufixo = randomUUID().replaceAll('-', '');
  const nomeBD = 'dcm_e2e_' + sufixo;
  const opcoesMongo = { serverSelectionTimeoutMS: 1000, connectTimeoutMS: 1000, timeoutMS: 4500 };
  const verifica = async (nome, verificar) => {
    try {
      const resultado = await verificar();
      aprovadas++;
      console.log('PASS — ' + nome);
      return resultado;
    } catch (err) {
      falhadas++;
      // Não imprimir pedidos, tokens nem objetos de erro do driver.
      const detalhe = typeof err.actual === 'number' && typeof err.expected === 'number'
        ? ' (obtido ' + err.actual + ', esperado ' + err.expected + ')' : '';
      console.error('FAIL — ' + nome + detalhe);
      if (err.codigoTeste) console.error('  ' + err.codigoTeste);
      throw err;
    }
  };
  const precondicao = (motivo) => Object.assign(new Error(motivo), { codigoTeste: motivo });
  try {
    const base = await verifica('MongoDB temporário em loopback, primário do replica set e API isolada', async () => {
      pasta = await fs.mkdtemp(path.join(raizTemp, 'dcm-e2e-'));
      const dados = path.join(pasta, 'db');
      await fs.mkdir(dados);
      const portaMongo = await portaLivre();
      const destino = 'mongodb://' + HOST + ':' + portaMongo;
      const uri = destino + '/' + nomeBD + '?replicaSet=' + REPLICA;
      mongodb = vigiarProcesso(spawn(binarioMongo(), ['--dbpath', dados, '--bind_ip', HOST,
        '--port', String(portaMongo), '--replSet', REPLICA, '--oplogSize', '64',
        '--logpath', path.join(pasta, 'mongo.log')], { windowsHide: true, stdio: 'ignore' }));
      const direto = () => new MongoClient(destino + '/?directConnection=true', opcoesMongo);
      await aguardar(async () => {
        if (mongodb.erro || mongodb.saiu) throw precondicao('Não foi possível arrancar mongod. Instale-o ou indique MONGOD_BINARY.');
        const teste = direto();
        try { return await teste.db('admin').command({ ping: 1 }); }
        catch { return false; }
        finally { await teste.close(); }
      }, 'MongoDB indisponível', 18000);
      const controlo = direto();
      try {
        const { parsed } = await controlo.db('admin').command({ getCmdLineOpts: 1 });
        assert.equal(path.resolve(parsed.storage.dbPath), dados);
        assert.equal(parsed.replication.replSet, REPLICA);
        await controlo.db('admin').command({ replSetInitiate: {
          _id: REPLICA, members: [{ _id: 0, host: HOST + ':' + portaMongo }]
        } });
        await aguardar(async () => {
          const info = await controlo.db('admin').command({ hello: 1 });
          return info.setName === REPLICA && info.isWritablePrimary && info.me === HOST + ':' + portaMongo;
        }, 'O replica set temporário não elegeu um primário', 18000);
        versaoMongo = (await controlo.db('admin').command({ buildInfo: 1 })).version;
      } finally { await controlo.close(); }
      cliente = await new MongoClient(uri, opcoesMongo).connect();
      db = cliente.db();
      assert.equal(db.databaseName, nomeBD);
      assert.equal((await db.listCollections().toArray()).length, 0);
      let portaApi = await portaLivre();
      while (portaApi === portaMongo) portaApi = await portaLivre();
      const url = 'http://' + HOST + ':' + portaApi;
      api = vigiarProcesso(fork(__filename, ['--api-isolada'], {
        cwd: pasta, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: {
          SystemRoot: process.env.SystemRoot, PATH: process.env.PATH,
          NODE_ENV: 'test', PORT: String(portaApi), CLIENT_URL: url, MONGODB_URI: uri,
          JWT_SECRET: segredo, IMAGENS_ARMAZENAMENTO: 'local', CICLO_LEILOES_ATIVO: 'true'
        }, execArgv: []
      }));
      let pronta = false;
      api.processo.on('message', mensagem => { pronta ||= mensagem === 'api-isolada-pronta'; });
      await aguardar(async () => {
        if (api.erro || api.saiu) throw precondicao('A API isolada terminou durante o arranque');
        if (!pronta) return false;
        try { return (await fetch(url + '/api/health', { signal: AbortSignal.timeout(700) })).ok; }
        catch { return false; }
      }, 'API de teste indisponível', 18000);
      console.log('Ambiente: Node.js ' + process.version + ', MongoDB ' + versaoMongo + ' (replica set local), Socket.io WebSocket.');
      return url;
    });

    async function rest(metodo, rota, status, { token, corpo, chave } = {}) {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      if (corpo !== undefined) headers['Content-Type'] = 'application/json';
      if (chave) headers['Idempotency-Key'] = chave;
      const resposta = await fetch(base + '/api' + rota, {
        method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo),
        redirect: 'error', signal: AbortSignal.timeout(TIMEOUT)
      });
      assert.equal(resposta.status, status, metodo + ' ' + rota);
      return resposta.status === 204 ? null : resposta.json();
    }
    const get = (rota, token, status = 200) => rest('GET', rota, status, { token });
    const post = (rota, corpo, token, status = 201, chave) => rest('POST', rota, status, { corpo, token, chave });
    const patch = (rota, corpo, token, status = 200) => rest('PATCH', rota, status, { corpo, token });
    const oid = id => new ObjectId(id);
    const login = (email, password) => post('/auth/login', { email, password }, undefined, 200);
    async function registar(nome, papel, numero) {
      const email = papel + numero + '@example.test';
      const password = randomUUID();
      const corpo = { nome, email, password, papel };
      if (papel === 'produtor') corpo.produtor = { nomeExploracao: nome, localidade: 'Teste' };
      const { id } = await post('/auth/registo', corpo);
      const { token, utilizador } = await login(email, password);
      assert.equal(utilizador.id, id);
      assert.equal(utilizador.papel, papel);
      return { id, token, email };
    }
    const nomes = ['A', 'B'];
    await verifica('GET /health devolve o estado ok', async () => assert.deepEqual(await get('/health'), { estado: 'ok' }));
    const [compradorA, compradorB, produtor, outroProdutor, admin] = await verifica('Registo e login REST com identidade e papel corretos', async () => {
      // O registo público não permite criar administradores. A única inserção
      // direta de dados prepara esse utilizador na base descartável.
      const email = 'admin@example.test';
      const password = randomUUID();
      const { insertedId } = await db.collection('users').insertOne({
        nome: 'Admin E2E', papel: 'admin', email, passwordHash: await bcrypt.hash(password, 10)
      });
      const conta = await login(email, password);
      assert.equal(conta.utilizador.papel, 'admin');
      return [...await Promise.all([
        registar('Comprador A', 'comprador', 1), registar('Comprador B', 'comprador', 2),
        registar('Apiário do Vale', 'produtor', 1), registar('Pomar da Serra', 'produtor', 2)
      ]), { id: String(insertedId), token: conta.token }];
    });
    let expirado;
    await verifica('Palavra-passe incorreta, JWT ausente, inválido e expirado são rejeitados com 401', async () => {
      expirado = jwt.sign({ id: compradorA.id, papel: 'comprador' }, segredo, { expiresIn: -1 });
      await Promise.all([
        post('/auth/login', { email: compradorA.email, password: randomUUID() }, undefined, 401),
        get('/auth/eu', undefined, 401), get('/auth/eu', 'invalido', 401), get('/auth/eu', expirado, 401)
      ]);
    });
    await verifica('A sessão válida identifica a conta e a API restringe o acesso por papel', async () => {
      assert.equal((await get('/auth/eu', compradorA.token)).id, compradorA.id);
      await get('/admin/estatisticas', compradorA.token, 403);
      assert.equal(typeof (await get('/admin/estatisticas', admin.token)).produtores, 'number');
      await post('/products', {}, compradorA.token, 403);
    });
    const [socketA, socketB, socketProdutor] = await verifica('Socket.io recusa JWT ausente/expirado e liga três clientes autenticados por WebSocket', async () => {
      const negados = [undefined, expirado].map(t => criarClienteSocket(base, t, sockets));
      assert.deepEqual(await Promise.all(negados.map(c => c.ligar())), [401, 401]);
      const clientes = [compradorA, compradorB, produtor].map(u => criarClienteSocket(base, u.token, sockets));
      assert.deepEqual(await Promise.all(clientes.map(c => c.ligar())), [200, 200, 200]);
      assert(clientes.every(c => c.socket.io.engine.transport.name === 'websocket'));
      return clientes;
    });
    const dadosMel = { nome: 'Mel de urze', descricao: 'Colheita artesanal', categoria: 'Mel', preco: 5, stock: 10, biologico: true };
    await verifica('Produtor pendente não publica produtos e recebe aprovação por notificação privada', async () => {
      await post('/products', dadosMel, produtor.token, 403);
      const pendentes = await get('/admin/produtores/pendentes', admin.token);
      assert(pendentes.some(p => p._id === produtor.id));
      for (const conta of [produtor, outroProdutor]) {
        const resposta = await patch('/admin/produtores/' + conta.id + '/validacao', { aprovado: true }, admin.token);
        assert.equal(resposta.produtor.estadoValidacao, 'aprovado');
      }
      await socketProdutor.evento('conta-validada', e => e.id === produtor.id);
      assert(!(await get('/admin/produtores/pendentes', admin.token)).some(p => p._id === produtor.id));
      assert(!socketB.eventos.some(e => e.nome === 'conta-validada'));
    });
    const [mel, melCaro, fruta] = await verifica('Produtores aprovados publicam produtos; titularidade e validação de preço e stock', async () => {
      const novo = await post('/products', dadosMel, produtor.token);
      const caro = await post('/products', { ...dadosMel, nome: 'Mel de rosmaninho', preco: 8 }, produtor.token);
      const outro = await post('/products', { nome: 'Maçã', categoria: 'Fruta', preco: 2.5, stock: 5 }, outroProdutor.token);
      await rest('PUT', '/products/' + novo._id, 404, { token: outroProdutor.token, corpo: { stock: 3 } });
      await post('/products', { ...dadosMel, preco: 1.234 }, produtor.token, 400);
      await post('/products', { ...dadosMel, stock: 1.5 }, produtor.token, 400);
      return [novo, caro, outro];
    });
    await verifica('Pesquisa por nome, descrição e produtor; categoria, preço máximo e ordenação', async () => {
      const ids = lista => lista.map(p => p._id);
      assert.deepEqual(ids(await get('/products?q=Mel&categoria=Mel&ordenar=preco_desc')), [melCaro._id, mel._id]);
      assert.deepEqual(ids(await get('/products?q=artesanal&precoMax=5&bio=true')), [mel._id]);
      assert.deepEqual(ids(await get('/products?q=Serra&categoria=Fruta')), [fruta._id]);
    });
    const linhas = (...pares) => pares.map(([p, quantidade]) => ({ produto: p._id, quantidade }));
    const compra = (comprador, chave, artigos, status = 201) => post('/orders', {
      linhas: artigos, entrega: { tipo: 'levantamento' }
    }, comprador.token, status, chave);
    const stock = async produto => (await get('/products/' + produto._id)).stock;
    const artigos = linhas([mel, 2], [fruta, 1]);
    const encomenda = await verifica('Checkout transacional: uma encomenda por produtor e stock reservado', async () => {
      const encomendas = await compra(compradorA, 'compra-dois-produtores', artigos);
      assert.deepEqual(encomendas.map(e => e.produtor).sort(), [produtor.id, outroProdutor.id].sort());
      assert.deepEqual(await Promise.all([stock(mel), stock(fruta)]), [8, 4]);
      const primeira = encomendas.find(e => e.produtor === produtor.id);
      await socketProdutor.evento('nova-encomenda', e => e.id === primeira._id);
      return primeira;
    });
    await verifica('Idempotency-Key repete as encomendas sem novo desconto e recusa dados diferentes', async () => {
      const repetidas = await compra(compradorA, 'compra-dois-produtores', artigos);
      assert.equal(repetidas.find(e => e.produtor === produtor.id)._id, encomenda._id);
      assert.equal(await db.collection('orders').countDocuments(), 2);
      assert.deepEqual(await Promise.all([stock(mel), stock(fruta)]), [8, 4]);
      await compra(compradorA, 'compra-dois-produtores', linhas([mel, 1]), 409);
    });
    await verifica('Stock insuficiente no segundo artigo reverte a reserva do primeiro e o checkout', async () => {
      await compra(compradorA, 'rollback', linhas([mel, 1], [fruta, 99]), 409);
      assert.deepEqual(await Promise.all([stock(mel), stock(fruta)]), [8, 4]);
      assert.equal(await db.collection('orders').countDocuments(), 2);
      assert.equal(await db.collection('checkouts').countDocuments(), 1);
    });
    const rotaEstado = '/orders/' + encomenda._id + '/estado';
    const dadosReview = { encomenda: encomenda._id, produto: mel._id, classificacao: 5 };
    await verifica('Encomenda privada, avaliação antecipada recusada e estados só avançam', async () => {
      await get('/orders/' + encomenda._id, compradorB.token, 404);
      await post('/reviews', dadosReview, compradorA.token, 409);
      await patch(rotaEstado, { estado: 'confirmada' }, compradorA.token, 403);
      for (const estado of ['confirmada', 'pronta', 'entregue']) {
        assert.equal((await patch(rotaEstado, { estado }, produtor.token)).estado, estado);
        await socketA.evento('encomenda-atualizada', e => e.id === encomenda._id && e.estado === estado);
      }
      await patch(rotaEstado, { estado: 'pronta' }, produtor.token, 409);
      assert(!socketB.eventos.some(e => e.nome === 'encomenda-atualizada'));
    });
    const review = await verifica('Avaliação após entrega e prevenção de duplicados', async () => {
      const criada = await post('/reviews', dadosReview, compradorA.token);
      await post('/reviews', dadosReview, compradorA.token, 409);
      assert((await get('/reviews?produto=' + mel._id)).some(r => r._id === criada._id));
      return criada;
    });
    await verifica('Denúncias concorrentes da mesma conta contam uma vez e o administrador pode ocultar', async () => {
      const rota = '/reviews/' + review._id + '/denuncia';
      await Promise.all([post(rota, {}, compradorB.token, 204), post(rota, {}, compradorB.token, 204)]);
      const denunciadas = await get('/admin/reviews/denunciadas', admin.token);
      assert.equal(denunciadas.find(r => r._id === review._id).denuncias, 1);
      assert(!Object.hasOwn(denunciadas.find(r => r._id === review._id), 'denunciantes'));
      await patch('/admin/reviews/' + review._id, { visivel: false }, admin.token);
      assert(!(await get('/reviews?produto=' + mel._id)).some(r => r._id === review._id));
    });

    const clientes = [socketA, socketB];
    const compradores = [compradorA, compradorB];
    const alias = id => nomes[compradores.findIndex(c => c.id === String(id))];
    const novoLeilao = (lote, datas = { duracao: 5 }) => post('/auctions', {
      lote, produto: mel._id, precoBase: 100, incremento: 5, ...datas
    }, produtor.token);
    async function estadoInicial(id, estado = 'ativo') {
      const desde = socketA.eventos.length;
      const primeiro = await socketA.entrar(id);
      const segundo = await socketB.entrar(id);
      await socketA.evento('presenca', n => n === 2, desde);
      for (const s of [primeiro, segundo]) {
        assert.equal(s.leilao.estado, estado);
        assert.equal(s.leilao.licitacaoAtual.valor, 100);
        assert.equal(s.leilao.numLicitacoes, 0);
        assert.equal(s.licitacoes.length, 0);
        assert(Number.isFinite(Date.parse(s.agora)));
      }
    }
    const dadosLeilao = async id => {
      const filtro = { leilao: oid(id) };
      const [auction, bids, orders] = await Promise.all([
        db.collection('auctions').findOne({ _id: oid(id) }),
        db.collection('bids').find(filtro).toArray(),
        db.collection('orders').find(filtro).toArray()
      ]);
      return { auction, bids, orders };
    };
    await verifica('Salas têm presença e recusam lances abaixo do mínimo, de produtores e antes da abertura', async () => {
      const ativo = await novoLeilao('Validação de lances');
      await estadoInicial(ativo._id);
      assert.match((await socketA.licitar(ativo._id, 104)).erro, /mínima/i);
      assert.match((await socketProdutor.licitar(ativo._id, 105)).erro, /compradores/i);
      const futuro = await novoLeilao('Agendado distante', { iniciaEm: new Date(Date.now() + 180000).toISOString(), duracao: 2 });
      assert.match((await socketA.licitar(futuro._id, 105)).erro, /não está ativo/i);
      assert.equal((await dadosLeilao(ativo._id)).bids.length, 0);
      assert.equal((await dadosLeilao(futuro._id)).bids.length, 0);
    });
    async function corrida(id, numero) {
      const respostas = await Promise.all(clientes.map(c => c.licitar(id, 105)));
      assert.equal(respostas.filter(r => r.ok === true).length, 1);
      const vencedor = respostas.findIndex(r => r.ok);
      assert.equal(respostas[1 - vencedor].ok, false);
      assert.match(respostas[1 - vencedor].erro, /110,00/);
      const { auction, bids } = await dadosLeilao(id);
      assert.equal(auction.numLicitacoes, 1);
      assert.equal(auction.licitacaoAtual.valor, 105);
      assert.equal(bids.length, 1);
      assert.equal(bids[0].valor, 105);
      assert.equal(String(bids[0].comprador), compradores[vencedor].id);
      assert.equal(String(auction.licitacaoAtual.comprador), String(bids[0].comprador));
      assert.equal(String(bids[0]._id), respostas[vencedor].licitacao._id);
      for (const c of clientes) {
        const e = await c.evento('nova-licitacao', x => x.leilaoId === id);
        assert.equal(e.valor, 105);
        assert.equal(e.numLicitacoes, 1);
        assert.equal(e.comprador, compradores[vencedor].id);
      }
      const historico = await get('/auctions/' + id + '/bids');
      assert.deepEqual(historico.map(b => b._id), [String(bids[0]._id)]);
      console.log('EVIDÊNCIA corrida-' + numero + ' ' + JSON.stringify({
        respostas: respostas.map((r, i) => ({ comprador: nomes[i], ok: r.ok, ...(r.ok ? { valor: r.valor } : { erro: r.erro }) })),
        Auction: { numLicitacoes: auction.numLicitacoes, valor: auction.licitacaoAtual.valor, lider: alias(auction.licitacaoAtual.comprador) },
        Bid: [{ valor: bids[0].valor, comprador: alias(bids[0].comprador) }],
        clientes: 'ambos receberam o mesmo lance confirmado'
      }));
      return vencedor;
    }
    for (const numero of [1, 2, 3]) {
      await verifica('Concorrência ' + numero + '/3: dois lances de 105 €, uma aceitação e estado igual nos clientes e no MongoDB', async () => {
        const leilao = await novoLeilao('Concorrência ' + numero);
        await estadoInicial(leilao._id);
        await corrida(leilao._id, numero);
      });
    }
    await verifica('Rajada de dez lances: acknowledgements aceites, Bid, incremento e Auction consistentes', async () => {
      const leilao = await novoLeilao('Rajada de dez lances');
      await estadoInicial(leilao._id);
      const valores = [105, 120, 110, 115, 125, 140, 130, 135, 145, 150];
      const respostas = await Promise.all(valores.map((valor, i) => clientes[i % 2].licitar(leilao._id, valor)));
      assert(respostas.every(r => typeof r.ok === 'boolean'));
      const aceites = respostas.flatMap((r, i) => r.ok ? [{ id: r.licitacao._id, valor: valores[i], comprador: compradores[i % 2].id }] : []);
      const { auction, bids } = await dadosLeilao(leilao._id);
      assert(aceites.length > 0);
      assert.deepEqual(bids.map(b => ({ id: String(b._id), valor: b.valor, comprador: String(b.comprador) })).sort((a, b) => a.valor - b.valor),
        aceites.sort((a, b) => a.valor - b.valor));
      assert.equal(auction.numLicitacoes, aceites.length);
      assert.equal(auction.licitacaoAtual.valor, 150);
      assert.equal(String(auction.licitacaoAtual.comprador), aceites.at(-1).comprador);
      const eventos = await Promise.all(clientes.map(c => c.evento('nova-licitacao', x => x.leilaoId === leilao._id && x.numLicitacoes === aceites.length)));
      const sequencia = c => c.eventos.filter(e => e.nome === 'nova-licitacao' && e.dados.leilaoId === leilao._id).map(e => e.dados.valor);
      assert(eventos.every(e => e.valor === 150));
      for (const c of clientes) assert.deepEqual(sequencia(c), aceites.map(a => a.valor));
      let anterior = 100;
      for (const { valor } of aceites) { assert(valor - anterior >= 5); anterior = valor; }
      console.log('EVIDÊNCIA rajada ' + JSON.stringify({
        pedidos: valores.length, aceites: aceites.map(a => a.valor), recusados: valores.length - aceites.length,
        bidsGravados: bids.length, valorFinal: auction.licitacaoAtual.valor
      }));
    });

    const { comLance, vazio } = await verifica('O ciclo abre automaticamente os leilões agendados', async () => {
      const inicio = Date.now() + 3500;
      const datas = { iniciaEm: new Date(inicio).toISOString(), terminaEm: new Date(inicio + 8500).toISOString() };
      const [comLance, vazio] = await Promise.all([novoLeilao('Fecho com vencedor', datas), novoLeilao('Fecho sem licitações', datas)]);
      assert.equal(vazio.estado, 'agendado');
      await estadoInicial(comLance._id, 'agendado');
      await Promise.all(clientes.map(c => c.evento('aberto', e => e.id === comLance._id)));
      assert.equal((await get('/auctions/' + comLance._id)).estado, 'ativo');
      return { comLance, vazio };
    });
    const vencedor = await verifica('Leilão aberto aceita uma licitação válida e permite recuperar o estado ao voltar à sala', async () => {
      const resposta = await socketA.licitar(comLance._id, 105);
      assert.equal(resposta.ok, true);
      socketB.socket.disconnect();
      assert.equal(await socketB.ligar(), 200);
      const estado = await socketB.entrar(comLance._id);
      assert.equal(estado.leilao.licitacaoAtual.valor, 105);
      assert.equal(estado.licitacoes.length, 1);
      return compradorA;
    });
    await verifica('Fecho automático anuncia vencedor e cria uma única encomenda privada, mesmo após novo ciclo', async () => {
      const id = comLance._id;
      const [fimA, fimB, ganho, produtorFim] = await Promise.all([
        ...clientes.map(c => c.evento('terminado', e => e.id === id, 0, 16000)),
        socketA.evento('leilao-ganho', e => e.id === id, 0, 16000),
        socketProdutor.evento('leilao-terminado', e => e.id === id, 0, 16000)
      ]);
      assert.deepEqual(fimA, fimB);
      assert.equal(fimA.vencedor.id, vencedor.id);
      assert.equal(fimA.valor, 105);
      assert(!Object.hasOwn(fimA, 'encomenda'));
      assert.equal(ganho.encomenda, produtorFim.encomenda);
      await get('/orders/' + ganho.encomenda, compradorB.token, 404);
      assert.equal((await get('/orders/' + ganho.encomenda, vencedor.token)).total, 105);
      assert.equal((await socketA.licitar(id, 110)).ok, false);
      // O temporizador do servidor executa a cada 2 s.
      await esperar(2200);
      const { auction, bids, orders } = await dadosLeilao(id);
      assert.equal(auction.estado, 'terminado');
      assert.equal(auction.numLicitacoes, bids.length);
      assert.equal(bids.length, 1);
      assert.equal(orders.length, 1);
      const [order] = orders;
      assert.equal(String(auction.encomenda), ganho.encomenda);
      assert.equal(String(order._id), ganho.encomenda);
      assert.equal(String(order.comprador), vencedor.id);
      assert.equal(String(order.produtor), produtor.id);
      assert.equal(order.estado, 'confirmada');
      assert.equal(order.origem, 'leilao');
      assert.equal(order.linhas.length, 1);
      const [linha] = order.linhas;
      assert.deepEqual([String(linha.produto), linha.quantidade, linha.unidade, linha.precoUnit], [mel._id, 1, 'lote', 105]);
      assert(!socketB.eventos.some(e => e.nome === 'leilao-ganho' && e.dados.id === id));
      const indice = (await db.collection('orders').indexes()).find(i => i.name === NOME_INDICE);
      assert.equal(indice?.unique, true);
      assert.deepEqual(indice.partialFilterExpression, { origem: 'leilao', leilao: { $type: 'objectId' } });
      console.log('EVIDÊNCIA fecho ' + JSON.stringify({
        Auction: { estado: auction.estado, numLicitacoes: auction.numLicitacoes },
        Bid: bids.length, Order: { documentos: orders.length, origem: order.origem, estado: order.estado, valor: linha.precoUnit }
      }));
    });
    await verifica('Leilão sem lances termina sem vencedor, licitações ou encomenda', async () => {
      await aguardar(async () => (await get('/auctions/' + vazio._id)).estado === 'terminado',
        'O leilão sem lances não terminou', 16000);
      const { auction, bids, orders } = await dadosLeilao(vazio._id);
      assert.equal(auction.numLicitacoes, 0);
      assert.equal(auction.licitacaoAtual.comprador, undefined);
      assert.equal(auction.encomenda, undefined);
      assert.equal(bids.length, 0);
      assert.equal(orders.length, 0);
    });
  } catch {
    console.error('Suite interrompida após uma falha; as verificações seguintes dependentes não foram executadas.');
  } finally {
    try {
      await verifica('Encerramento da API, dos sockets e do MongoDB temporário e remoção dos ficheiros', async () => {
        sockets.forEach(s => s.disconnect());
        let apiEncerrada = true;
        if (api && !api.saiu && !api.erro) {
          if (api.processo.connected) api.processo.send('encerrar');
          apiEncerrada = (await esperarSaida(api, 26000)) === 0;
          if (!api.saiu) { api.processo.kill(); await esperarSaida(api, 4000); }
        }
        if (cliente) {
          try { await cliente.db('admin').command({ shutdown: 1, force: true, timeoutSecs: 1 }); }
          catch { /* MongoDB fecha a ligação antes de responder. */ }
          finally { await cliente.close(); }
        }
        if (mongodb && !mongodb.saiu && !mongodb.erro) {
          if (await esperarSaida(mongodb, 1500) === undefined) {
            mongodb.processo.kill();
            await esperarSaida(mongodb, 4000);
          }
        }
        assert(!mongodb || mongodb.saiu || mongodb.erro, 'O processo MongoDB ainda está ativo');
        assert(!api || api.saiu || api.erro, 'O processo API ainda está ativo');
        if (pasta) {
          const resolvida = await fs.realpath(pasta);
          assert.equal(path.dirname(resolvida), raizTemp);
          assert.match(path.basename(resolvida), /^dcm-e2e-[a-zA-Z0-9]+$/);
          await fs.rm(resolvida, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
        }
        assert(apiEncerrada);
      });
    } catch { /* verifica() já registou a falha de limpeza. */ }
    console.log('Resumo: ' + aprovadas + ' aprovadas, ' + falhadas + ' falhadas (' + (aprovadas + falhadas) + ' executadas).');
    process.exitCode = falhadas ? 1 : 0;
  }
}
