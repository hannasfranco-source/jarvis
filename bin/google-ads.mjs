#!/usr/bin/env node
// Ferramenta de Google Ads — Jarvis Gringa Ads (API oficial). Modelo = campanha "HONEYFIL [250] CP [02-11] COOKIE - EUA" (ALE05).
// Uso:
//   google-ads contas                        contas permitidas hoje (ativas, não ocultas, não administradoras, em BRL, diretas da MCC 1)
//   google-ads criar <spec.json> --simular   valida tudo no Google SEM criar nada
//   google-ads criar <spec.json>             cria a campanha PAUSADA + recursos (sitelinks, destaques, snippet, promoção)
// Regras fixas (nunca mudam por spec): campanha nasce pausada; nunca exclui; nunca aplica recomendações do Google;
// IA Max e automação de recursos sempre desligados; só Rede de Pesquisa do Google; orçamento nunca acima do teto.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const V = 'v24';
const HOME = os.homedir();
const REGRAS = JSON.parse(fs.readFileSync(path.join(HOME, 'jarvis/bin/google-ads-regras.json'), 'utf8'));
const env = Object.fromEntries(fs.readFileSync(path.join(HOME, 'jarvis/.google-ads.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const MCC = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
const LOG = path.join(HOME, 'jarvis/logs/google-ads.log');
const GEO = { US: ['2840', 'EUA'], CA: ['2124', 'CA'], GB: ['2826', 'UK'], AU: ['2036', 'AU'], // tier 1 (Nutra usa só estes)
  BR: ['2076', 'BR'], PT: ['2620', 'PT'], ES: ['2724', 'ES'], MX: ['2484', 'MX'], AR: ['2032', 'AR'], CO: ['2170', 'CO'], CL: ['2152', 'CL'], // lançamentos de outros lugares
  DE: ['2276', 'DE'], FR: ['2250', 'FR'], IT: ['2380', 'IT'], IE: ['2372', 'IE'], NZ: ['2554', 'NZ'], ZA: ['2710', 'ZA'] };
const TIER1 = ['US', 'CA', 'GB', 'AU'];
const LANG = { en: '1000', de: '1001', fr: '1002', es: '1003', it: '1004', pt: '1014' }; // idioma do evento (lançamentos)
const BRASIL = '2076';
const NEGATIVAS_PADRAO = ['review', 'reviews', 'work', 'scam', 'what is', 'legit'];
const len = (s) => [...String(s)].length;
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const log = (o) => { try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, JSON.stringify({ quando: new Date().toISOString(), ...o }) + '\n'); } catch {} };
const die = (m) => { console.log('ERRO: ' + m); process.exit(1); };

let TOKEN;
async function token() {
  if (TOKEN) return TOKEN;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!j.access_token) die('autorização do Google falhou (' + (j.error_description || j.error) + '). Rode: ~/jarvis/bin/google-ads-autorizar');
  return (TOKEN = j.access_token);
}
const headers = async () => ({ authorization: `Bearer ${await token()}`, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN, 'login-customer-id': MCC, 'content-type': 'application/json' });
const erroTxt = (j) => { const e = j?.error; if (!e) return JSON.stringify(j).slice(0, 400); const d = (e.details || []).flatMap(x => x.errors || []).map(x => `${x.message}${x.location ? ' @ ' + x.location.fieldPathElements.map(p => p.fieldName + (p.index !== undefined ? `[${p.index}]` : '')).join('.') : ''}`); return (d.length ? d.join(' | ') : e.message).slice(0, 900); };
async function api(cid, rota, corpo) {
  const r = await fetch(`https://googleads.googleapis.com/${V}/customers/${cid}/${rota}`, { method: 'POST', headers: await headers(), body: JSON.stringify(corpo) });
  const j = await r.json();
  if (!r.ok) { const err = new Error(erroTxt(j)); err.api = true; throw err; }
  return j;
}
const busca = async (cid, query) => (await api(cid, 'googleAds:search', { query })).results || [];

