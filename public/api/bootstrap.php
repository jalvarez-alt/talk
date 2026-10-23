<?php
declare(strict_types=1);

const ROLES = ['admin', 'bodega', 'vendedor'];

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Falta api/config.php (copia config.sample.php).']);
    exit;
}
$config = require $configFile;

function db(): PDO
{
    static $pdo = null;
    global $config;
    if ($pdo === null) {
        $d = $config['db'];
        $pdo = new PDO(
            "mysql:host={$d['host']};dbname={$d['name']};charset=utf8mb4",
            $d['user'],
            $d['pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }
    return $pdo;
}

function responder(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fallar(string $mensaje, int $code = 400): never
{
    responder(['error' => $mensaje], $code);
}

function entrada(): array
{
    $json = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($json) ? $json : [];
}

function es_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function iniciar_sesion(): void
{
    $dias = 14;
    ini_set('session.gc_maxlifetime', (string) ($dias * 86400));
    session_name('talk');
    session_set_cookie_params([
        'lifetime' => $dias * 86400,
        'path' => '/',
        'secure' => es_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Usuario logueado, releído de la BD para respetar cambios de rol o desactivación. */
function usuario_actual(): ?array
{
    $id = $_SESSION['uid'] ?? null;
    if (!$id) {
        return null;
    }
    $st = db()->prepare('SELECT id, nombre, usuario, rol FROM usuarios WHERE id = ? AND activo = 1');
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) {
        return null;
    }
    $u['id'] = (int) $u['id'];
    return $u;
}

function requerir_rol(string ...$roles): array
{
    $u = usuario_actual();
    if (!$u) {
        fallar('Sesión no iniciada.', 401);
    }
    if ($roles && !in_array($u['rol'], $roles, true)) {
        fallar('No tienes permiso para esto.', 403);
    }
    return $u;
}

/** Los POST exigen un header propio: un sitio externo no puede enviarlo sin pasar por CORS. */
function requerir_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fallar('Método no permitido.', 405);
    }
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'talk') {
        fallar('Solicitud no válida.', 403);
    }
}

function a_utc(string $iso): string
{
    $t = strtotime($iso);
    if ($t === false) {
        fallar('Fecha no válida.');
    }
    return gmdate('Y-m-d H:i:s', $t);
}

function texto(mixed $v, int $max): string
{
    return mb_substr(trim((string) $v), 0, $max);
}
