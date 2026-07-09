param([int]$Port = 5050)

$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
  ".html" = "text/html"; ".js" = "application/javascript"; ".json" = "application/json";
  ".css" = "text/css"; ".svg" = "image/svg+xml"; ".png" = "image/png"; ".ico" = "image/x-icon"
}

$pool = [runspacefactory]::CreateRunspacePool(1, 8)
$pool.Open()

$handler = {
  param($context, $root, $mime)
  $req = $context.Request
  $res = $context.Response
  try {
    $path = $req.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root ($path.TrimStart("/"))
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $contentType
      $res.KeepAlive = $false
      $res.ContentLength64 = $bytes.Length
      $chunkSize = 32768
      $offset = 0
      while ($offset -lt $bytes.Length) {
        $len = [Math]::Min($chunkSize, $bytes.Length - $offset)
        $res.OutputStream.Write($bytes, $offset, $len)
        $offset += $len
      }
      $res.OutputStream.Flush()
    } else {
      $res.StatusCode = 404
    }
  } catch {
  } finally {
    try { $res.Close() } catch {}
  }
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $ps = [powershell]::Create()
  $ps.RunspacePool = $pool
  [void]$ps.AddScript($handler)
  [void]$ps.AddArgument($context)
  [void]$ps.AddArgument($root)
  [void]$ps.AddArgument($mime)
  $ps.BeginInvoke() | Out-Null
}
