import { useState } from 'react';
import { api } from './api.js';
import { Modal } from './componentes.jsx';
import { ROLES, useSondeo } from './util.js';

const VACIO = { nombre: '', usuario: '', password: '', rol: 'vendedor' };

export default function Admin({ yo }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [claveDe, setClaveDe] = useState(null);
  const [claveNueva, setClaveNueva] = useState('');

  const cargar = async () => {
    try {
      setUsuarios((await api.usuarios()).usuarios);
    } catch (e) {
      setError(e.message);
    }
  };
  useSondeo(cargar, 15000, []);

  const campo = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const crear = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      await api.crearUsuario(form);
      setExito(`Usuario ${form.usuario.toLowerCase()} creado.`);
      setForm(VACIO);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
    setGuardando(false);
  };

  const actualizar = async (datos) => {
    setError(null);
    setExito(null);
    try {
      await api.actualizarUsuario(datos);
      await cargar();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const guardarClave = async () => {
    if (await actualizar({ id: claveDe.id, password: claveNueva })) {
      setExito(`Contraseña de ${claveDe.nombre} actualizada.`);
      setClaveDe(null);
      setClaveNueva('');
    }
  };

  return (
    <div className="dashboard">
      <h2>👥 Usuarios</h2>

      <form onSubmit={crear} className="admin-form">
        <h3>Crear usuario</h3>
        <div className="admin-campos">
          <label className="field">
            Nombre
            <input value={form.nombre} onChange={campo('nombre')} maxLength={60} required />
          </label>
          <label className="field">
            Usuario (para entrar)
            <input
              value={form.usuario}
              onChange={campo('usuario')}
              maxLength={30}
              autoCapitalize="none"
              required
            />
          </label>
          <label className="field">
            Contraseña (mín. 6)
            <input
              type="text"
              value={form.password}
              onChange={campo('password')}
              minLength={6}
              autoComplete="off"
              required
            />
          </label>
          <label className="field">
            Rol
            <select value={form.rol} onChange={campo('rol')}>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn-enviar" disabled={guardando}>
          {guardando ? 'Guardando...' : '➕ Crear usuario'}
        </button>
      </form>

      {exito && <div className="alerta exito">✅ {exito}</div>}
      {error && <div className="alerta error">{error}</div>}

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
                <td>{u.nombre}</td>
                <td>{u.usuario}</td>
                <td>
                  <select
                    value={u.rol}
                    disabled={u.id === yo.id}
                    onChange={(e) => actualizar({ id: u.id, rol: e.target.value })}
                  >
                    {Object.entries(ROLES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.activo ? 'Activo' : 'Desactivado'}</td>
                <td className="tabla-acciones">
                  <button className="btn-filtro" onClick={() => setClaveDe(u)}>
                    🔑 Contraseña
                  </button>
                  {u.id !== yo.id && (
                    <button className="btn-filtro" onClick={() => actualizar({ id: u.id, activo: !u.activo })}>
                      {u.activo ? '⛔ Desactivar' : '✅ Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {claveDe && (
        <Modal titulo={`Nueva contraseña para ${claveDe.nombre}`} onCerrar={() => setClaveDe(null)}>
          <input
            type="text"
            className="modal-input"
            placeholder="Mínimo 6 caracteres"
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && claveNueva.length >= 6 && guardarClave()}
            autoComplete="off"
            autoFocus
          />
          <div className="modal-acciones">
            <button
              className="btn-motivo btn-confirmar-nota"
              disabled={claveNueva.length < 6}
              onClick={guardarClave}
            >
              ✅ Guardar
            </button>
            <button className="btn-volver" onClick={() => setClaveDe(null)}>
              Volver
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
