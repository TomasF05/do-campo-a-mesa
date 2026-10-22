import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';

export default function Registo() {
  const [dados, setDados] = useState({ nome: '', email: '', password: '', papel: 'comprador', nomeExploracao: '', localidade: '' });
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setDados((d) => ({ ...d, [campo]: e.target.value }));
  async function submeter(e) {
    e.preventDefault(); setErro('');
    try {
      if (!USAR_DADOS_SIMULADOS) await api('/auth/registo', { metodo: 'POST', corpo: { nome: dados.nome, email: dados.email, password: dados.password, papel: dados.papel, produtor: dados.papel === 'produtor' ? { nomeExploracao: dados.nomeExploracao, localidade: dados.localidade } : undefined } });
      setMensagem(USAR_DADOS_SIMULADOS ? `Pré-visualização validada para ${dados.nome} (${dados.papel}). Use uma das contas de exemplo para experimentar a aplicação.` : 'Conta criada. Já pode entrar.');
      setDados((d) => ({ ...d, password: '' }));
    } catch (err) { setErro(err.message); }
  }
  return (
    <div className="formulario-estreito">
      <h1>Registar</h1>
      {USAR_DADOS_SIMULADOS && <p className="alert alert-info">Na demonstração, o formulário valida e pré-visualiza o registo. Não cria uma conta nem guarda a password.</p>}
      <form className="card p-3" onSubmit={submeter}>
        {[['nome','Nome','text','name'],['email','Email','email','email'],['password','Password','password','new-password']].map(([campo,label,tipo,auto]) => <div key={campo}><label className="form-label" htmlFor={`registo-${campo}`}>{label}</label><input className="form-control mb-3" id={`registo-${campo}`} type={tipo} autoComplete={auto} minLength={campo === 'password' ? 8 : undefined} value={dados[campo]} onChange={mudar(campo)} required /></div>)}
        <label className="form-label" htmlFor="papel">Tipo de conta</label><select id="papel" className="form-select mb-3" value={dados.papel} onChange={mudar('papel')}><option value="comprador">Comprador</option><option value="produtor">Produtor</option></select>
        {dados.papel === 'produtor' && <fieldset><legend className="fs-6">Exploração</legend><label className="form-label" htmlFor="exploracao">Nome da exploração</label><input id="exploracao" className="form-control mb-3" value={dados.nomeExploracao} onChange={mudar('nomeExploracao')} required /><label className="form-label" htmlFor="registo-localidade">Localidade</label><input id="registo-localidade" className="form-control mb-3" value={dados.localidade} onChange={mudar('localidade')} required /></fieldset>}
        {erro && <p className="alert alert-danger" role="alert">{erro}</p>}{mensagem && <p className="alert alert-success" role="status">{mensagem}</p>}
        <button type="submit" className="btn btn-success">{USAR_DADOS_SIMULADOS ? 'Pré-visualizar registo' : 'Criar conta'}</button>
      </form><p className="mt-3"><Link to="/login">Entrar com uma conta existente</Link></p>
    </div>
  );
}
