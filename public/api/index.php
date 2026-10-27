<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

iniciar_sesion();

const MOTIVOS = [
    'cliente_arrepentido' => 'El cliente se arrepintió',
    'error_vendedor' => 'El vendedor se equivocó de producto',
];
const ESTADOS_ACTIVOS = ['pendiente', 'buscando', 'no_encontrado_bodega'];

/** Vendedor en cuyo nombre se actúa: el elegido en "¿Quién eres?" o, si no hay, el propio usuario. */
function vendedor_objetivo(PDO $pdo, array $u, mixed $como): int
{
    $id = (int) $como;
    if ($id === 0 || $id === $u['id']) {
        return $u['id'];
    }
    $st = $pdo->prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'vendedor' AND activo = 1");
    $st->execute([$id]);
    if (!$st->fetchColumn()) {
        fallar('Vendedor no válido.');
    }
    return $id;
}

try {
    $ruta = $_GET['r'] ?? '';
    $pdo = db();

    switch ($ruta) {
        case 'auth/me':
            responder(['usuario' => usuario_actual()]);

        case 'auth/login':
            requerir_post();
            $in = entrada();
            $usuario = strtolower(texto($in['usuario'] ?? '', 40));
            $password = (string) ($in['password'] ?? '');
            $ip = $_SERVER['REMOTE_ADDR'] ?? '';

            $st = $pdo->prepare(
                'SELECT COUNT(*) FROM login_intentos
                 WHERE ip = ? AND usuario = ? AND creado > (UTC_TIMESTAMP() - INTERVAL 15 MINUTE)'
            );
            $st->execute([$ip, $usuario]);
            if ((int) $st->fetchColumn() >= 5) {
                fallar('Demasiados intentos. Espera 15 minutos.', 429);
            }

            $st = $pdo->prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1');
            $st->execute([$usuario]);
            $u = $st->fetch();
            if (!$u || !password_verify($password, $u['password_hash'])) {
                $pdo->prepare('INSERT INTO login_intentos (ip, usuario, creado) VALUES (?, ?, UTC_TIMESTAMP())')
                    ->execute([$ip, $usuario]);
                fallar('Usuario o contraseña incorrectos.', 401);
            }
            $pdo->prepare('DELETE FROM login_intentos WHERE ip = ? AND usuario = ?')->execute([$ip, $usuario]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) $u['id'];
            responder(['usuario' => [
                'id' => (int) $u['id'], 'nombre' => $u['nombre'], 'usuario' => $u['usuario'], 'rol' => $u['rol'],
            ]]);

        case 'auth/logout':
            requerir_post();
            $_SESSION = [];
            session_destroy();
            responder(['ok' => true]);

        case 'auth/password':
            requerir_post();
            $u = requerir_rol();
            $in = entrada();
            $nueva = (string) ($in['nueva'] ?? '');
            if (strlen($nueva) < 6) {
                fallar('La contraseña nueva debe tener al menos 6 caracteres.');
            }
            $st = $pdo->prepare('SELECT password_hash FROM usuarios WHERE id = ?');
            $st->execute([$u['id']]);
            if (!password_verify((string) ($in['actual'] ?? ''), (string) $st->fetchColumn())) {
                fallar('La contraseña actual no es correcta.', 403);
            }
            $pdo->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
                ->execute([password_hash($nueva, PASSWORD_DEFAULT), $u['id']]);
            responder(['ok' => true]);

        // ---------- Administración de usuarios ----------
        case 'usuarios':
            requerir_rol('admin');
            $filas = $pdo->query('SELECT id, nombre, usuario, rol, activo FROM usuarios ORDER BY activo DESC, rol, nombre')
                ->fetchAll();
            foreach ($filas as &$f) {
                $f['id'] = (int) $f['id'];
                $f['activo'] = (bool) $f['activo'];
            }
            unset($f);
            responder(['usuarios' => $filas]);

        case 'usuarios/crear':
            requerir_post();
            requerir_rol('admin');
            $in = entrada();
            $nombre = texto($in['nombre'] ?? '', 60);
            $usuario = strtolower(texto($in['usuario'] ?? '', 30));
            $password = (string) ($in['password'] ?? '');
            $rol = (string) ($in['rol'] ?? '');
            if ($nombre === '') {
                fallar('El nombre es obligatorio.');
            }
            if (!preg_match('/^[a-z0-9._-]{3,30}$/', $usuario)) {
                fallar('El usuario debe tener 3 a 30 caracteres: letras, números, punto, guion o guion bajo.');
            }
            if (strlen($password) < 6) {
                fallar('La contraseña debe tener al menos 6 caracteres.');
            }
            if (!in_array($rol, ROLES, true)) {
                fallar('Rol no válido.');
            }
            try {
                $pdo->prepare('INSERT INTO usuarios (nombre, usuario, password_hash, rol, creado) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())')
                    ->execute([$nombre, $usuario, password_hash($password, PASSWORD_DEFAULT), $rol]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') {
                    fallar('Ese nombre de usuario ya existe.', 409);
                }
                throw $e;
            }
            responder(['ok' => true], 201);

        case 'usuarios/actualizar':
            requerir_post();
            $admin = requerir_rol('admin');
            $in = entrada();
            $id = (int) ($in['id'] ?? 0);
            $st = $pdo->prepare('SELECT id FROM usuarios WHERE id = ?');
            $st->execute([$id]);
            if (!$st->fetch()) {
                fallar('Usuario no encontrado.', 404);
            }
            $sets = [];
            $vals = [];
            if (isset($in['nombre'])) {
                $n = texto($in['nombre'], 60);
                if ($n === '') {
                    fallar('El nombre es obligatorio.');
                }
                $sets[] = 'nombre = ?';
                $vals[] = $n;
            }
            if (isset($in['usuario'])) {
                $nuevo = strtolower(texto($in['usuario'], 30));
                if (!preg_match('/^[a-z0-9._-]{3,30}$/', $nuevo)) {
                    fallar('Usuario no válido (3-30 caracteres, sin espacios).');
                }
                $sets[] = 'usuario = ?';
                $vals[] = $nuevo;
            }
            if (isset($in['rol'])) {
                if (!in_array($in['rol'], ROLES, true)) {
                    fallar('Rol no válido.');
                }
                if ($id === $admin['id'] && $in['rol'] !== 'admin') {
                    fallar('No puedes quitarte el rol de administrador.');
                }
                $sets[] = 'rol = ?';
                $vals[] = $in['rol'];
            }
            if (isset($in['activo'])) {
                if ($id === $admin['id'] && !$in['activo']) {
                    fallar('No puedes desactivar tu propio usuario.');
                }
                $sets[] = 'activo = ?';
                $vals[] = $in['activo'] ? 1 : 0;
            }
            if (isset($in['password']) && $in['password'] !== '') {
                if (strlen((string) $in['password']) < 6) {
                    fallar('La contraseña debe tener al menos 6 caracteres.');
                }
                $sets[] = 'password_hash = ?';
                $vals[] = password_hash((string) $in['password'], PASSWORD_DEFAULT);
            }
            if (!$sets) {
                fallar('Nada que actualizar.');
            }
            $vals[] = $id;
            try {
                $pdo->prepare('UPDATE usuarios SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') {
                    fallar('Ese nombre de usuario ya existe.', 409);
                }
                throw $e;
            }
            responder(['ok' => true]);

        case 'usuarios/eliminar':
            requerir_post();
            $admin = requerir_rol('admin');
            $id = (int) (entrada()['id'] ?? 0);
            if ($id === $admin['id']) {
                fallar('No puedes eliminar tu propio usuario.');
            }
            $st = $pdo->prepare('SELECT nombre FROM usuarios WHERE id = ?');
            $st->execute([$id]);
            if ($st->fetchColumn() === false) {
                fallar('Usuario no encontrado.', 404);
            }
            $st = $pdo->prepare('SELECT COUNT(*) FROM pedidos WHERE vendedor_id = ?');
            $st->execute([$id]);
            $n = (int) $st->fetchColumn();
            if ($n > 0) {
                fallar("Tiene $n pedido(s) en el historial y no se puede eliminar. Desactívalo para que no pueda entrar.", 409);
            }
            $pdo->prepare('DELETE FROM usuarios WHERE id = ?')->execute([$id]);
            responder(['ok' => true]);

        // ---------- Pedidos ----------
        case 'vendedores':
            requerir_rol('vendedor', 'bodega', 'admin');
            responder(['vendedores' => array_map(
                fn($f) => ['id' => (int) $f['id'], 'nombre' => $f['nombre']],
                $pdo->query("SELECT id, nombre FROM usuarios WHERE rol = 'vendedor' AND activo = 1 ORDER BY nombre")->fetchAll()
            )]);

        case 'pedidos':
            $u = requerir_rol();
            $where = [];
            $vals = [];
            if ($u['rol'] === 'vendedor' || !empty($_GET['mios'])) {
                $where[] = 'p.vendedor_id = ?';
                $vals[] = vendedor_objetivo($pdo, $u, $_GET['como'] ?? 0);
            }
            if (!empty($_GET['activos'])) {
                $where[] = "p.estado IN ('pendiente','buscando','no_encontrado_bodega')";
            } else {
                $where[] = 'p.created_at >= ?';
                $where[] = 'p.created_at <= ?';
                $vals[] = a_utc((string) ($_GET['desde'] ?? ''));
                $vals[] = a_utc((string) ($_GET['hasta'] ?? ''));
            }
            $st = $pdo->prepare(
                'SELECT p.id, u.nombre AS vendedor, p.producto, p.estado, p.rebusqueda,
                        p.motivo_cancelacion, p.nota_bodega, p.nota_faltante, p.created_at
                 FROM pedidos p JOIN usuarios u ON u.id = p.vendedor_id
                 WHERE ' . implode(' AND ', $where) . ' ORDER BY p.created_at DESC, p.id DESC LIMIT 500'
            );
            $st->execute($vals);
            $filas = $st->fetchAll();
            foreach ($filas as &$f) {
                $f['id'] = (int) $f['id'];
                $f['rebusqueda'] = (bool) $f['rebusqueda'];
                $f['created_at'] = str_replace(' ', 'T', $f['created_at']) . 'Z';
            }
            unset($f);
            responder(['pedidos' => $filas]);

        case 'reportes/faltantes':
            requerir_rol('admin');
            $estado = (string) ($_GET['estado'] ?? '');
            $estados = in_array($estado, ['no_encontrado_bodega', 'faltante_inventario'], true)
                ? [$estado]
                : ['no_encontrado_bodega', 'faltante_inventario'];
            $in = implode(',', array_fill(0, count($estados), '?'));
            $st = $pdo->prepare(
                "SELECT p.id, u.nombre AS vendedor, p.producto, p.estado, p.rebusqueda,
                        p.nota_faltante, p.created_at
                 FROM pedidos p JOIN usuarios u ON u.id = p.vendedor_id
                 WHERE p.estado IN ($in) AND p.created_at >= ? AND p.created_at <= ?
                 ORDER BY p.created_at DESC, p.id DESC LIMIT 5000"
            );
            $st->execute([...$estados, a_utc((string) ($_GET['desde'] ?? '')), a_utc((string) ($_GET['hasta'] ?? ''))]);
            $filas = $st->fetchAll();
            foreach ($filas as &$f) {
                $f['id'] = (int) $f['id'];
                $f['rebusqueda'] = (bool) $f['rebusqueda'];
                $f['created_at'] = str_replace(' ', 'T', $f['created_at']) . 'Z';
            }
            unset($f);
            responder(['pedidos' => $filas]);

        case 'pedidos/crear':
            requerir_post();
            $u = requerir_rol('vendedor', 'bodega');
            $in = entrada();
            $producto = texto($in['producto'] ?? '', 1000);
            if ($producto === '') {
                fallar('Escribe el producto.');
            }
            $pdo->prepare("INSERT INTO pedidos (vendedor_id, producto, estado, created_at) VALUES (?, ?, 'pendiente', UTC_TIMESTAMP())")
                ->execute([vendedor_objetivo($pdo, $u, $in['como'] ?? 0), $producto]);
            responder(['ok' => true], 201);

        case 'pedidos/estado':
            requerir_post();
            $u = requerir_rol('vendedor', 'bodega', 'admin');
            $in = entrada();
            $id = (int) ($in['id'] ?? 0);
            $accion = (string) ($in['accion'] ?? '');
            $nota = texto($in['nota'] ?? '', 255);

            $pdo->beginTransaction();
            $st = $pdo->prepare('SELECT * FROM pedidos WHERE id = ? FOR UPDATE');
            $st->execute([$id]);
            $p = $st->fetch();
            if (!$p) {
                $pdo->rollBack();
                fallar('Pedido no encontrado.', 404);
            }
            $actual = $p['estado'];
            $cambios = null;

            // Acciones de vendedor: sobre pedidos propios (también para bodega, que puede actuar como vendedor).
            // Acciones de bodega: solo bodega/admin.
            if (in_array($accion, ['cancelar', 'encontrado_almacen', 'rebuscar'], true)) {
                if ((int) $p['vendedor_id'] !== vendedor_objetivo($pdo, $u, $in['como'] ?? 0)) {
                    $pdo->rollBack();
                    fallar('Este pedido no es tuyo.', 403);
                }
                $motivo = MOTIVOS[$in['motivo'] ?? ''] ?? null;
                if ($accion === 'cancelar' && in_array($actual, ESTADOS_ACTIVOS, true) && $motivo !== null) {
                    $cambios = ['estado' => 'cancelado', 'motivo_cancelacion' => $motivo];
                } elseif ($accion === 'encontrado_almacen' && $actual === 'no_encontrado_bodega') {
                    $cambios = ['estado' => 'en_camino'];
                } elseif ($accion === 'rebuscar' && $actual === 'no_encontrado_bodega') {
                    $cambios = ['estado' => 'pendiente', 'rebusqueda' => 1];
                }
            } else {
                if ($u['rol'] === 'vendedor') {
                    $pdo->rollBack();
                    fallar('No tienes permiso para esto.', 403);
                }
                $abierto = in_array($actual, ['pendiente', 'buscando'], true);
                if ($accion === 'buscando' && $actual === 'pendiente') {
                    $cambios = ['estado' => 'buscando'];
                } elseif ($accion === 'en_camino' && $abierto) {
                    $cambios = ['estado' => 'en_camino'];
                } elseif ($accion === 'bodega_3' && $abierto && $nota !== '') {
                    $cambios = ['estado' => 'bodega_3', 'nota_bodega' => $nota];
                } elseif ($accion === 'no_encontrado' && $abierto && !$p['rebusqueda']) {
                    $cambios = ['estado' => 'no_encontrado_bodega'];
                } elseif ($accion === 'faltante' && $abierto && $p['rebusqueda'] && $nota !== '') {
                    $cambios = ['estado' => 'faltante_inventario', 'nota_faltante' => $nota];
                }
            }

            if ($cambios === null) {
                $pdo->rollBack();
                fallar('Esa acción no es válida para el estado actual del pedido.', 409);
            }
            $cols = implode(', ', array_map(fn($c) => "$c = ?", array_keys($cambios)));
            $pdo->prepare("UPDATE pedidos SET $cols WHERE id = ?")->execute([...array_values($cambios), $id]);
            $pdo->commit();
            responder(['ok' => true]);

        default:
            fallar('Ruta no encontrada.', 404);
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[talk] ' . $e);
    fallar('Error interno del servidor.', 500);
}
