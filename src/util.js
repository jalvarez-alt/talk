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

/** Una nota: onda `tipo`, de `f1` a `f2` Hz durante `dur` s, empezando en `t`. */
function nota(ctx, t, tipo, f1, f2, dur, vol = 0.25) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(f1, t);
  if (f2 !== f1) osc.frequency.linearRampToValueAtTime(f2, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  gain.gain.setValueAtTime(vol, t + Math.max(dur - 0.08, 0.03));
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const TONOS = {
  campana: {
    label: '🔔 Campana',
    tocar: (c, t) => [587.33, 880, 1174.66].forEach((f, i) => nota(c, t + i * 0.18, 'sine', f, f, 0.6)),
  },
  sirena: {
    label: '🚨 Sirena',
    tocar: (c, t) => [0, 0.7, 1.4, 2.1].forEach((d, i) => nota(c, t + d, 'sawtooth', i % 2 ? 1000 : 600, i % 2 ? 600 : 1000, 0.7, 0.18)),
  },
  alarma: {
    label: '⏰ Alarma',
    tocar: (c, t) => [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((d) => nota(c, t + d, 'square', 880, 880, 0.12, 0.12)),
  },
  timbre: {
    label: '🛎️ Timbre (ding-dong)',
    tocar: (c, t) => {
      nota(c, t, 'sine', 659.25, 659.25, 0.7);
      nota(c, t + 0.6, 'sine', 523.25, 523.25, 0.9);
    },
  },
  bocina: {
    label: '📯 Bocina',
    tocar: (c, t) => [0, 0.55].forEach((d) => nota(c, t + d, 'sawtooth', 220, 220, 0.45, 0.2)),
  },
  digital: {
    label: '🎵 Digital',
    tocar: (c, t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(c, t + i * 0.12, 'triangle', f, f, 0.2)),
  },
};

let tonoActual = 'campana';
export const fijarTono = (t) => {
  if (TONOS[t]) tonoActual = t;
};

export function sonido(tono = tonoActual) {
  try {
    const ctx = contexto();
    (TONOS[tono] || TONOS.campana).tocar(ctx, ctx.currentTime);
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
