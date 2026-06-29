async function tabGA4() {
  loading();
  const [ga4Channels, ga4Daily, cmpChannels, cmpDaily] = await Promise.all([
    fetchGA4ChannelsAgg(S.start, S.end),
    fetchGA4DailyAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchGA4ChannelsAgg(S.cmpStart, S.cmpEnd) : [],
    S.compare && S.cmpStart ? fetchGA4DailyAgg(S.cmpStart, S.cmpEnd)   : [],
  ]);

  const agg    = ga4Channels.slice().sort((a,b)=>b.conversions-a.conversions);
  const cmpAgg = cmpChannels.length ? cmpChannels : [];

  const totSess=sum(agg,'sessions'), totConv=sum(agg,'conversions'), totRev=sum(agg,'revenue');
  const cTotSess = cmpAgg.length ? sum(cmpAgg,'sessions')    : undefined;
  const cTotConv = cmpAgg.length ? sum(cmpAgg,'conversions') : undefined;
  const cTotRev  = cmpAgg.length ? sum(cmpAgg,'revenue')     : undefined;
  const convRate  = totSess>0 ? totConv/totSess*100 : 0;
  const cConvRate = (cTotSess&&cTotConv&&cTotSess>0) ? cTotConv/cTotSess*100 : undefined;

  // Daily sessions chart from aggregated RPC
  const dailySess = {};
  for (const r of ga4Daily) {
    dailySess[r.date] = { s: +r.sessions||0, c: +r.conversions||0 };
  }
  const ga4Days = Object.keys(dailySess).sort();
  const maxS = Math.max(...ga4Days.map(d=>dailySess[d].s),1);

  document.getElementById('content').innerHTML = `
  <div class="kpi-grid cols-4" style="margin-bottom:20px">
    ${kpiCard('Sessões',           totSess,  cTotSess,  fN, 'c-blue')}
    ${kpiCard('Conversões',        totConv,  cTotConv,  fN, 'c-green')}
    ${kpiCard('Taxa de Conversão', convRate, cConvRate, fP, 'c-yellow')}
    ${kpiCard('Receita',           totRev,   cTotRev,   fR, 'c-brand')}
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-title">Sessões Diárias</div>
      <div style="overflow-y:auto;max-height:280px">
        ${ga4Days.length ? ga4Days.map(d=>{
          const s=dailySess[d].s;
          return `<div class="chart-day">
            <span class="chart-label">${d.slice(5)}</span>
            <div class="chart-bars">
              <div style="flex:${s};background:#58a6ff;border-radius:2px" title="${fN(s)} sessões"></div>
              <div style="flex:${maxS-s};opacity:0"></div>
            </div>
            <span class="chart-val">${fN(s)}</span>
          </div>`;
        }).join('') : '<div class="c-muted" style="text-align:center;padding:20px;font-size:13px">Sem dados</div>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Top Canais (Conversões)</div>
      ${(() => {
        const chMap = {};
        for (const r of agg) {
          if (!chMap[r.channel]) chMap[r.channel]={s:0,c:0};
          chMap[r.channel].s += r.sessions;
          chMap[r.channel].c += r.conversions;
        }
        const chs  = Object.entries(chMap).sort(([,a],[,b])=>b.c-a.c);
        const maxC = Math.max(...chs.map(([,v])=>v.c),1);
        return chs.map(([ch,v])=>`
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span class="badge bb">${ch}</span>
              <span><strong>${fN(v.c)}</strong> <span class="c-muted">conv.</span></span>
            </div>
            <div style="height:6px;background:#21262d;border-radius:3px;overflow:hidden">
              <div style="height:100%;background:#1D9E75;width:${(v.c/maxC*100).toFixed(1)}%"></div>
            </div>
          </div>`).join('') || '<div class="c-muted" style="font-size:13px;padding:20px 0;text-align:center">Sem dados</div>';
      })()}
    </div>
  </div>

  <div class="card">
    <div class="card-title">GA4 — Canal × Campanha (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Canal</th><th>Campanha</th>
        <th class="r">Sessões</th><th class="r">Conversões</th>
        <th class="r">Taxa Conv.</th><th class="r">Receita</th>
      </tr></thead>
      <tbody>${agg.length ? agg.slice(0,60).map((r,i)=>`<tr>
        <td class="c-muted">${i+1}</td>
        <td><span class="badge bb">${r.channel}</span></td>
        <td class="c-muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.campaign}</td>
        <td class="r">${fN(r.sessions)}</td>
        <td class="r"><strong>${fN(r.conversions)}</strong></td>
        <td class="r ${r.conversion_rate>2?'c-green':''}">${fP(r.conversion_rate)}</td>
        <td class="r c-brand">${fR(r.revenue)}</td>
      </tr>`).join('') : emptyRow(7)}</tbody>
    </table></div>
  </div>`;
}
