let _lpSubTab = 'ga4';
let _lpData = { ga4: null, google: null, checkout: null };

function lpSubtabBtn(id, label) {
  const active = _lpSubTab === id;
  return `<button onclick="switchLPSubTab('${id}')"
    style="background:${active ? '#01AB7D22' : '#ffffff'};border:1px solid ${active ? '#01AB7D' : '#e5e7eb'};
      color:${active ? '#01AB7D' : '#6b7280'};border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;
      cursor:pointer;transition:all .15s">${label}</button>`;
}

function renderLPSubtabs() {
  return `<div style="display:flex;gap:8px;margin-bottom:20px">
    ${lpSubtabBtn('ga4', '📈 GA4')}
    ${lpSubtabBtn('google', '🔵 Google Ads')}
    ${lpSubtabBtn('checkout', '🛒 Checkout')}
  </div>`;
}

async function switchLPSubTab(id) {
  _lpSubTab = id;
  document.getElementById('lp-subtabs').innerHTML = renderLPSubtabs();
  const body = document.getElementById('lp-subtab-body');

  const cached = _lpData[id];
  if (cached && cached.start === S.start && cached.end === S.end) {
    body.innerHTML = renderLPBody(id, cached.rows);
    return;
  }

  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando dados…</div>`;
  const rows = id === 'ga4' ? await fetchLPGA4Rows() : id === 'google' ? await fetchLPGoogleRows() : await fetchCheckoutRows();
  _lpData[id] = { start: S.start, end: S.end, rows };
  if (_lpSubTab === id) body.innerHTML = renderLPBody(id, rows);
}

async function fetchLPGA4Rows() {
  return fetchLPAgg(S.start, S.end);
}

function isJusfyLpUrl(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch (_) { return false; }
  const isJusfyHost = host === 'jusfy.com.br' || host === 'www.jusfy.com.br' || host.startsWith('page.jusfy');
  return isJusfyHost && !url.includes('/blog/');
}

async function fetchLPGoogleRows() {
  const allRows = await fetchGoogleLPAgg(S.start, S.end);
  return allRows.filter(r => isJusfyLpUrl(r.url));
}

async function fetchCheckoutRows() {
  return fetchCheckoutAgg(S.start, S.end);
}

function renderLPBody(id, rows) {
  const tableId = 'lp-' + id;
  registerSortRenderer(tableId, () => {
    if (_lpSubTab === id) document.getElementById('lp-subtab-body').innerHTML = renderLPBody(id, rows);
  });
  if (id === 'ga4') return renderLPGA4(rows, tableId);
  if (id === 'google') return renderLPGoogle(rows, tableId);
  return renderLPCheckout(rows, tableId);
}

function renderLPGA4(lpAgg, tableId) {
  const totSess = sum(lpAgg, 'sessions');
  const totConv = sum(lpAgg, 'conversions');
  const avgRate = totSess > 0 ? totConv / totSess * 100 : 0;

  const withRate = lpAgg.map(r => ({
    ...r,
    rate: r.sessions>0 ? r.conversions/r.sessions*100 : 0,
  }));
  const st   = getSort(tableId, 'sessions', 'desc');
  const rows = sortRows(withRate, st.key, st.dir);

  return `
  <div class="card">
    <div class="card-title">GA4 — Sessões x Conversão por Landing Page (${disp(S.start)} → ${disp(S.end)})</div>
    <p style="font-size:12px;color:#6b7280;margin-bottom:12px">
      Apenas páginas do domínio <code style="color:#01AB7D">page.jusfy.com.br</code>. Conversões atribuídas à sessão de entrada (landing page), não à URL onde o purchase disparou.
    </p>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th>${sortTh(tableId,'Landing Page','landing_page','asc','')}
        ${sortTh(tableId,'Sessões','sessions')}${sortTh(tableId,'Conversões','conversions')}${sortTh(tableId,'Taxa Conv.','rate')}
      </tr></thead>
      <tbody>${rows.length ? rows.map((r,i)=>`<tr>
        <td class="c-muted">${i+1}</td>
        <td style="max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.landing_page}">${r.landing_page}</td>
        <td class="r"><strong>${fN(r.sessions)}</strong></td>
        <td class="r">${fN(r.conversions)}</td>
        <td class="r"><span class="${r.rate>=avgRate?'d-up':'c-muted'}">${fP(r.rate)}</span></td>
      </tr>`).join('') : emptyRow(5)}</tbody>
    </table></div>
  </div>`;
}

function renderLPGoogle(rows0, tableId) {
  const totClicks = sum(rows0, 'clicks');
  const totConv   = sum(rows0, 'conversions');
  const avgRate   = totClicks > 0 ? totConv / totClicks * 100 : 0;

  const withRate = rows0.map(r => ({
    ...r,
    rate: r.clicks>0 ? r.conversions/r.clicks*100 : 0,
  }));
  const st     = getSort(tableId, 'clicks', 'desc');
  const sorted = sortRows(withRate, st.key, st.dir);

  return `
  <div class="card">
    <div class="card-title">Google Ads — Cliques x Conversão por Landing Page (${disp(S.start)} → ${disp(S.end)})</div>
    <p style="font-size:12px;color:#6b7280;margin-bottom:12px">
      URL final (unexpanded_final_url) do relatório de Landing Pages do Google Ads. Query string e parâmetros de tracking removidos para agrupar a mesma página usada em campanhas diferentes.
    </p>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th>${sortTh(tableId,'URL','url','asc','')}
        ${sortTh(tableId,'Cliques','clicks')}${sortTh(tableId,'Conversões','conversions')}${sortTh(tableId,'Taxa Conv.','rate')}
      </tr></thead>
      <tbody>${sorted.length ? sorted.map((r,i)=>`<tr>
        <td class="c-muted">${i+1}</td>
        <td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.url}">${r.url}</td>
        <td class="r"><strong>${fN(r.clicks)}</strong></td>
        <td class="r">${fN(Math.round(r.conversions))}</td>
        <td class="r"><span class="${r.rate>=avgRate?'d-up':'c-muted'}">${fP(r.rate)}</span></td>
      </tr>`).join('') : emptyRow(5)}</tbody>
    </table></div>
  </div>`;
}

const PLAN_SUFFIXES = ['_ULTIMATE', '_STARTER', '_MASTER'];

function sumInto(acc, r) {
  acc.sessions         += r.sessions;
  acc.conversions      += r.conversions;
  acc.bounced_sessions += r.bounced_sessions;
}

function groupCheckoutRows(rows0) {
  // 1) Agrupa todas as variantes CAA / OAB numa única linha
  const caaOab = { sessions: 0, conversions: 0, bounced_sessions: 0, _count: 0 };
  const rest1 = [];
  for (const r of rows0) {
    const upper = r.landing_page.toUpperCase();
    if (upper.includes('CAA') || upper.includes('OAB')) {
      sumInto(caaOab, r);
      caaOab._count++;
    } else {
      rest1.push(r);
    }
  }

  // 2) Dentro do que sobrou, agrupa por campanha: une _ULTIMATE + _STARTER + _MASTER
  //    da mesma campanha numa única linha (ex: ANIVER26_ULTIMATE + ANIVER26_STARTER + ANIVER26_MASTER -> "ANIVER26")
  const campaigns = {};
  const rest2 = [];
  for (const r of rest1) {
    const upper = r.landing_page.toUpperCase();
    const suffix = PLAN_SUFFIXES.find(s => upper.endsWith(s));
    if (suffix) {
      const key = r.landing_page.slice(0, r.landing_page.length - suffix.length);
      if (!campaigns[key]) campaigns[key] = { sessions: 0, conversions: 0, bounced_sessions: 0, rows: [] };
      sumInto(campaigns[key], r);
      campaigns[key].rows.push(r);
    } else {
      rest2.push(r);
    }
  }

  const result = [...rest2];
  for (const [key, b] of Object.entries(campaigns)) {
    if (b.rows.length >= 2) {
      const name = key.split('/').pop();
      result.push({
        landing_page: `${name} — agrupado (${b.rows.length} páginas)`,
        sessions: b.sessions, conversions: b.conversions, bounced_sessions: b.bounced_sessions,
      });
    } else {
      result.push(b.rows[0]);
    }
  }

  if (caaOab._count > 0) {
    result.push({
      landing_page: `CAA / OAB — agrupado (${caaOab._count} páginas)`,
      sessions: caaOab.sessions, conversions: caaOab.conversions, bounced_sessions: caaOab.bounced_sessions,
    });
  }
  return result;
}

function renderLPCheckout(rows0, tableId) {
  const totSess    = sum(rows0, 'sessions');
  const totConv    = sum(rows0, 'conversions');
  const totBounced = sum(rows0, 'bounced_sessions');
  const avgRate    = totSess > 0 ? totConv / totSess * 100 : 0;
  const avgBounce  = totSess > 0 ? totBounced / totSess * 100 : 0;

  const grouped = groupCheckoutRows(rows0);
  const withMetrics = grouped.map(r => ({
    ...r,
    rate:   r.sessions>0 ? r.conversions/r.sessions*100 : 0,
    bounce: r.sessions>0 ? r.bounced_sessions/r.sessions*100 : 0,
  }));
  const st   = getSort(tableId, 'sessions', 'desc');
  const rows = sortRows(withMetrics, st.key, st.dir);

  return `
  <div class="kpi-grid cols-4" style="margin-bottom:20px">
    ${kpiCard('Sessões (Register)', totSess, undefined, fN, 'c-blue')}
    ${kpiCard('Conversões', totConv, undefined, fN, 'c-brand')}
    ${kpiCard('Taxa de Conversão', avgRate, undefined, fP, 'c-brand')}
    ${kpiCard('Bounce Rate', avgBounce, undefined, fP, 'c-red')}
  </div>

  <div class="card">
    <div class="card-title">Checkout — Sessões x Conversão x Bounce (${disp(S.start)} → ${disp(S.end)})</div>
    <p style="font-size:12px;color:#6b7280;margin-bottom:12px">
      Páginas <code style="color:#01AB7D">app.jusfy.com.br/register*</code> usadas como landing page de checkout (link direto de campanha para cadastro). Variantes com <code style="color:#01AB7D">CAA</code> ou <code style="color:#01AB7D">OAB</code> no caminho são agrupadas em uma única linha.
    </p>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th>${sortTh(tableId,'Landing Page','landing_page','asc','')}
        ${sortTh(tableId,'Sessões','sessions')}${sortTh(tableId,'Conversões','conversions')}${sortTh(tableId,'Taxa Conv.','rate')}${sortTh(tableId,'Bounce','bounce')}
      </tr></thead>
      <tbody>${rows.length ? rows.map((r,i)=>`<tr>
        <td class="c-muted">${i+1}</td>
        <td style="max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.landing_page}">${r.landing_page}</td>
        <td class="r"><strong>${fN(r.sessions)}</strong></td>
        <td class="r">${fN(r.conversions)}</td>
        <td class="r"><span class="${r.rate>=avgRate?'d-up':'c-muted'}">${fP(r.rate)}</span></td>
        <td class="r"><span class="${r.bounce<=avgBounce?'d-up':'d-down'}">${fP(r.bounce)}</span></td>
      </tr>`).join('') : emptyRow(6)}</tbody>
    </table></div>
  </div>`;
}

async function tabLP() {
  loading();
  _lpSubTab = 'ga4';
  _lpData = { ga4: null, google: null, checkout: null };

  document.getElementById('content').innerHTML = `
    <div id="lp-subtabs">${renderLPSubtabs()}</div>
    <div id="lp-subtab-body"></div>`;

  await switchLPSubTab('ga4');
}
