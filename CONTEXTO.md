# CONTEXTO – TALK

App web para coordinar pedidos entre **vendedores** y **bodega**. El vendedor pide un producto, bodega lo busca y responde con el estado. Antes se llamaba "MOTO PIÑA" / `motopina`; ya se renombró todo a **TALK** / `talk`.

## Stack

- **Frontend**: React 19 + Vite 7 (`src/`), JavaScript (sin TypeScript), CSS plano en `src/styles.css`.
- **Backend**: PHP 8.1+ / MySQL (PDO) en `public/api/`, sin framework. Un solo router en `index.php` con `switch` por ruta.
- **Hosting objetivo**: compartido (cPanel / Namecheap). Sin WebSockets, por eso el tiempo real es polling cada 4 s (solo con la pestaña visible), con sonido y notificación del navegador al detectar cambios.
- `npm run build` genera `dist/` (incluye `dist/api`), que es lo que se sube al servidor.

## Estructura

```
src/
  App.jsx          sesión, cabecera, cambio de contraseña, enruta por rol
  Login.jsx
  Vendedor.jsx     crear pedidos, ver los propios, cancelar, responder "no hallado"
  Bodega.jsx       pedidos activos + historial de todos
  Admin.jsx        gestión de usuarios
  componentes.jsx  componentes compartidos (Modal, etc.)
  api.js           cliente fetch; manda cabecera X-Requested-With: talk
  util.js          constantes (ROLES, estados, etc.) y helpers
public/api/
  index.php        router y lógica de negocio
  bootstrap.php    config, PDO, sesión ("talk"), helpers, validación de cabecera
  install.php      crea tablas y el admin; BORRAR del servidor tras usarlo
  config.sample.php  copiar a config.php con datos de MySQL (config.php no se versiona)
```

## Roles

- **vendedor**: crea pedidos, ve solo los suyos, cancela (con motivo) y responde a "no hallado en bodega".
- **bodega**: gestiona pedidos activos y ve el historial de todos.
- **admin**: lo de bodega + crear/editar/desactivar usuarios, cambiar roles y contraseñas.

## Base de datos

Tablas: `usuarios` (rol: admin/bodega/vendedor), `pedidos`, `login_intentos` (limitación de intentos de login).

## Flujo de estados del pedido

Estados: `pendiente`, `buscando`, `en_camino`, `bodega_3`, `no_encontrado_bodega`, `faltante_inventario`, `cancelado`. Activos: pendiente, buscando, no_encontrado_bodega. Transiciones (endpoint `pedidos/estado`, acción → resultado):

| Quién | Acción | Desde | Hacia |
|---|---|---|---|
| bodega | `buscando` | pendiente | buscando |
| bodega | `en_camino` | pendiente/buscando | en_camino |
| bodega | `bodega_3` (nota obligatoria) | pendiente/buscando | bodega_3 |
| bodega | `no_encontrado` | pendiente/buscando, primera búsqueda | no_encontrado_bodega |
| bodega | `faltante` (nota obligatoria) | pendiente/buscando, ya es rebúsqueda | faltante_inventario |
| vendedor | `cancelar` (con motivo) | estados activos | cancelado |
| vendedor | `encontrado_almacen` | no_encontrado_bodega | en_camino |
| vendedor | `rebuscar` | no_encontrado_bodega | pendiente (`rebusqueda=1`) |

Cualquier otra combinación responde 409. La actualización usa transacción con `SELECT ... FOR UPDATE`.

## Endpoints (`/api/index.php`, por parámetro de ruta)

`auth/me`, `auth/login`, `auth/logout`, `auth/password`, `usuarios`, `usuarios/crear`, `usuarios/actualizar`, `pedidos`, `pedidos/crear`, `pedidos/estado`. Las escrituras son POST y exigen la cabecera `X-Requested-With: talk` (protección CSRF básica).

## Desarrollo local

```
php -S localhost:8000 -t public     # backend
npm run dev                         # frontend (proxy /api -> :8000)
```

## Despliegue (resumen)

1. Crear base y usuario MySQL en cPanel.
2. `npm install && npm run build`.
3. Subir el contenido de `dist/` a `public_html`.
4. Copiar `api/config.sample.php` → `api/config.php` con los datos de MySQL.
5. Abrir `/api/install.php`, crear el admin y **borrarlo**.
6. Crear vendedores y bodega desde *Usuarios*. Usar HTTPS.

## Notas

- Interfaz y mensajes en español.
- Al cambiar el nombre de sesión/cabecera (motopina → talk) hay que subir frontend y backend juntos; las sesiones abiertas se cierran.
- La carpeta del proyecto sigue llamándose `motopina`; renombrarla a `talk` está pendiente (requiere cerrarla en VS Code).
