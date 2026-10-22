export default function Indicadores({ itens }) {
  return <dl className="grelha-indicadores">{itens.map(([nome, valor]) => <div key={nome} className="card p-3">
    <dt className="small texto-secundario">{nome}</dt><dd className="h3 mb-0">{valor}</dd>
  </div>)}</dl>;
}
