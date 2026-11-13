# ╔══════════════════════════════════════════════════════════╗
# ║  JARVIS — Instalador para Windows                       ║
# ║  Gringa Ads Academy                                      ║
# ╚══════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Stop"
$JARVIS_DIR = "$env:USERPROFILE\jarvis"
$REPO_URL = "https://github.com/hannasfranco-source/jarvis/archive/refs/heads/main.zip"

function Write-Banner {
    Write-Host ""
    Write-Host "   +---------------------------------------+" -ForegroundColor DarkYellow
    Write-Host "   |     J.A.R.V.I.S. — Gringa Ads         |" -ForegroundColor DarkYellow
    Write-Host "   |     Instalador v1.0 (Windows)          |" -ForegroundColor DarkYellow
    Write-Host "   +---------------------------------------+" -ForegroundColor DarkYellow
    Write-Host ""
}

function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Info($msg)  { Write-Host "  → $msg" -ForegroundColor DarkYellow }
function Write-Erro($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Banner

# Modo sem perguntas: quando rodado pelo Claude (sem teclado), usa JARVIS_NOME e pula as perguntas opcionais
$INTERATIVO = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
if ($env:JARVIS_ATUALIZAR -eq "1") { $INTERATIVO = $false }

# ─── 1. Verificar sistema ───
Write-Info "Verificando o sistema..."
if ($env:OS -ne "Windows_NT") {
    Write-Erro "Este script é para Windows."
    exit 1
}
Write-Ok "Windows detectado"

# ─── 2. Verificar/instalar Node.js ───
$NODE_BIN = ""
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $NODE_BIN = $nodeCmd.Source
    $NODE_V = & node -v 2>$null
    Write-Ok "Node.js já instalado: $NODE_V"
} else {
    Write-Info "Node.js não encontrado. Instalando..."
    $nodeDir = "$env:USERPROFILE\.local\node"
    $nodeZip = "$env:TEMP\node.zip"
    $nodeUrl = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip"

    Write-Info "Baixando Node.js 22..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing

    Write-Info "Extraindo..."
    if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
    New-Item -ItemType Directory -Path (Split-Path $nodeDir) -Force | Out-Null
    $extractDir = "$env:TEMP\node-extract"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Expand-Archive -Path $nodeZip -DestinationPath $extractDir -Force
    Move-Item "$extractDir\node-v22.12.0-win-x64" $nodeDir
    Remove-Item $nodeZip -Force
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue

    $NODE_BIN = "$nodeDir\node.exe"
    $NODE_V = & $NODE_BIN -v 2>$null
    Write-Ok "Node.js instalado: $NODE_V"

    # Adicionar ao PATH do usuário
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$nodeDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$nodeDir;$userPath", "User")
        $env:PATH = "$nodeDir;$env:PATH"
        Write-Ok "Node.js adicionado ao PATH (feche e abra o terminal depois)"
    }
}

# ─── 3. Verificar Claude Code ───
$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if ($claudeCmd) {
    Write-Ok "Claude Code encontrado"
} else {
    Write-Host ""
    Write-Info "Claude Code não encontrado."
    Write-Info "Você precisa do Claude Pro ou Max para usar o Jarvis."
    Write-Info "Instale: https://claude.ai/download"
    Write-Host ""
    if ($INTERATIVO) {
        $resp = Read-Host "  Já tem o Claude Code instalado? (s/n)"
        if ($resp -ne "s" -and $resp -ne "S") {
            Write-Host ""
            Write-Info "Instale o Claude Code e rode este instalador de novo."
            exit 0
        }
    }
}

# ─── 4. Baixar arquivos do repositório ───
Write-Info "Baixando arquivos do Jarvis..."
$tempZip = "$env:TEMP\jarvis-download.zip"
$tempExtract = "$env:TEMP\jarvis-extract"

Invoke-WebRequest -Uri $REPO_URL -OutFile $tempZip -UseBasicParsing
if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
$SCRIPT_DIR = "$tempExtract\jarvis-main"

if (-not (Test-Path "$SCRIPT_DIR\escritorio\server.mjs")) {
    Write-Erro "Não consegui baixar os arquivos. Tente baixar o ZIP manualmente:"
    Write-Erro $REPO_URL
    exit 1
}
Write-Ok "Arquivos baixados"

# ─── 5. Criar estrutura ───
Write-Host ""
Write-Info "Criando a pasta do Jarvis em ~/jarvis..."
$dirs = @(
    "$JARVIS_DIR\agentes\jarvis",
    "$JARVIS_DIR\agentes\nutra",
    "$JARVIS_DIR\agentes\lancamentos",
    "$JARVIS_DIR\escritorio\public",
    "$JARVIS_DIR\bin",
    "$JARVIS_DIR\entregas",
    "$JARVIS_DIR\logs"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
}

