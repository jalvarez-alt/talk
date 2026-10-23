import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Insignia } from './componentes.jsx';
import { exportarExcel, exportarPdf, fechaCorta } from './exportar.js';
import { formatearHora } from './util.js';

const hoyLocal = (dias = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function Reporte() {
  const [desde, setDesde] = useState(hoyLocal(30));
  const [hasta, setHasta] = useState(hoyLocal());
  const [estado, setEstado] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [exportando, setExportando] = useState(false);

  const generar = async () => {
    if (!desde || !hasta || desde > hasta) {
      setError('Revisa el rango de fechas.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const ini = new Date(`${desde}T00:00:00`).toISOString();
      const fin = new Date(`${hasta}T23:59:59.999`).toISOString();
      setPedidos((await api.reporteFaltantes({ desde: ini, hasta: fin, estado })).pedidos);
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  };

  useEffect(() => {
    generar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rango = `${fechaCorta(`${desde}T12:00:00`)} a ${fechaCorta(`${hasta}T12:00:00`)}`;
  const faltantes = pedidos.filter((p) => p.estado === 'faltante_inventario').length;

  const exportar = async (fn) => {
    setExportando(true);
    try {
      await fn(pedidos, rango);
    } catch (e) {
      setError(`No se pudo exportar: ${e.message}`);
    }
    setExportando(false);
  };

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h2>Reporte de faltantes y no encontrados</h2>
        <div className="header-acciones">
          <button className="btn-filtro" disabled={!pedidos.length || exportando} onClick={() => exportar(exportarExcel)}>
            📗 Excel (XLS)
          </button>
          <button className="btn-filtro" disabled={!pedidos.length || exportando} onClick={() => exportar(exportarPdf)}>
            📕 PDF
          </button>
        </div>
      </div>

      <div className="filtro-fechas">
        <label>
          Desde <input type="date" className="input-fecha" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta <input type="date" className="input-fecha" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select className="input-fecha" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="no_encontrado_bodega">No hallado en bodega</option>
          <option value="faltante_inventario">Faltante de inventario</option>
        </select>
        <button className="btn-filtro activo" onClick={generar} disabled={cargando}>
          {cargando ? 'Generando...' : 'Generar'}
        </button>
      </div>

      {error && <div className="alerta error">{error}</div>}

      <p className="vacio" style={{ textAlign: 'left' }}>
        <strong>{pedidos.length}</strong> registros · {faltantes} faltantes de inventario ·{' '}
        {pedidos.length - faltantes} no hallados en bodega
      </p>

      {pedidos.length === 0 && !cargando ? (
        <p className="vacio">No hay registros en el rango seleccionado.</p>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Re-búsqueda</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{formatearHora(p.created_at, true)}</td>
                  <td>{p.vendedor}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{p.producto}</td>
                  <td>
                    <Insignia estado={p.estado} />
                  </td>
                  <td>{p.rebusqueda ? 'Sí' : 'No'}</td>
                  <td style={{ whiteSpace: 'normal' }}>{p.nota_faltante || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
