// Gera a página de ofertas para o aluno aprovar (index.html ao lado do ofertas.json).
//   ofertas <nutra|lancamentos> <pasta em ~/jarvis/entregas, ex.: ofertas-nutra-2026-11-12>
// O agente grava ofertas.json: { "rodada": {"data": "AAAA-MM-DD"}, "ofertas": [...], "descartadas": [...] }
// Nutra: id, produto, plataforma, checkout, pagina (site oficial), trends, fontes, resumo, riscos.
// Lançamentos: id, evento, produtor, pagina (link da página de captação, obrigatório), datas, pais, idioma, preco, comissao,
//   afiliacao, contato, instagram, confirmacao, fontes, resumo, riscos, jaAfiliada.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [tipo, pasta] = process.argv.slice(2);
if (!['nutra', 'lancamentos'].includes(tipo) || !pasta || !/^[\w.-]+$/.test(pasta)) {
  console.error('uso: ofertas <nutra|lancamentos> <pasta em ~/jarvis/entregas>');
  process.exit(1);
}
const NUTRA = tipo === 'nutra';
const dir = path.join(os.homedir(), 'jarvis', 'entregas', pasta);
let dados;
try { dados = JSON.parse(fs.readFileSync(path.join(dir, 'ofertas.json'), 'utf8')); }
catch (e) { console.error(`ERRO: não li ${dir}/ofertas.json (${e.message})`); process.exit(1); }
const ofertas = Array.isArray(dados) ? dados : dados.ofertas || [];
const descartadas = Array.isArray(dados) ? [] : dados.descartadas || [];
const rodada = (!Array.isArray(dados) && dados.rodada) || {};

