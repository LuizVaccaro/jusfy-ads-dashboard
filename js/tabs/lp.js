let _lpSubTab = 'ga4';
let _lpData = { ga4: null, google: null };

function lpSubtabBtn(id, label) {
  const active = _lpSubTab === id;
  return `<button onclick="switchLPSubTab('${id}')"
    style="background:${active ? '#1D9E7522' : '#161b22'};border:1px solid ${active ? '#1D9E75' : '#30363d'};
      color:${active ? '#1D9E75' : '#8b949e'};border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;
      cursor:pointer;transition:all .15s">${label}</button>`;
}

function renderLPSubtabs() {
  return `<div style="display:flex;gap:8px;margin-bottom:20px">
    ${lpSubtabBtn('ga4', '📈 GA4')}
    ${lpSubtabBtn('google', '🔵 Google Ads')}
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
  const rows = id === 'ga4' ? await fetchLPGA4Rows() : await fetchLPGoogleRows();
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

function renderLPBody(id, rows) {
  const tableId = 'lp-' + id;
  registerSortRenderer(tableId, () => {
    if (_lpSubTab === id) document.getElementById('lp-subtab-body').innerHTML = renderLPBody(id, rows);
  });
  return id === 'ga4' ? renderLPGA4(rows, tableId) : renderLPGoogle(rows, tableId);
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
    <p style="font-size:12px;color:#8b949e;margin-bottom:12px">
      Apenas páginas do domínio <code style="color:#1D9E75">page.jusfy.com.br</code>. Conversões atribuídas à sessão de entrada (landing page), não à URL onde o purchase disparou.
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
    <p style="font-size:12px;color:#8b949e;margin-bottom:12px">
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

async function tabLP() {
  loading();
  _lpSubTab = 'ga4';
  _lpData = { ga4: null, google: null };

  document.getElementById('content').innerHTML = `
    <div id="lp-subtabs">${renderLPSubtabs()}</div>
    <div id="lp-subtab-body"></div>`;

  await switchLPSubTab('ga4');
}
