<?php
/**
 * FKR Media USA — contact endpoint for shared Linux hosting.
 *
 * The PHP twin of worker/index.js. On the Cloudflare deploy the Worker
 * answers /api/contact and this file is never served (run_worker_first);
 * on an Apache host .htaccess rewrites /api/contact to this file and it
 * does the same job with the same rules:
 *
 *   1. STORE  — the enquiry goes into the hosting account's MySQL database
 *               over localhost (no remote access needed). Record of truth.
 *   2. NOTIFY — an email goes to FKR through the account's SMTP server
 *               (api/smtp.php), Reply-To set to the visitor.
 *
 * 200 as long as one of the two succeeded; only when both fail does the
 * visitor see an error, and then the form offers the mailto route.
 *
 * WHERE THE SECRETS LIVE — never in this file and never in the web root:
 *
 *   The settings are read, in this order, from
 *     a. real environment variables (a hosting panel's "environment
 *        variables" feature, or SetEnv in an .htaccess), then
 *     b. a file named fkr-contact.env found in the first of:
 *          - the path in FKR_CONTACT_CONFIG, if that variable is set
 *          - the directory ABOVE the document root (the account's home
 *            directory on cPanel/Plesk — the recommended place)
 *          - each directory walking up from this file, four levels
 *   fkr-contact.env.example in the repository lists every key.
 *
 *   If the file has to sit inside the web root, .htaccess refuses to serve
 *   any *.env, but a directory above public_html is the safe answer.
 *
 * Same security rules as the Worker: same-origin POSTs only, every field
 * re-validated with hard caps, honeypot checked here too, 5 enquiries per
 * address per hour counted on a salted SHA-256 (the address itself is never
 * stored), mail built from HTML-escaped fields.
 *
 * Requires PHP 7.4+ with pdo_mysql and openssl — standard on any host.
 */

declare(strict_types=1);

// Whatever goes wrong, the reply stays JSON: a PHP notice printed into the
// body would break the client and leak a server path.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const LIMITS = [
    'name' => 120, 'company' => 160, 'email' => 254, 'phone' => 40,
    'service' => 40, 'budget' => 40, 'message' => 4000,
];
const BODY_LIMIT = 16 * 1024;
const SERVICES = ['digital-advertising', 'social-media', 'seo', 'web', 'branding', 'content', 'other'];
const BUDGETS = ['', 'under-25k', '25-50k', '50-100k', '100k-plus', 'unsure'];
const HONEYPOT = 'company_website';
const RATE_WINDOW = 3600;   // seconds
const RATE_MAX = 5;

