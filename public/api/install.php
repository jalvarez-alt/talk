<?php
declare(strict_types=1);
// Instalador de una sola vez: crea las tablas y el primer administrador.
// BÓRRALO del servidor cuando termines.
require __DIR__ . '/bootstrap.php';

header('Content-Type: text/html; charset=utf-8');
$pdo = db();

$pdo->exec("CREATE TABLE IF NOT EXISTS usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    usuario VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin','bodega','vendedor') NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS pedidos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendedor_id INT UNSIGNED NOT NULL,
    producto TEXT NOT NULL,
    estado ENUM('pendiente','buscando','en_camino','bodega_3','no_encontrado_bodega','faltante_inventario','cancelado')
        NOT NULL DEFAULT 'pendiente',
    rebusqueda TINYINT(1) NOT NULL DEFAULT 0,
    motivo_cancelacion VARCHAR(255) NULL,
    nota_bodega VARCHAR(255) NULL,
    nota_faltante VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_created (created_at),
    INDEX idx_estado (estado),
    INDEX idx_vendedor (vendedor_id, created_at),
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS login_intentos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    usuario VARCHAR(40) NOT NULL,
    creado DATETIME NOT NULL,
    INDEX idx_intento (ip, usuario, creado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$hayUsuarios = (int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn() > 0;
$h = fn(string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$mensaje = '';

if ($hayUsuarios) {
    http_response_code(403);
    $mensaje = 'Ya está instalado. Elimina este archivo (api/install.php) del servidor.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nombre = texto($_POST['nombre'] ?? '', 60);
    $usuario = strtolower(texto($_POST['usuario'] ?? '', 30));
    $password = (string) ($_POST['password'] ?? '');
    if ($nombre === '' || !preg_match('/^[a-z0-9._-]{3,30}$/', $usuario) || strlen($password) < 6) {
        $mensaje = 'Datos no válidos (usuario 3-30 caracteres sin espacios, contraseña mínimo 6).';
    } else {
        $pdo->prepare("INSERT INTO usuarios (nombre, usuario, password_hash, rol, creado) VALUES (?, ?, ?, 'admin', UTC_TIMESTAMP())")
            ->execute([$nombre, $usuario, password_hash($password, PASSWORD_DEFAULT)]);
        $hayUsuarios = true;
        $mensaje = 'Listo: administrador creado. AHORA ELIMINA api/install.php del servidor y entra a la app.';
    }
}
?>
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalación TALK</title>
<body style="font-family:system-ui;max-width:420px;margin:40px auto;padding:0 16px">
<h2>Instalación TALK</h2>
<p>Tablas verificadas en la base de datos.</p>
<?php if ($mensaje): ?><p><strong><?= $h($mensaje) ?></strong></p><?php endif; ?>
<?php if (!$hayUsuarios): ?>
<form method="post" style="display:grid;gap:10px">
  <label>Nombre del administrador<br><input name="nombre" required style="width:100%"></label>
  <label>Usuario<br><input name="usuario" required style="width:100%"></label>
  <label>Contraseña (mín. 6)<br><input name="password" type="password" required style="width:100%"></label>
  <button>Crear administrador</button>
</form>
<?php endif; ?>
</body>