# ─── 6. Copiar arquivos ───
Write-Info "Copiando arquivos..."

# Atualização: guarda uma cópia das instruções atuais dos agentes (o aluno pode ter personalizado)
$carimbo = Get-Date -Format "yyyyMMdd-HHmm"
foreach ($a in @("jarvis", "nutra", "lancamentos")) {
    $md = "$JARVIS_DIR\agentes\$a\CLAUDE.md"
    if (Test-Path $md) { Copy-Item $md "$JARVIS_DIR\agentes\$a\CLAUDE.anterior-$carimbo.md" -Force }
}

Copy-Item "$SCRIPT_DIR\escritorio\server.mjs"        "$JARVIS_DIR\escritorio\" -Force
if (Test-Path "$JARVIS_DIR\escritorio\equipe.json") {
    try { & $NODE_BIN "$SCRIPT_DIR\bin\mesclar-equipe.mjs" "$SCRIPT_DIR\escritorio\equipe.json" "$JARVIS_DIR\escritorio\equipe.json" | Out-Null }
    catch { Copy-Item "$SCRIPT_DIR\escritorio\equipe.json" "$JARVIS_DIR\escritorio\" -Force }
} else {
    Copy-Item "$SCRIPT_DIR\escritorio\equipe.json" "$JARVIS_DIR\escritorio\" -Force
}
Copy-Item "$SCRIPT_DIR\escritorio\public\index.html"  "$JARVIS_DIR\escritorio\public\" -Force
Copy-Item "$SCRIPT_DIR\escritorio\public\voz.html"    "$JARVIS_DIR\escritorio\public\" -Force
Copy-Item "$SCRIPT_DIR\escritorio\public\aprovar-ofertas.js" "$JARVIS_DIR\escritorio\public\" -Force
Copy-Item "$SCRIPT_DIR\agentes\jarvis\CLAUDE.md"      "$JARVIS_DIR\agentes\jarvis\" -Force
Copy-Item "$SCRIPT_DIR\agentes\nutra\CLAUDE.md"       "$JARVIS_DIR\agentes\nutra\" -Force
Copy-Item "$SCRIPT_DIR\agentes\lancamentos\CLAUDE.md" "$JARVIS_DIR\agentes\lancamentos\" -Force
Copy-Item "$SCRIPT_DIR\bin\google-ads.mjs"             "$JARVIS_DIR\bin\" -Force
Copy-Item "$SCRIPT_DIR\bin\google-ads-autorizar.mjs"   "$JARVIS_DIR\bin\" -Force
Copy-Item "$SCRIPT_DIR\bin\google-ads-regras.json"     "$JARVIS_DIR\bin\" -Force
Copy-Item "$SCRIPT_DIR\bin\ofertas.mjs"                 "$JARVIS_DIR\bin\" -Force
Copy-Item "$SCRIPT_DIR\bin\ratoeira-script.mjs"         "$JARVIS_DIR\bin\" -Force
Copy-Item "$SCRIPT_DIR\conexoes.md"                    "$JARVIS_DIR\" -Force
Copy-Item "$SCRIPT_DIR\versao.json"                    "$JARVIS_DIR\" -Force
if (-not (Test-Path "$JARVIS_DIR\agenda.md")) { Copy-Item "$SCRIPT_DIR\agenda.md" "$JARVIS_DIR\" -Force }

# Criar scripts .cmd para os comandos
@"
@echo off
"$env:USERPROFILE\.local\node\node.exe" "$env:USERPROFILE\jarvis\bin\google-ads.mjs" %*
"@ | Set-Content "$JARVIS_DIR\bin\google-ads.cmd" -Encoding ASCII

@"
@echo off
"$env:USERPROFILE\.local\node\node.exe" "$env:USERPROFILE\jarvis\bin\google-ads-autorizar.mjs" %*
"@ | Set-Content "$JARVIS_DIR\bin\google-ads-autorizar.cmd" -Encoding ASCII

@"
@echo off
if exist "$env:USERPROFILE\.local\node\node.exe" (
  "$env:USERPROFILE\.local\node\node.exe" "$env:USERPROFILE\jarvis\bin\ofertas.mjs" %*
) else (
  node "$env:USERPROFILE\jarvis\bin\ofertas.mjs" %*
)
"@ | Set-Content "$JARVIS_DIR\bin\ofertas.cmd" -Encoding ASCII

@"
@echo off
if exist "$env:USERPROFILE\.local\node\node.exe" (
  "$env:USERPROFILE\.local\node\node.exe" "$env:USERPROFILE\jarvis\bin\ratoeira-script.mjs" %*
) else (
  node "$env:USERPROFILE\jarvis\bin\ratoeira-script.mjs" %*
)
"@ | Set-Content "$JARVIS_DIR\bin\ratoeira-script.cmd" -Encoding ASCII

@'
@echo off
powershell -ExecutionPolicy Bypass -Command "$env:JARVIS_ATUALIZAR='1'; irm https://raw.githubusercontent.com/hannasfranco-source/jarvis/main/instalar.ps1 | iex"
'@ | Set-Content "$JARVIS_DIR\bin\atualizar.cmd" -Encoding ASCII

Write-Ok "Arquivos copiados"

# ─── 7. Perguntar o nome ───
Write-Host ""
$NOME = $env:JARVIS_NOME
if ([string]::IsNullOrWhiteSpace($NOME) -and (Test-Path "$JARVIS_DIR\config.json")) {
    try { $NOME = (Get-Content "$JARVIS_DIR\config.json" -Raw | ConvertFrom-Json).nome } catch {}
}
if ([string]::IsNullOrWhiteSpace($NOME) -and $INTERATIVO) { $NOME = Read-Host "  Qual é o seu nome?" }
if ([string]::IsNullOrWhiteSpace($NOME)) { $NOME = "Aluno" }

if (-not (Test-Path "$JARVIS_DIR\config.json")) {
@"
{
  "nome": "$NOME",
  "musicaBomDia": "spotify:track:08mG3Y1vljYA6bvDt4Wqkj",
  "musicaInicio": 9,
  "vozProvedor": "fish",
  "vozId": ""
}
"@ | Set-Content "$JARVIS_DIR\config.json" -Encoding UTF8
}

Write-Ok "Configurado para $NOME"

# Atualizar o nome nos agentes
foreach ($agente in @("jarvis", "nutra", "lancamentos")) {
    $mdPath = "$JARVIS_DIR\agentes\$agente\CLAUDE.md"
    if (Test-Path $mdPath) {
        (Get-Content $mdPath -Raw) -replace '\{\{NOME\}\}', $NOME | Set-Content $mdPath -Encoding UTF8 -NoNewline
    }
}

$conPath = "$JARVIS_DIR\conexoes.md"
if (Test-Path $conPath) {
    (Get-Content $conPath -Raw) -replace '\{\{NOME\}\}', $NOME | Set-Content $conPath -Encoding UTF8 -NoNewline
}

$agPath = "$JARVIS_DIR\agenda.md"
if (Test-Path $agPath) {
    (Get-Content $agPath -Raw) -replace '\{\{NOME\}\}', $NOME | Set-Content $agPath -Encoding UTF8 -NoNewline
}

# ─── 8. Configurar Google Ads (opcional) ───
if (Test-Path "$JARVIS_DIR\.google-ads.env") {
    Write-Ok "Google Ads: configuração mantida"
} else {
    Write-Host ""
    Write-Host "  --- Google Ads (opcional, pode fazer depois) ---" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Info "Para criar campanhas pelo Jarvis, você precisa de um"
    Write-Info "projeto no Google Cloud com a API do Google Ads ativada."
    Write-Host ""
    Write-Info "Guia completo: https://github.com/gringa-ads/jarvis/wiki/Google-Ads"
    Write-Host ""
    $resp = "n"
    if ($INTERATIVO) { $resp = Read-Host "  Já tem as credenciais do Google Ads? (s/n)" }
    if ($resp -eq "s" -or $resp -eq "S") {
        $GAS_CLIENT_ID = Read-Host "  Client ID"
        $GAS_CLIENT_SECRET = Read-Host "  Client Secret"
        $GAS_DEV_TOKEN = Read-Host "  Developer Token"
        $GAS_MCC = Read-Host "  Login Customer ID (MCC, sem traços)"
        @"
GOOGLE_ADS_CLIENT_ID=$GAS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET=$GAS_CLIENT_SECRET
GOOGLE_ADS_DEVELOPER_TOKEN=$GAS_DEV_TOKEN
GOOGLE_ADS_LOGIN_CUSTOMER_ID=$GAS_MCC
"@ | Set-Content "$JARVIS_DIR\.google-ads.env" -Encoding UTF8
        Write-Ok "Credenciais salvas"
        Write-Host ""
        Write-Info "Agora rode este comando para autorizar:"
        Write-Host "  $JARVIS_DIR\bin\google-ads-autorizar.cmd" -ForegroundColor DarkYellow
    } else {
        @"
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
"@ | Set-Content "$JARVIS_DIR\.google-ads.env" -Encoding UTF8
        Write-Info "Sem problema! Quando tiver, edite $JARVIS_DIR\.google-ads.env"
    }
}

# ─── 9. Configurar o Escritório para ligar com o Windows ───
Write-Host ""
Write-Info "Configurando o Escritório para ligar com o Windows..."

if ([string]::IsNullOrEmpty($NODE_BIN)) {
    $NODE_BIN = "$env:USERPROFILE\.local\node\node.exe"
}

# Criar script de inicialização
$startScript = @"
@echo off
start /b "" "$NODE_BIN" "$JARVIS_DIR\escritorio\server.mjs" > "$JARVIS_DIR\escritorio\servidor.log" 2>&1
"@
Set-Content "$JARVIS_DIR\escritorio\iniciar.cmd" $startScript -Encoding ASCII

# Criar atalho na pasta Startup para iniciar automaticamente
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = "$startupFolder\Jarvis Escritorio.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$JARVIS_DIR\escritorio\iniciar.cmd"
$shortcut.WorkingDirectory = "$JARVIS_DIR\escritorio"
$shortcut.WindowStyle = 7  # minimizado
$shortcut.Save()

# Atualização: encerra o painel antigo antes de iniciar o novo
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*jarvis*server.mjs*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# Iniciar o servidor agora
Start-Process -FilePath $NODE_BIN -ArgumentList "$JARVIS_DIR\escritorio\server.mjs" -WorkingDirectory "$JARVIS_DIR\escritorio" -WindowStyle Hidden -RedirectStandardOutput "$JARVIS_DIR\escritorio\servidor.log" -RedirectStandardError "$JARVIS_DIR\escritorio\servidor-erro.log"

Write-Ok "Escritório configurado em http://localhost:4848"

# Limpar arquivos temporários
Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

# ─── 10. Resumo final ───
Write-Host ""
Write-Host "   +---------------------------------------+" -ForegroundColor DarkYellow
Write-Host "   |         INSTALAÇÃO CONCLUÍDA!          |" -ForegroundColor DarkYellow
Write-Host "   +---------------------------------------+" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  Seu Jarvis está em: $JARVIS_DIR" -ForegroundColor White
Write-Host ""
Write-Host "  Como usar:" -ForegroundColor White
Write-Host "  1. Abra http://localhost:4848 no Chrome" -ForegroundColor DarkYellow
Write-Host "  2. Abra o Claude Code na pasta de um agente:" -ForegroundColor DarkYellow
Write-Host "     cd $JARVIS_DIR\agentes\nutra; claude" -ForegroundColor DarkGray
Write-Host "     cd $JARVIS_DIR\agentes\lancamentos; claude" -ForegroundColor DarkGray
Write-Host "  3. Para usar o Jarvis por voz, clique em" -ForegroundColor DarkYellow
Write-Host "     JARVIS · DESLIGADO no topo da página" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  Agentes:" -ForegroundColor White
Write-Host "  • Nutra       → garimpo, copy, página e campanha" -ForegroundColor DarkYellow
Write-Host "  • Lançamentos → garimpo, copy, página e campanha" -ForegroundColor DarkYellow
Write-Host "  • Jarvis      → orquestra tudo, responde por voz" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  Conexões (importante):" -ForegroundColor White
Write-Host "  → Falta conectar a Ratoeira Ads, a Hostinger e o e-mail (Lançamentos). O Jarvis te guia na primeira conversa." -ForegroundColor DarkYellow
Write-Host ""
if ($GAS_CLIENT_ID) {
    Write-Host "  ✓ Google Ads: Credenciais salvas. Rode: $JARVIS_DIR\bin\google-ads-autorizar.cmd" -ForegroundColor Green
} else {
    Write-Host "  → Google Ads: Configure quando estiver pronto: edite $JARVIS_DIR\.google-ads.env" -ForegroundColor DarkYellow
}
Write-Host ""
Write-Host "  Voz do Jarvis (opcional):" -ForegroundColor White
Write-Host "  → Crie conta grátis em fish.audio" -ForegroundColor DarkYellow
Write-Host "  → Abra http://localhost:4848/voz.html e cole a chave" -ForegroundColor DarkYellow
Write-Host ""

if ($INTERATIVO) {
    Write-Host "  Pressione Enter para fechar..." -ForegroundColor DarkGray
    Read-Host
}