const nome = (o) => (NUTRA ? o.produto : o.evento);
const faltam = [];
for (const o of ofertas) {
  const obrig = NUTRA ? ['id', 'produto'] : ['id', 'evento', 'produtor', 'pagina'];
  for (const k of obrig) if (!o[k]) faltam.push(`${nome(o) || o.id || '?'}: falta "${k}"`);
  if (o.pagina && !/^https?:\/\//i.test(o.pagina)) faltam.push(`${nome(o)}: "pagina" precisa ser um link http(s)`);
}
if (faltam.length) { console.error('ERRO: ofertas incompletas:\n- ' + faltam.join('\n- ')); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eUrl = (u) => /^https?:\/\//i.test(u || '');
const link = (u, t) => (eUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t || u)}</a>` : esc(u || '—'));
const linha = (rotulo, valor, html = false) => (valor ? `<div class="l"><span>${rotulo}</span><div>${html ? valor : esc(valor)}</div></div>` : '');
const data = rodada.data || pasta.replace(/^ofertas-(nutra|lancamentos)-/, '');

const temComissao = ofertas.some((o) => o.comissao);
const cabecalho = NUTRA ? ['Produto', 'Plataforma', 'Página oficial', 'Trends'] : ['Produtor', 'Evento', 'Datas', 'Página de captação', ...(temComissao ? ['Comissão'] : [])];
const linhaResumo = (o) => (NUTRA
  ? `<td><b>${esc(o.produto)}</b></td><td>${esc(o.plataforma || '—')}</td><td>${link(o.pagina, 'abrir')}</td><td>${esc(o.trends || '—')}</td>`
  : `<td><b>${esc(o.produtor)}</b></td><td>${esc(o.evento)}</td><td>${esc(o.datas || '—')}</td><td>${link(o.pagina, 'abrir página')}</td>${temComissao ? `<td>${esc(o.comissao || '—')}</td>` : ''}`);

const detalhes = (o) => (NUTRA
  ? [linha('Site oficial', link(o.pagina), true), linha('Plataforma', o.plataforma), linha('Checkout', link(o.checkout), true),
     linha('Google Trends', o.trends), linha('Fontes', o.fontes), linha('Atenção', o.riscos)]
  : [linha('Página de captação', link(o.pagina), true), linha('Datas', o.datas), linha('Gratuito ou pago', o.preco), linha('Comissão', o.comissao),
     linha('Afiliação', eUrl(o.afiliacao) ? link(o.afiliacao, 'programa de afiliados') : o.afiliacao || 'pedir por e-mail', eUrl(o.afiliacao)),
     linha('Contato (fonte)', o.contato), linha('Instagram do expert', eUrl(o.instagram) ? link(o.instagram) : o.instagram, eUrl(o.instagram)),
     linha('Como confirmei o lançamento', o.confirmacao), linha('Fontes', o.fontes), linha('Situação', o.situacao), linha('Atenção', o.riscos)]).join('');

const blocos = ofertas.map((o, i) => `
<section class="card">
  <div class="topo"><span class="n">${i + 1}</span><div><h2>${esc(nome(o))}</h2><div class="prod">${NUTRA ? esc(o.plataforma || '') : `${esc(o.produtor)}${o.pais ? ` · ${esc(o.pais)}` : ''}${o.idioma ? ` · ${esc(o.idioma)}` : ''}`}</div></div>${o.jaAfiliada ? '<span class="tag">já é afiliado</span>' : ''}</div>
  ${o.resumo ? `<p class="resumo">${esc(o.resumo)}</p>` : ''}
  <div class="grade">${detalhes(o)}</div>
  <div data-oferta="${esc(o.id)}"></div>
</section>`).join('\n');

const naoPassaram = descartadas.length
  ? `<h2 class="sec">Não passaram (sem botão)</h2><ul class="desc">${descartadas.map((d) => `<li><b>${esc(nome(d) || d.evento || d.produto)}</b>${d.produtor ? ` — ${esc(d.produtor)}` : ''}${d.pagina ? ` · ${link(d.pagina, 'página')}` : ''}<br><small>${esc(d.motivo)}</small></li>`).join('')}</ul>`
  : '';

const titulo = NUTRA ? 'Produtos de Nutra para aprovar' : 'Lançamentos para aprovar';
const apos = NUTRA ? 'Aprovando, o agente Nutra pede o seu link de afiliação e segue com o funil.' : 'Aprovando, o agente de Lançamentos envia o e-mail de afiliação.';
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — ${esc(data)}</title>
<style>
  :root { --bg:#f6f7fb; --card:#fff; --linha:#e3e6ef; --txt:#1c2033; --suave:#5d647a; --acc:#3b4cca; }
  * { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--txt); font:16px/1.5 -apple-system, "Segoe UI", Arial, sans-serif; padding:16px; }
  main { max-width:860px; margin:0 auto; } h1 { font-size:24px; margin:8px 0 4px; } .sub { color:var(--suave); margin:0 0 18px; }
  .sec { font-size:18px; margin:28px 0 10px; } a { color:var(--acc); word-break:break-word; }
  .tabela { overflow-x:auto; background:var(--card); border:1px solid var(--linha); border-radius:12px; }
  table { border-collapse:collapse; width:100%; min-width:520px; font-size:14px; } th, td { text-align:left; padding:9px 12px; border-top:1px solid var(--linha); vertical-align:top; }
  th { border-top:0; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--suave); background:#fafbfe; }
  .card { background:var(--card); border:1px solid var(--linha); border-radius:14px; padding:18px; margin:16px 0; }
  .topo { display:flex; gap:12px; align-items:flex-start; } .n { flex:none; width:30px; height:30px; border-radius:50%; background:var(--acc); color:#fff; display:grid; place-items:center; font-weight:700; }
  h2 { font-size:19px; margin:0; } .prod { color:var(--suave); font-size:14px; } .tag { margin-left:auto; background:#fff3d6; border:1px solid #f0d58a; border-radius:20px; padding:3px 10px; font-size:12px; font-weight:600; white-space:nowrap; }
  .resumo { margin:12px 0; } .grade { display:grid; margin-top:8px; } .l { display:grid; grid-template-columns:170px 1fr; gap:12px; padding:8px 0; border-top:1px solid var(--linha); font-size:14px; } .l span { color:var(--suave); font-weight:600; }
  .desc { padding-left:18px; } .desc li { margin:8px 0; } small { color:var(--suave); }
  @media (max-width:560px) { .l { grid-template-columns:1fr; gap:2px; } }
</style></head>
<body data-tipo="${tipo}"><main>
<h1>${titulo}</h1>
<p class="sub">Rodada de ${esc(data)} · ${ofertas.length} ${ofertas.length === 1 ? 'oferta' : 'ofertas'}. ${apos}</p>
${ofertas.length ? `<div class="tabela"><table><tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr>${ofertas.map((o) => `<tr>${linhaResumo(o)}</tr>`).join('')}</table></div>` : '<p>Nenhuma oferta nova passou nos critérios nesta rodada.</p>'}
${blocos}
${naoPassaram}
</main>
<script src="/aprovar-ofertas.js"></script>
</body></html>`;

fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`OK: ${ofertas.length} ofertas, ${descartadas.length} descartadas → http://localhost:4848/entregas/${pasta}/`);
