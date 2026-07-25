<#
  PreToolUse hook — enquiry-form gate.

  Blocks a browser-driven submit of the Meridian enquiry form unless every
  required field carries a valid value. The rules here mirror `rules` in
  script.js exactly (name >= 2 chars, permissive email regex, message >= 20
  chars, company optional) — if you change one, change the other.

  Scope: this governs form fills/clicks driven through the Playwright MCP
  server from Claude Code. It does NOT run for a human visiting the page in
  their own browser — that path is guarded by script.js.

  Wiring: .claude/settings.json -> hooks.PreToolUse, matcher
    mcp__playwright__browser_fill_form|mcp__playwright__browser_type|mcp__playwright__browser_click

  Field values are accumulated in .enquiry-state.json (gitignored) as they are
  typed, then checked when the submit button is clicked.
#>

$ErrorActionPreference = 'Stop'

$stateFile = Join-Path $PSScriptRoot '.enquiry-state.json'
$keys = @('name', 'email', 'company', 'message')

function Deny([string]$reason) {
  $out = @{
    hookSpecificOutput = @{
      hookEventName            = 'PreToolUse'
      permissionDecision       = 'deny'
      permissionDecisionReason = $reason
    }
  }
  $out | ConvertTo-Json -Depth 5 -Compress
  exit 0
}

function Note([string]$message) {
  (@{ systemMessage = $message; suppressOutput = $true } | ConvertTo-Json -Compress)
  exit 0
}

function Read-State {
  $s = @{ name = ''; email = ''; company = ''; message = ''; armed = '' }
  if (Test-Path $stateFile) {
    try {
      $j = Get-Content $stateFile -Raw -Encoding utf8 | ConvertFrom-Json
      foreach ($k in @($keys + 'armed')) {
        if (($j.PSObject.Properties.Name -contains $k) -and $null -ne $j.$k) { $s[$k] = [string]$j.$k }
      }
    } catch { }
  }
  return $s
}

function Write-State($s) {
  ($s | ConvertTo-Json -Compress) | Set-Content -Path $stateFile -Encoding utf8
}

# Map a human-readable field label from the Playwright snapshot onto one of the
# form's element ids. Order matters: "Company" must be caught before "name".
function Get-FieldKey([string]$label) {
  if (-not $label) { return $null }
  $l = $label.ToLowerInvariant()
  if ($l -match 'e-?mail') { return 'email' }
  if ($l -match 'company|organi[sz]ation') { return 'company' }
  if ($l -match 'name') { return 'name' }
  if ($l -match 'message|grow|textarea|detail|comment') { return 'message' }
  return $null
}

function Test-IsSubmitTarget([string]$label) {
  if (-not $label) { return $false }
  return ($label.ToLowerInvariant() -match 'claim your free diagnostic|diagnostic|submit|send enquiry|send inquiry')
}

# Same checks as script.js `rules`, in the same order.
function Get-Problems($s) {
  $p = @()

  $name = $s['name'].Trim()
  if (-not $name) { $p += 'Name is empty.' }
  elseif ($name.Length -lt 2) { $p += "Name ('$name') is shorter than 2 characters." }

  $email = $s['email'].Trim()
  if (-not $email) { $p += 'Email is empty.' }
  elseif ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') { $p += "Email ('$email') is not a valid address." }

  $msg = $s['message'].Trim()
  if (-not $msg) { $p += 'Message is empty.' }
  elseif ($msg.Length -lt 20) { $p += "Message is only $($msg.Length) characters; 20 or more required." }

  return $p
}

# ---------------------------------------------------------------------------

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $payload = $raw | ConvertFrom-Json } catch { exit 0 }

$tool = [string]$payload.tool_name
$ti = $payload.tool_input
if (-not $ti) { exit 0 }

if ($tool -like '*browser_fill_form') {
  $s = Read-State
  $matched = 0
  foreach ($f in @($ti.fields)) {
    $key = Get-FieldKey ([string]$f.name)
    if ($key) { $s[$key] = [string]$f.value; $matched++ }
  }
  if ($matched -eq 0) { exit 0 }   # some other form — not ours, stay out of the way
  $s['armed'] = ''
  Write-State $s

  $problems = Get-Problems $s
  if ($problems.Count -gt 0) {
    Note ("Enquiry form: recorded $matched field(s); still incomplete - " + ($problems -join ' '))
  }
  Note "Enquiry form: recorded $matched field(s); all required fields valid."
}

if ($tool -like '*browser_type') {
  $key = Get-FieldKey ([string]$ti.element)
  if (-not $key) { exit 0 }
  $s = Read-State
  $s[$key] = [string]$ti.text
  $s['armed'] = ''
  Write-State $s
  exit 0
}

if ($tool -like '*browser_click') {
  if (-not (Test-IsSubmitTarget ([string]$ti.element))) { exit 0 }

  $s = Read-State
  $filled = @($keys | Where-Object { $s[$_].Trim() }).Count
  if ($filled -eq 0) {
    Deny @'
Blocked: enquiry form submit attempted with no field values recorded.
Fill the form through browser_fill_form or browser_type first (name, email, message are required), then click submit.
'@
  }

  $problems = Get-Problems $s
  if ($problems.Count -gt 0) {
    $lines = @('Blocked: the enquiry form is not valid yet.') + ($problems | ForEach-Object { "  - $_" })
    Deny ($lines -join [Environment]::NewLine)
  }

  $s['armed'] = 'true'
  Write-State $s
  Note 'Enquiry form validated: name, email and message all pass. Submitting.'
}

exit 0
