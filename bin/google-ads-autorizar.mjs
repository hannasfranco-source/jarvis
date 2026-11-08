// Autoriza o acesso ao Google Ads (uma vez) e guarda o refresh token em ~/jarvis/.google-ads.env.
// Uso: google-ads-autorizar   (abre o navegador; clique em Permitir)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

const ENV = path.join(os.homedir(), 'jarvis/.google-ads.env');
const lerEnv = () => Object.fromEntries(fs.readFileSync(ENV, 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = lerEnv();
const clientId = env.GOOGLE_ADS_CLIENT_ID, clientSecret = env.GOOGLE_ADS_CLIENT_SECRET;
if (!clientId || !clientSecret) { console.log('FALTA: GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET em ~/jarvis/.google-ads.env'); process.exit(1); }

const state = crypto.randomBytes(16).toString('hex');
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname !== '/') { res.writeHead(404).end(); return; }
  const fim = (msg, ok) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(`<h2>${msg}</h2><p>Pode fechar esta aba.</p>`); console.log(ok ? 'OK: ' + msg : 'ERRO: ' + msg); setTimeout(() => process.exit(ok ? 0 : 1), 300); };
  if (u.searchParams.get('state') !== state) return fim('Resposta inválida (state).', false);
  if (u.searchParams.get('error')) return fim('Google recusou: ' + u.searchParams.get('error'), false);
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: u.searchParams.get('code'), client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    const j = await r.json();
    if (!j.refresh_token) return fim('Não veio o refresh token: ' + (j.error_description || j.error || 'sem detalhe'), false);
    const atual = lerEnv(); atual.GOOGLE_ADS_REFRESH_TOKEN = j.refresh_token;
    fs.writeFileSync(ENV, Object.entries(atual).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(ENV, 0o600);
    fim('Autorizado! O Google Ads está conectado.', true);
  } catch (e) { fim('Falha ao trocar o código: ' + e.message, false); }
});

let redirect;
server.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${server.address().port}`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/adwords',
    access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  console.log('Abrindo o navegador para você clicar em Permitir...');
  execFile('open', [url]);
  setTimeout(() => { console.log('ERRO: tempo esgotado (5 min).'); process.exit(1); }, 300000);
});
