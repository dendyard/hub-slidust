<?php
/* ── Slidust Share Redirector ────────────────────────────────────────────────
 * URL: /share/{projectId}?task={taskId}
 * - Fetches minimal task data (no auth) ONLY to build OG meta tags for crawlers
 *   (WhatsApp / Slack / Twitter link previews need server-rendered meta tags).
 * - Real browsers are redirected INSTANTLY into the app, which opens the task
 *   card in dashboard mode (read-only + "Open in Project", access-checked).
 * - No visible preview UI.
 * ─────────────────────────────────────────────────────────────────────────── */

$requestUri = $_SERVER['REQUEST_URI'];
$path       = parse_url($requestUri, PHP_URL_PATH);

// Resolve projectId from any routing style:
//  - production .htaccess rewrite: /share/p123            -> path segment after "share"
//  - dev proxy (PATH_INFO):        /share/index.php/p123  -> $_SERVER['PATH_INFO']
//  - query fallback:               ?project=p123
$projectId = '';
if (!empty($_SERVER['PATH_INFO'])) {
    $projectId = explode('/', trim($_SERVER['PATH_INFO'], '/'))[0];
}
if ($projectId === '') {
    $segments = explode('/', trim($path, '/'));
    $shareIdx = array_search('share', $segments);
    if ($shareIdx !== false && isset($segments[$shareIdx + 1]) && $segments[$shareIdx + 1] !== 'index.php') {
        $projectId = $segments[$shareIdx + 1];
    }
}
if ($projectId === '') $projectId = $_GET['project'] ?? '';
$taskId = $_GET['task'] ?? '';

$host    = $_SERVER['HTTP_HOST'] ?? '';
$isLocal = strpos($host, 'localhost') !== false || strpos($host, '127.0.0') !== false;
$apiBase = $isLocal
    ? 'http://localhost:8888/apis.slidust.xyz/index.php/api'
    : 'https://apis.slidust.xyz/index.php/api';

$task = null;
if ($taskId) {
    $ch = curl_init("$apiBase/tasks/share/" . urlencode($taskId));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body && $code === 200) $task = json_decode($body, true);
}

$scheme   = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$origin   = $scheme . '://' . $host;
$shareUrl = $origin . $requestUri;

// Open the task card in the app (dashboard mode: read-only + access-checked "Open in Project").
// Relative so it resolves against the current origin (dev :5173 or production).
$appUrl = '/?task=' . rawurlencode($taskId) . '&shared=1';

$title       = $task['title']        ?? '';
$projectName = $task['project_name'] ?? 'Slidust';
$rawDesc     = $task['description']  ?? '';

$plainDesc = strip_tags(html_entity_decode($rawDesc, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
$plainDesc = preg_replace('/\s+/', ' ', trim($plainDesc));
$metaDesc  = mb_strlen($plainDesc) > 180 ? mb_substr($plainDesc, 0, 177) . '...' : ($plainDesc ?: "Task in $projectName");

$ogTitle = htmlspecialchars(($title ? "$title — " : '') . $projectName, ENT_QUOTES);
$ogDesc  = htmlspecialchars($metaDesc, ENT_QUOTES);
$ogUrl   = htmlspecialchars($shareUrl, ENT_QUOTES);
$jsUrl   = htmlspecialchars($appUrl, ENT_QUOTES);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= $ogTitle ?></title>

  <!-- OG meta tags for link previews (crawlers read these) -->
  <meta name="description"         content="<?= $ogDesc ?>" />
  <meta property="og:type"         content="article" />
  <meta property="og:url"          content="<?= $ogUrl ?>" />
  <meta property="og:title"        content="<?= $ogTitle ?>" />
  <meta property="og:description"  content="<?= $ogDesc ?>" />
  <meta property="og:site_name"    content="Slidust" />
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="<?= $ogTitle ?>" />
  <meta name="twitter:description" content="<?= $ogDesc ?>" />

  <!-- Instant redirect for real browsers (fires before paint) -->
  <script>window.location.replace(<?= json_encode($appUrl) ?>);</script>
  <meta http-equiv="refresh" content="0;url=<?= $jsUrl ?>" />

  <style>
    body {
      margin: 0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f1f5f9; color: #64748b; font-size: 0.9rem;
    }
  </style>
</head>
<body>
  Opening task… <a href="<?= $jsUrl ?>" style="margin-left:6px;color:#3b82f6;">click here</a> if not redirected.
</body>
</html>
