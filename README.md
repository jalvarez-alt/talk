# TALK – pedidos vendedor ↔ bodega

Frontend React (Vite) + backend PHP/MySQL, pensado para hosting compartido (cPanel / Namecheap).

## Despliegue en Namecheap

1. **Base de datos**: en cPanel > *MySQL Databases* crea una base, un usuario y asígnalo con todos los privilegios.
2. **Compilar**: `npm install` y `npm run build`. Se genera `dist/` (incluye `dist/api`).
3. **Subir** el contenido de `dist/` a la carpeta pública del dominio (`public_html` o la del subdominio).
4. **Configurar**: en el servidor, copia `api/config.sample.php` a `api/config.php` y pon los datos de MySQL.
5. **Instalar**: abre `https://tu-dominio/api/install.php`, crea el administrador.
6. **Borra `api/install.php` del servidor.**
7. Entra a la app, ve a *Usuarios* y crea vendedores y personal de bodega.

Requiere PHP 8.1+ (cPanel > *Select PHP Version*), con las extensiones `pdo_mysql` y `mbstring`.
Usa HTTPS (AutoSSL de cPanel) para que la cookie de sesión sea segura.

## Desarrollo local

Necesitas PHP y MySQL locales:

```
php -S localhost:8000 -t public     # backend
npm run dev                         # frontend (proxy /api -> :8000)
```

## Roles

- **vendedor**: crea pedidos, ve solo los suyos, cancela, y responde a "no hallado en bodega".
- **bodega**: gestiona los pedidos activos y el historial de todos.
- **admin**: lo de bodega + crear/editar/desactivar usuarios, cambiar roles y contraseñas.

## Tiempo real

El hosting compartido no soporta WebSockets, así que la app consulta al servidor cada 4 s
(solo con la pestaña visible) y dispara sonido + notificación del navegador al detectar cambios.
