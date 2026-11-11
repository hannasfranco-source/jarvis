#!/usr/bin/env node
// Escritório Jarvis — versão para alunos da Gringa Ads Academy.
// Node puro, sem dependências. Escuta em 127.0.0.1:4848.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const PORTA = Number(process.env.PORTA) || 4848;
const HOST = '127.0.0.1';
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(RAIZ, 'public');
const ENTREGAS_DIR = path.join(RAIZ, '..', 'entregas');
const EQUIPE_ARQ = path.join(RAIZ, 'equipe.json');
const CONFIG_ARQ = path.join(RAIZ, '..', 'config.json');
const INTERVALO_MS = 1000;
const FIM_BYTES = 256 * 1024;

let config = {};
try { config = JSON.parse(fs.readFileSync(CONFIG_ARQ, 'utf8')); } catch {}

// ---------- transcripts ----------
function pastaDoCwd(cwd) { return cwd.replace(/[^a-zA-Z0-9]/g, '-'); }

const caminhoCache = new Map();
function caminhoTranscript(sessionId, cwd) {
  const nome = `${sessionId}.jsonl`;
  const esperado = path.join(PROJECTS_DIR, pastaDoCwd(cwd || ''), nome);
  if (fs.existsSync(esperado)) return esperado;
  const salvo = caminhoCache.get(sessionId);
  if (salvo && fs.existsSync(salvo)) return salvo;
  try {
    for (const d of fs.readdirSync(PROJECTS_DIR)) {
      const p = path.join(PROJECTS_DIR, d, nome);
      if (fs.existsSync(p)) { caminhoCache.set(sessionId, p); return p; }
    }
  } catch {}
  return null;
}

function lerFim(arquivo, tamanho) {
  const n = Math.min(tamanho, FIM_BYTES);
  const buf = Buffer.alloc(n);
  const fd = fs.openSync(arquivo, 'r');
  try { fs.readSync(fd, buf, 0, n, tamanho - n); } finally { fs.closeSync(fd); }
  const linhas = buf.toString('utf8').split('\n');
  if (n < tamanho) linhas.shift();
  return linhas;
}

function encurtar(s, max = 80) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function detalheFerramenta(nome, input) {
  if (!input || typeof input !== 'object') return '';
  if (input.file_path) return path.basename(String(input.file_path));
  if (nome === 'Bash') return encurtar(input.description || input.command);
  if (input.description) return encurtar(input.description);
  for (const k of ['query', 'skill', 'prompt', 'command', 'url', 'path']) if (input[k]) return encurtar(input[k]);
  return '';
}

function analisarTranscript(linhas) {
  const r = { titulo: null, ultimoPrompt: null, ultimaAtividade: null, ferramenta: null, ultimaFerramenta: null, ultimoTexto: null, modelo: null };
  const pendentes = new Map();
  let tituloIA = null, tituloProprio = null;
  for (const linha of linhas) {
    if (!linha) continue;
    let j; try { j = JSON.parse(linha); } catch { continue; }
    if (j.type === 'custom-title' && j.customTitle) tituloProprio = j.customTitle;
    else if (j.type === 'ai-title' && j.aiTitle) tituloIA = j.aiTitle;
    else if (j.type === 'last-prompt' && j.lastPrompt) r.ultimoPrompt = encurtar(j.lastPrompt, 140);
    if (j.isSidechain) continue;
    if ((j.type === 'user' || j.type === 'assistant') && j.timestamp) {
      const t = Date.parse(j.timestamp);
      if (!Number.isNaN(t)) r.ultimaAtividade = t;
    }
    const conteudo = j.message?.content;
    if (j.type === 'assistant' && Array.isArray(conteudo)) {
      if (j.message.model) r.modelo = j.message.model;
      for (const c of conteudo) {
        if (c.type === 'tool_use') { const f = { nome: c.name, detalhe: detalheFerramenta(c.name, c.input) }; pendentes.set(c.id, f); r.ultimaFerramenta = f; }
        else if (c.type === 'text' && c.text?.trim()) r.ultimoTexto = encurtar(c.text, 200);
      }
      if (j.message.stop_reason === 'end_turn') pendentes.clear();
    } else if (j.type === 'user' && Array.isArray(conteudo)) {
      for (const c of conteudo) if (c.type === 'tool_result') pendentes.delete(c.tool_use_id);
    }
  }
  r.titulo = tituloProprio || tituloIA;
  r.ferramenta = [...pendentes.values()].pop() || null;
  return r;
}

