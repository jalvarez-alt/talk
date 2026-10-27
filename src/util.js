import { useEffect, useRef } from 'react';

export const ESTADOS = {
  pendiente: { label: '⚪ Pendiente', clase: 'pendiente' },
  buscando: { label: '🔵 Buscando', clase: 'buscando' },
  en_camino: { label: '🟢 Encontrado y en camino', clase: 'en-camino' },
  bodega_3: { label: '🟡 En Bodega 3', clase: 'bodega-3' },
  no_encontrado_bodega: { label: '⚠️ No hallado en bodega — verificar en almacén', clase: 'no-encontrado' },
  faltante_inventario: { label: '🔴 Faltante de inventario', clase: 'faltante' },
  cancelado: { label: '⚫ Cancelado', clase: 'cancelado' },
};

export const MOTIVOS = [
  { codigo: 'cliente_arrepentido', label: '🙅 El cliente se arrepintió' },
  { codigo: 'error_vendedor', label: '✏️ El vendedor se equivocó de producto' },
];

export const ROLES = { admin: 'Administrador', bodega: 'Bodega', vendedor: 'Vendedor' };

/** Rango [desde, hasta] en ISO (hora local del navegador) para los filtros de historial. */
export function rangoFechas(filtro, fecha) {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);
  if (filtro === 'ayer') {
    desde.setDate(desde.getDate() - 1);
    hasta.setDate(hasta.getDate() - 1);
  } else if (filtro === '7dias') {
    desde.setDate(desde.getDate() - 6);
  } else if (filtro === 'custom' && fecha) {
    const d = new Date(`${fecha}T00:00:00`);
    desde.setTime(d.getTime());
    hasta.setTime(d.getTime());
    hasta.setHours(23, 59, 59, 999);
  }
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

export function formatearHora(iso, conFecha) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (!conFecha) return hora;
  return `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} • ${hora}`;
}

let ctxAudio = null;
let silencio = null;

function contexto() {
  if (!ctxAudio) ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
  if (ctxAudio.state === 'suspended') ctxAudio.resume();
  return ctxAudio;
}

/** WAV de 1 s en silencio, generado en memoria. */
function wavSilencio() {
  const n = 8000;
  const b = new DataView(new ArrayBuffer(44 + n));
  const t = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  t(0, 'RIFF'); b.setUint32(4, 36 + n, true); t(8, 'WAVEfmt ');
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true);
  t(36, 'data'); b.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

/**
 * Debe llamarse desde un gesto del usuario (clic/tecla). Habilita el audio y mantiene un audio
 * silencioso en bucle: así el navegador no congela la pestaña al minimizarla y las alertas siguen sonando.
 */
export function desbloquearAudio() {
  try {
    contexto();
    if (!silencio) {
      silencio = new Audio(wavSilencio());
      silencio.loop = true;
    }
    if (silencio.paused) silencio.play().catch(() => {});
  } catch (e) {
    console.error('No se pudo habilitar el audio:', e);
  }
}

export function sonido() {
  try {
    const ctx = contexto();
    [587.33, 880, 1174.66].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch (e) {
    console.error('No se pudo reproducir el sonido:', e);
  }
}

export const notificacionesActivas = () =>
  typeof Notification !== 'undefined' && Notification.permission === 'granted';

export function avisar(titulo, cuerpo) {
  sonido();
  if (notificacionesActivas()) new Notification(titulo, { body: cuerpo, icon: './logo.png', tag: 'talk', renotify: true });
}

export async function pedirPermisoNotificaciones() {
  if (typeof Notification === 'undefined') return false;
  const permiso = await Notification.requestPermission();
  sonido();
  return permiso === 'granted';
}

/** Ejecuta `fn` ya y luego cada `ms` (con `segundoPlano`, también con la pestaña oculta o minimizada). Se reinicia con `deps`. */
export function useSondeo(fn, ms, deps, segundoPlano = false) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const tick = () => {
      if (segundoPlano || !document.hidden) ref.current();
    };
    tick();
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
