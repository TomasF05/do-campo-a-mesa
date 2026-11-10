// A notificação é posterior à gravação e nunca pode fazer falhar a operação confirmada.
function notificar(io, sala, evento, dados) {
  if (!io) return;
  const falhou = (err) => console.error(`Erro ao emitir ${evento}:`, err);
  try {
    const resultado = io.to(sala).emit(evento, dados);
    if (typeof resultado?.catch === 'function') resultado.catch(falhou);
  } catch (err) { falhou(err); }
}

module.exports = { notificar };
