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
  Reporte.jsx      reporte de faltantes / no encontrados (solo admin)
  exportar.js      exportación del reporte a PDF (jsPDF, carga diferida) y XLS
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
- **bodega**: gestiona pedidos activos y ve el historial de todos. Además tiene una lista **Vista** (Bodega / Vendedor) para actuar también como vendedor.

### "¿Quién eres?" (panel del vendedor)

Lista con los usuarios de rol vendedor activos (endpoint `vendedores`). El elegido se guarda en `localStorage` (`talk_como`) y se envía como `como` al crear pedidos, listar (`mios=1`) y ejecutar acciones de vendedor (cancelar, encontrado_almacen, rebuscar). El servidor valida que `como` sea un vendedor activo (`vendedor_objetivo()` en `index.php`). Sin nombre elegido no se puede enviar ni se ve historial; un vendedor entra preseleccionado como él mismo. **Decisión de seguridad**: vendedor, bodega y admin pueden actuar en nombre de cualquier vendedor (como en la app anterior); las acciones de bodega siguen vetadas al rol vendedor (403). La lista se llena creando usuarios con rol *Vendedor* en *Usuarios*.
- **admin**: lo de bodega + crear/editar/desactivar usuarios, cambiar roles y contraseñas + pestaña **Reportes**.

## Reporte de faltantes (admin)

Pestaña *Reportes*: filtra por rango de fechas (por defecto 30 días) y tipo (todos / no hallado en bodega / faltante de inventario), muestra resumen y tabla, y exporta a **PDF** (jsPDF + autotable, horizontal, con logo) o **XLS** (tabla HTML con extensión .xls; Excel puede avisar del formato). Endpoint `reportes/faltantes` (solo admin, máx. 5000 filas). Limitación: usa el estado *actual* del pedido; uno que fue "no hallado" y luego se encontró ya no aparece (no hay historial de cambios de estado).

## Imagen corporativa

Marca **Motos y Motos El Paisa** (Cali). Logo en `public/logo.png` (99×100 px, tomado de su sitio web). Interfaz escalada con `html { font-size }` (112,5 % en móvil, 135 % desde 700 px; es el ajuste para agrandar/reducir todo). Paleta: negro `--negro #151515`, amarillo `--marca #f2c41d`, blanco. Cabecera negra con borde amarillo y logo; login con logo; favicon y theme-color. Si hay logo en mayor resolución o hex oficial, reemplazarlos.

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

`auth/me`, `auth/login`, `auth/logout`, `auth/password`, `usuarios`, `usuarios/crear`, `usuarios/actualizar`, `pedidos`, `pedidos/crear`, `pedidos/estado`, `reportes/faltantes`, `vendedores`. `pedidos` acepta `mios=1` y `como=<id>`. La ruta va en el parámetro `r` (`api/index.php?r=pedidos`). Las escrituras son POST y exigen la cabecera `X-Requested-With: talk` (protección CSRF básica).

## Desarrollo local

```
php -S localhost:8000 -t public     # backend
npm run dev                         # frontend (proxy /api -> :8000)
```

Local: base MySQL `talk` en XAMPP con su propio `public/api/config.php` (no versionado); crear el admin en `http://localhost:8000/api/install.php`. Ojo: `npm run build` copia ese `config.php` a `dist/api`; **borrarlo de `dist/` antes de subir**.

## Despliegue (resumen)

1. Crear base y usuario MySQL en cPanel.
2. `npm install && npm run build`.
3. Subir el contenido de `dist/` a `public_html`.
4. Copiar `api/config.sample.php` → `api/config.php` con los datos de MySQL.
5. Abrir `/api/install.php`, crear el admin y **borrarlo**.
6. Crear vendedores y bodega desde *Usuarios*. Usar HTTPS.

## Entorno de prueba (Namecheap)

- URL: https://prueba.solucioneseys.co/
- Datos de SFTP en `sftp.json` y de MySQL en el `config.php` del servidor; ninguno está versionado. Subida: `npm run build`, quitar `dist/api/config.php` y subir `dist/` por SFTP sin sobrescribir el `config.php` del servidor.
- El servidor venía con PHP 7.2; hay que fijar **PHP 8.2** en cPanel (Select PHP Version). El `.htaccess` no lo cambia.
- Pendiente: borrar `api/install.php` del servidor y bloquear `api/config.php` en `public/api/.htaccess`.

## Repositorio

https://github.com/jalvarez-alt/talk.git (rama `main`). Excluidos: `sftp.json`, `public/api/config.php`, `node_modules`, `dist`.

## Notas

- Interfaz y mensajes en español.
- Al cambiar el nombre de sesión/cabecera (motopina → talk) hay que subir frontend y backend juntos; las sesiones abiertas se cierran.
- La carpeta del proyecto ya se llama `talk`.
