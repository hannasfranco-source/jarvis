// Botões "Aprovar" / "Não quero" das páginas de ofertas do garimpo (entregas/<pasta>/index.html).
// A página só marca onde vão os botões: <div class="aprovacao" data-oferta="<id do ofertas.json>"></div>.
(() => {
  const pasta = decodeURIComponent(location.pathname.split('/')[2] || '');
  const css = document.createElement('style');
  css.textContent = `
    .aprovacao { margin: 14px 0 4px; padding: 12px; border-radius: 10px; background: #f4f6fb; border: 1px solid #dfe3ee; font-family: -apple-system, Arial, sans-serif; }
    .aprovacao textarea { width: 100%; box-sizing: border-box; min-height: 38px; margin: 0 0 8px; padding: 6px 8px; border: 1px solid #ccd2e0; border-radius: 8px; font: inherit; font-size: 14px; }
    .aprovacao .b { display: flex; gap: 8px; flex-wrap: wrap; }
    .aprovacao button { flex: 1; min-width: 130px; padding: 10px 14px; border-radius: 8px; border: 0; font: 600 15px -apple-system, Arial, sans-serif; cursor: pointer; }
    .aprovacao .sim { background: #1e9e55; color: #fff; } .aprovacao .nao { background: #e4e7ef; color: #333; }
    .aprovacao button:disabled { opacity: .6; cursor: default; }
    .aprovacao .ok { font-weight: 600; } .aprovacao .ok.verde { color: #1e7d45; } .aprovacao .ok.cinza { color: #666; }
    .aprovacao .erro { color: #c0392b; font-size: 13px; margin-top: 6px; }
    .aprovacao-resumo { position: sticky; top: 0; z-index: 5; margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; background: #1b2140; color: #fff; font: 600 14px -apple-system, Arial, sans-serif; }
    .adicionar { margin: 18px 0; padding: 16px; border-radius: 12px; background: #eef7f1; border: 1px solid #cfe6d8; font-family: -apple-system, Arial, sans-serif; }
    .adicionar h3 { margin: 0 0 4px; font-size: 17px; } .adicionar p { margin: 0 0 12px; color: #456; font-size: 14px; }
    .adicionar label { display: block; font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
    .adicionar input, .adicionar textarea { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #bcd; border-radius: 8px; font: inherit; font-size: 14px; }
    .adicionar .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } @media (max-width: 560px) { .adicionar .duas { grid-template-columns: 1fr; } }
    .adicionar button { margin-top: 14px; width: 100%; padding: 12px; border: 0; border-radius: 8px; background: #1e9e55; color: #fff; font: 600 15px -apple-system, Arial, sans-serif; cursor: pointer; }
    .adicionar button:disabled { opacity: .6; } .adicionar .msg { margin-top: 10px; font-weight: 600; font-size: 14px; } .adicionar .msg.erro { color: #c0392b; } .adicionar .msg.ok { color: #1e7d45; }
    .minhas { margin: 12px 0; font: 14px -apple-system, Arial, sans-serif; } .minhas div { padding: 8px 0; border-top: 1px solid #dfe3ee; }`;
  document.head.appendChild(css);
  const lanc = document.body.dataset.tipo === 'lancamentos';
  let decisoes = {};
  const caixas = [...document.querySelectorAll('[data-oferta]')];
  const resumo = document.createElement('div');
  resumo.className = 'aprovacao-resumo';
  if (caixas.length) document.body.prepend(resumo);

  function desenhar() {
    let falta = 0;
    for (const el of caixas) {
      const id = el.dataset.oferta, d = decisoes[id];
      el.classList.add('aprovacao');
      if (d?.decisao === 'aprovar') {
        el.innerHTML = `<div class="ok verde">✓ Aprovado — ${esc(d.msg || 'Agora abra o agente para seguir.')}${d.nota ? `<br><small>Recado: ${esc(d.nota)}</small>` : ''}</div>`;
      } else if (d?.decisao === 'recusar') {
        el.innerHTML = `<div class="ok cinza">✗ Você não quis este produto.${d.nota ? ` <small>(${esc(d.nota)})</small>` : ''}</div>
          <div class="b" style="margin-top:8px"><button class="sim" data-d="aprovar">Mudei de ideia: aprovar</button></div><div class="erro"></div>`;
      } else {
        falta++;
        el.innerHTML = `<textarea placeholder="${lanc ? 'Recado opcional (ex.: mandar o e-mail em português, priorizar este...)' : 'Recado opcional (ex.: pedir na MaxWeb, gostei porque...)'}"></textarea>
          <div class="b"><button class="sim" data-d="aprovar">${lanc ? '✓ Aprovar e liberar o e-mail de afiliação' : '✓ Aprovar'}</button><button class="nao" data-d="recusar">✗ Não quero</button></div><div class="erro"></div>`;
      }
    }
    resumo.textContent = falta ? `${falta} de ${caixas.length} ofertas esperando sua decisão` : `Tudo decidido (${caixas.length} ofertas). Pode fechar esta página.`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.aprovacao button[data-d]');
    if (!b) return;
    const el = b.closest('[data-oferta]');
    el.querySelectorAll('button').forEach((x) => (x.disabled = true));
    try {
      const r = await fetch('/api/ofertas/decidir', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pasta, id: el.dataset.oferta, decisao: b.dataset.d, nota: el.querySelector('textarea')?.value || '' }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'erro');
      decisoes[el.dataset.oferta] = j;
      desenhar();
    } catch (e) {
      el.querySelector('.erro').textContent = `Não salvou: ${e.message}. Abra esta página por localhost:4848/entregas.`;
      el.querySelectorAll('button').forEach((x) => (x.disabled = false));
    }
  });


  // Formulário "Achei um lançamento por conta": adicionar já é aprovar (o agente envia o e-mail de afiliação depois).
  for (const box of document.querySelectorAll('[data-adicionar]')) {
    box.classList.add('adicionar');
    box.innerHTML = `<h3>➕ Achei um lançamento por conta</h3>
      <p>Pesquisei por conta e quero pedir a afiliação. Ao enviar, o lançamento já fica aprovado e o agente de Lançamentos envia o e-mail de afiliação.</p>
      <div class="duas"><div><label>Produtor / expert *</label><input name="produtor"></div><div><label>Nome do evento *</label><input name="evento"></div></div>
      <label>Link da página de captação (a página de inscrição do evento)</label><input name="pagina" placeholder="https://...">
      <div class="duas"><div><label>Datas do evento</label><input name="datas"></div><div><label>País / idioma</label><input name="pais"></div></div>
      <div class="duas"><div><label>Gratuito ou pago</label><input name="preco"></div><div><label>Comissão (se souber)</label><input name="comissao"></div></div>
      <label>Contato para a afiliação (e-mail) ou link do programa de afiliados</label><input name="contato">
      <label>Recado para o agente (opcional)</label><textarea name="nota" rows="2" placeholder="Ex.: já falei com ele no Instagram, mandar o e-mail em inglês"></textarea>
      <button type="button">✓ Adicionar e aprovar o envio do e-mail</button><div class="msg"></div>`;
    box.querySelector('button').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget, msg = box.querySelector('.msg');
      const dados = {};
      box.querySelectorAll('input, textarea').forEach((i) => (dados[i.name] = i.value));
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Enviando…';
      try {
        const r = await fetch('/api/ofertas/adicionar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dados) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro || 'erro');
        msg.className = 'msg ok'; msg.textContent = `✓ Adicionado. ${j.msg || ''}`;
        box.querySelectorAll('input, textarea').forEach((i) => (i.value = ''));
        listarMinhas();
      } catch (e) {
        msg.className = 'msg erro'; msg.textContent = `Não salvou: ${e.message}. Abra esta página por localhost:4848/entregas.`;
      }
      btn.disabled = false;
    });
  }
  async function listarMinhas() {
    const alvo = document.querySelector('[data-minhas]');
    if (!alvo) return;
    try {
      const base = '/entregas/ofertas-lancamentos-minhas/';
      const [o, d] = await Promise.all([fetch(base + 'ofertas.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])), fetch(base + 'decisoes.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {}))]);
      const lista = (Array.isArray(o) ? o : o.ofertas || []).slice().reverse();
      alvo.className = 'minhas';
      alvo.innerHTML = lista.length ? lista.map((x) => `<div><b>${esc(x.evento)}</b> — ${esc(x.produtor)}${x.pagina ? ` · <a href="${esc(x.pagina)}" target="_blank" rel="noopener">página de captação</a>` : ''}<br><small>${d[x.id]?.decisao === 'aprovar' ? 'aprovado' : 'aguardando'}</small></div>`).join('') : '<div>Nada adicionado ainda.</div>';
    } catch {}
  }
  listarMinhas();

  fetch('decisoes.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => { decisoes = d || {}; desenhar(); });
})();