const transcriptCache = new Map();
function dadosTranscript(arquivo) {
  if (!arquivo) return null;
  try {
    const st = fs.statSync(arquivo);
    const c = transcriptCache.get(arquivo);
    if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) return c.dados;
    const dados = analisarTranscript(lerFim(arquivo, st.size));
    transcriptCache.set(arquivo, { mtimeMs: st.mtimeMs, size: st.size, dados });
    return dados;
  } catch { return null; }
}

// ---------- sessões ----------
function processoVivo(pid) {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

function descreverEspera(raw) {
  if (!raw) return 'responder no terminal';
  const r = raw.toLowerCase();
  if (r === 'input needed') return 'responder uma pergunta';
  if (/permission|approve|allow/.test(r)) return 'aprovar uma permissão';
  return encurtar(raw, 40);
}

function lerSessoes() {
  let nomes;
  try { nomes = fs.readdirSync(SESSIONS_DIR).filter(n => /^\d+\.json$/.test(n)); } catch { return []; }
  const agentes = [];
  for (const nome of nomes) {
    let reg;
    try { reg = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, nome), 'utf8')); } catch { continue; }
    if (!reg?.sessionId || !reg.pid || !processoVivo(reg.pid)) continue;
    const t = dadosTranscript(caminhoTranscript(reg.sessionId, reg.cwd)) || {};
    let estado, espera = null;
    switch (reg.status) {
      case 'busy': case 'shell': estado = 'trabalhando'; break;
      case 'waiting': estado = 'esperando'; espera = descreverEspera(reg.waitingFor); break;
      case 'idle': estado = 'parado'; break;
      default: estado = t.ferramenta || (t.ultimaAtividade && Date.now() - t.ultimaAtividade < 90000) ? 'trabalhando' : 'parado';
    }
    let ferramenta = estado === 'trabalhando' ? t.ferramenta || null : null;
    if (reg.status === 'shell' && !ferramenta) ferramenta = { nome: 'Shell', detalhe: 'comando em segundo plano' };
    agentes.push({
      id: reg.sessionId, pid: reg.pid, projeto: path.basename(reg.cwd || '') || '~',
      cwd: reg.cwd || null, nome: reg.name || null, titulo: t.titulo || null,
      estado, espera, ferramenta, ultimaFerramenta: t.ultimaFerramenta || null,
      ultimoPrompt: t.ultimoPrompt || null, ultimoTexto: t.ultimoTexto || null,
      modelo: t.modelo || null, iniciouEm: reg.startedAt || null,
      ultimaAtividade: t.ultimaAtividade || reg.statusUpdatedAt || reg.updatedAt || null,
    });
  }
  return agentes.sort((a, b) => (a.iniciouEm || 0) - (b.iniciouEm || 0));
}

