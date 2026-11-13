const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const pastaUploads = path.join(__dirname, '..', '..', 'uploads');
const LIMITE_ENVIO_MS = 12000;
const LIMITE_REMOCAO_MS = 4000;

function validarArmazenamento() {
  const modo = process.env.IMAGENS_ARMAZENAMENTO || (process.env.NODE_ENV === 'production' ? 'cloudinary' : 'local');
  if (modo !== 'local' && modo !== 'cloudinary') {
    throw new Error('IMAGENS_ARMAZENAMENTO deve ser local ou cloudinary');
  }
  if (modo === 'cloudinary') {
    try {
      const configuracao = new URL(process.env.CLOUDINARY_URL);
      if (configuracao.protocol !== 'cloudinary:' || !configuracao.hostname || !configuracao.username || !configuracao.password) {
        throw new Error();
      }
      require('cloudinary').v2.config({
        cloud_name: configuracao.hostname,
        api_key: decodeURIComponent(configuracao.username),
        api_secret: decodeURIComponent(configuracao.password)
      });
    } catch {
      throw new Error('Defina uma CLOUDINARY_URL válida para o armazenamento de imagens');
    }
  }
  return modo;
}

async function removerOrfa(remover) {
  try {
    await remover();
  } catch {
    console.error('Não foi possível remover a nova fotografia após uma falha.');
  }
}

async function guardarImagem(buffer, extensao, origem) {
  const modo = validarArmazenamento();
  const nome = randomUUID();

  if (modo === 'local') {
    const ficheiro = nome + '.' + extensao;
    const destino = path.join(pastaUploads, ficheiro);
    await fs.mkdir(pastaUploads, { recursive: true });
    const handle = await fs.open(destino, 'wx');
    const remover = () => fs.unlink(destino);
    try {
      try {
        await handle.writeFile(buffer);
      } finally {
        await handle.close();
      }
    } catch (err) {
      await removerOrfa(remover);
      throw err;
    }
    return { imagemUrl: origem + '/uploads/' + ficheiro, remover };
  }

  const { uploader } = require('cloudinary').v2;
  const publicId = 'do-campo-a-mesa/produtos/' + nome;
  const opcoes = { resource_type: 'image', public_id: publicId, overwrite: false, timeout: LIMITE_ENVIO_MS };
  const remover = async () => {
    const { result } = await uploader.destroy(publicId, { resource_type: 'image', timeout: LIMITE_REMOCAO_MS });
    if (result !== 'ok' && result !== 'not found') throw new Error('O Cloudinary não confirmou a remoção');
  };
  try {
    const resultado = await new Promise((resolve, reject) => {
      const stream = uploader.upload_stream(opcoes, (err, imagem) => err ? reject(err) : resolve(imagem));
      stream.once('error', reject);
      stream.end(buffer);
    });
    if (resultado?.public_id !== publicId || resultado.existing || !resultado.secure_url?.startsWith('https://')) {
      throw new Error('Resposta inesperada do Cloudinary');
    }
    return { imagemUrl: resultado.secure_url, remover };
  } catch {
    throw new Error('Não foi possível enviar a fotografia para o Cloudinary');
  }
}

module.exports = { guardarImagem, removerOrfa, validarArmazenamento };
