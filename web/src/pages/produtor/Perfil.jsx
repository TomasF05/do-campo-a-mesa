import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

function camposPerfil(utilizador) {
  return {
    nome: utilizador.nome,
    nomeExploracao: utilizador.produtor?.nomeExploracao ?? '',
    localidade: utilizador.produtor?.localidade ?? '',
    descricao: utilizador.produtor?.descricao ?? ''
  };
}

export default function PerfilProdutor() {
  const { utilizador, token, estadoProdutor, atualizar } = useAuth();
  const [originais, setOriginais] = useState(() => camposPerfil(utilizador));
  const [dados, setDados] = useState(originais);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const alteracoes = Object.fromEntries(Object.entries(dados)
    .filter(([campo, valor]) => valor.trim() !== originais[campo])
    .map(([campo, valor]) => [campo, valor.trim()]));

  const mudar = (campo) => (e) => {
    setDados((atuais) => ({ ...atuais, [campo]: e.target.value }));
    setErro(''); setAviso('');
  };

  async function guardar(e) {
    e.preventDefault();
    if (aGuardar || !Object.keys(alteracoes).length) return;
    setAGuardar(true); setErro(''); setAviso('');
    try {
      const resposta = await api(`/producers/${encodeURIComponent(utilizador._id)}`, { metodo: 'PATCH', corpo: alteracoes, token });
      const perfil = camposPerfil(resposta);
      setOriginais(perfil); setDados(perfil);
      setAviso('Perfil guardado.');
      atualizar({ substituir: true });
    } catch (err) { setErro(err.message); }
    finally { setAGuardar(false); }
  }

  return <>
    <header className="mb-3"><Link to="/produtor">Voltar ao painel</Link><h1>Editar perfil público</h1></header>
    <form className="card p-3 formulario-estreito ms-0" onSubmit={guardar}>
      <fieldset disabled={aGuardar}>
        <label className="form-label" htmlFor="perfil-nome">Nome público</label>
        <input className="form-control mb-3" id="perfil-nome" value={dados.nome} onChange={mudar('nome')} maxLength={100} required />
        <label className="form-label" htmlFor="perfil-exploracao">Nome da exploração</label>
        <input className="form-control mb-3" id="perfil-exploracao" value={dados.nomeExploracao} onChange={mudar('nomeExploracao')} required={Boolean(originais.nomeExploracao)} />
        <label className="form-label" htmlFor="perfil-localidade">Localidade</label>
        <input className="form-control mb-3" id="perfil-localidade" value={dados.localidade} onChange={mudar('localidade')} required={Boolean(originais.localidade)} />
        <label className="form-label" htmlFor="perfil-descricao">Descrição (opcional)</label>
        <textarea className="form-control mb-3" id="perfil-descricao" value={dados.descricao} onChange={mudar('descricao')} maxLength={1000} rows={4} />
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <button type="submit" className="btn btn-primary" disabled={!Object.keys(alteracoes).length}>{aGuardar ? 'A guardar…' : 'Guardar perfil'}</button>
          {estadoProdutor === 'aprovado' && <Link className="btn btn-outline-primary" to={`/produtores/${utilizador._id}`}>Ver página pública</Link>}
        </div>
      </fieldset>
      {erro && <p className="alert alert-danger mt-3 mb-0" role="alert">{erro}</p>}
      {aviso && <p className="mt-3 mb-0" role="status">{aviso}</p>}
    </form>
  </>;
}
