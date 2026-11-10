#!/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║  JARVIS — Instalador para Alunos da Gringa Ads Academy  ║
# ╚══════════════════════════════════════════════════════════╝
set -e

JARVIS_DIR="$HOME/jarvis"
COR='\033[1;38;5;208m'  # laranja
VERDE='\033[1;32m'
CINZA='\033[0;90m'
RESET='\033[0m'
BOLD='\033[1m'

banner() {
  echo ""
  echo -e "${COR}   ╭─────────────────────────────────────╮${RESET}"
  echo -e "${COR}   │     J.A.R.V.I.S. — Gringa Ads       │${RESET}"
  echo -e "${COR}   │     Instalador v1.0                  │${RESET}"
  echo -e "${COR}   ╰─────────────────────────────────────╯${RESET}"
  echo ""
}

ok()   { echo -e "  ${VERDE}✓${RESET} $1"; }
info() { echo -e "  ${COR}→${RESET} $1"; }
erro() { echo -e "  \033[1;31m✗${RESET} $1"; }

banner

# ─── 1. Verificar sistema ───
info "Verificando o sistema..."
if [[ "$(uname)" != "Darwin" ]]; then
  erro "Este instalador é para Mac. No Windows, veja o README."
  exit 1
fi
ok "macOS detectado"

# ─── 2. Verificar/instalar Node.js ───
NODE_BIN=""
if command -v node &>/dev/null; then
  NODE_BIN="$(command -v node)"
  NODE_V="$(node -v 2>/dev/null || echo '')"
  ok "Node.js já instalado: $NODE_V em $NODE_BIN"
elif [ -x "$HOME/.local/node/bin/node" ]; then
  NODE_BIN="$HOME/.local/node/bin/node"
  NODE_V="$($NODE_BIN -v 2>/dev/null || echo '')"
  ok "Node.js encontrado: $NODE_V em $NODE_BIN"
