const User = require('../models/User');
const { a, erro } = require('../utils/http');

module.exports = a(async (req, res, next) => {
  const existe = await User.exists({ _id: req.user.id, papel: 'produtor', 'produtor.validado': true });
  if (!existe) throw erro(403, 'O produtor ainda não foi validado');
  next();
});
