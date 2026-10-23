import { ESTADOS } from './util.js';

export function Insignia({ estado }) {
  const e = ESTADOS[estado] || { label: estado, clase: 'pendiente' };
  return <span className={`badge badge-${e.clase}`}>{e.label}</span>;
}

export function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

export function FiltroFechas({ filtro, fecha, onFiltro, onFecha }) {
  const botones = [
    ['hoy', 'Hoy'],
    ['ayer', 'Ayer'],
    ['7dias', 'Últimos 7 días'],
  ];
  return (
    <div className="filtro-fechas">
      {botones.map(([clave, texto]) => (
        <button
          key={clave}
          className={`btn-filtro ${filtro === clave ? 'activo' : ''}`}
          onClick={() => onFiltro(clave)}
        >
          {texto}
        </button>
      ))}
      <input
        type="date"
        className="input-fecha"
        value={fecha}
        onChange={(e) => {
          onFecha(e.target.value);
          if (e.target.value) onFiltro('custom');
        }}
      />
    </div>
  );
}

/** Notas que se muestran en las tarjetas del historial. */
export function NotasPedido({ pedido }) {
  return (
    <>
      {pedido.estado === 'cancelado' && pedido.motivo_cancelacion && (
        <div className="pedido-motivo">⚫ {pedido.motivo_cancelacion}</div>
      )}
      {pedido.estado === 'bodega_3' && pedido.nota_bodega && (
        <div className="pedido-nota-bodega">
          📍 <strong>Bodega 3:</strong> {pedido.nota_bodega}
        </div>
      )}
      {pedido.estado === 'faltante_inventario' && pedido.nota_faltante && (
        <div className="pedido-nota-faltante">
          🔴 <strong>Faltante:</strong> {pedido.nota_faltante}
        </div>
      )}
    </>
  );
}
