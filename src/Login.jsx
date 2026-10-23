import { useState } from 'react';
import { api } from './api.js';

export default function Login({ onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const { usuario: u } = await api.login(usuario, password);
      onEntrar(u);
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  return (
    <main className="login">
      <img className="login-logo" src="./logo.png" alt="Motos y Motos El Paisa" />
      <h1>TALK</h1>
      <p className="login-sub">
        <span className="punto-vivo" /> Comunicación en vivo
      </p>
      <form onSubmit={enviar} className="login-form">
        <label className="field">
          Usuario
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
          />
        </label>
        <label className="field">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="alerta error">{error}</div>}
        <button className="btn-enviar" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
