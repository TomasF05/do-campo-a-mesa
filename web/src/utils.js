export const CATEGORIAS = ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
export const EPOCAS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export const euro = (valor) => Number(valor).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
export const totalEncomenda = (e) => e.linhas.reduce((s, l) => s + l.precoUnit * l.quantidade, 0);
