import { ESTADOS } from './util.js';

const TIPO = { no_encontrado_bodega: 'No hallado en bodega', faltante_inventario: 'Faltante de inventario' };
const ENCABEZADOS = ['#', 'Fecha', 'Vendedor', 'Producto', 'Tipo', 'Re-búsqueda', 'Nota'];

const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', hour12: true });

export const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'medium' });

function filas(pedidos) {
  return pedidos.map((p) => [
    p.id,
    fechaHora(p.created_at),
    p.vendedor,
    p.producto,
    TIPO[p.estado] || ESTADOS[p.estado]?.label || p.estado,
    p.rebusqueda ? 'Sí' : 'No',
    p.nota_faltante || '',
  ]);
}

const esc = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const nombreArchivo = (ext) => `reporte-faltantes-${new Date().toISOString().slice(0, 10)}.${ext}`;

/** XLS como tabla HTML: Excel lo abre directamente (puede avisar del formato al abrir). */
export function exportarExcel(pedidos, rango) {
  const cuerpo = filas(pedidos)
    .map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Faltantes</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
<table border="1">
<tr><td colspan="${ENCABEZADOS.length}"><b>Motos y Motos El Paisa — Reporte de faltantes y no encontrados</b></td></tr>
<tr><td colspan="${ENCABEZADOS.length}">${esc(rango)} · ${pedidos.length} registros</td></tr>
<tr>${ENCABEZADOS.map((h) => `<th style="background:#f2c41d">${h}</th>`).join('')}</tr>
${cuerpo}
</table></body></html>`;
  descargar(new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), nombreArchivo('xls'));
}

async function logoDataUrl() {
  try {
    const blob = await (await fetch('./logo.png')).blob();
    return await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportarPdf(pedidos, rango) {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    logoDataUrl(),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFillColor(21, 21, 21);
  doc.rect(0, 0, ancho, 70, 'F');
  doc.setFillColor(242, 196, 29);
  doc.rect(0, 70, ancho, 4, 'F');
  if (logo) doc.addImage(logo, 'PNG', 30, 10, 50, 50);
  doc.setTextColor(242, 196, 29);
  doc.setFontSize(16);
  doc.text('Reporte de faltantes y no encontrados', 95, 33);
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(10);
  doc.text(`Motos y Motos El Paisa · ${rango}`, 95, 52);

  const faltantes = pedidos.filter((p) => p.estado === 'faltante_inventario').length;
  doc.setTextColor(40, 40, 40);
  doc.text(
    `Total: ${pedidos.length}   ·   Faltantes de inventario: ${faltantes}   ·   No hallados en bodega: ${pedidos.length - faltantes}`,
    30,
    95,
  );

  autoTable(doc, {
    startY: 108,
    head: [ENCABEZADOS],
    body: filas(pedidos),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [242, 196, 29], textColor: [21, 21, 21] },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 90 }, 5: { cellWidth: 60 } },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Generado ${fechaHora(new Date().toISOString())} · Página ${doc.getNumberOfPages()}`,
        30,
        doc.internal.pageSize.getHeight() - 15,
      );
    },
  });
  doc.save(nombreArchivo('pdf'));
}
