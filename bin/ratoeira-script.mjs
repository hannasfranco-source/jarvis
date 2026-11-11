// ratoeira-script — cadastra o produto na Ratoeira Ads do aluno (Chrome invisível) e devolve o script de rastreamento
// para o <head> da página. Caminho: Hub → Acessar Ratoeira Ads → Projetos → <projeto> → NOVA → plataforma do produto →
// nome do produto → ação de conversão → CADASTRAR. Se já existe ratoeira com esse nome no projeto, não cria outra:
// devolve o script da que existe.
//   ratoeira-script login                                  abre o Chrome da Ratoeira para o aluno entrar na conta (uma vez)
//   ratoeira-script configurar <nutra|lancamentos> --projeto "Nome" --id <número do projeto> --acao "Nome da conversão"
//   ratoeira-script <nutra|lancamentos> "<Produto>" <Plataforma> [--acao "..."] [--ensaio]
// A senha NÃO é guardada: o login fica na sessão do perfil do Chrome (~/jarvis/logs/.chrome-ratoeira).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.join(os.homedir(), 'jarvis');
const CONFIG = path.join(RAIZ, 'ratoeira.json');
const PERFIL = process.env.JARVIS_RATOEIRA_PERFIL || path.join(RAIZ, 'logs', '.chrome-ratoeira');
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const simples = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function achaChrome() {
  const l = process.env.LOCALAPPDATA, pf = process.env.PROGRAMFILES, pf86 = process.env['PROGRAMFILES(X86)'];
  const candidatos = process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : process.platform === 'win32' ? [pf && `${pf}\\Google\\Chrome\\Application\\chrome.exe`, pf86 && `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, l && `${l}\\Google\\Chrome\\Application\\chrome.exe`]
    : ['/usr/bin/google-chrome', '/usr/bin/chromium'];
  return candidatos.filter(Boolean).find((c) => fs.existsSync(c));
}

const args = process.argv.slice(2), opc = {}, soltos = [];
for (let i = 0; i < args.length; i++) args[i] === '--ensaio' ? (opc.ensaio = true) : args[i].startsWith('--') ? (opc[args[i].slice(2)] = args[++i]) : soltos.push(args[i]);
const USO = 'uso: ratoeira-script <nutra|lancamentos> "<Produto>" <Plataforma> [--acao "..."]   (ex.: ratoeira-script nutra "Payarmin" BuyGoods)\n     ratoeira-script login\n     ratoeira-script configurar <nutra|lancamentos> --projeto "Nutras" --id 12345 --acao "Compra"';
const lerConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } };

if (soltos[0] === 'login') {
  const chromeLogin = achaChrome();
  if (!chromeLogin) { console.log('ERRO: não achei o Google Chrome. Instale em google.com/chrome e tente de novo.'); process.exit(1); }
  fs.mkdirSync(PERFIL, { recursive: true });
  try { fs.rmSync(path.join(PERFIL, 'DevToolsActivePort')); } catch {}
  spawn(chromeLogin, [`--user-data-dir=${PERFIL}`, '--lang=pt-BR', '--no-first-run', 'https://ratoeirahub.com/login/'], { stdio: 'ignore', detached: true }).unref();
  console.log('OK: abri o Chrome da Ratoeira. Entre na sua conta (e-mail e senha), clique em "Acessar" na Ratoeira Ads e depois FECHE essa janela do Chrome.');
  process.exit(0);
}
if (soltos[0] === 'configurar') {
  const frente = soltos[1], id = Number(opc.id);
  if (!['nutra', 'lancamentos'].includes(frente) || !opc.projeto || !Number.isInteger(id) || id <= 0) { console.error(USO); process.exit(1); }
  const cfg = lerConfig();
  cfg[frente] = { nome: String(opc.projeto).trim(), id, acao: opc.acao ? String(opc.acao).trim() : cfg[frente]?.acao || '' };
  fs.mkdirSync(RAIZ, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`OK: ${frente} → projeto "${cfg[frente].nome}" (id ${id})${cfg[frente].acao ? `, ação de conversão "${cfg[frente].acao}"` : ''}`);
  process.exit(0);
}

const [frente, produto, plataforma] = soltos;
if (!['nutra', 'lancamentos'].includes(frente) || !produto || !plataforma) { console.error(USO); process.exit(1); }
const cfgFrente = lerConfig()[frente];
if (!cfgFrente?.id) { console.log(`ERRO: falta configurar o projeto da Ratoeira para ${frente}. Rode: ratoeira-script configurar ${frente} --projeto "Nome do projeto" --id <número que aparece no endereço do projeto> --acao "Nome da conversão"`); process.exit(1); }
const PROJETO = { id: cfgFrente.id, nome: cfgFrente.nome };
const LISTA = `https://app.ratoeiraads.com.br/v2/projetos/${PROJETO.id}/ratoeiras`;
const acao = opc.acao || cfgFrente.acao;
if (!acao) { console.log(`ERRO: falta o nome da ação de conversão. Passe --acao "..." ou rode: ratoeira-script configurar ${frente} --projeto "${PROJETO.nome}" --id ${PROJETO.id} --acao "Nome da conversão"`); process.exit(1); }
if (typeof WebSocket === 'undefined') { console.log('ERRO: o Node.js é antigo demais (precisa da versão 22). Rode o instalador do Jarvis de novo.'); process.exit(1); }
const NOME = produto.trim().toUpperCase();

const CHROME = achaChrome();
if (!CHROME) { console.log('ERRO: não achei o Google Chrome. Instale em google.com/chrome e tente de novo.'); process.exit(1); }
fs.mkdirSync(PERFIL, { recursive: true });
try { fs.rmSync(path.join(PERFIL, 'DevToolsActivePort')); } catch {}
const SO_UA = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'Macintosh; Intel Mac OS X 10_15_7';
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', '--window-size=1300,900',
  `--user-agent=Mozilla/5.0 (${SO_UA}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36`,
  `--user-data-dir=${PERFIL}`, '--lang=pt-BR', 'about:blank'], { stdio: 'ignore' });
