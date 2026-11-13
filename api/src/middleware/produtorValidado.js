const User = require('../models/User');
const { a, erro } = require('../utils/http');

module.exports = a(async (req, res, next) => {
  const produtor = await User.findOne({ _id: req.user.id, papel: 'produtor' }).select('produtor.validado produtor.estadoValidacao').lean();
  const { estadoValidacao } = User.normalizarProdutor(produtor?.produtor);
  if (estadoValidacao === 'rejeitado') throw erro(403, 'A conta de produtor foi rejeitada');
  if (estadoValidacao !== 'aprovado') throw erro(403, 'O produtor ainda não foi validado');
  next();
});
