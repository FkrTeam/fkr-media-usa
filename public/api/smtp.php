<?php
/**
 * A minimal SMTP client — the PHP twin of worker/smtp.js.
 *
 * Speaks just enough of RFC 5321 to hand one message to an authenticated
 * relay, the hosting account's own mail server:
 *
 *   EHLO → (STARTTLS → EHLO) → AUTH PLAIN|LOGIN → MAIL FROM → RCPT TO → DATA → QUIT
 *
 * Transport, by `secure`:
 *   'tls'       implicit TLS from the first byte — port 465. Preferred.
 *   'starttls'  plain connect, then upgrade before anything sensitive — 587.
 *   'none'      plaintext throughout. Local testing only.
 *
 * Credentials are used inside the TLS session and never logged; a refusal
 * at any step surfaces as an Exception naming the step and the server's
 * own reply, which is what the host's error log then shows.
 *
 * Not a page: loaded by contact.php only.
 */

declare(strict_types=1);

if (!function_exists('respond')) {
    http_response_code(404);
    exit;
}

final class Smtp
{
    private const TIMEOUT = 20;

    /** @var resource */
    private $socket;

    public static function send(array $o): void
    {
        $secure = $o['secure'] ?? 'tls';
        $host = $o['host'];
        $port = (int)$o['port'];

        $context = stream_context_create(['ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'SNI_enabled' => true,
        ]]);
        $target = ($secure === 'tls' ? 'ssl://' : 'tcp://') . $host . ':' . $port;

        $sock = @stream_socket_client($target, $errno, $errstr, self::TIMEOUT, STREAM_CLIENT_CONNECT, $context);
        if (!$sock) {
            throw new RuntimeException("SMTP connect to $host:$port failed: $errstr ($errno)");
        }
        stream_set_timeout($sock, self::TIMEOUT);

        $s = new self();
        $s->socket = $sock;

        try {
            $s->expect([220], 'greeting');
            $ehlo = $s->command('EHLO fkrmediausa.com', [250], 'EHLO');

            if ($secure === 'starttls') {
                if (stripos($ehlo, 'STARTTLS') === false) {
                    throw new RuntimeException('SMTP server does not offer STARTTLS');
                }
                $s->command('STARTTLS', [220], 'STARTTLS');
                $method = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                    $method |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
                }
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                    $method |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
                }
                if (stream_socket_enable_crypto($sock, true, $method) !== true) {
                    throw new RuntimeException('SMTP STARTTLS upgrade failed');
                }
                $ehlo = $s->command('EHLO fkrmediausa.com', [250], 'EHLO');
            }

            if (!empty($o['user'])) {
                if (preg_match('/AUTH[ =].*PLAIN/i', $ehlo)) {
                    $s->command('AUTH PLAIN ' . base64_encode("\0{$o['user']}\0{$o['pass']}"), [235], 'AUTH');
                } elseif (preg_match('/AUTH[ =].*LOGIN/i', $ehlo)) {
                    $s->command('AUTH LOGIN', [334], 'AUTH LOGIN');
                    $s->command(base64_encode($o['user']), [334], 'AUTH LOGIN user');
                    $s->command(base64_encode($o['pass']), [235], 'AUTH LOGIN password');
                } else {
                    throw new RuntimeException('SMTP server offers neither AUTH PLAIN nor AUTH LOGIN');
                }
            }

            $s->command("MAIL FROM:<{$o['from']}>", [250], 'MAIL FROM');
            foreach ($o['to'] as $rcpt) {
                $s->command("RCPT TO:<$rcpt>", [250, 251], "RCPT TO $rcpt");
            }

            $s->command('DATA', [354], 'DATA');
            // Dot-stuffing: a line that is only "." would end the message early.
            $body = preg_replace('/^\./m', '..', preg_replace('/\r?\n/', "\r\n", $o['message']));
            $s->command($body . "\r\n.", [250], 'message body');

            try {
                $s->command('QUIT', [221], 'QUIT');
            } catch (Throwable $e) {
                // Already accepted; a rude hang-up here changes nothing.
            }
        } finally {
            fclose($sock);
        }
    }

    private function command(string $line, array $expected, string $step): string
    {
        fwrite($this->socket, $line . "\r\n");
        return $this->expect($expected, $step);
    }

    /** Reads one full reply (continuation lines included) and checks its code. */
    private function expect(array $expected, string $step): string
    {
        $reply = '';
        for (;;) {
            $line = fgets($this->socket, 4096);
            if ($line === false) {
                $info = stream_get_meta_data($this->socket);
                throw new RuntimeException($info['timed_out'] ? 'SMTP timeout waiting for the server' : 'SMTP connection closed by the server');
            }
            $reply .= $line;
            if (preg_match('/^\d{3}(?: |\r?\n|$)/', $line)) {
                break;
            }
        }
        $code = (int)substr($reply, 0, 3);
        if (!in_array($code, $expected, true)) {
            // The server's text is useful; the command that got it is not —
            // it may hold the password.
            $first = strtok($reply, "\r\n") ?: $reply;
            throw new RuntimeException("SMTP $step failed: " . substr($first, 0, 200));
        }
        return $reply;
    }

    /* ---------- message building ---------- */

    /** multipart/alternative with UTF-8 text and HTML, RFC 2047 headers. */
    public static function buildMessage(array $m): string
    {
        $boundary = '=_fkr_' . bin2hex(random_bytes(16));
        $id = '<' . bin2hex(random_bytes(16)) . '@fkrmediausa.com>';

        $headers = array_filter([
            'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
            'Message-ID: ' . $id,
            'From: ' . self::mailbox($m['fromName'] ?? '', $m['from']),
            'To: ' . implode(', ', array_map(fn($a) => "<$a>", $m['to'])),
            !empty($m['replyTo']) ? 'Reply-To: <' . $m['replyTo'] . '>' : null,
            'Subject: ' . self::encodeWord($m['subject']),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'X-Mailer: fkr-media-usa php',
        ]);

        $part = fn(string $type, string $content) => implode("\r\n", [
            "--$boundary",
            "Content-Type: $type; charset=UTF-8",
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($content), 76, "\r\n")),
        ]);

        return implode("\r\n", array_merge($headers, [
            '',
            $part('text/plain', $m['text']),
            $part('text/html', $m['html']),
            "--$boundary--",
            '',
        ]));
    }

    private static function mailbox(string $name, string $addr): string
    {
        if ($name === '') {
            return "<$addr>";
        }
        $safe = preg_match("/^[\\w .'-]+$/", $name) ? "\"$name\"" : self::encodeWord($name);
        return "$safe <$addr>";
    }

    private static function encodeWord(string $value): string
    {
        return preg_match('/^[\x20-\x7e]*$/', $value) ? $value : '=?UTF-8?B?' . base64_encode($value) . '?=';
    }
}
