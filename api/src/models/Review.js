// Coleção própria: as avaliações são consultadas e moderadas independentemente.
const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  produto: { type: Types.ObjectId, ref: 'Product', index: true },
  encomenda: { type: Types.ObjectId, ref: 'Order', required: true },
  classificacao: { type: Number, min: 1, max: 5, required: true, validate: { validator: Number.isInteger, message: 'A classificação tem de ser um número inteiro' } },
  comentario: { type: String, trim: true, maxlength: 1000 },
  denuncias: { type: Number, default: 0, min: 0 },
  visivel: { type: Boolean, default: true }
}, { timestamps: true });

// Garante o 409 mesmo quando duas avaliações iguais chegam em simultâneo.
reviewSchema.index({ autor: 1, encomenda: 1, produto: 1 }, {
  unique: true, partialFilterExpression: { encomenda: { $type: 'objectId' } }
});

module.exports = model('Review', reviewSchema);
