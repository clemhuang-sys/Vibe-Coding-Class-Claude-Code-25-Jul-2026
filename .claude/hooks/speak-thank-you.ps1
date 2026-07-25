<#
  PostToolUse hook — spoken acknowledgement after an enquiry-form submit.

  Speaks the confirmation aloud through Windows SAPI, but only when
  validate-enquiry-form.ps1 armed the state file on the same click — so a
  click that was never validated stays silent.

  Wiring: .claude/settings.json -> hooks.PostToolUse, matcher
    mcp__playwright__browser_click
  Runs with "async": true so the speech does not block the session.
#>

$ErrorActionPreference = 'Stop'

$stateFile = Join-Path $PSScriptRoot '.enquiry-state.json'
$MESSAGE = 'Thank you for your submission. We will get back to you in 3 business days.'

$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $payload = $raw | ConvertFrom-Json } catch { exit 0 }

# Only fire for a submit click that the PreToolUse gate approved.
if (-not (Test-Path $stateFile)) { exit 0 }
try { $state = Get-Content $stateFile -Raw -Encoding utf8 | ConvertFrom-Json } catch { exit 0 }
if ([string]$state.armed -ne 'true') { exit 0 }

# Disarm first, so a failure below cannot leave the hook primed to re-fire.
Remove-Item $stateFile -Force -ErrorAction SilentlyContinue

try {
  $voice = New-Object -ComObject SAPI.SPVoice
  $voice.Speak($MESSAGE, 0) | Out-Null
} catch {
  # No SAPI voice available (headless / non-Windows): fall back to System.Speech,
  # and if that is missing too, say so in the transcript rather than failing loudly.
  try {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Speak($MESSAGE)
    $synth.Dispose()
  } catch {
    (@{ systemMessage = "Enquiry submitted. (Text-to-speech unavailable: $($_.Exception.Message))" } | ConvertTo-Json -Compress)
    exit 0
  }
}

(@{ systemMessage = "Spoke confirmation: $MESSAGE" } | ConvertTo-Json -Compress)
exit 0
