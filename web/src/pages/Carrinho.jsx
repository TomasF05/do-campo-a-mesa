import { useCarrinho } from '../context/CarrinhoContext.jsx';
import PorImplementar from '../components/PorImplementar.jsx';

export default function Carrinho() {
  const { linhas, alterarQuantidade, remover, total } = useCarrinho();
  return (
    <>
      <h1>Carrinho</h1>
      {linhas.length === 0 ? <p>O carrinho está vazio.</p> : (
        <ul className="list-group mb-3">
          {linhas.map(({ produto, quantidade }) => (
            <li
              key={produto._id}
              className="list-group-item"
            >
              <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                <div>
                  <strong>{produto.nome}</strong>

                  <div className="small text-muted">
                    {produto.preco.toFixed(2)} € / {produto.unidade}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() =>
                      alterarQuantidade(
                        produto._id,
                        quantidade - 1
                      )
                    }
                    aria-label={`Diminuir quantidade de ${produto.nome}`}
                  >
                    −
                  </button>

                  <span>{quantidade}</span>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() =>
                      alterarQuantidade(
                        produto._id,
                        quantidade + 1
                      )
                    }
                    aria-label={`Aumentar quantidade de ${produto.nome}`}
                  >
                    +
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => remover(produto._id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="fw-bold">Total: {total.toFixed(2)} €</p>
      <PorImplementar passo={3}>
        escolher levantamento ou entrega e submeter com <code>POST /api/orders</code> (uma encomenda por produtor).
      </PorImplementar>
    </>
  );
}
