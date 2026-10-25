import { useEffect, useState } from 'react';
import { api, onSesionExpirada } from './api.js';
import { Modal } from './componentes.jsx';
import Login from './Login.jsx';
import Vendedor from './Vendedor.jsx';
import Bodega from './Bodega.jsx';
import Reporte from './Reporte.jsx';
import Admin from './Admin.jsx';
import { ROLES } from './util.js';

function CambiarPassword({ onCerrar }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.cambiarPassword(actual, nueva);
      setListo(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal titulo="Cambiar contraseña" onCerrar={onCerrar}>
      {listo ? (
        <>
          <div className="alerta exito">✅ Contraseña actualizada</div>
          <button className="btn-volver" onClick={onCerrar}>
            Cerrar
          </button>
        </>
      ) : (
        <form onSubmit={guardar} className="login-form">
          <label className="field">
            Contraseña actual
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} required />
          </label>
          <label className="field">
            Contraseña nueva (mín. 6)
            <input
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {error && <div className="alerta error">{error}</div>}
          <div className="modal-acciones">
            <button className="btn-motivo btn-confirmar-nota">Guardar</button>
            <button type="button" className="btn-volver" onClick={onCerrar}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function App() {
  const [yo, setYo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState(null);
  const [claveAbierta, setClaveAbierta] = useState(false);

  useEffect(() => {
    onSesionExpirada(() => setYo(null));
    api
      .yo()
      .then(({ usuario }) => setYo(usuario))
      .catch(() => setYo(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    document.title = yo ? `TALK ${yo.nombre}` : 'TALK';
    setVista(yo?.rol === 'admin' ? 'bodega' : (yo?.rol ?? null));
  }, [yo]);

  const salir = async () => {
    try {
      await api.logout();
    } finally {
      setYo(null);
    }
  };

  if (cargando) return <p className="cargando">Cargando...</p>;
  if (!yo) return <Login onEntrar={setYo} />;

  return (
    <main className="app-container">
      <header className="app-header">
        <div className="app-header-logo">
          <img src="./logo.png" alt="Motos y Motos El Paisa" />
          <div className="app-header-marca">
            <span className="app-header-titulo">TALK</span>
            <span className="conexion-vivo">
              <span className="punto-vivo" /> {yo.nombre} · {ROLES[yo.rol]}
            </span>
          </div>
        </div>
        <div className="header-acciones">
          <button className="btn-cambiar-rol" onClick={() => setClaveAbierta(true)}>
            🔑
          </button>
          <button className="btn-cambiar-rol" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      {yo.rol === 'bodega' && (
        <label className="selector-vista">
          Vista
          <select value={vista ?? ''} onChange={(e) => setVista(e.target.value)}>
            <option value="bodega">🏭 Bodega</option>
            <option value="vendedor">🛒 Vendedor (mis pedidos)</option>
          </select>
        </label>
      )}

      {yo.rol === 'admin' && (
        <div className="tabs">
          <button className={`tab ${vista === 'bodega' ? 'activa' : ''}`} onClick={() => setVista('bodega')}>
            🏭 Bodega
          </button>
          <button className={`tab ${vista === 'usuarios' ? 'activa' : ''}`} onClick={() => setVista('usuarios')}>
            👥 Usuarios
          </button>
          <button className={`tab ${vista === 'reportes' ? 'activa' : ''}`} onClick={() => setVista('reportes')}>
            📊 Reportes
          </button>
        </div>
      )}

      {vista === 'vendedor' && <Vendedor />}
      {vista === 'bodega' && <Bodega />}
      {vista === 'usuarios' && <Admin yo={yo} />}
      {vista === 'reportes' && <Reporte />}

      {claveAbierta && <CambiarPassword onCerrar={() => setClaveAbierta(false)} />}
    </main>
  );
}