// ---------- equipe ----------
function normalizar(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

let equipeCfg = null, equipeMtime = 0;
function carregarEquipe() {
  try {
    const st = fs.statSync(EQUIPE_ARQ);
    if (equipeCfg && st.mtimeMs === equipeMtime) return;
    const cfg = JSON.parse(fs.readFileSync(EQUIPE_ARQ, 'utf8'));
    const base = cfg.pastaBase || '~/jarvis/agentes';
    equipeCfg = {
      base: path.resolve(base.replace(/^~(?=$|\/)/, os.homedir())),
      agentes: cfg.agentes.map((a, i) => ({ ...a, numero: i + 1, chaves: new Set([a.id, ...(a.pastas || [])].map(normalizar)) })),
    };
    equipeMtime = st.mtimeMs;
  } catch (err) {
    if (!equipeCfg) equipeCfg = { base: '', agentes: [] };
  }
}

function agenteDaPasta(cwd) {
  if (!cwd || !equipeCfg.base) return null;
  const rel = path.relative(equipeCfg.base, path.resolve(cwd));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const primeira = normalizar(rel.split(path.sep)[0]);
  return equipeCfg.agentes.find(a => a.chaves.has(primeira)) || null;
}

const PRIORIDADE = { esperando: 3, trabalhando: 2, parado: 1 };
function montarEquipe(sessoes) {
  return equipeCfg.agentes.map(cfg => {
    const minhas = sessoes.filter(s => agenteDaPasta(s.cwd)?.id === cfg.id)
      .sort((a, b) => PRIORIDADE[b.estado] - PRIORIDADE[a.estado] || (b.ultimaAtividade || 0) - (a.ultimaAtividade || 0));
    const s = minhas[0] || null;
    return { id: cfg.id, numero: cfg.numero, nome: cfg.nome, curto: cfg.curto || cfg.nome.toUpperCase(),
      estado: s ? s.estado : 'offline', sessao: s ? { ...s, ligada: ligada(s.id) } : null, sessoes: minhas.length };
  });
}

// ---------- mensagens (mod do Claude Code) ----------
const PRESENCA_MS = 10000;
const CONFIRMAR_MS = 30000;
const presenca = new Map();
const mensagens = [];
const ARQ_USO = path.join(RAIZ, 'uso.json');
let uso = null;
try { uso = JSON.parse(fs.readFileSync(ARQ_USO, 'utf8')); } catch {}

const ligada = sessao => Date.now() - (presenca.get(sessao) || 0) < PRESENCA_MS;

function novaMensagem({ sessao, texto }) {
  texto = String(texto || '').trim();
  if (!texto) throw new Error('mensagem vazia');
  if (texto.length > 8000) throw new Error('mensagem grande demais');
  const agente = estado.equipe.find(a => a.sessao?.id === sessao);
  if (!agente) throw new Error('essa sessão não é de nenhum agente');
  if (!ligada(sessao)) throw new Error('a sessão não está ligada ao escritório');
  const m = { id: crypto.randomUUID(), sessao, agente: agente.id, texto, estado: 'fila', criadaEm: Date.now() };
  mensagens.unshift(m);
  mensagens.length = Math.min(mensagens.length, 40);
  atualizar();
  return m;
}

function caixaDeEntrada({ session }) {
  if (!session) throw new Error('sessão ausente');
  presenca.set(session, Date.now());
  const minhas = mensagens.filter(m => m.sessao === session && m.estado === 'fila').reverse();
  for (const m of minhas) Object.assign(m, { estado: 'enviando', enviadaEm: Date.now() });
  if (minhas.length) atualizar();
  return { messages: minhas.map(m => ({ id: m.id, text: m.texto })) };
}

function confirmarEntrega({ session, results }) {
  for (const r of Array.isArray(results) ? results : []) {
    const m = mensagens.find(x => x.id === r?.id && x.sessao === session && x.estado === 'enviando');
    if (m) Object.assign(m, r.ok ? { estado: 'entregue' } : { estado: 'falhou', erro: String(r.error || 'erro').slice(0, 300) });
  }
  atualizar();
  return { ok: true };
}

function janelaUso(j) {
  const p = Number(j?.percentual);
  if (!Number.isFinite(p)) return null;
  return { percentual: Math.min(100, Math.max(0, p)), reiniciaEm: typeof j.reiniciaEm === 'string' ? j.reiniciaEm : null };
}

function guardarUso(corpo) {
  uso = { cincoHoras: janelaUso(corpo.cincoHoras), semana: janelaUso(corpo.semana), recebidoEm: Date.now() };
  fs.writeFileSync(ARQ_USO, JSON.stringify(uso) + '\n');
  atualizar();
  return { ok: true };
}

// ---------- música (Spotify via AppleScript) ----------
const MUSICA = config.musicaBomDia || 'spotify:track:08mG3Y1vljYA6bvDt4Wqkj';
const MUSICA_INICIO = config.musicaInicio || 9;
const rodar = (cmd, args) => new Promise(ok => execFile(cmd, args, { timeout: 20000 }, (err, saida) => ok(err ? null : String(saida))));
const appleScriptSpotify = linhas => new Promise((ok, falha) => {
  execFile('osascript', ['-e', `tell application "Spotify"\n${linhas.join('\n')}\nend tell`], { timeout: 20000 }, (err, saida) =>
    err ? falha(new Error('Spotify não respondeu')) : ok(String(saida).trim()));
});

async function musica({ acao, volume }) {
  const vol = Math.max(0, Math.min(100, Math.round(Number(volume) || 50)));
  if (acao === 'parar') return appleScriptSpotify(['pause']).then(() => ({ ok: true }));
  if (acao === 'volume') return appleScriptSpotify([`set sound volume to ${vol}`]).then(() => ({ ok: true }));
  if (acao !== 'tocar') throw new Error('ação inválida');
  if ((await rodar('pgrep', ['-x', 'Spotify'])) === null) {
    await rodar('open', ['-g', '-j', '-a', 'Spotify']);
    await new Promise(ok => setTimeout(ok, 3000));
  }
  const pronta = `(id of current track) is "${MUSICA}"`;
  const r = await appleScriptSpotify(['set sound volume to 0', `if ${pronta} then`, `set player position to ${MUSICA_INICIO}`, 'play',
    'delay 0.3', `set sound volume to ${vol}`, 'return "pronta"', 'end if', 'return "outra"']);
  if (r === 'pronta') return { ok: true };
  await appleScriptSpotify([`play track "${MUSICA}"`, 'delay 1', `set player position to ${MUSICA_INICIO}`, `set sound volume to ${vol}`]);
  await rodar('open', ['-a', 'Google Chrome']);
  return { ok: true };
}

// ---------- voz (Fish Audio / ElevenLabs) ----------
const VOZ_ARQ = path.join(RAIZ, 'voz.json');
const chavesVoz = {};
async function voz({ texto }) {
  texto = String(texto || '').trim().slice(0, 2000);
  if (!texto) throw new Error('texto vazio');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(VOZ_ARQ, 'utf8')); } catch {}
  const provedor = cfg.provedor === 'elevenlabs' ? 'elevenlabs' : 'fish';
  chavesVoz[provedor] ||= (await rodar('security', ['find-generic-password', '-s', `escritorio-${provedor === 'fish' ? 'fishaudio' : 'elevenlabs'}`, '-a', 'api', '-w']))?.trim() || null;
  const chave = chavesVoz[provedor];
  if (!chave || !cfg.voz) throw new Error('sem voz configurada');
  const r = provedor === 'fish'
    ? await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST', headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json', model: cfg.modelo || 's2.1-pro-free' },
      body: JSON.stringify({ text: texto, reference_id: cfg.voz, format: 'mp3', mp3_bitrate: 128, latency: 'balanced' }),
    })
    : await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voz)}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': chave, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: texto, model_id: cfg.modelo || 'eleven_multilingual_v2' }),
    });
  if (!r.ok) { if (r.status === 401) chavesVoz[provedor] = null; throw new Error(`${provedor} respondeu ${r.status}`); }
  return { audio: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

async function guardarChaveVoz({ chave }) {
  chave = String(chave || '').trim();
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(chave)) throw new Error('chave inválida');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(VOZ_ARQ, 'utf8')); } catch {}
  const servico = `escritorio-${cfg.provedor === 'elevenlabs' ? 'elevenlabs' : 'fishaudio'}`;
  await rodar('security', ['add-generic-password', '-U', '-s', servico, '-a', 'api', '-w', chave]);
  delete chavesVoz.fish; delete chavesVoz.elevenlabs;
  const nome = config.nome || 'amigo';
  return voz({ texto: `Pronto, ${nome}. A partir de agora eu falo com esta voz.` });
}