else
  info "Node.js não encontrado. Instalando..."
  ARCH="$(uname -m)"
  if [ "$ARCH" = "arm64" ]; then
    NODE_URL="https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-arm64.tar.xz"
  else
    NODE_URL="https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-x64.tar.xz"
  fi
  mkdir -p "$HOME/.local/node"
  info "Baixando Node.js 22..."
  curl -fsSL "$NODE_URL" | tar xJ --strip-components=1 -C "$HOME/.local/node"
  NODE_BIN="$HOME/.local/node/bin/node"
  NODE_V="$($NODE_BIN -v 2>/dev/null || echo '')"
  ok "Node.js instalado: $NODE_V"
  # Adiciona ao PATH se não estiver
  if ! echo "$PATH" | grep -q "$HOME/.local/node/bin"; then
    SHELL_RC="$HOME/.zshrc"
    [ -f "$HOME/.bashrc" ] && [ ! -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.bashrc"
    echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "$SHELL_RC"
    export PATH="$HOME/.local/node/bin:$PATH"
    ok "Node.js adicionado ao PATH (feche e abra o terminal depois)"
  fi
fi

# ─── 3. Verificar Claude Code ───
if command -v claude &>/dev/null; then
  ok "Claude Code encontrado"
else
  echo ""
  info "${BOLD}Claude Code não encontrado.${RESET}"
  info "Você precisa do Claude Pro ou Max para usar o Jarvis."
  info "Instale: ${COR}https://claude.ai/download${RESET}"
  echo ""
  read -rp "  Já tem o Claude Code instalado? (s/n) " resp
  if [[ "$resp" != "s" && "$resp" != "S" ]]; then
    echo ""
    info "Instale o Claude Code e rode este instalador de novo."
    exit 0
  fi
fi

# ─── 4. Baixar arquivos se rodando via curl/pipe ───
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$SCRIPT_DIR/escritorio/server.mjs" ]; then
  info "Baixando arquivos do Jarvis..."
  TEMP_DIR="$(mktemp -d)"
  curl -fsSL "https://github.com/hannasfranco-source/jarvis/archive/refs/heads/main.tar.gz" | tar xz -C "$TEMP_DIR"
  SCRIPT_DIR="$TEMP_DIR/jarvis-main"
  if [ ! -f "$SCRIPT_DIR/escritorio/server.mjs" ]; then
    erro "Não consegui baixar os arquivos. Tente baixar o ZIP manualmente:"
    erro "https://github.com/hannasfranco-source/jarvis/archive/refs/heads/main.zip"
    rm -rf "$TEMP_DIR"
    exit 1
  fi
  ok "Arquivos baixados"
fi

# ─── 5. Criar estrutura ───
echo ""
info "Criando a pasta do Jarvis em ~/jarvis..."
mkdir -p "$JARVIS_DIR"/{agentes/{jarvis,nutra,lancamentos},escritorio/public,bin,entregas,logs}

# ─── 6. Copiar arquivos ───
info "Copiando arquivos..."

cp "$SCRIPT_DIR/escritorio/server.mjs" "$JARVIS_DIR/escritorio/"
cp "$SCRIPT_DIR/escritorio/equipe.json" "$JARVIS_DIR/escritorio/"
cp "$SCRIPT_DIR/escritorio/public/index.html" "$JARVIS_DIR/escritorio/public/"
cp "$SCRIPT_DIR/escritorio/public/voz.html" "$JARVIS_DIR/escritorio/public/"
cp "$SCRIPT_DIR/agentes/jarvis/CLAUDE.md" "$JARVIS_DIR/agentes/jarvis/"
cp "$SCRIPT_DIR/agentes/nutra/CLAUDE.md" "$JARVIS_DIR/agentes/nutra/"
cp "$SCRIPT_DIR/agentes/lancamentos/CLAUDE.md" "$JARVIS_DIR/agentes/lancamentos/"
cp "$SCRIPT_DIR/bin/google-ads.mjs" "$JARVIS_DIR/bin/"
cp "$SCRIPT_DIR/bin/google-ads-autorizar.mjs" "$JARVIS_DIR/bin/"
cp "$SCRIPT_DIR/bin/google-ads-regras.json" "$JARVIS_DIR/bin/"

# Criar os comandos executáveis
cat > "$JARVIS_DIR/bin/google-ads" << 'SCRIPT'
#!/bin/sh
exec "$HOME/.local/node/bin/node" "$HOME/jarvis/bin/google-ads.mjs" "$@"
SCRIPT
chmod +x "$JARVIS_DIR/bin/google-ads"

cat > "$JARVIS_DIR/bin/google-ads-autorizar" << 'SCRIPT'
#!/bin/sh
exec "$HOME/.local/node/bin/node" "$HOME/jarvis/bin/google-ads-autorizar.mjs" "$@"
SCRIPT
chmod +x "$JARVIS_DIR/bin/google-ads-autorizar"

ok "Arquivos copiados"

# ─── 7. Perguntar o nome ───
echo ""
read -rp "  Qual é o seu nome? " NOME
NOME="${NOME:-Aluno}"
# Salvar config
cat > "$JARVIS_DIR/config.json" << EOF
{
  "nome": "$NOME",
  "musicaBomDia": "spotify:track:08mG3Y1vljYA6bvDt4Wqkj",
  "musicaInicio": 9,
  "vozProvedor": "fish",
  "vozId": ""
}
EOF
ok "Configurado para $NOME"

# Atualizar o nome nos agentes
sed -i '' "s/{{NOME}}/$NOME/g" "$JARVIS_DIR/agentes/jarvis/CLAUDE.md" 2>/dev/null || true
sed -i '' "s/{{NOME}}/$NOME/g" "$JARVIS_DIR/agentes/nutra/CLAUDE.md" 2>/dev/null || true
sed -i '' "s/{{NOME}}/$NOME/g" "$JARVIS_DIR/agentes/lancamentos/CLAUDE.md" 2>/dev/null || true

# ─── 8. Configurar Google Ads (opcional) ───
echo ""
echo -e "  ${COR}─── Google Ads (opcional, pode fazer depois) ───${RESET}"
echo ""
info "Para criar campanhas pelo Jarvis, você precisa de um"
info "projeto no Google Cloud com a API do Google Ads ativada."
echo ""
info "Guia completo: ${COR}https://github.com/gringa-ads/jarvis/wiki/Google-Ads${RESET}"
echo ""
read -rp "  Já tem as credenciais do Google Ads? (s/n) " resp
if [[ "$resp" == "s" || "$resp" == "S" ]]; then
  read -rp "  Client ID: " GAS_CLIENT_ID
  read -rp "  Client Secret: " GAS_CLIENT_SECRET
  read -rp "  Developer Token: " GAS_DEV_TOKEN
  read -rp "  Login Customer ID (MCC, sem traços): " GAS_MCC
  cat > "$JARVIS_DIR/.google-ads.env" << EOF
GOOGLE_ADS_CLIENT_ID=$GAS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET=$GAS_CLIENT_SECRET
GOOGLE_ADS_DEVELOPER_TOKEN=$GAS_DEV_TOKEN
GOOGLE_ADS_LOGIN_CUSTOMER_ID=$GAS_MCC
EOF
  chmod 600 "$JARVIS_DIR/.google-ads.env"
  ok "Credenciais salvas"
  echo ""
  info "Agora rode este comando para autorizar:"
  echo -e "  ${COR}~/jarvis/bin/google-ads-autorizar${RESET}"
else
  # Criar arquivo vazio de exemplo
  cat > "$JARVIS_DIR/.google-ads.env" << 'EOF'
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
EOF
  chmod 600 "$JARVIS_DIR/.google-ads.env"
  info "Sem problema! Quando tiver, edite ~/jarvis/.google-ads.env"
fi

# ─── 9. Configurar o escritório para ligar sozinho ───
echo ""
info "Configurando o Escritório para ligar com o Mac..."
PLIST="$HOME/Library/LaunchAgents/com.jarvis.escritorio.plist"
NODE_EXEC="$NODE_BIN"
[ -z "$NODE_EXEC" ] && NODE_EXEC="$HOME/.local/node/bin/node"

cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.jarvis.escritorio</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_EXEC</string>
    <string>$JARVIS_DIR/escritorio/server.mjs</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$JARVIS_DIR/escritorio/servidor.log</string>
  <key>StandardErrorPath</key><string>$JARVIS_DIR/escritorio/servidor.log</string>
  <key>WorkingDirectory</key><string>$JARVIS_DIR/escritorio</string>
</dict>
</plist>
EOF

launchctl bootout gui/$(id -u) "$PLIST" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST" 2>/dev/null || true
ok "Escritório configurado em http://localhost:4848"

# Limpar arquivos temporários
[ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"

# ─── 10. Resumo final ───
echo ""
echo -e "${COR}   ╭─────────────────────────────────────╮${RESET}"
echo -e "${COR}   │         INSTALAÇÃO CONCLUÍDA!        │${RESET}"
echo -e "${COR}   ╰─────────────────────────────────────╯${RESET}"
echo ""
echo -e "  ${BOLD}Seu Jarvis está em:${RESET} ~/jarvis"
echo ""
echo -e "  ${BOLD}Como usar:${RESET}"
echo -e "  ${COR}1.${RESET} Abra ${COR}http://localhost:4848${RESET} no Chrome"
echo -e "  ${COR}2.${RESET} Abra o Claude Code na pasta de um agente:"
echo -e "     ${CINZA}cd ~/jarvis/agentes/nutra && claude${RESET}"
echo -e "     ${CINZA}cd ~/jarvis/agentes/lancamentos && claude${RESET}"
echo -e "  ${COR}3.${RESET} Para usar o Jarvis por voz, clique em"
echo -e "     ${COR}JARVIS · DESLIGADO${RESET} no topo da página"
echo ""
echo -e "  ${BOLD}Agentes:${RESET}"
echo -e "  ${COR}•${RESET} Nutra       → garimpo, copy, página e campanha"
echo -e "  ${COR}•${RESET} Lançamentos → garimpo, copy, página e campanha"
echo -e "  ${COR}•${RESET} Jarvis      → orquestra tudo, responde por voz"
echo ""
echo -e "  ${BOLD}Google Ads:${RESET}"
if [ -n "$GAS_CLIENT_ID" ]; then
  echo -e "  ${VERDE}✓${RESET} Credenciais salvas. Rode: ~/jarvis/bin/google-ads-autorizar"
else
  echo -e "  ${COR}→${RESET} Configure quando estiver pronto: edite ~/jarvis/.google-ads.env"
fi
echo ""
echo -e "  ${BOLD}Voz do Jarvis (opcional):${RESET}"
echo -e "  ${COR}→${RESET} Crie conta grátis em ${COR}fish.audio${RESET}"
echo -e "  ${COR}→${RESET} Abra ${COR}http://localhost:4848/voz.html${RESET} e cole a chave"
echo ""
