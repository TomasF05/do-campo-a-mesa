import CartaoLeilao from '../components/CartaoLeilao.jsx';
import { useApi } from '../hooks/useApi.js';
import EstadoPedido from '../components/EstadoPedido.jsx';

export default function Leiloes() {
  const { dados, erro, aCarregar } = useApi('/auctions');
  const ativos = (dados || []).filter(
    (leilao) =>
      leilao.estado === 'ativo' ||
      leilao.estado === 'agendado'
  );

  return (
    <>
      <header className="mb-4">
        <h1>Leilões</h1>

        <p className="texto-secundario">
          Consulte os lotes disponíveis e acompanhe
          os leilões dos produtores locais.
        </p>
      </header>

      <EstadoPedido aCarregar={aCarregar} erro={erro} />
      {!aCarregar && !erro && (ativos.length === 0 ? (
        <p className="texto-secundario">
          Não existem leilões disponíveis.
        </p>
      ) : (
        <section
          className="grelha-leiloes"
          aria-labelledby="titulo-leiloes"
        >
          <h2
            id="titulo-leiloes"
            className="visually-hidden"
          >
            Leilões disponíveis
          </h2>

          {ativos.map((leilao) => (
            <div
              key={leilao._id}
              className="h-100"
            >
              <CartaoLeilao leilao={leilao} />
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