async function configurarVoz({ provedor, chave, vozId }) {
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(VOZ_ARQ, 'utf8')); } catch {}
  if (provedor !== undefined) cfg.provedor = provedor || 'fish';
  if (vozId !== undefined) cfg.voz = vozId || '';
  fs.writeFileSync(VOZ_ARQ, JSON.stringify(cfg, null, 2) + '\n');
  if (chave) {
    const servico = `escritorio-${cfg.provedor === 'elevenlabs' ? 'elevenlabs' : 'fishaudio'}`;
    await rodar('security', ['add-generic-password', '-U', '-s', servico, '-a', 'api', '-w', chave.trim()]);
    delete chavesVoz.fish; delete chavesVoz.elevenlabs;
  }
  return { ok: true };
}

// ---------- estado + SSE ----------
let estado = { equipe: [], config: { nome: config.nome || 'Aluno' }, atualizadoEm: Date.now() };
let estadoJson = '';
const clientes = new Set();

function atualizar() {
  carregarEquipe();
  const equipe = montarEquipe(lerSessoes());
  const json = JSON.stringify([equipe, mensagens, uso]);
  if (json === estadoJson) return;
  estadoJson = json;
  estado = { equipe, mensagens, uso, config: { nome: config.nome || 'Aluno' }, atualizadoEm: Date.now() };
  const msg = `event: estado\ndata: ${JSON.stringify(estado)}\n\n`;
  for (const res of clientes) res.write(msg);
}

