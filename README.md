# J.A.R.V.I.S. — Gringa Ads Academy

Sistema de agentes de IA para afiliados que usam Google Ads. Inclui:

- **Agente Nutra** — garimpo de produtos, copy, página e campanha
- **Agente Lançamentos** — garimpo de eventos, copy, página de cookie e campanha
- **Jarvis (Central)** — orquestra tudo, responde por voz
- **Escritório** — painel visual estilo Jarvis com status em tempo real

## Requisitos

- **Mac** (Apple Silicon ou Intel)
- **Claude Code** com plano Pro ou Max — [claude.ai/download](https://claude.ai/download)
- **Google Chrome** (para a voz do Jarvis)

## Instalação

1. Abra o Terminal
2. Rode:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/gringa-ads/jarvis/main/instalar.sh)"
```

Ou, se já baixou o repositório:

```bash
cd jarvis-alunos
bash instalar.sh
```

O instalador:
- Instala o Node.js 22 se não tiver
- Cria a pasta `~/jarvis/` com tudo configurado
- Pergunta seu nome
- Opcionalmente configura o Google Ads
- Liga o Escritório para iniciar com o Mac

## Como usar

### 1. Abra o Escritório
Acesse **http://localhost:4848** no Chrome.

### 2. Ative um agente
Abra o Claude Code na pasta do agente:

```bash
cd ~/jarvis/agentes/nutra && claude
```

ou

```bash
cd ~/jarvis/agentes/lancamentos && claude
```

O painel mostra o status do agente em tempo real.

### 3. Voz do Jarvis
Clique em **JARVIS · DESLIGADO** no topo da página para ativar.
Diga "Jarvis, ..." e ele responde em voz alta.

O comando "Bom dia" toca Back in Black e dá o briefing do dia.

### 4. Google Ads

#### Configurar (uma vez)
1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com)
2. Ative a API do Google Ads
3. Crie credenciais OAuth 2.0 (tipo Desktop)
4. Edite `~/jarvis/.google-ads.env` com Client ID, Client Secret, Developer Token e MCC
5. Rode:

```bash
~/jarvis/bin/google-ads-autorizar
```

#### Criar campanha
O agente monta o JSON e roda:

```bash
~/jarvis/bin/google-ads criar campanha.json --simular
~/jarvis/bin/google-ads criar campanha.json
```

Campanhas são criadas **sempre PAUSADAS** — você revisa e ativa no Google Ads.

### 5. Voz (opcional)
Para o Jarvis falar com uma voz realista:

1. Crie conta grátis em [fish.audio](https://fish.audio)
2. Abra **http://localhost:4848/voz.html**
3. Cole a chave da API e salve

Sem chave, ele usa a voz do navegador (funciona, mas é robótica).

## Estrutura

```
~/jarvis/
├── agentes/
│   ├── jarvis/CLAUDE.md       ← agente central
│   ├── nutra/CLAUDE.md        ← funil de nutra
│   └── lancamentos/CLAUDE.md  ← funil de lançamentos
├── escritorio/
│   ├── server.mjs             ← servidor do painel
│   └── public/                ← HTML do painel
├── bin/
│   ├── google-ads             ← criar campanhas
│   └── google-ads-autorizar   ← conectar Google Ads
├── entregas/                  ← onde os agentes salvam o trabalho
├── logs/                      ← logs das campanhas
└── config.json                ← seu nome e configurações
```

## Dúvidas comuns

**O painel não abre?**
Rode no Terminal: `~/jarvis/escritorio/server.mjs` e veja se dá algum erro.

**O agente não aparece no painel?**
O painel lê as sessões do Claude Code. Abra o agente com `cd ~/jarvis/agentes/nutra && claude` e ele aparece.

**Google Ads dá erro de autorização?**
Rode `~/jarvis/bin/google-ads-autorizar` de novo.

**Spotify não toca?**
O Spotify precisa estar instalado (não a versão web). Abra o Spotify pelo menos uma vez antes.