async function contasPermitidas() {
  const rs = await busca(MCC, "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code FROM customer_client WHERE customer_client.level = 1 AND customer_client.manager = FALSE AND customer_client.hidden = FALSE AND customer_client.status = 'ENABLED'");
  return rs.map(x => x.customerClient).filter(c => c.currencyCode === 'BRL').map(c => ({ id: c.id, nome: c.descriptiveName })).sort((a, b) => a.nome.localeCompare(b.nome));
}

// Vagas por conta: conta só as campanhas ATIVAS (ENABLED) no momento (regra da Hanna, 05/11/2026).
const MAX_CAMP = REGRAS.max_campanhas_por_conta ?? 4;
async function vagas(contas) {
  const out = [];
  for (const c of contas) {
    const ativas = (await busca(c.id, "SELECT campaign.id FROM campaign WHERE campaign.status = 'ENABLED'")).length;
    out.push({ ...c, ativas, pendentes: 0, total: ativas });
  }
  return out;
}

const LR = REGRAS.lancamentos ?? {}; // padrão de lançamentos (campanha modelo Alicia Lyttle / AI Business Summit, RA1)
function validar(spec) { return String(spec.frente || 'nutra').toLowerCase() === 'lancamentos' ? validarLanc(spec) : validarNutra(spec); }
function validarLanc(spec) {
  const e = [];
  ['expert', 'paises', 'url_final', 'titulos', 'descricoes', 'sitelinks', 'callouts', 'palavras_chave'].forEach(k => { if (spec[k] === undefined || spec[k] === '' || spec[k] === null) e.push(`falta "${k}"`); });
  if (e.length) return e;
  if (!/^https:\/\//.test(spec.url_final)) e.push('url_final precisa começar com https://');
  if (/#LINK-DE-AFILIADO/i.test(spec.url_final)) e.push('url_final ainda tem #LINK-DE-AFILIADO');
  if (!Array.isArray(spec.paises) || !spec.paises.length || spec.paises.some(p => !GEO[p])) e.push('paises: use só ' + Object.keys(GEO).join(', '));
  if (spec.idioma && !LANG[spec.idioma]) e.push('idioma: use só ' + Object.keys(LANG).join(', '));
  if (spec.titulos.length < 3 || spec.titulos.length > 15) e.push(`titulos: ${spec.titulos.length} (3 a 15; o padrão é 15)`);
  spec.titulos.forEach((t, i) => { if (len(t) > 30) e.push(`título ${i + 1} tem ${len(t)} caracteres (máx 30): ${t}`); });
  if (!(spec.titulos_fixados_n >= 0 && spec.titulos_fixados_n <= spec.titulos.length)) e.push('titulos_fixados_n inválido');
  if (spec.descricoes.length < 2 || spec.descricoes.length > 4) e.push(`descricoes: ${spec.descricoes.length} (2 a 4)`);
  spec.descricoes.forEach((t, i) => { if (len(t) > 90) e.push(`descrição ${i + 1} tem ${len(t)} caracteres (máx 90)`); });
  if (spec.sitelinks.length < 2 || spec.sitelinks.length > 8) e.push(`sitelinks: ${spec.sitelinks.length} (2 a 8)`);
  spec.sitelinks.forEach((s, i) => { if (len(s.texto) > 25) e.push(`sitelink ${i + 1} texto >25`); if (len(s.desc1) > 35 || len(s.desc2) > 35) e.push(`sitelink ${i + 1} descrição >35`); });
  if (spec.callouts.length < 2 || spec.callouts.length > 10) e.push(`callouts: ${spec.callouts.length} (2 a 10)`);
  spec.callouts.forEach((c, i) => { if (len(c) > 25) e.push(`destaque ${i + 1} tem ${len(c)} caracteres (máx 25)`); });
  if (!Array.isArray(spec.palavras_chave) || !spec.palavras_chave.length) e.push('palavras_chave: lista vazia');
  const orc = Number(spec.orcamento_diario_brl ?? LR.orcamento_diario_padrao_brl);
  if (!(orc > 0)) e.push('orçamento inválido');
  if (orc > (LR.orcamento_diario_teto_brl ?? 0)) e.push(`orçamento R$ ${orc} passa do teto de lançamentos (R$ ${LR.orcamento_diario_teto_brl})`);
  return e;
}
function validarNutra(spec) {
  const e = [];
  if (Array.isArray(spec.paises) && spec.paises.some(p => !TIER1.includes(p))) e.push('Nutra: paises só do tier 1 (' + TIER1.join(', ') + ')');
  const need = (k) => { if (spec[k] === undefined || spec[k] === '' || spec[k] === null) e.push(`falta "${k}"`); };
  ['produto', 'comissao', 'plataforma', 'paises', 'url_final', 'titulos', 'descricoes', 'sitelinks', 'callouts', 'snippet', 'promocao'].forEach(need);
  if (e.length) return e;
  if (!/^https:\/\//.test(spec.url_final)) e.push('url_final precisa começar com https://');
  if (/#LINK-DE-AFILIADO/i.test(spec.url_final)) e.push('url_final ainda tem #LINK-DE-AFILIADO');
  if (!Array.isArray(spec.paises) || !spec.paises.length || spec.paises.some(p => !GEO[p])) e.push('paises: use só ' + Object.keys(GEO).join(', '));
  if (spec.titulos.length < 3 || spec.titulos.length > 15) e.push(`titulos: ${spec.titulos.length} (precisa de 3 a 15; o padrão é 15)`);
  spec.titulos.forEach((t, i) => { if (len(t) > 30) e.push(`título ${i + 1} tem ${len(t)} caracteres (máx 30): ${t}`); });
  if (spec.descricoes.length < 2 || spec.descricoes.length > 4) e.push(`descricoes: ${spec.descricoes.length} (precisa de 2 a 4; o padrão é 4)`);
  spec.descricoes.forEach((t, i) => { if (len(t) > 90) e.push(`descrição ${i + 1} tem ${len(t)} caracteres (máx 90)`); });
  if (spec.sitelinks.length !== 4) e.push(`sitelinks: ${spec.sitelinks.length} (a regra é 4)`);
  spec.sitelinks.forEach((s, i) => { if (len(s.texto) > 25) e.push(`sitelink ${i + 1} texto >25`); if (len(s.desc1) > 35 || len(s.desc2) > 35) e.push(`sitelink ${i + 1} descrição >35`); });
  if (spec.callouts.length < 2) e.push('callouts: mínimo 2');
  spec.callouts.forEach((c, i) => { if (len(c) > 25) e.push(`destaque ${i + 1} tem ${len(c)} caracteres (máx 25)`); });
  if (!spec.snippet.header || !Array.isArray(spec.snippet.valores) || spec.snippet.valores.length < 3) e.push('snippet: precisa de header e 3+ valores');
  else spec.snippet.valores.forEach((v, i) => { if (len(v) > 25) e.push(`snippet valor ${i + 1} >25`); });
  if (!(Number(spec.promocao.valor_usd) > 0) || !spec.promocao.alvo) e.push('promocao: precisa de alvo e valor_usd');
  const orc = Number(spec.orcamento_diario_brl ?? REGRAS.orcamento_diario_padrao_brl);
  if (!(orc > 0)) e.push('orçamento inválido');
  if (orc > REGRAS.orcamento_diario_teto_brl) e.push(`orçamento R$ ${orc} passa do teto de R$ ${REGRAS.orcamento_diario_teto_brl}`);
  const cpa = Number(spec.cpa_alvo_brl ?? REGRAS.cpa_alvo_padrao_brl);
  if (!(cpa > 0)) e.push('CPA alvo inválido');
  return e;
}

// Lê o anuncios.md da Copy: formato numerado (Nutra) ou listas simples (Lançamentos: 7 títulos para fixar + 8 complementares).
function lerCopia(arq) {
  const a = lerCopiaNumerada(arq);
  if (a.titulos.length >= 3 && a.sitelinks.length) return a;
  return lerCopiaSimples(arq);
}
function lerCopiaSimples(arq) {
  const p = String(arq).replace(/^~/, HOME);
  let txt; try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { die('não consegui ler a copy ' + p + ': ' + e.message); }
  const blocos = []; let cur = null;
  for (const linha of txt.split('\n')) { const h = linha.match(/^##\s+(.*)$/); if (h) { cur = { cab: h[1], linhas: [] }; blocos.push(cur); continue; } if (cur) cur.linhas.push(linha); }
  const limpa = (l) => l.replace(/^\s*(?:\d+\.|[-*•])\s+/, '').replace(/\s\(\d+\)\s*$/, '').replace(/^\*\*|\*\*$/g, '').trim();
  const itens = (b) => b.linhas.map(limpa).filter(l => l && !/^[>#]/.test(l));
  const fix = [], comp = [], out = { descricoes: [], callouts: [], sitelinks: [] };
  for (const b of blocos) {
    const t = norm(b.cab);
    if (/titulo/.test(t)) (/fixar|principa/.test(t) ? fix : comp).push(...itens(b));
    else if (/sitelink/.test(t)) { let g = []; const fecha = () => { if (g.length) out.sitelinks.push({ texto: g[0], desc1: g[1] ?? '', desc2: g[2] ?? '' }); g = []; }; for (const l of b.linhas) { const x = limpa(l); if (!x) fecha(); else g.push(x); } fecha(); }
    else if (/descri/.test(t)) out.descricoes.push(...itens(b));
    else if (/destaque|callout/.test(t)) out.callouts.push(...itens(b));
  }
  return { titulos: [...fix, ...comp], titulos_fixados_n: fix.length, ...out };
}
function lerCopiaNumerada(arq) {
  const p = String(arq).replace(/^~/, HOME);
  let txt; try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { die('não consegui ler a copy ' + p + ': ' + e.message); }
  const secoes = {}; let atual = null;
  for (const linha of txt.split('\n')) {
    const h = linha.match(/^##\s+\d+\.\s+(.*)$/);
    if (h) { const t = norm(h[1]); atual = /titulo/.test(t) ? 'titulos' : /descri/.test(t) ? 'descricoes' : /sitelink/.test(t) ? 'sitelinks' : /destaque/.test(t) ? 'callouts' : /snippet/.test(t) ? 'snippet' : /promo/.test(t) ? 'promocao' : null; if (atual) secoes[atual] = { cab: h[1], linhas: [] }; continue; }
    if (/^##\s/.test(linha)) { atual = null; continue; }
    if (atual) secoes[atual].linhas.push(linha);
  }
  const limpa = (s) => s.replace(/\s\(\d+\)\s*$/, '').replace(/^\*\*|\*\*$/g, '').trim();
  const numeradas = (sec) => (sec?.linhas || []).map(l => l.match(/^\d+\.\s+(.*)$/)).filter(Boolean).map(m => limpa(m[1]));
  const spec = { titulos: numeradas(secoes.titulos), descricoes: numeradas(secoes.descricoes), callouts: numeradas(secoes.callouts), sitelinks: [] };
  let cur = null;
  for (const l of secoes.sitelinks?.linhas || []) {
    const n = l.match(/^\d+\.\s+(.*)$/); const d = l.match(/^\s+-\s+(.*)$/);
    if (n) { cur = { texto: limpa(n[1]), desc: [] }; spec.sitelinks.push(cur); } else if (d && cur) cur.desc.push(limpa(d[1]));
  }
  spec.sitelinks = spec.sitelinks.map(s => ({ texto: s.texto, desc1: s.desc[0] ?? '', desc2: s.desc[1] ?? '' }));
  const sn = secoes.snippet; if (sn) { const header = (sn.cab.match(/["“]([^"”]+)["”]/) || [])[1]; const vals = (sn.linhas.find(l => l.includes('·')) || '').split('·').map(s => s.trim()).filter(Boolean); if (header && vals.length) spec.snippet = { header, valores: vals }; }
  const pr = secoes.promocao; if (pr) { const j = pr.linhas.join('\n'); const v = j.match(/Valor:\s*\$?\s*([\d.,]+)/); const it = j.match(/Item:\s*(.+)/); if (v && it) { const nomeP = it[1].trim().replace(/™$/, ''); spec.promocao = { alvo: nomeP + '™', valor_usd: Number(v[1].replace(/,/g, '')) }; } }
  return spec;
}

function nomeCampanha(spec) {
  const d = new Date(); const dd = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const todos = TIER1.every(p => spec.paises.includes(p));
  const paises = todos ? 'TIER1' : spec.paises.map(p => GEO[p][1]).join(' ');
  if (String(spec.frente || 'nutra').toLowerCase() === 'lancamentos') return `${spec.expert.toUpperCase()} [${dd}] PESQUISA`; // modelo: "ALICIA LYTTLE [10-09] PESQUISA" (data = dia em que a campanha é criada)
  return `${spec.produto.toUpperCase()} [${spec.comissao}] ${spec.plataforma.toUpperCase()} [${dd}] COOKIE - ${paises}`;
}

async function criar(arq, simular) {
  let spec; try { spec = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { die('não consegui ler ' + arq + ': ' + e.message); }
  if (spec.anuncios) spec = { ...lerCopia(spec.anuncios), ...spec }; // o que estiver escrito no spec manda sobre a copy lida
  spec.meta_conversao ??= REGRAS.meta_conversao_padrao; // padrão da Hanna: sempre "Ereção" (só Nutra)
  const lanc = String(spec.frente || 'nutra').toLowerCase() === 'lancamentos';
  if (lanc) { spec.paises ??= ['US']; spec.titulos_fixados_n ??= LR.titulos_fixados_na_posicao_1 ?? 7; }
  const erros = validar(spec); if (erros.length) die('o pacote tem problemas:\n - ' + erros.join('\n - '));
  const permitidas = await contasPermitidas();
  const frente = String(spec.frente || 'nutra').toLowerCase(); // "nutra" (padrão) ou "lancamentos"
  const reservadas = (REGRAS.contas_reservadas_lancamentos ?? []).map(norm); // contas só de lançamento: nutra nunca usa
  const cont = (await vagas(permitidas)).filter(c => frente === 'lancamentos' ? (!reservadas.length || reservadas.includes(norm(c.nome))) : !reservadas.includes(norm(c.nome))); // lançamento só nas contas reservadas (RA1)
  const resumo = cont.map(c => `${c.nome} ${c.total}/${MAX_CAMP}`).join(' · ');
  let alvo;
  if (!spec.conta || String(spec.conta).toLowerCase() === 'auto') {
    const livres = cont.filter(c => c.total < MAX_CAMP).sort((a, b) => a.total - b.total || a.nome.localeCompare(b.nome));
    if (!livres.length) die(`nenhuma conta tem vaga (máx ${MAX_CAMP} campanhas por conta): ${resumo}. Abra um cartão "Decisão" para a Hanna.`);
    alvo = [livres[0]]; console.log(`Conta escolhida automaticamente: ${livres[0].nome} (menos campanhas). Vagas: ${resumo}`);
  } else {
    const dig = String(spec.conta).replace(/\D/g, '');
    alvo = dig.length === 10 ? cont.filter(c => c.id === dig) : cont.filter(c => norm(c.nome) === norm(spec.conta));
    if (alvo.length === 0) die(`a conta "${spec.conta}" NÃO está na lista permitida. Permitidas hoje: ${permitidas.map(c => c.nome).join(', ')}`);
    if (alvo.length > 1) die(`mais de uma conta se chama "${spec.conta}": use o número (${alvo.map(c => c.id).join(', ')})`);
    if (alvo[0].total >= MAX_CAMP) die(`a conta ${alvo[0].nome} já tem ${alvo[0].total} campanhas (máx ${MAX_CAMP}). Use conta "auto". Vagas: ${resumo}`);
  }
  const cid = alvo[0].id;
  const nome = nomeCampanha(spec);
  const existe = await busca(cid, `SELECT campaign.id FROM campaign WHERE campaign.name = '${nome.replace(/'/g, "\\'")}' AND campaign.status != 'REMOVED'`);
  if (existe.length) die(`já existe uma campanha chamada "${nome}" nessa conta. Não criei outra.`);
  const metas = lanc ? [] : (await busca(cid, 'SELECT custom_conversion_goal.name, custom_conversion_goal.resource_name FROM custom_conversion_goal')).map(x => x.customConversionGoal).filter(g => norm(g.name) === norm(spec.meta_conversao));
  if (!lanc && metas.length !== 1) die(`meta de conversão "${spec.meta_conversao}": achei ${metas.length} na conta ${alvo[0].nome} (precisa ser exatamente 1)`);

  const orcMicros = String(Math.round(Number(spec.orcamento_diario_brl ?? (lanc ? LR.orcamento_diario_padrao_brl : REGRAS.orcamento_diario_padrao_brl)) * 1e6));
  const cpaMicros = String(Math.round(Number(spec.cpa_alvo_brl ?? REGRAS.cpa_alvo_padrao_brl) * 1e6));
  const rn = (t, id) => `customers/${cid}/${t}/${id}`;
  const B = rn('campaignBudgets', -1), C = rn('campaigns', -2), G = rn('adGroups', -3);
  const prod = spec.produto_anuncio || spec.produto;
  const ops = [
    { campaignBudgetOperation: { create: { resourceName: B, name: `${nome} | ${Date.now()}`, amountMicros: orcMicros, deliveryMethod: 'STANDARD', explicitlyShared: false } } },
    { campaignOperation: { create: {
      resourceName: C, name: nome, status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: B,
      networkSettings: lanc ? { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false } : { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
      ...(lanc ? { targetSpend: { cpcBidCeilingMicros: String(Math.round(Number(spec.cpc_maximo_brl ?? LR.cpc_maximo_brl ?? 12) * 1e6)) } } : { maximizeConversions: { targetCpaMicros: cpaMicros } }),
      geoTargetTypeSetting: { positiveGeoTargetType: lanc ? 'PRESENCE_OR_INTEREST' : 'PRESENCE', negativeGeoTargetType: 'PRESENCE' },
      aiMaxSetting: { enableAiMax: false },
      assetAutomationSettings: [{ assetAutomationType: 'TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_OUT' }, { assetAutomationType: 'FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_OUT' }],
      containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    } } },
  ];
  for (const p of spec.paises) ops.push({ campaignCriterionOperation: { create: { campaign: C, negative: false, location: { geoTargetConstant: `geoTargetConstants/${GEO[p][0]}` } } } });
  // Exclusões do modelo (Brasil e Atlanta), só quando não conflitam com o país do evento: lançamento do Brasil não exclui o Brasil; Atlanta só se for EUA.
  const excluidos = (lanc ? (LR.locais_excluidos ?? [BRASIL]) : [BRASIL]).filter(g => !(g === BRASIL && spec.paises.includes('BR')) && !(g === '1015254' && !spec.paises.includes('US')));
  for (const g of excluidos) ops.push({ campaignCriterionOperation: { create: { campaign: C, negative: true, location: { geoTargetConstant: `geoTargetConstants/${g}` } } } });
  if (lanc) ops.push({ campaignCriterionOperation: { create: { campaign: C, language: { languageConstant: `languageConstants/${spec.idioma_id ?? LANG[spec.idioma ?? 'en'] ?? LR.idioma ?? '1000'}` } } } });
  for (const k of [...new Set(spec.negativas ?? (lanc ? [] : NEGATIVAS_PADRAO))]) ops.push({ campaignCriterionOperation: { create: { campaign: C, negative: true, keyword: { text: k, matchType: 'BROAD' } } } });
  ops.push({ adGroupOperation: { create: { resourceName: G, name: 'Grupo de anúncios 1', campaign: C, status: 'ENABLED', type: 'SEARCH_STANDARD' } } });
  for (const k of (lanc ? [...new Set(spec.palavras_chave)] : [spec.produto.toUpperCase(), spec.produto.toLowerCase()])) ops.push({ adGroupCriterionOperation: { create: { adGroup: G, status: 'ENABLED', keyword: { text: k, matchType: 'PHRASE' } } } });
  ops.push({ adGroupAdOperation: { create: { adGroup: G, status: 'ENABLED', ad: { finalUrls: [spec.url_final], responsiveSearchAd: { headlines: spec.titulos.map((text, i) => ({ text, ...(lanc && i < spec.titulos_fixados_n ? { pinnedField: 'HEADLINE_1' } : {}) })), descriptions: spec.descricoes.map((text, i) => ({ text, ...(lanc && i === 0 ? { pinnedField: 'DESCRIPTION_1' } : {}) })) } } } } });

  console.log(`Conta: ${alvo[0].nome} (${cid})\nCampanha: ${nome}\n` + (lanc
    ? `Lançamento · Maximizar cliques (teto CPC R$ ${Number(spec.cpc_maximo_brl ?? LR.cpc_maximo_brl ?? 12)}) · orçamento: R$ ${Number(orcMicros) / 1e6}/dia · países: ${spec.paises.join(', ')} (presença ou interesse) · idioma: ${spec.idioma ?? 'en'} · locais excluídos: ${excluidos.join(',') || 'nenhum'} · parceiros de pesquisa ligados · metas padrão da conta\nPalavras-chave (frase): ${spec.palavras_chave.join(', ')}\nTítulos fixados na posição 1: ${spec.titulos_fixados_n} · sitelinks: ${spec.sitelinks.length} · destaques: ${spec.callouts.length}\n`
    : `Orçamento: R$ ${Number(orcMicros) / 1e6}/dia · CPA alvo: R$ ${Number(cpaMicros) / 1e6} · países: ${spec.paises.join(', ')} (presença) · meta: ${metas[0].name}\nPalavras-chave: "${spec.produto.toUpperCase()}" e "${spec.produto.toLowerCase()}" (frase)\n`) + `Anúncio: ${spec.titulos.length} títulos, ${spec.descricoes.length} descrições → ${spec.url_final}`);
  if (simular) {
    try { await api(cid, 'googleAds:mutate', { mutateOperations: ops, validateOnly: true }); console.log('\nSIMULAÇÃO OK: o Google aceitou a campanha (nada foi criado). Falta validar só a meta de conversão e os recursos, que dependem da campanha existir.'); log({ acao: 'simular', conta: cid, campanha: nome, ok: true }); }
    catch (e) { log({ acao: 'simular', conta: cid, campanha: nome, ok: false, erro: e.message }); die('o Google recusou na simulação: ' + e.message); }
    return;
  }
  let campId;
  try {
    const j = await api(cid, 'googleAds:mutate', { mutateOperations: ops });
    const rc = (j.mutateOperationResponses || []).map(x => x.campaignResult?.resourceName).find(Boolean);
    campId = rc?.split('/').pop();
  } catch (e) { log({ acao: 'criar', conta: cid, campanha: nome, ok: false, erro: e.message }); die('o Google recusou a criação (nada foi criado): ' + e.message); }
  console.log(`\nCampanha criada PAUSADA (id ${campId}).`);
  log({ acao: 'criar', conta: cid, campanha: nome, campanha_id: campId, ok: true });

  // 2ª etapa: meta de conversão da campanha + recursos. Se falhar, a campanha continua pausada e o erro é avisado.
  const falhas = [];
  if (!lanc) try { // Nutra: só a meta personalizada. Lançamentos: metas padrão da conta (como na campanha modelo), nada a fazer.
    await api(cid, 'googleAds:mutate', { mutateOperations: [{ conversionGoalCampaignConfigOperation: { update: { resourceName: rn('conversionGoalCampaignConfigs', campId), goalConfigLevel: 'CAMPAIGN', customConversionGoal: metas[0].resourceName }, updateMask: 'goal_config_level,custom_conversion_goal' } }] });
    // Só a meta personalizada conta (como na campanha modelo): desliga as metas padrão que vêm ligadas por padrão.
    const padrao = (await busca(cid, `SELECT campaign_conversion_goal.resource_name, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.id = ${campId}`)).map(x => x.campaignConversionGoal).filter(g => g.biddable);
    if (padrao.length) await api(cid, 'googleAds:mutate', { mutateOperations: padrao.map(g => ({ campaignConversionGoalOperation: { update: { resourceName: g.resourceName, biddable: false }, updateMask: 'biddable' } })) });
    console.log(`Meta de conversão: só ${metas[0].name} ✔ (${padrao.length} metas padrão desligadas)`);
  } catch (e) { falhas.push('meta de conversão: ' + e.message); }
  const Cn = rn('campaigns', campId); const aops = []; let n = -10;
  const asset = (corpo, tipo) => { const r = rn('assets', n--); aops.push({ assetOperation: { create: { resourceName: r, ...corpo } } }, { campaignAssetOperation: { create: { campaign: Cn, asset: r, fieldType: tipo } } }); };
  for (const s of spec.sitelinks) asset({ finalUrls: [spec.url_final], sitelinkAsset: { linkText: s.texto, description1: s.desc1, description2: s.desc2 } }, 'SITELINK');
  for (const c of spec.callouts) asset({ calloutAsset: { calloutText: c } }, 'CALLOUT');
  if (!lanc) asset({ structuredSnippetAsset: { header: spec.snippet.header, values: spec.snippet.valores } }, 'STRUCTURED_SNIPPET');
  if (!lanc) asset({ finalUrls: [spec.url_final], promotionAsset: { promotionTarget: spec.promocao.alvo, moneyAmountOff: { currencyCode: 'USD', amountMicros: String(Math.round(Number(spec.promocao.valor_usd) * 1e6)) }, languageCode: 'en' } }, 'PROMOTION');
  try { await api(cid, 'googleAds:mutate', { mutateOperations: aops }); console.log(`Recursos ✔ (${spec.sitelinks.length} sitelinks, ${spec.callouts.length} destaques${lanc ? '' : ', 1 snippet, 1 promoção'})`); }
  catch (e) { falhas.push('recursos: ' + e.message); }
  if (falhas.length) { console.log('\nATENÇÃO: a campanha foi criada, mas faltou:\n - ' + falhas.join('\n - ')); log({ acao: 'etapa2', conta: cid, campanha_id: campId, ok: false, falhas }); process.exit(2); }
  log({ acao: 'etapa2', conta: cid, campanha_id: campId, ok: true });
  console.log('\nTUDO PRONTO. A campanha está PAUSADA: revise no Google Ads e ative.');
}

const [cmd, a1, a2] = process.argv.slice(2);
try {
  if (cmd === 'contas') { const l = await contasPermitidas(); console.log(`Contas permitidas (${l.length}):`); l.forEach(c => console.log(` - ${c.nome} (${c.id})`)); }
  else if (cmd === 'criar' && a1) await criar(a1, a2 === '--simular');
  else if (cmd === 'vagas') { const l = await vagas(await contasPermitidas()); console.log(`Vagas por conta (máx ${MAX_CAMP}; conta só as campanhas ATIVAS agora):`); l.forEach(c => console.log(` - ${c.nome}: ${c.total}/${MAX_CAMP} ativas${c.total >= MAX_CAMP ? '  CHEIA' : ''}${(REGRAS.contas_reservadas_lancamentos ?? []).map(norm).includes(norm(c.nome)) ? '  [só lançamentos]' : ''}`)); }
  else if (cmd === 'ler-copia' && a1) { const c = lerCopia(a1); console.log(JSON.stringify(c, null, 1)); console.log(`\n${c.titulos.length} títulos · ${c.descricoes.length} descrições · ${c.sitelinks.length} sitelinks · ${c.callouts.length} destaques · snippet: ${c.snippet ? 'sim' : 'NÃO'} · promoção: ${c.promocao ? 'sim' : 'NÃO'}`); }
  else if (cmd === 'metas' && a1) {
    const permitidas = await contasPermitidas(); const digitos = String(a1).replace(/\D/g, '');
    const alvo = digitos.length === 10 ? permitidas.filter(c => c.id === digitos) : permitidas.filter(c => norm(c.nome) === norm(a1));
    if (alvo.length !== 1) die(`conta "${a1}" não está (ou não é única) na lista permitida: ${permitidas.map(c => c.nome).join(', ')}`);
    const l = (await busca(alvo[0].id, "SELECT custom_conversion_goal.name FROM custom_conversion_goal WHERE custom_conversion_goal.status = 'ENABLED'")).map(x => x.customConversionGoal.name).sort();
    console.log(`Metas de conversão personalizadas da conta ${alvo[0].nome}: ${l.join(', ')}`);
  }
  else console.log('Uso: google-ads contas | google-ads metas <conta> | google-ads criar <spec.json> [--simular]');
} catch (e) { die(e.message); }