setInterval(atualizar, INTERVALO_MS);
atualizar();
setInterval(() => { for (const res of clientes) res.write(': ping\n\n'); }, 20000);
setInterval(() => {
  for (const m of mensagens) {
    if (m.estado === 'enviando' && Date.now() - m.enviadaEm > CONFIRMAR_MS) Object.assign(m, { estado: 'falhou', erro: 'sessão não confirmou' });
    if (m.estado === 'fila' && Date.now() - m.criadaEm > 60000) Object.assign(m, { estado: 'falhou', erro: 'sessão fechou' });
  }
}, 5000);

// ---------- HTTP ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

function json(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function servirEstatico(req, res, url) {
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const arq = path.resolve(PUBLIC_DIR, rel);
  if (!arq.startsWith(PUBLIC_DIR + path.sep)) return json(res, 403, { erro: 'proibido' });
  fs.readFile(arq, (err, dados) => {
    if (err) return json(res, 404, { erro: 'não encontrado' });
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(dados);
  });
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 64 * 1024) reject(new Error('corpo grande demais')); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { reject(new Error('JSON inválido')); } });
  });
}

function postPermitido(req) {
  const origem = req.headers.origin;
  return String(req.headers['content-type'] || '').startsWith('application/json') &&
    (!origem || origem === `http://localhost:${PORTA}` || origem === `http://127.0.0.1:${PORTA}`);
}

