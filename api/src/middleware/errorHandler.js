// Tratamento centralizado de erros: converte erros do Mongoose em códigos HTTP
module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.name === 'ValidationError') {
    const detalhes = Object.fromEntries(Object.entries(err.errors).map(([campo, e]) => [campo, e.message]));
    return res.status(400).json({ erro: 'Dados inválidos', detalhes });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ erro: 'Identificador ou valor inválido' });
  }
  if (err.code === 11000) return res.status(409).json({ erro: 'Já existe um registo com esses dados' });
  if (err.name === 'MulterError') return res.status(400).json({ erro: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem demasiado grande (máximo 5 MB)' : 'Upload inválido' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Corpo JSON inválido' });
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ erro: status >= 500 ? 'Erro interno' : err.message });
};
