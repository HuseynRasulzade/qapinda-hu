<?php
/**
 * Qapinda.hu form handler (contact + waitlist) for shared hosting.
 * Spam protection: honeypot field, minimum fill time, same-origin check, per-IP rate limit.
 * CONFIG: set $TO / $FROM below. For SMTP-less hosts PHP mail() is used.
 */
header('Content-Type: application/json; charset=utf-8');
$TO   = 'szia@qapinda.hu';          // ← where messages arrive
$FROM = 'noreply@qapinda.hu';       // ← must be an address on your domain (SPF)

function out($ok, $code = 200) { http_response_code($code); echo json_encode(['ok' => $ok]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(false, 405);

// Same-origin only
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($origin && !preg_match('#^https?://(www\.)?qapinda\.hu#i', $origin)) out(false, 403);

// Honeypot + timing (bots fill instantly)
if (!empty($_POST['website'])) out(true);                       // pretend success
$ts = (int)($_POST['ts'] ?? 0);
if ($ts && (round(microtime(true) * 1000) - $ts) < 2500) out(true);

// Rate limit: 5 submissions / hour / IP (file based)
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$f = sys_get_temp_dir() . '/qapinda_rl_' . md5($ip);
$hits = array_filter(is_file($f) ? (array)json_decode(file_get_contents($f)) : [], fn($t) => $t > time() - 3600);
if (count($hits) >= 5) out(false, 429);
$hits[] = time(); file_put_contents($f, json_encode(array_values($hits)));

$clean = fn($v) => trim(str_replace(["\r", "\n"], ' ', strip_tags((string)$v)));
$type  = ($_POST['type'] ?? '') === 'waitlist' ? 'waitlist' : 'contact';
$email = filter_var($clean($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
if (!$email) out(false, 422);
$lang  = ($_POST['lang'] ?? 'hu') === 'en' ? 'en' : 'hu';

if ($type === 'contact') {
  $name = $clean($_POST['name'] ?? ''); $topic = $clean($_POST['topic'] ?? '');
  $msg  = trim(strip_tags((string)($_POST['message'] ?? '')));
  if ($name === '' || mb_strlen($msg) < 10 || empty($_POST['consent'])) out(false, 422);
  $subject = "[Qapinda] Kapcsolat / Contact: $name";
  $body = "Name: $name\nEmail: $email\nTopic: $topic\nLang: $lang\n\n$msg\n";
} else {
  $subject = "[Qapinda] Waitlist: $email";
  $body = "Email: $email\nLang: $lang\nSource: " . $clean($_POST['source'] ?? '') . "\n";
}
$headers = "From: Qapinda <$FROM>\r\nReply-To: $email\r\nContent-Type: text/plain; charset=UTF-8\r\n";
$ok = mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
out($ok, $ok ? 200 : 500);
