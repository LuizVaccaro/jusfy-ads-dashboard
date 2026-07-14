async function tabGA4() {
  loading();
  const [ga4Channels, ga4Daily, cmpChannels, cmpDaily] = await Promise.all([
    fetchGA4ChannelsAgg(S.start, S.end),
    fetchGA4DailyAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchGA4ChannelsAgg(S.cmpStart, S.cmpEnd) : [],
    S.compare && S.cmpStart ? fetchGA4DailyAgg(S.cmpStart, S.cmpEnd)   : [],
  ]);

  const totSess  = sum(ga4Channels,'sessions');
  const cTotSess = cmpChannels.length ? sum(cmpChannels,'sessions') : undefined;

  // Daily sessions chart
  const dailySess = {};
  for (const r of ga4Daily) {
    dailySess[r.date] = +r.sessions||0;
  }
  const ga4Days = Object.keys(dailySess).sort();
  const maxS = Math.max(...ga4Days.map(d=>dailySess[d]),1);

  // Top sources
  const srcMap = {};
  for (const r of ga4Channels) {
    if (!srcMap[r.source]) srcMap[r.source]=0;
    srcMap[r.source] += +r.sessions||0;
  }
  const topSources = Object.entries(srcMap).sort(([,a],[,b])=>b-a);
  const maxSrc = Math.max(...topSources.map(([,v])=>v),1);

  // Full UTM table — sort by sessions desc, top 100
  const rows = ga4Channels.slice().sort((a,b)=>b.sessions-a.sessions).slice(0,100);

  document.getElementById('content').innerHTML = `
  <div class="kpi-grid cols-3" style="margin-bottom:20px">
    ${kpiCard('Sessões (GA4)',   totSess,  cTotSess,  fN, 'c-blue')}
    ${kpiCard('Origens únicas',  topSources.length, undefined, fN, 'c-muted')}
    ${kpiCard('Campanhas únicas', new Set(ga4Channels.map(r=>r.campaign)).size, undefined, fN, 'c-muted')}
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-title">Sessões Diárias</div>
      <div style="overflow-y:auto;max-height:280px">
        ${ga4Days.length ? ga4Days.map(d=>{
          const s=dailySess[d];
          return `<div class="chart-day">
            <span class="chart-label">${d.slice(5)}</span>
            <div class="chart-bars">
              <div style="flex:${s};background:#0182ab;border-radius:2px" title="${fN(s)} sessões"></div>
              <div style="flex:${maxS-s};opacity:0"></div>
            </div>
            <span class="chart-val">${fN(s)}</span>
          </div>`;
        }).join('') : '<div class="c-muted" style="text-align:center;padding:20px;font-size:13px">Sem dados</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Top Origens (UTM Source)</div>
      ${topSources.map(([src,v])=>`
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
            <span class="badge bb">${src}</span>
            <span><strong>${fN(v)}</strong> <span class="c-muted">sessões</span></span>
          </div>
          <div style="height:6px;background:#FAFAFA;border-radius:3px;overflow:hidden">
            <div style="height:100%;background:#02A378;width:${(v/maxSrc*100).toFixed(1)}%"></div>
          </div>
        </div>`).join('') || '<div class="c-muted" style="font-size:13px;padding:20px 0;text-align:center">Sem dados</div>'}
    </div>
  </div>

  <div class="card">
    <div class="card-title">GA4 — Sessões por UTM (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Source</th><th>Medium</th><th>Campaign</th>
        <th class="r">Sessões</th><th class="r">% Total</th>
      </tr></thead>
      <tbody>${rows.length ? rows.map((r,i)=>`<tr>
        <td class="c-muted">${i+1}</td>
        <td><span class="badge bb">${r.source}</span></td>
        <td class="c-muted">${r.medium}</td>
        <td class="c-muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.campaign}</td>
        <td class="r"><strong>${fN(r.sessions)}</strong></td>
        <td class="r c-muted">${totSess>0?fP(r.sessions/totSess*100):'—'}</td>
      </tr>`).join('') : emptyRow(6)}</tbody>
    </table></div>
  </div>`;
}
