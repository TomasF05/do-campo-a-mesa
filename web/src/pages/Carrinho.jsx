import { useCarrinho } from '../context/CarrinhoContext.jsx';
import FinalizarCarrinho from '../components/FinalizarCarrinho.jsx';
import { Link } from 'react-router-dom';

export default function Carrinho() {
  const { linhas, alterarQuantidade, remover, esvaziar, total } = useCarrinho();
  return (
    <>
      <h1>Carrinho</h1>
      {linhas.length === 0 ? <p>O carrinho está vazio. <Link to="/">Explorar produtos</Link></p> : (
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
                    disabled={Number.isFinite(produto.stock) && quantidade >= produto.stock}
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
      {linhas.length > 0 && <button className="btn btn-outline-danger mb-3" type="button" onClick={esvaziar}>Esvaziar carrinho</button>}
      <FinalizarCarrinho />
    </>
  );
}
