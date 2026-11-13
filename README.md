# Do Campo à Mesa

Mercado digital que aproxima os produtores locais do Alto Minho dos consumidores e da restauração. Reúne um catálogo pesquisável, encomendas e leilões em direto para lotes sazonais ou excedentes. Projeto individual da unidade curricular de **Desenvolvimento Web e para a Cloud**, do Mestrado em Engenharia Informática (IPVC–ESTG).

| Serviço | Endereço público |
| --- | --- |
| Aplicação | [Do Campo à Mesa](https://do-campo-a-mesa-web-d1xc.onrender.com) |
| API REST | [Origem da API](https://do-campo-a-mesa-342d.onrender.com), com os recursos sob `/api`. [Verificação de saúde](https://do-campo-a-mesa-342d.onrender.com/api/health) |
| Documentação da API | [Swagger UI](https://do-campo-a-mesa-342d.onrender.com/api-docs/) |

## Funcionalidades

- **Visitante:** consulta o catálogo, pesquisa por nome, descrição ou produtor, filtra e ordena produtos, e consulta perfis públicos e a listagem de leilões.
- **Comprador:** gere o carrinho, encomenda para entrega ou levantamento, acompanha o estado das encomendas, avalia produtos e produtores após a entrega e licita em direto.
- **Produtor:** edita o perfil público e acompanha o estado de validação. Após aprovação, pode publicar produtos com fotografias, gerir stock e criar leilões. No painel, consulta as encomendas recebidas e atualiza o seu estado.
- **Administrador:** consulta indicadores, aprova ou rejeita produtores e modera avaliações denunciadas.

## Arquitetura e tecnologias

| Componente | Tecnologias e responsabilidade |
| --- | --- |
| `web/` | SPA em JavaScript com React, Vite, React Router, Bootstrap 5 e Sass. Os contextos React mantêm a sessão, o carrinho e a ligação Socket.io. |
| `api/` | Node.js e Express para a API REST e Socket.io para tempo real no mesmo servidor HTTP. JWT e bcryptjs para autenticação e palavras-passe, Multer para os uploads e OpenAPI 3.0.3 com Swagger UI. |
| Dados | MongoDB, através do Mongoose. O MongoDB Atlas mantém os dados da aplicação e suporta as transações de checkout e leilões. |
| Fotografias | Cloudinary e o respetivo SDK na API em produção. Em desenvolvimento, o modo local guarda ficheiros em `api/uploads/`. |
| Publicação | Código versionado em Git/GitHub. O Render Static Site distribui o frontend compilado e o Render Web Service executa a API e o Socket.io. |

O navegador consulta a API por HTTPS e recebe atualizações pelo Socket.io, com WebSocket seguro (WSS) ou polling HTTPS. A API é responsável pelas regras de negócio, verifica o JWT e o papel do utilizador e comunica com o MongoDB e o Cloudinary. Os segredos ficam no backend. A interface segue uma abordagem Mobile First. Os estilos Sass incluem o mixin `a-partir-de()` com pontos de quebra de 768, 1024 e 1280 px. O [relatório técnico](docs/relatorio.md) descreve as decisões de implementação.

## Instalação e execução local

Recomenda-se **Node.js 22**. São também necessários npm, Git e acesso a MongoDB. Usa um **replica set** MongoDB local ou um cluster Atlas para os fluxos transacionais. Um MongoDB local em modo *standalone* não suporta as transações usadas no checkout e nos leilões. [Requisitos de transações no MongoDB](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

A partir da raiz do repositório, abre dois terminais e executa:

```bash
# Terminal 1 — API
cd api
cp .env.example .env
# Configurar as variáveis de api/.env antes do arranque.
npm ci
npm run dev
```

```bash
# Terminal 2 — frontend
cd web
cp .env.example .env
npm ci
npm run dev
```

No PowerShell, usa `Copy-Item .env.example .env` em vez de `cp` se preferires. Se o ficheiro `.env` já existir, edita-o diretamente. Abre [o frontend local](http://localhost:5173), [a verificação de saúde da API](http://localhost:3000/api/health) ou [a Swagger UI local](http://localhost:3000/api-docs/). Para arrancar a API sem o modo de desenvolvimento do Nodemon, usa `npm start` em `api/`.

### Variáveis de ambiente

| Ficheiro / serviço | Variável | Configuração |
| --- | --- | --- |
| API | `PORT` | `3000` em desenvolvimento. No Render, usa a porta fornecida pelo serviço. |
| API | `MONGODB_URI` | URI da base de dados autorizada para o ambiente. Usa uma base isolada para testes com escrita. |
| API | `JWT_SECRET` | Segredo longo e aleatório, distinto por ambiente. |
| API | `JWT_EXPIRES_IN` | Duração do token. O valor por omissão é `2h`. |
| API | `CLIENT_URL` | Origem exata do frontend, sem barra final. Localmente, `http://localhost:5173`. No Render, o URL HTTPS do Static Site. |
| API | `IMAGENS_ARMAZENAMENTO` | `local` para gravar em disco em desenvolvimento. Em produção, define `cloudinary`. |
| API | `CLOUDINARY_URL` | Credencial necessária apenas no modo `cloudinary`. Configura-a como segredo no Web Service ou no `api/.env` de teste. |
| API | `CICLO_LEILOES_ATIVO` | `true` ativa a abertura e o fecho automáticos. Define `false` quando a API local usar a mesma base que o Render. |
| Frontend | `VITE_API_URL` | Origem da API, sem `/api` nem barra final. Localmente, `http://localhost:3000`. No Static Site, `https://do-campo-a-mesa-342d.onrender.com`, definida antes da compilação. |

Mantém os ficheiros `.env` fora do Git e usa os ficheiros `.env.example` como referência. Em produção, configura `NODE_ENV=production` na API. As variáveis `VITE_*` são incorporadas no frontend durante a compilação e só devem conter valores públicos.

## Publicação e fotografias

Para reproduzir a publicação no Render, configura o Web Service com `api/` como diretório de trabalho, `npm ci` para instalar, `npm start` para arrancar e `/api/health` como verificação de saúde. A configuração da SPA usa `web/` como diretório de trabalho, `npm ci && npm run build` como comando de compilação e `dist` como pasta publicada. Uma regra de *rewrite* de `/*` para `/index.html` permite abrir ou recarregar uma rota interna da SPA. [Render Static Sites](https://render.com/docs/static-sites)

O produtor envia a fotografia para `POST /api/products/:id/imagem` no campo multipart `imagem`. A API aceita JPEG, PNG ou WebP abaixo de 5 MiB. Em produção, envia o ficheiro ao Cloudinary e guarda o URL HTTPS em `imagemUrl` no MongoDB. Assim, a imagem permanece acessível após um reinício ou uma nova publicação da API. Se um novo envio falhar, a referência anterior é preservada. Fotografias antigas referenciadas por URLs locais precisam de ser carregadas novamente para obter um URL público.

## Leilões e notificações

O produtor aprovado cria um leilão imediato ou agendado. O servidor aceita licitações de compradores autenticados, verifica o prazo e o incremento mínimo e grava o lance e a atualização do leilão na mesma transação. O ciclo abre os leilões agendados e encerra os ativos após o prazo. Quando existe vencedor, cria uma única encomenda confirmada, com uma unidade do lote e o valor final. Um leilão sem licitações termina sem encomenda.

O Socket.io atualiza a presença, o valor atual e o histórico da sala. Também entrega avisos de encomendas, aprovação de produtor e resultado de leilão aos destinatários respetivos. Após uma reconexão, a aplicação recupera o estado atual pela API REST. Os avisos emitidos durante uma desconexão podem não voltar a aparecer.

O **Render Free** suspende o Web Service após 15 minutos sem tráfego de entrada. O primeiro pedido após esse período pode demorar cerca de um minuto. Enquanto o processo estiver suspenso, o ciclo automático não corre. Quando a API retoma, os ciclos seguintes voltam a verificar os prazos vencidos. A hora registada do fecho pode, por isso, ficar depois da hora prevista, embora o servidor continue a rejeitar lances que cheguem após o prazo. O plano inclui 750 horas de instâncias Free por mês, partilhadas pelo *workspace*, e o disco do Web Service é efémero. [Limites do Render Free](https://render.com/docs/free)

## Testes

A suite de integração requer o executável **`mongod`** instalado. Coloca-o no `PATH` ou define `MONGOD_BINARY` com o caminho completo para o executável. Em Windows, a suite também procura nas pastas habituais de instalação do MongoDB.

```bash
cd api
npm ci
npm test
```

Se precisares de indicar outro caminho, define a variável antes de executar `npm test` (exemplo em PowerShell):

```powershell
$env:MONGOD_BINARY = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm test
```

A suite arranca uma API e um *replica set* descartáveis em loopback, cria os próprios dados de teste e limpa os recursos no fim. Não precisa de uma API já em execução, do `.env` habitual, do seed nem de acesso ao Atlas. O comando indica `PASS` ou `FAIL` para cada verificação e termina com código `1` se houver falhas. O [relatório](docs/relatorio.md#83-testes-e-validação) inclui a evidência das licitações concorrentes.

- Em `web/`, executa `npm run build` para verificar a compilação.
- Em `api/`, executa `npm audit --omit=dev` para verificar os avisos nas dependências de produção.
- Com a API em execução, verifica `GET /api/health` (esperado: HTTP 200 e `{"estado":"ok"}`), `GET /api/products` (lista de produtos) e `/api-docs/` (Swagger UI). `GET /api/admin/estatisticas` sem token deve devolver HTTP 401.
- Para validar um leilão, usa um produtor aprovado e dois compradores em sessões independentes. Verifica a abertura, os lances em direto, o fecho e as relações entre leilão, licitações e encomenda. Para testes com escrita, usa uma base isolada ou dados expressamente reservados para o ensaio.
- O script `npm run seed` é opcional e destrutivo. Usa-o apenas numa base local descartável para repor os dados de exemplo. A instalação e a publicação não dependem dele.