const limite = setTimeout(() => sair('tempo esgotado (3 min)'), 180_000);
function sair(erro) {
  clearTimeout(limite);
  chrome.kill();
  if (erro) console.log(`ERRO: ${erro}`);
  setTimeout(() => process.exit(erro ? 1 : 0), 500);
}

try {
  let porta;
  for (let k = 0; k < 100 && !porta; k++) {
    await espera(100);
    try { porta = fs.readFileSync(path.join(PERFIL, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {}
  }
  if (!porta) throw new Error('o Chrome não abriu (o perfil da Ratoeira está aberto em outra janela?)');
  const alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((a) => a.type === 'page');
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = () => erro(new Error('sem conexão com o Chrome')); });
  let n = 0;
  const pendentes = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); } };
  const cmd = (method, params = {}) => new Promise((ok, erro) => {
    const id = ++n;
    const t = setTimeout(() => { pendentes.delete(id); erro(new Error(`o Chrome não respondeu (${method})`)); }, 15000);
    pendentes.set(id, (m) => { clearTimeout(t); m.error ? erro(new Error(m.error.message)) : ok(m.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async (js) => (await cmd('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true })).result?.value;
  const ir = async (url, ms = 7000) => { await cmd('Page.navigate', { url }); await espera(ms); };
  // Clique de verdade (mouse) no centro do elemento achado pelo JS `achar` (expressão que devolve o elemento).
  const clicar = async (achar, ms = 2000) => {
    const r = await ev(`(() => { const e = (${achar}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (!r) return false;
    await espera(300);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 });
    await espera(ms);
    return true;
  };
  const porTexto = (texto, seletor = 'button, a') => `[...document.querySelectorAll(${JSON.stringify(seletor)})].find((e) => e.innerText.trim() === ${JSON.stringify(texto)} && e.offsetParent)`;
  const digitar = async (seletor, texto) => {
    await clicar(`document.querySelector(${JSON.stringify(seletor)})`, 400);
    await ev(`(() => { const e = document.querySelector(${JSON.stringify(seletor)}); e.focus(); e.select && e.select(); })()`);
    await cmd('Input.insertText', { text: texto });
    await espera(1200);
  };
  const fecharAvisos = () => ev(`(() => { [...document.querySelectorAll('button, a')].filter((b) => /^(Agora não|FECHAR)$/.test(b.innerText.trim())).forEach((b) => b.click()); })()`);

  // 1. Entrar: lista do projeto; se não abriu, faz login no Hub e clica em Acessar (Ratoeira Ads) na mesma aba.
  await cmd('Page.enable');
  await ir(LISTA);
  if (!(await ev('location.host === "app.ratoeiraads.com.br" && document.body.innerText.includes("Ratoeiras do Projeto")'))) {
    await ir('https://ratoeirahub.com/login/');
    if (await ev('!!document.querySelector("input[name=password]")')) throw new Error('SEM LOGIN na Ratoeira. Rode "ratoeira-script login", entre na sua conta da Ratoeira, clique em Acessar, feche a janela do Chrome e tente de novo.');
    await fecharAvisos();
    await ev('window.open = (u) => { location.href = u; return window; }');
    if (!(await clicar(porTexto('Acessar'), 9000))) throw new Error('não achei o botão "Acessar" da Ratoeira Ads (assinatura vencida?)');
    await ir(LISTA);
    if (!(await ev('document.body.innerText.includes("Ratoeiras do Projeto")'))) throw new Error(`não consegui abrir o projeto ${PROJETO.nome} (id ${PROJETO.id}) na Ratoeira Ads: confira o número do projeto`);
  }
  await fecharAvisos();

  // 2. Já existe ratoeira com esse nome? (procura em todas as páginas da lista)
  const pegarScriptDoCartao = async () => {
    await ev(`window.__copiado = []; try { navigator.clipboard.writeText = (t) => { window.__copiado.push(String(t)); return Promise.resolve(); }; } catch {}`);
    const ok = await clicar(`(() => { for (const nome of [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NOME)} && e.offsetParent)) { let p = nome; for (let i = 0; i < 8 && p && !p.innerText.includes('content_copy'); i++) p = p.parentElement; const b = p && [...p.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'content_copy'); if (b) return b.closest('button, a') || b; } return null; })()`, 2500);
    const s = ok && (await ev(`(window.__copiado || []).find((t) => t.includes('<script')) || [...document.querySelectorAll('code, pre')].map((e) => e.textContent).find((t) => t.includes('<script'))`));
    return s || null;
  };
  let existente = null;
  for (let pag = 0; pag < 15; pag++) {
    if (await ev(`[...document.querySelectorAll('*')].some((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(NOME)})`)) {
      existente = await pegarScriptDoCartao();
      // Achou o nome mas não o script: nunca cria outra (duplicaria a ratoeira).
      if (!existente) throw new Error(`a ratoeira ${NOME} já existe no projeto, mas não consegui copiar o script dela — copie na Ratoeira (botão de copiar no cartão)`);
      break;
    }
    if (!(await clicar(`(() => { const b = document.querySelector('button.mat-mdc-paginator-navigation-next, button[aria-label="Next page"], button[aria-label="Próxima página"]'); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' ? b : null; })()`, 3000))) break;
  }
  if (existente) {
    console.log(`JÁ EXISTIA: a ratoeira ${NOME} já estava no projeto ${PROJETO.nome} — não criei outra.`);
    console.log(`SCRIPT: ${existente.trim()}`);
    sair();
  } else {
    // 3. Nova ratoeira
    await ir(LISTA);
    await fecharAvisos();
    if (!(await clicar(porTexto('NOVA'), 4000))) throw new Error('não achei o botão NOVA');
    await digitar('input[formcontrolname=projeto]', PROJETO.nome);
    if (!(await clicar(`[...document.querySelectorAll('mat-option, [role=option]')].find((o) => o.innerText.trim() === ${JSON.stringify(PROJETO.nome)})`, 1200))) throw new Error(`não achei o projeto ${PROJETO.nome} na lista`);
    // O campo mostra "Escolha uma plataforma"; "Selecione uma plataforma" pode ser a mensagem de erro embaixo dele.
    await clicar(`(() => { const folhas = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.offsetParent && !e.closest('mat-error')); return folhas.find((e) => e.textContent.trim() === 'Escolha uma plataforma') || folhas.find((e) => e.textContent.trim() === 'Selecione uma plataforma'); })()`, 1200);
    if (!(await ev(`/plataforma/i.test(document.activeElement?.placeholder || '')`))) await clicar(`[...document.querySelectorAll('input')].find((i) => /plataforma/i.test(i.placeholder) && i.offsetParent)`, 1200);
    if (!(await ev(`/plataforma/i.test(document.activeElement?.placeholder || '')`))) throw new Error('não consegui abrir o campo Plataforma');
    await cmd('Input.insertText', { text: plataforma });
    await espera(1500);
    const opcoes = await ev(`[...document.querySelectorAll('.searchable-select-option-label')].filter((e) => e.offsetParent).map((e) => e.textContent.trim())`);
    const escolhida = (opcoes || []).find((o) => simples(o) === simples(plataforma));
    if (!escolhida) throw new Error(`a plataforma "${plataforma}" não existe na Ratoeira. Parecidas: ${(opcoes || []).slice(0, 8).join(', ') || 'nenhuma'}`);
    await clicar(`[...document.querySelectorAll('.searchable-select-option-label')].find((e) => e.textContent.trim() === ${JSON.stringify(escolhida)}).parentElement`, 1200);
    await digitar('input[formcontrolname=nome]', NOME);
    await digitar('input[formcontrolname=pixel]', acao);
    const valores = await ev(`({ projeto: document.querySelector('input[formcontrolname=projeto]').value, plataforma: [...document.querySelectorAll('input')].find((i) => /plataforma/i.test(i.placeholder))?.value, nome: document.querySelector('input[formcontrolname=nome]').value, visitas: document.querySelector('input[formcontrolname=quantidade_visita]').value, acao: document.querySelector('input[formcontrolname=pixel]').value })`);
    if (valores.projeto !== PROJETO.nome || valores.plataforma !== escolhida || valores.nome !== NOME || valores.acao !== acao) throw new Error(`o formulário não ficou certo, não cadastrei: ${JSON.stringify(valores)}`);
    if (opc.ensaio) { console.log(`ENSAIO: formulário certo, não cadastrei: ${JSON.stringify(valores)}`); sair(); await espera(60000); }
    await clicar(porTexto('CADASTRAR', 'button'), 7000);
    const script = await ev(`[...document.querySelectorAll('mat-dialog-container code, mat-dialog-container pre, mat-dialog-container textarea, .cdk-overlay-pane code')].map((e) => e.value || e.textContent).find((t) => t.includes('<script'))`);
    if (!script) {
      const msg = await ev(`[...document.querySelectorAll('mat-error, .mat-mdc-snack-bar-label, simple-snack-bar')].map((e) => e.innerText.trim()).filter(Boolean).join(' · ')`);
      throw new Error(`cliquei em CADASTRAR mas não apareceu o script${msg ? ` (a Ratoeira disse: ${msg})` : ''} — confira na Ratoeira antes de tentar de novo`);
    }
    console.log(`CRIADA: ratoeira ${NOME} · projeto ${PROJETO.nome} · ${escolhida} · ação "${acao}" · ${valores.visitas} visitas`);
    console.log(`SCRIPT: ${script.trim()}`);
    sair();
  }
} catch (err) {
  sair(err.message);
}
