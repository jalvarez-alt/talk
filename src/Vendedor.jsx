import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { FiltroFechas, Insignia, Modal, NotasPedido } from './componentes.jsx';
import {
  ESTADOS,
  MOTIVOS,
  avisar,
  formatearHora,
  notificacionesActivas,
  pedirPermisoNotificaciones,
  rangoFechas,
  useSondeo,
} from './util.js';

const guardado = () => {
  try {
    return localStorage.getItem('talk_como') || '';
  } catch {
    return '';
  }
};

export default function Vendedor({ yo }) {
  const [vendedores, setVendedores] = useState([]);
  const [como, setComo] = useState(guardado);
  const [producto, setProducto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('hoy');
  const [fecha, setFecha] = useState('');
  const [cancelando, setCancelando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [notif, setNotif] = useState(notificacionesActivas);
  const previos = useRef(null);

  useEffect(() => {
    api
      .vendedores()
      .then(({ vendedores: lista }) => {
        setVendedores(lista);
        // Sin elección previa válida: un vendedor entra como él mismo; bodega/admin deben escoger.
        const valido = lista.some((v) => String(v.id) === como);
        if (!valido) setComo(lista.some((v) => v.id === yo.id) ? String(yo.id) : '');
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elegir = (id) => {
    setComo(id);
    try {
      localStorage.setItem('talk_como', id);
    } catch {
      // sin almacenamiento: la elección vale solo para esta sesión
    }
  };

  // Al cambiar el filtro o el vendedor no se avisa de lo que simplemente aparece en la nueva lista.
  useEffect(() => {
    previos.current = null;
  }, [filtro, fecha, como]);

  const cargar = async () => {
    if (!como) {
      setPedidos([]);
      return;
    }
    try {
      const { pedidos: lista } = await api.pedidos({ ...rangoFechas(filtro, fecha), mios: 1, como });
      if (previos.current && filtro === 'hoy') {
        for (const p of lista) {
          const antes = previos.current.get(p.id);
          if (antes && antes !== p.estado && p.estado !== 'cancelado') {
            avisar('Respuesta de Bodega', `${p.producto}: ${ESTADOS[p.estado]?.label ?? p.estado}`);
          }
        }
      }
      previos.current = new Map(lista.map((p) => [p.id, p.estado]));
      setPedidos(lista);
    } catch (e) {
      console.error(e);
    }
  };
  useSondeo(cargar, 4000, [filtro, fecha, como], true);

  const enviar = async (e) => {
    e.preventDefault();
    if (!producto.trim() || enviando || !como) return;
    setEnviando(true);
    setError(null);
    try {
      await api.crearPedido(producto.trim(), como);
      setProducto('');
      setExito(true);
      setTimeout(() => setExito(false), 3000);
      cargar();
    } catch (err) {
      setError(err.message);
    }
    setEnviando(false);
  };

  const accion = async (id, nombre, extra) => {
    setOcupado(true);
    setError(null);
    try {
      await api.accionPedido(id, nombre, { ...extra, como });
      setCancelando(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
    setOcupado(false);
  };

  return (
    <div className="dashboard">
      <h2>🧾 Panel del vendedor</h2>
      {!notif && (
        <button
          className="btn-intercom"
          onClick={async () => setNotif(await pedirPermisoNotificaciones())}
        >
          🔔 Activar notificaciones
        </button>
      )}

      <label className="selector-vista">
        ¿Quién eres?
        <select value={como} onChange={(e) => elegir(e.target.value)}>
          <option value="">-- Selecciona tu nombre --</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
      </label>

      <form onSubmit={enviar} className="pedido-form">
        <textarea
          placeholder="Escribe el producto / pedido aquí..."
          value={producto}
          onChange={(e) => setProducto(e.target.value)}
          rows={5}
          maxLength={1000}
          required
        />
        <button type="submit" className="btn-enviar" disabled={enviando || !producto.trim() || !como}>
          {enviando ? 'Enviando...' : '📦 Enviar pedido a bodega'}
        </button>
      </form>

      {exito && <div className="alerta exito">✅ Pedido enviado</div>}
      {error && <div className="alerta error">{error}</div>}

      <section className="historial">
        <h3>📋 Historial de pedidos</h3>
        <FiltroFechas filtro={filtro} fecha={fecha} onFiltro={setFiltro} onFecha={setFecha} />
        {pedidos.length === 0 ? (
          <p className="vacio">No hay pedidos en el rango seleccionado.</p>
        ) : (
          <div className="pedidos-grid">
            {pedidos.map((p) => (
              <div key={p.id} className={`pedido-card estado-${ESTADOS[p.estado]?.clase}`}>
                <div className="pedido-top">
                  <span className="pedido-hora">🕐 {formatearHora(p.created_at, filtro !== 'hoy')}</span>
                  <Insignia estado={p.estado} />
                </div>
                <div className="pedido-producto">{p.producto}</div>
                <NotasPedido pedido={p} />
                {p.estado === 'no_encontrado_bodega' ? (
                  <div className="pedido-acciones">
                    <button
                      className="btn-accion en-camino"
                      disabled={ocupado}
                      onClick={() => accion(p.id, 'encontrado_almacen')}
                    >
                      🟢 Encontrado en almacén
                    </button>
                    <button
                      className="btn-accion buscando"
                      disabled={ocupado}
                      onClick={() => accion(p.id, 'rebuscar')}
                    >
                      🔄 Re-buscar en bodega
                    </button>
                    <button className="btn-cancelar" onClick={() => setCancelando(p)}>
                      ❌ Cancelar pedido
                    </button>
                  </div>
                ) : (
                  (p.estado === 'pendiente' || p.estado === 'buscando') && (
                    <button className="btn-cancelar" onClick={() => setCancelando(p)}>
                      ❌ Cancelar pedido
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {cancelando && (
        <Modal titulo="Cancelar pedido" onCerrar={() => setCancelando(null)}>
          <p className="modal-producto">{cancelando.producto}</p>
          <p className="modal-instruccion">Selecciona el motivo:</p>
          <div className="modal-motivos">
            {MOTIVOS.map((m) => (
              <button
                key={m.codigo}
                className="btn-motivo"
                disabled={ocupado}
                onClick={() => accion(cancelando.id, 'cancelar', { motivo: m.codigo })}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button className="btn-volver" disabled={ocupado} onClick={() => setCancelando(null)}>
            Volver
          </button>
        </Modal>
      )}
    </div>
  );
}