// ---------- páginas de ofertas (aprovação) ----------
// Os agentes entregam ~/jarvis/entregas/ofertas-<nutra|lancamentos>-<data>/ (ofertas.json + index.html gerado pelo comando
// `ofertas`). Os botões Aprovar / Não quero (public/aprovar-ofertas.js) gravam decisoes.json na mesma pasta; o agente lê
// esse arquivo no começo da conversa e segue (link de afiliação na Nutra, e-mail de afiliação em Lançamentos).
const PASTA_OFERTAS = /^ofertas-(nutra|lancamentos)[\w.-]*$/;
const lerLista = (arq) => { try { const j = JSON.parse(fs.readFileSync(arq, 'utf8')); return Array.isArray(j) ? j : j.ofertas || []; } catch { return []; } };
const gravarJson = (arq, obj) => { fs.writeFileSync(arq + '.tmp', JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(arq + '.tmp', arq); };

function decidirOferta({ pasta, id, decisao, nota = '' }) {
  if (typeof pasta !== 'string' || !PASTA_OFERTAS.test(pasta)) throw new Error('pasta inválida');
  if (!['aprovar', 'recusar'].includes(decisao)) throw new Error('decisão inválida');
  const dir = path.join(ENTREGAS_DIR, pasta);
  if (!lerLista(path.join(dir, 'ofertas.json')).some((x) => x.id === id)) throw new Error('oferta não encontrada');
  const arqDec = path.join(dir, 'decisoes.json');
  let decisoes = {};
  try { decisoes = JSON.parse(fs.readFileSync(arqDec, 'utf8')); } catch {}
  if (decisoes[id]?.decisao === 'aprovar') throw new Error('já aprovada');
  const registro = { decisao, nota: String(nota || '').trim().slice(0, 1000), quando: new Date().toISOString() };
  if (decisao === 'aprovar') {
    registro.msg = pasta.startsWith('ofertas-nutra')
      ? 'Agora abra o agente Nutra (botão Code, pasta jarvis → agentes → nutra). Ele vai pedir o seu link de afiliação e seguir com o funil.'
      : 'Agora abra o agente de Lançamentos (botão Code, pasta jarvis → agentes → lancamentos). Ele envia o e-mail de afiliação e acompanha a resposta.';
  }
  decisoes[id] = registro;
  gravarJson(arqDec, decisoes);
  return { ok: true, ...registro };
}

// "Achei um lançamento por conta": adicionar já é aprovar.
function adicionarOferta(d) {
  const campo = (k, n = 400) => String(d?.[k] || '').trim().slice(0, n);
  const produtor = campo('produtor', 120), evento = campo('evento', 160), pagina = campo('pagina', 500);
  if (!produtor || !evento) throw new Error('preencha o produtor e o nome do evento');
  if (pagina && !/^https?:\/\/\S+$/i.test(pagina)) throw new Error('o link da página de captação precisa começar com http:// ou https://');
  const pasta = 'ofertas-lancamentos-minhas', dir = path.join(ENTREGAS_DIR, pasta), arq = path.join(dir, 'ofertas.json');
  fs.mkdirSync(dir, { recursive: true });
  const lista = lerLista(arq);
  const base = `${new Date().toLocaleDateString('sv-SE')}-${`${evento} ${produtor}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`;
  let id = base;
  for (let n = 2; lista.some((x) => x.id === id); n++) id = `${base}-${n}`;
  lista.push({ id, produtor, evento, pagina, datas: campo('datas', 200), pais: campo('pais', 80), preco: campo('preco', 120), comissao: campo('comissao', 200),
    contato: campo('contato', 200), resumo: campo('nota', 1000) || 'Lançamento pesquisado pelo aluno.', origem: 'pesquisa do aluno', adicionadaEm: new Date().toISOString() });
  gravarJson(arq, lista);
  return decidirOferta({ pasta, id, decisao: 'aprovar', nota: campo('nota', 1000) });
}

function servirEntregas(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname.slice('/entregas'.length)).replace(/^\/+/, ''); } catch { return json(res, 400, { erro: 'endereço inválido' }); }
  if (!rel) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: '/entregas/' }); return res.end(); }
    let pastas = [];
    try { pastas = fs.readdirSync(ENTREGAS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => ({ nome: d.name, t: fs.statSync(path.join(ENTREGAS_DIR, d.name)).mtimeMs })).sort((a, b) => b.t - a.t); } catch {}
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    res.writeHead(200, { 'content-type': TIPOS['.html'], 'cache-control': 'no-store' });
    return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Entregas do Jarvis</title><body style="font:16px/1.6 -apple-system,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px"><h1>Entregas do Jarvis</h1>${pastas.length ? '<ul>' + pastas.map((p) => `<li><a href="/entregas/${encodeURIComponent(p.nome)}/">${esc(p.nome)}</a></li>`).join('') + '</ul>' : '<p>Ainda não há entregas.</p>'}`);
  }
  let arq = path.resolve(ENTREGAS_DIR, rel);
  if (!arq.startsWith(ENTREGAS_DIR + path.sep)) return json(res, 403, { erro: 'proibido' });
  try {
    if (fs.statSync(arq).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' }); return res.end(); }
      arq = path.join(arq, 'index.html');
    }
  } catch { return json(res, 404, { erro: 'não encontrado' }); }
  fs.readFile(arq, (err, dados) => {
    if (err) return json(res, 404, { erro: 'não encontrado' });
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(dados);
  });
}

const ROTAS = {
  '/api/enviar': novaMensagem, '/api/mod/inbox': caixaDeEntrada, '/api/mod/inbox/ack': confirmarEntrega,
  '/api/mod/uso': guardarUso, '/api/ofertas/decidir': decidirOferta, '/api/ofertas/adicionar': adicionarOferta, '/api/musica': musica, '/api/voz': voz, '/api/voz/chave': guardarChaveVoz, '/api/voz/config': configurarVoz,
};

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  if (req.method === 'GET' && url.pathname === '/api/estado') return json(res, 200, estado);
  if (req.method === 'GET' && url.pathname === '/api/eventos') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`event: estado\ndata: ${JSON.stringify(estado)}\n\n`);
    clientes.add(res);
    req.on('close', () => clientes.delete(res));
    return;
  }
  if (req.method === 'POST' && ROTAS[url.pathname]) {
    if (!postPermitido(req)) return json(res, 403, { erro: 'proibido' });
    lerCorpo(req).then(async c => json(res, 200, await ROTAS[url.pathname](c))).catch(err => json(res, 400, { erro: err.message }));
    return;
  }
  if (req.method === 'GET' && (url.pathname === '/entregas' || url.pathname.startsWith('/entregas/'))) return servirEntregas(req, res, url);
  if (req.method === 'GET') return servirEstatico(req, res, url);
  json(res, 404, { erro: 'não encontrado' });
});

servidor.listen(PORTA, HOST, () => console.log(`Jarvis em http://localhost:${PORTA}`));
