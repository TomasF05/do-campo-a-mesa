// Linha temporal do estado da encomenda: pendente -> confirmada -> pronta -> entregue
const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];

export default function EstadoEncomenda({ estado }) {
  const indice = ESTADOS.indexOf(estado);
  return (
    <ol className="estado-encomenda" aria-label={`Estado: ${estado}`}>
      {ESTADOS.map((e, i) => (
        <li key={e} aria-current={i === indice ? 'step' : undefined} className={i < indice ? 'feito' : i === indice ? 'atual' : ''}>{e}{i === indice && <span className="visually-hidden"> (estado atual)</span>}</li>
      ))}
    </ol>
  );
}
