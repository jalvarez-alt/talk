import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Modal } from './componentes.jsx';
import { ROLES, TONOS, desbloquearAudio, fijarTono, sonido, useSondeo } from './util.js';

const VACIO = { nombre: '', usuario: '', password: '', rol: 'vendedor' };

export default function Admin({ yo }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [claveDe, setClaveDe] = useState(null);
  const [claveNueva, setClaveNueva] = useState('');
  const [editando, setEditando] = useState(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [usuarioNuevo, setUsuarioNuevo] = useState('');
  const [eliminando, setEliminando] = useState(null);
  const [tono, setTono] = useState('campana');
  const [tonoGuardado, setTonoGuardado] = useState('campana');

  const cargar = async () => {
    try {
      setUsuarios((await api.usuarios()).usuarios);
    } catch (e) {
      setError(e.message);
    }
  };
  useSondeo(cargar, 15000, []);

  useEffect(() => {
    api
      .ajustes()
      .then(({ tono: t }) => {
        setTono(t);
        setTonoGuardado(t);
      })
      .catch((e) => setError(e.message));
  }, []);

  const probar = () => {
    desbloquearAudio();
    sonido(tono);
  };

  const guardarTono = async () => {
    setError(null);
    setExito(null);
    try {
      await api.guardarAjustes(tono);
      fijarTono(tono);
      setTonoGuardado(tono);
      setExito(`Tono de alerta guardado: ${TONOS[tono].label}.`);
    } catch (err) {
      setError(err.message);
    }
  };

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

  const guardarNombre = async () => {
    if (await actualizar({ id: editando.id, nombre: nombreNuevo, usuario: usuarioNuevo })) {
      setExito(`Datos actualizados: ${nombreNuevo.trim()} (${usuarioNuevo.trim().toLowerCase()}).`);
      setEditando(null);
    }
  };

  const eliminar = async () => {
    setError(null);
    setExito(null);
    try {
      await api.eliminarUsuario(eliminando.id);
      setExito(`Usuario ${eliminando.nombre} eliminado.`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
    setEliminando(null);
  };

  return (
    <div className="dashboard">
      <h2>👥 Usuarios</h2>

      <section className="admin-form">
        <h3>🔊 Tono de las alertas</h3>
        <p className="modal-instruccion">Es el sonido que oyen todos los usuarios cuando llega un pedido o una respuesta.</p>
        <div className="filtro-fechas">
          <select className="input-fecha" value={tono} onChange={(e) => setTono(e.target.value)}>
            {Object.entries(TONOS).map(([k, t]) => (
              <option key={k} value={k}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn-filtro" onClick={probar}>
            ▶ Probar
          </button>
          <button type="button" className="btn-filtro activo" disabled={tono === tonoGuardado} onClick={guardarTono}>
            💾 Guardar
          </button>
        </div>
      </section>

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
                  <button
                    className="btn-filtro"
                    onClick={() => {
                      setEditando(u);
                      setNombreNuevo(u.nombre);
                      setUsuarioNuevo(u.usuario);
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button className="btn-filtro" onClick={() => setClaveDe(u)}>
                    🔑 Contraseña
                  </button>
                  {u.id !== yo.id && (
                    <button className="btn-filtro" onClick={() => actualizar({ id: u.id, activo: !u.activo })}>
                      {u.activo ? '⛔ Desactivar' : '✅ Activar'}
                    </button>
                  )}
                  {u.id !== yo.id && (
                    <button className="btn-filtro" onClick={() => setEliminando(u)}>
                      🗑️ Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={`Editar a ${editando.nombre}`} onCerrar={() => setEditando(null)}>
          <label className="field">
            Nombre
            <input
              className="modal-input"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </label>
          <label className="field">
            Usuario (para entrar)
            <input
              className="modal-input"
              value={usuarioNuevo}
              onChange={(e) => setUsuarioNuevo(e.target.value)}
              maxLength={30}
              autoCapitalize="none"
            />
          </label>
          <div className="modal-acciones">
            <button
              className="btn-motivo btn-confirmar-nota"
              disabled={
                !nombreNuevo.trim() ||
                (nombreNuevo.trim() === editando.nombre && usuarioNuevo.trim().toLowerCase() === editando.usuario)
              }
              onClick={guardarNombre}
            >
              ✅ Guardar
            </button>
            <button className="btn-volver" onClick={() => setEditando(null)}>
              Volver
            </button>
          </div>
        </Modal>
      )}

      {eliminando && (
        <Modal titulo={`¿Eliminar a ${eliminando.nombre}?`} onCerrar={() => setEliminando(null)}>
          <p className="modal-instruccion">
            Se borra el usuario <strong>{eliminando.usuario}</strong> de forma permanente. Si ya tiene pedidos, no se podrá
            eliminar y conviene desactivarlo.
          </p>
          <div className="modal-acciones">
            <button className="btn-motivo btn-confirmar-nota" onClick={eliminar}>
              🗑️ Sí, eliminar
            </button>
            <button className="btn-volver" onClick={() => setEliminando(null)}>
              Volver
            </button>
          </div>
        </Modal>
      )}

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
