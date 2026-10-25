const BASE = 'api/index.php';

let alExpirarSesion = () => {};
export const onSesionExpirada = (fn) => {
  alExpirarSesion = fn;
};

async function llamar(ruta, { post, params } = {}) {
  const query = new URLSearchParams({ r: ruta, ...params });
  const res = await fetch(`${BASE}?${query}`, {
    method: post ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: post
      ? { 'Content-Type': 'application/json', 'X-Requested-With': 'talk' }
      : undefined,
    body: post ? JSON.stringify(post) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // respuesta no JSON (p. ej. error del servidor): se informa abajo
  }
  if (!res.ok) {
    if (res.status === 401 && ruta !== 'auth/login') alExpirarSesion();
    throw new Error(data.error || 'Error de conexión con el servidor.');
  }
  return data;
}

export const api = {
  yo: () => llamar('auth/me'),
  login: (usuario, password) => llamar('auth/login', { post: { usuario, password } }),
  logout: () => llamar('auth/logout', { post: {} }),
  cambiarPassword: (actual, nueva) => llamar('auth/password', { post: { actual, nueva } }),

  usuarios: () => llamar('usuarios'),
  crearUsuario: (datos) => llamar('usuarios/crear', { post: datos }),
  actualizarUsuario: (datos) => llamar('usuarios/actualizar', { post: datos }),

  reporteFaltantes: (params) => llamar('reportes/faltantes', { params }),
  vendedores: () => llamar('vendedores'),
  pedidos: (params) => llamar('pedidos', { params }),
  crearPedido: (producto, como) => llamar('pedidos/crear', { post: { producto, como } }),
  accionPedido: (id, accion, extra = {}) =>
    llamar('pedidos/estado', { post: { id, accion, ...extra } }),
};
