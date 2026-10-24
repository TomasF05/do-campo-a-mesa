// TODO (Passo 4): decidir se as avaliações ficam embebidas no produto/produtor
// ou numa coleção própria, e justificar a decisão no relatório.
const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  encomenda: { type: Types.ObjectId, ref: 'Order' },
  classificacao: { type: Number, min: 1, max: 5, required: true },
  comentario: String,
  denuncias: { type: Number, default: 0 },
  visivel: { type: Boolean, default: true }
}, { timestamps: true });

// Garante o 409 mesmo quando duas avaliações iguais chegam em simultâneo.
reviewSchema.index({ autor: 1, encomenda: 1, produto: 1 }, {
  unique: true, partialFilterExpression: { encomenda: { $type: 'objectId' } }
});

module.exports = model('Review', reviewSchema);
