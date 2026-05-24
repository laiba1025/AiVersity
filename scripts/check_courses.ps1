Write-Output 'ENV:'
Write-Output 'AZURE_SQL_CONNECTION_STRING='
if ($env:AZURE_SQL_CONNECTION_STRING) { Write-Output $env:AZURE_SQL_CONNECTION_STRING } else { Write-Output '<not set>' }
Write-Output 'USE_SQL_STORAGE='
if ($env:USE_SQL_STORAGE) { Write-Output $env:USE_SQL_STORAGE } else { Write-Output '<not set>' }
Write-Output '--- /api/courses ---'
try {
  $c = Invoke-RestMethod -Uri 'http://localhost:3000/api/courses' -Method Get -ErrorAction Stop
  $count = 0
  if ($c -is [System.Array]) { $count = $c.Length } elseif ($c) { $count = 1 }
  Write-Output ("Courses count: $count")
  $c | Select-Object -First 5 | ConvertTo-Json -Depth 4 | Write-Output
} catch {
  Write-Output ("/api/courses ERROR: " + $_.Exception.Message)
}

Write-Output '--- /api/courses?program=CS BSc ---'
try {
  $p = Invoke-RestMethod -Uri 'http://localhost:3000/api/courses?program=CS%20BSc' -Method Get -ErrorAction Stop
  $count2 = 0
  if ($p -is [System.Array]) { $count2 = $p.Length } elseif ($p) { $count2 = 1 }
  Write-Output ("CS BSc courses count: $count2")
  $p | ConvertTo-Json -Depth 4 | Write-Output
} catch {
  Write-Output ("/api/courses?program ERROR: " + $_.Exception.Message)
}

Write-Output '--- login as persisttest ---'
try {
  $ws = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $body = @{ username='persisttest'; password='p@ss1234' } | ConvertTo-Json
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $body -WebSession $ws -ErrorAction Stop
  Write-Output ("LOGIN STATUS: $($r.StatusCode)")
} catch {
  Write-Output ("LOGIN ERROR: " + $_.Exception.Message)
}

Write-Output '--- /api/student/courses/by-program as persisttest ---'
try {
  $s = Invoke-RestMethod -Uri 'http://localhost:3000/api/student/courses/by-program?program=CS%20BSc' -Method Get -WebSession $ws -ErrorAction Stop
  $keys = ($s | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name -ErrorAction SilentlyContinue) -join ', '
  Write-Output ("Student courses response keys: $keys")
  $s | ConvertTo-Json -Depth 5 | Write-Output
} catch {
  Write-Output ("STUDENT COURSES ERROR: " + $_.Exception.Message)
}
