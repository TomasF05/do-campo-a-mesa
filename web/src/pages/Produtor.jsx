// Visitante: página pública do produtor
import { useParams } from 'react-router-dom';
import CartaoProduto from '../components/CartaoProduto.jsx';
import produtos from '../data/produtos.json';

export default function Produtor() {
  const { id } = useParams();

  const produtosDoProdutor = produtos.filter(
    (p) => p.produtor?._id === id
  );

  const produtor = produtosDoProdutor[0]?.produtor;

  if (!produtor) {
    return (
      <>
        <h1>Produtor</h1>
        <p>Produtor não encontrado.</p>
      </>
    );
  }

  return (
    <>
      <section className="mb-4">
        <h1>{produtor.nome}</h1>

        <p className="texto-secundario">
          {produtor.produtor?.localidade}
        </p>
      </section>

      <section aria-labelledby="produtos-produtor">
        <h2 id="produtos-produtor">
          Produtos
        </h2>

        <div className="grelha-produtos">
          {produtosDoProdutor.map((produto) => (
            <CartaoProduto key={produto._id} produto={produto}/>
          ))}
        </div>
      </section>
    </>
  );
}
