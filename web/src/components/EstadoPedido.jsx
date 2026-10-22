export default function EstadoPedido({ aCarregar, erro }) {
  if (aCarregar) return <p role="status">A carregar…</p>;
  if (erro) return <p className="alert alert-danger" role="alert">{erro}</p>;
  return null;
}
