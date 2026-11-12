const { Schema, model, Types } = require('mongoose');

// A chave é composta pelo comprador e pelo identificador enviado pelo cliente.
const checkoutSchema = new Schema({
  _id: String,
  assinatura: { type: String, required: true },
  encomendas: [{ type: Types.ObjectId, ref: 'Order' }]
}, { versionKey: false });

module.exports = model('Checkout', checkoutSchema);
