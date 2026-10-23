import { useRef, useState } from 'react';
import { api } from './api.js';
import { FiltroFechas, Insignia, Modal, NotasPedido } from './componentes.jsx';
import {
  ESTADOS,
  avisar,
  formatearHora,
  notificacionesActivas,
  pedirPermisoNotificaciones,
  rangoFechas,
  useSondeo,
} from './util.js';

export default function Bodega() {
  const [tab, setTab] = useState('activos');
  const [activos, setActivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [filtro, setFiltro] = useState('hoy');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState(null); // { pedido, tipo: 'bodega_3' | 'faltante' }
  const [texto, setTexto] = useState('');
  const [notif, setNotif] = useState(notificacionesActivas);
  const previos = useRef(null);

  const cargar = async () => {
    try {
      const { pedidos } = await api.pedidos({ activos: 1 });
      if (previos.current) {
        for (const p of pedidos) {
          const antes = previos.current.get(p.id);
          if (antes === undefined) avisar('Nuevo pedido', `${p.vendedor}: ${p.producto}`);
          else if (antes === 'no_encontrado_bodega' && p.estado === 'pendiente')
            avisar('🔄 Re-búsqueda solicitada', `${p.vendedor}: ${p.producto}`);
        }
      }
      previos.current = new Map(pedidos.map((p) => [p.id, p.estado]));
      setActivos(pedidos);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  };
  useSondeo(cargar, 4000, []);

  const cargarHistorial = async () => {
    try {
      const { pedidos } = await api.pedidos(rangoFechas(filtro, fecha));
      setHistorial(pedidos);
    } catch (e) {
      setError(e.message);
    }
  };
  useSondeo(() => tab === 'historial' && filtro === 'hoy' && cargarHistorial(), 8000, [tab, filtro, fecha]);

  const accion = async (pedido, nombre, extra) => {
    setOcupado(pedido.id);
    setError(null);
    try {
      await api.accionPedido(pedido.id, nombre, extra);
      setNota(null);
      setTexto('');
      await cargar();
    } catch (e) {
      setError(e.message);
    }
    setOcupado(null);
  };

  const abrirNota = (pedido, tipo) => {
    setNota({ pedido, tipo });
    setTexto('');
  };
  const confirmarNota = () => {
    if (!texto.trim() || ocupado) return;
    accion(nota.pedido, nota.tipo, { nota: texto.trim() });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>🏭 Panel de bodega</h2>
        <div className="header-acciones">
          {!notif && (
            <button
              className="btn-intercom"
              onClick={async () => setNotif(await pedirPermisoNotificaciones())}
            >
              🔔 Activar intercomunicador
            </button>
          )}
          <button className="btn-refrescar" onClick={cargar}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'activos' ? 'activa' : ''}`} onClick={() => setTab('activos')}>
          ⚡ Pedidos activos
          {activos.length > 0 && <span className="tab-contador">{activos.length}</span>}
        </button>
        <button className={`tab ${tab === 'historial' ? 'activa' : ''}`} onClick={() => setTab('historial')}>
          📋 Historial
        </button>
      </div>

      {cargando && <p>Cargando pedidos...</p>}
      {error && <div className="alerta error">{error}</div>}

      {!cargando && tab === 'activos' &&
        (activos.length === 0 ? (
          <p className="vacio">No hay pedidos activos 🎉</p>
        ) : (
          <div className="pedidos-grid">
            {activos.map((p) => {
              const bloqueado = ocupado === p.id;
              const esperando = p.estado === 'no_encontrado_bodega';
              return (
                <div key={p.id} className={`pedido-card estado-${ESTADOS[p.estado].clase}`}>
                  <div className="pedido-top">
                    <span className="pedido-vendedor">{p.vendedor}</span>
                    <Insignia estado={p.estado} />
                  </div>
                  {p.rebusqueda && (
                    <div className="pedido-rebusqueda">🔄 Segunda búsqueda (solicitada por el vendedor)</div>
                  )}
                  <div className="pedido-producto">{p.producto}</div>
                  <div className="pedido-hora">🕐 {new Date(p.created_at).toLocaleString('es-CO')}</div>
                  {esperando ? (
                    <div className="pedido-nota-bodega">Esperando respuesta del vendedor.</div>
                  ) : (
                    <div className="pedido-acciones">
                      <button
                        className="btn-accion buscando"
                        disabled={bloqueado || p.estado === 'buscando'}
                        onClick={() => accion(p, 'buscando')}
                      >
                        🔍 Buscando
                      </button>
                      <button
                        className="btn-accion en-camino"
                        disabled={bloqueado}
                        onClick={() => accion(p, 'en_camino')}
                      >
                        🟢 Encontrado y en camino
                      </button>
                      <button
                        className="btn-accion bodega-3"
                        disabled={bloqueado}
                        onClick={() => abrirNota(p, 'bodega_3')}
                      >
                        🏭 En Bodega 3
                      </button>
                      {p.rebusqueda ? (
                        <button
                          className="btn-accion agotado"
                          disabled={bloqueado}
                          onClick={() => abrirNota(p, 'faltante')}
                        >
                          🔴 Reportar faltante
                        </button>
                      ) : (
                        <button
                          className="btn-accion agotado"
                          disabled={bloqueado}
                          onClick={() => accion(p, 'no_encontrado')}
                        >
                          🔴 No encontrado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

      {tab === 'historial' && (
        <>
          <FiltroFechas filtro={filtro} fecha={fecha} onFiltro={setFiltro} onFecha={setFecha} />
          {historial.length === 0 ? (
            <p className="vacio">No hay pedidos en el rango seleccionado.</p>
          ) : (
            <div className="pedidos-grid">
              {historial.map((p) => (
                <div key={p.id} className={`pedido-card estado-${ESTADOS[p.estado].clase}`}>
                  <div className="pedido-top">
                    <span className="pedido-vendedor">{p.vendedor}</span>
                    <Insignia estado={p.estado} />
                  </div>
                  <div className="pedido-producto">{p.producto}</div>
                  <NotasPedido pedido={p} />
                  <div className="pedido-hora">🕐 {formatearHora(p.created_at, filtro !== 'hoy')}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {nota && (
        <Modal
          titulo={nota.tipo === 'bodega_3' ? '🏭 Pedido en Bodega 3' : '🔴 Reportar faltante de inventario'}
          onCerrar={() => setNota(null)}
        >
          <p className="modal-producto">{nota.pedido.producto}</p>
          <p className="modal-instruccion">
            {nota.tipo === 'bodega_3'
              ? 'Indicación para el vendedor (obligatoria):'
              : 'Explicación final para administración (obligatoria):'}
          </p>
          <input
            type="text"
            className="modal-input"
            maxLength={255}
            placeholder={
              nota.tipo === 'bodega_3'
                ? 'Ej: entrada 7432, mercancía de UMA'
                : 'Ej: no está en bodega ni en almacén, sistema muestra 2'
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmarNota()}
            autoFocus
          />
          <div className="modal-acciones">
            <button
              className="btn-motivo btn-confirmar-nota"
              disabled={!texto.trim() || ocupado === nota.pedido.id}
              onClick={confirmarNota}
            >
              ✅ Confirmar
            </button>
            <button className="btn-volver" onClick={() => setNota(null)}>
              Volver
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
