import { Link } from 'react-router-dom';

const euro = (valor) =>
  valor.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function CartaoLeilao({ leilao }) {
  const valorAtual =
    leilao.licitacaoAtual?.valor ?? leilao.precoBase;

  return (
    <article className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <span className={`badge ${ leilao.estado === 'ativo' ? 'text-bg-danger' : 'text-bg-secondary' }`}>
            {leilao.estado === 'ativo' ? 'Em direto' : 'Agendado'}
          </span>
        </div>

        <h2 className="h5">
          {leilao.lote}
        </h2>

        <p className="texto-secundario small">
          {leilao.produtor?.nome}
          {' · '}
          {leilao.produtor?.produtor?.localidade}
        </p>

        <p className="mb-1 texto-secundario small">
          Licitação atual
        </p>

        <p className="fs-4 fw-bold">
          {euro(valorAtual)}
        </p>

        <p className="small">
          Incremento mínimo:{' '}
          {euro(leilao.incremento)}
        </p>

        <Link to={`/leiloes/${leilao._id}`} className="btn btn-success mt-auto" >
          Ver leilão
        </Link>
      </div>
    </article>
  );
}