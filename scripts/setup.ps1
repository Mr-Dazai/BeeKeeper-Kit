# Usage: ./scripts/setup.ps1 -Target <target-project-path> [-Force]
# Copies agents/core/*.md to <target>/.claude/agents/, CLAUDE.template.md to <target>/CLAUDE.md,
# templates/PLAN.md and templates/ARCHITECTURE.md to <target>/docs/, and templates/settings.json to
# <target>/.claude/settings.json (enables the bee-keeper plugin). Existing docs, CLAUDE.md and agents are
# skipped unless -Force; an existing settings.json is never touched.
# No network, no other side effects.
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Target,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Target -PathType Container)) {
  Write-Error "Target folder not found: $Target"
  exit 1
}

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $Target '.claude/agents'
New-Item -ItemType Directory -Force -Path $dest | Out-Null

foreach ($f in Get-ChildItem -LiteralPath (Join-Path $root 'agents/core') -Filter *.md -File) {
  $out = Join-Path $dest $f.Name
  if ((Test-Path -LiteralPath $out) -and -not $Force) {
    Write-Host "skip   $($f.Name) (exists; use -Force to overwrite)"
  } else {
    Copy-Item -LiteralPath $f.FullName -Destination $out -Force
    Write-Host "copied $($f.Name)"
  }
}

$claude = Join-Path $Target 'CLAUDE.md'
if (Test-Path -LiteralPath $claude) {
  Write-Host 'skip   CLAUDE.md (exists)'
} else {
  Copy-Item -LiteralPath (Join-Path $root 'CLAUDE.template.md') -Destination $claude
  Write-Host 'copied CLAUDE.md'
}

$docs = Join-Path $Target 'docs'
New-Item -ItemType Directory -Force -Path $docs | Out-Null
foreach ($name in 'PLAN.md', 'ARCHITECTURE.md') {
  $out = Join-Path $docs $name
  if ((Test-Path -LiteralPath $out) -and -not $Force) {
    Write-Host "skip   docs/$name (exists; use -Force to overwrite)"
  } else {
    Copy-Item -LiteralPath (Join-Path $root "templates/$name") -Destination $out -Force
    Write-Host "copied docs/$name"
  }
}

$settings = Join-Path $Target '.claude/settings.json'
if (Test-Path -LiteralPath $settings) {
  Write-Host 'skip   .claude/settings.json (exists) — run: claude plugin install bee-keeper@bee-keeper --scope project'
} else {
  # Byte copy of the template keeps UTF-8 without BOM.
  [IO.File]::WriteAllBytes($settings, [IO.File]::ReadAllBytes((Join-Path $root 'templates/settings.json')))
  Write-Host 'copied .claude/settings.json'
}

Write-Host @'

Next steps:
  1. Open the project in Claude Code and trust the folder; accept the bee-keeper install it offers.
  2. Turn on auto-update once: /plugin → Marketplaces → bee-keeper → Enable auto-update.
  3. Run /bee-keeper:bee-scout, then /reload-plugins.
  4. Edit CLAUDE.md, docs/PLAN.md, docs/ARCHITECTURE.md and the EDIT sections in arch-guardian, secrets-auditor and milestone-checker.
'@
