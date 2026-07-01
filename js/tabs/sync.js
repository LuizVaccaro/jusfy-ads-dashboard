let _syncLogs = [];

function renderSyncLogsTable() {
  const st   = getSort('sync-logs', 'finished_at', 'desc');
  const logs = sortRows(_syncLogs, st.key, st.dir);

  document.getElementById('sync-logs-thead').innerHTML =
    `${sortTh('sync-logs','Plataforma','platform','asc','')}${sortTh('sync-logs','Tipo','sync_type','asc','')}
     ${sortTh('sync-logs','Resultado','status','asc','')}${sortTh('sync-logs','Registros','records_upserted')}
     ${sortTh('sync-logs','Horário','finished_at')}`;

  document.getElementById('sync-logs-tbody').innerHTML = logs.length ? logs.map(r=>{
    const ok     = r.status==='success';
    const pBadge = r.platform==='google_ads'?'bb':r.platform==='meta'?'by':'bg';
    return `<tr>
      <td><span class="badge ${pBadge}">${r.platform}</span></td>
      <td class="c-muted">${r.sync_type}</td>
      <td>${ok?'✅ Sucesso':'⚠️ '+((r.error_message||'').substring(0,70))}</td>
      <td class="r">${ok?fN(r.records_upserted):'—'}</td>
      <td class="r c-muted" style="font-size:11px">${new Date(r.finished_at).toLocaleString('pt-BR')}</td>
    </tr>`;
  }).join('') : emptyRow(5,'Nenhum log encontrado');
}

async function tabSync() {
  loading();
  _syncLogs = await fetchLogs();
  registerSortRenderer('sync-logs', renderSyncLogsTable);

  document.getElementById('content').innerHTML = `
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Últimas Sincronizações</div>
    <div class="table-wrap"><table>
      <thead><tr id="sync-logs-thead"></tr></thead>
      <tbody id="sync-logs-tbody"></tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="card-title">Sincronização Manual / Backfill Histórico</div>
    <p style="font-size:13px;color:#8b949e;margin-bottom:14px">
      Sincronize um dia específico ou um intervalo de datas para carregar histórico.
      Para backfill completo (jan/2025 → hoje), use Start: <code style="color:#1D9E75">2025-01-01</code> e End: data de ontem.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px">
      <div class="filter-group">
        <span class="filter-label">Start Date</span>
        <input class="filter-date" type="date" id="syncStart" value="${yesterday()}"/>
      </div>
      <div class="filter-group">
        <span class="filter-label">End Date</span>
        <input class="filter-date" type="date" id="syncEnd" value="${yesterday()}"/>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="sync-btn sync-g"   onclick="triggerSync('google-ads')">🔵 Sync Google Ads</button>
      <button class="sync-btn sync-m"   onclick="triggerSync('meta-ads')">🟡 Sync Meta Ads</button>
      <button class="sync-btn sync-ga4" onclick="triggerSync('ga4')">📈 Sync GA4</button>
      <button class="sync-btn" style="border-color:#1D9E7544;background:#1D9E7511;color:#1D9E75" onclick="triggerAll()">⚡ Sync Todos</button>
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #30363d">
      <div style="font-size:12px;font-weight:600;color:#e6edf3;margin-bottom:8px">🎂 Criativos — Aniversário</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="sync-btn sync-m" onclick="triggerSync('meta-creatives')">🟡 Sync Meta Criativos</button>
        <button class="sync-btn sync-g" onclick="triggerSync('google-creatives')">🔵 Sync Google Criativos</button>
      </div>
    </div>
    <div id="syncLog" style="margin-top:14px;font-size:12px;color:#8b949e;font-family:monospace;max-height:200px;overflow-y:auto;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:10px;display:none"></div>
  </div>`;

  renderSyncLogsTable();
}

async function triggerSync(fn) {
  const start = document.getElementById('syncStart').value;
  const end   = document.getElementById('syncEnd').value;
  if (!start||!end) { alert('Defina as datas.'); return; }
  appendSyncLog(`▶ Iniciando sync-${fn} (${start} → ${end})…`);
  try {
    const params = start===end ? `?date=${start}` : `?start_date=${start}&end_date=${end}`;
    const r = await fetch(`${SURL}/functions/v1/sync-${fn}${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SKEY}` }
    });
    const d = await r.json();
    if (d.success) appendSyncLog(`✅ sync-${fn}: ${d.records} registros (${d.dates||start})`);
    else           appendSyncLog(`❌ sync-${fn}: ${d.error}`);
  } catch(e) {
    appendSyncLog(`❌ Erro: ${e.message}`);
  }
}

async function triggerAll() {
  await triggerSync('google-ads');
  await triggerSync('meta-ads');
  await triggerSync('ga4');
  appendSyncLog('✅ Todos os syncs concluídos!');
}

function appendSyncLog(msg) {
  const el = document.getElementById('syncLog');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML += `<div>[${new Date().toLocaleTimeString('pt-BR')}] ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}
