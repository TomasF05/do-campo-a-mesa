// Utilizador: comprador (particular ou restaurante), produtor ou administrador
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  nome: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
  passwordHash: { type: String, required: true, select: false },
  papel: { type: String, enum: ['comprador', 'produtor', 'admin'], default: 'comprador' },

  // Dados específicos do produtor (página pública)
  produtor: {
    nomeExploracao: String,
    descricao: { type: String, maxlength: 1000 },
    localidade: String,
    localizacao: { lat: Number, lng: Number },
    validado: { type: Boolean, default: false } // o administrador valida o registo
  }
}, { timestamps: true });

userSchema.index({ papel: 1, 'produtor.validado': 1, 'produtor.localidade': 1 });

userSchema.methods.publico = function publico() {
  return {
    id: this._id,
    nome: this.nome,
    email: this.email,
    papel: this.papel,
    ...(this.papel === 'produtor' ? { produtor: this.produtor } : {})
  };
};

module.exports = model('User', userSchema);