// Created on first use, so setup is one database and one user.
const CREATE_TABLE = <<<'SQL'
CREATE TABLE IF NOT EXISTS enquiries (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  received_at   DATETIME(3)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  company       VARCHAR(160) NULL,
  email         VARCHAR(254) NOT NULL,
  phone         VARCHAR(40)  NULL,
  service       VARCHAR(40)  NOT NULL,
  budget        VARCHAR(40)  NULL,
  message       TEXT         NOT NULL,
  ip_hash       CHAR(64)     NOT NULL,
  country       CHAR(2)      NULL,
  user_agent    VARCHAR(300) NULL,
  referer       VARCHAR(500) NULL,
  notified_at   DATETIME(3)  NULL,
  notify_error  VARCHAR(200) NULL,
  INDEX enquiries_received_at (received_at),
  INDEX enquiries_ip_window (ip_hash, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL;

function respond(int $status, array $data, array $headers = []): void
{
    http_response_code($status);
    foreach ($headers as $k => $v) {
        header("$k: $v");
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function logError(string $message): void
{
    // Lands in the host's PHP error log, which every panel exposes.
    error_log('[contact] ' . $message);
}

/* ---------- request gate ---------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['error' => 'Method not allowed'], ['Allow' => 'POST']);
}

if (!sameOrigin()) {
    respond(403, ['error' => 'Forbidden']);
}

$raw = file_get_contents('php://input') ?: '';
if (strlen($raw) > BODY_LIMIT) {
    respond(413, ['error' => 'Request too large']);
}
$body = json_decode($raw, true);
if (!is_array($body)) {
    respond(400, ['error' => 'Expected JSON']);
}

// A bot filled the field people cannot see. Tell it nothing.
if (str($body[HONEYPOT] ?? null) !== '') {
    respond(200, ['ok' => true]);
}

[$enquiry, $errors] = validate($body);
if ($errors) {
    respond(422, ['error' => 'Please correct the highlighted fields.', 'fields' => $errors]);
}

/* ---------- configuration ---------- */

$cfg = loadConfig();
$hasDb = !empty($cfg['MYSQL_HOST']) && !empty($cfg['MYSQL_DATABASE']) && !empty($cfg['MYSQL_USER']) && isset($cfg['MYSQL_PASSWORD']);
if (!$hasDb) {
    logError('MYSQL_* not set — enquiries will not be stored');
}

$ip = clientIp();
$ipHash = hash('sha256', ($cfg['IP_SALT'] ?? '') . ':' . $ip);

$meta = [
    'ipHash' => $ipHash,
    'country' => substr((string)($_SERVER['HTTP_CF_IPCOUNTRY'] ?? ''), 0, 2) ?: null,
    'userAgent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300) ?: null,
    'referer' => substr((string)($_SERVER['HTTP_REFERER'] ?? ''), 0, 500) ?: null,
    'receivedAt' => gmdate('Y-m-d H:i:s.v'),
];

/* ---------- store ---------- */

$pdo = null;
$stored = null;

if ($hasDb) {
    try {
        $pdo = openDb($cfg);
        if (countRecent($pdo, $ipHash) >= RATE_MAX) {
            respond(429, ['error' => 'Too many enquiries from this connection. Please try again later, or email us directly.'], ['Retry-After' => (string)RATE_WINDOW]);
        }
        $stored = store($pdo, $enquiry, $meta);
    } catch (Throwable $e) {
        logError('MySQL failed: ' . $e->getMessage());
        $stored = null;
    }
}

/* ---------- notify ---------- */

$mailed = false;
try {
    $mailed = notify($cfg, $enquiry, $meta, $stored);
} catch (Throwable $e) {
    logError('email failed: ' . $e->getMessage());
    $mailed = false;
}

if ($stored === null && !$mailed) {
    respond(500, ['error' => 'We could not take your enquiry just now. Please email us directly.']);
}

if ($stored !== null && $pdo) {
    try {
        $pdo->prepare('UPDATE enquiries SET notified_at = ?, notify_error = ? WHERE id = ?')
            ->execute([$mailed ? gmdate('Y-m-d H:i:s.v') : null, $mailed ? null : 'send failed', $stored]);
    } catch (Throwable $e) {
        logError('could not record notification state: ' . $e->getMessage());
    }
}

respond(200, ['ok' => true]);

/* ====================================================================== */

function sameOrigin(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($origin === '' || $host === '') {
        return false;
    }
    $parts = parse_url($origin);
    if (!$parts || empty($parts['host'])) {
        return false;
    }
    $originHost = strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
    return $originHost === strtolower($host);
}

function clientIp(): string
{
    // Behind Cloudflare's proxy the real address is in CF-Connecting-IP;
    // otherwise REMOTE_ADDR is the connection itself. Nothing else is
    // trusted — X-Forwarded-For can be written by anyone.
    return (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '');
}

function str($value): string
{
    return is_string($value) ? trim($value) : '';
}

/** Length in characters, with or without the mbstring extension. */
function ulen(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    $n = preg_match_all('/./us', $value);
    return $n === false ? strlen($value) : $n;
}

function validate(array $body): array
{
    $e = [];
    foreach (['name', 'company', 'email', 'phone', 'service', 'budget', 'message'] as $key) {
        $e[$key] = str($body[$key] ?? null);
    }
    $errors = [];

    foreach (LIMITS as $key => $max) {
        if (ulen($e[$key]) > $max) {
            $errors[$key] = "Too long (max $max characters).";
        }
    }
    if (ulen($e['name']) < 2) {
        $errors['name'] = 'Please enter your name.';
    }
    if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $e['email']) || preg_match('/[\r\n<>]/', $e['email'])) {
        $errors['email'] = 'Please enter a valid email address.';
    }
    if (!in_array($e['service'], SERVICES, true)) {
        $errors['service'] = 'Please choose the service you are interested in.';
    }
    if (!in_array($e['budget'], BUDGETS, true)) {
        $errors['budget'] = 'Please choose a listed range.';
    }
    if (ulen($e['message']) < 10) {
        $errors['message'] = 'Please tell us a little more — at least a sentence.';
    }

    return [$e, $errors];
}

/* ---------- configuration ---------- */

function loadConfig(): array
{
    $keys = [
        'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_SSL',
        'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS',
        'MAIL_FROM', 'MAIL_TO', 'IP_SALT',
    ];

    $cfg = [];
    foreach ($keys as $key) {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            $cfg[$key] = $value;
        }
    }

    $file = findConfigFile();
    if ($file !== null) {
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && substr($value, -1) === $value[0]) {
                $value = substr($value, 1, -1);
            }
            // The environment wins over the file, so a panel setting can
            // override a stale file without editing it.
            if (in_array($key, $keys, true) && !isset($cfg[$key])) {
                $cfg[$key] = $value;
            }
        }
    }

    return $cfg;
}

function findConfigFile(): ?string
{
    $candidates = [];

    $explicit = getenv('FKR_CONTACT_CONFIG');
    if ($explicit) {
        $candidates[] = $explicit;
    }

    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($docRoot !== '') {
        $candidates[] = dirname($docRoot) . '/fkr-contact.env';
    }

    $dir = __DIR__;
    for ($i = 0; $i < 4; $i++) {
        $dir = dirname($dir);
        $candidates[] = $dir . '/fkr-contact.env';
    }

    foreach ($candidates as $path) {
        if (is_file($path) && is_readable($path)) {
            return $path;
        }
    }
    return null;
}

