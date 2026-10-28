const { Schema, model, Types } = require('mongoose');

const productSchema = new Schema({
  produtor: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  nome: { type: String, required: true, trim: true },
  descricao: { type: String, maxlength: 1000 },
  categoria: {
    type: String,
    enum: ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'],
    required: true
  },
  preco: { type: Number, required: true, min: 0 },
  unidade: { type: String, default: 'kg' }, // kg, unid., garrafa, 500 g…
  stock: { type: Number, default: 0, min: 0, validate: { validator: Number.isSafeInteger, message: 'O stock tem de ser um número inteiro' } },
  biologico: { type: Boolean, default: false },
  epocas: [{ type: String, enum: ['Primavera', 'Verão', 'Outono', 'Inverno'] }],
  imagemUrl: String // Passo 8: URL da imagem no storage da Cloud
}, { timestamps: true });

productSchema.index({ categoria: 1, preco: 1 });

module.exports = model('Product', productSchema);
