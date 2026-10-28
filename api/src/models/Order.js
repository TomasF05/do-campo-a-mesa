// Encomenda: as LINHAS são embebidas (lidas sempre com a encomenda);
// comprador e produtor são REFERENCIADOS.
const { Schema, model, Types } = require('mongoose');

const ESTADOS = ['pendente', 'confirmada', 'pronta', 'entregue'];

const orderSchema = new Schema({
  comprador: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  linhas: {
    type: [{
      produto: { type: Types.ObjectId, ref: 'Product' },
      nome: { type: String, required: true, trim: true },
      precoUnit: { type: Number, required: true, min: 0 },
      unidade: String,
      quantidade: { type: Number, required: true, min: 1, validate: { validator: Number.isSafeInteger, message: 'A quantidade tem de ser um número inteiro' } }
    }],
    validate: { validator: (linhas) => Array.isArray(linhas) && linhas.length > 0, message: 'A encomenda tem de ter pelo menos uma linha' }
  },
  estado: { type: String, enum: ESTADOS, default: 'pendente' },
  entrega: {
    tipo: { type: String, enum: ['levantamento', 'entrega'], default: 'levantamento' },
    morada: String
  },
  origem: { type: String, enum: ['loja', 'leilao'], default: 'loja' },
  leilao: { type: Types.ObjectId, ref: 'Auction' }
}, { timestamps: true, toJSON: { virtuals: true } });

orderSchema.virtual('total').get(function total() {
  return Math.round(this.linhas.reduce((soma, linha) => soma + linha.precoUnit * linha.quantidade, 0) * 100) / 100;
});
orderSchema.statics.ESTADOS = ESTADOS;

module.exports = model('Order', orderSchema);