/* ---------- storage ---------- */

function openDb(array $cfg): PDO
{
    $host = $cfg['MYSQL_HOST'];
    $port = (int)($cfg['MYSQL_PORT'] ?? 3306);
    $dsn = "mysql:host=$host;port=$port;dbname={$cfg['MYSQL_DATABASE']};charset=utf8mb4";

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ];
    if (strtolower($cfg['MYSQL_SSL'] ?? '') === 'require' && defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }

    $pdo = new PDO($dsn, $cfg['MYSQL_USER'], (string)$cfg['MYSQL_PASSWORD'], $options);
    $pdo->exec("SET time_zone = '+00:00'");
    $pdo->exec(CREATE_TABLE);
    return $pdo;
}

function countRecent(PDO $pdo, string $ipHash): int
{
    $since = gmdate('Y-m-d H:i:s.v', time() - RATE_WINDOW);
    $st = $pdo->prepare('SELECT COUNT(*) FROM enquiries WHERE ip_hash = ? AND received_at > ?');
    $st->execute([$ipHash, $since]);
    return (int)$st->fetchColumn();
}

function store(PDO $pdo, array $e, array $meta): string
{
    $id = uuid4();
    $pdo->prepare(
        'INSERT INTO enquiries
           (id, received_at, name, company, email, phone, service, budget, message,
            ip_hash, country, user_agent, referer, notified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)'
    )->execute([
        $id, $meta['receivedAt'], $e['name'], $e['company'] ?: null, $e['email'], $e['phone'] ?: null,
        $e['service'], $e['budget'] ?: null, $e['message'],
        $meta['ipHash'], $meta['country'], $meta['userAgent'], $meta['referer'],
    ]);
    return $id;
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/* ---------- email ---------- */

function notify(array $cfg, array $e, array $meta, ?string $id): bool
{
    if (empty($cfg['SMTP_HOST']) || empty($cfg['SMTP_USER']) || !isset($cfg['SMTP_PASS'])) {
        logError('SMTP_HOST / SMTP_USER / SMTP_PASS not set — enquiry stored but no email sent');
        return false;
    }
    $to = array_values(array_filter(array_map(
        fn($s) => parseAddress($s)['address'],
        explode(',', $cfg['MAIL_TO'] ?? '')
    )));
    $sender = parseAddress($cfg['MAIL_FROM'] ?? '');
    if (!$to || $sender['address'] === '') {
        logError('MAIL_TO / MAIL_FROM not set — enquiry stored but no email sent');
        return false;
    }

    require_once __DIR__ . '/smtp.php';

    $subject = 'Project enquiry — ' . $e['name'] . ($e['company'] !== '' ? " ({$e['company']})" : '');
    $rows = [
        ['Name', $e['name']],
        ['Company', $e['company'] !== '' ? $e['company'] : '—'],
        ['Email', $e['email']],
        ['Phone', $e['phone'] !== '' ? $e['phone'] : '—'],
        ['Service', $e['service']],
        ['Budget', $e['budget'] !== '' ? $e['budget'] : '—'],
        ['Country', $meta['country'] ?? '—'],
        ['Received', $meta['receivedAt'] . ' UTC'],
        ['Record', $id ?? 'not stored'],
    ];

    $text = implode("\n", array_map(fn($r) => "{$r[0]}: {$r[1]}", $rows)) . "\n\nMessage:\n" . $e['message'];

    $esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $table = implode("\n", array_map(
        fn($r) => '<tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap">' . $esc($r[0]) . '</td><td style="padding:4px 0">' . $esc($r[1]) . '</td></tr>',
        $rows
    ));
    $html = '<!doctype html><html><body style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;padding:24px">'
        . '<h2 style="margin:0 0 16px;font-size:18px">New project enquiry</h2>'
        . '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px">' . $table . '</table>'
        . '<div style="white-space:pre-wrap;border-left:3px solid #ee473d;padding:8px 14px;background:#faf9f7">' . $esc($e['message']) . '</div>'
        . '</body></html>';

    $message = Smtp::buildMessage([
        'from' => $sender['address'],
        'fromName' => $sender['name'] !== '' ? $sender['name'] : 'FKR Media USA',
        'to' => $to,
        'replyTo' => $e['email'],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
    ]);

    Smtp::send([
        'host' => $cfg['SMTP_HOST'],
        'port' => (int)($cfg['SMTP_PORT'] ?? 465),
        'secure' => $cfg['SMTP_SECURE'] ?? 'tls',
        'user' => $cfg['SMTP_USER'],
        'pass' => (string)$cfg['SMTP_PASS'],
        'from' => $sender['address'],
        'to' => $to,
        'message' => $message,
    ]);

    return true;
}

/** Splits `"Name" <addr>` or `addr` into its parts. */
function parseAddress(string $value): array
{
    if (preg_match('/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/', $value, $m)) {
        return ['name' => trim($m[1]), 'address' => trim($m[2])];
    }
    return ['name' => '', 'address' => trim($value)];
}
