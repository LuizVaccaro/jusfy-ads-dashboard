async function tabGeral() {
  loading();
  const [campAgg, dailyByPlatform, ga4Channels, cmpCampAgg, cmpGA4Channels, realConvTotals, campsRaw] = await Promise.all([
    fetchCampAgg(S.start, S.end),
    fetchCampDailyByPlatform(S.start, S.end),
    fetchGA4ChannelsAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCampAgg(S.cmpStart, S.cmpEnd)        : [],
    S.compare && S.cmpStart ? fetchGA4ChannelsAgg(S.cmpStart, S.cmpEnd) : [],
    fetchJusfyConversionsTotals(S.start, S.end),
    fetchCamps(S.start, S.end),
  ]);

  // Lookup por nome/campaign_id, pra reclassificar conversões cujo referral no Metabase veio errado
  // (Affiliate/Others) mas o utm_campaign é claramente de uma campanha paga real.
  const campaignLookup = buildCampaignLookup(campsRaw);
  const realByChannel = aggregateRealConversionsByChannel(realConvTotals, campaignLookup);
  const realTotal = Object.values(realByChannel).reduce((s,v)=>s+v.clientes_unicos, 0);
  const channelOrder = ['Google Ads','Meta Ads','Bing Ads','Orgânico','Social','Comunidade','CRM','ChatGPT','Outros'];

  const addMetrics = rows => rows.map(r => ({...r,
    ctr: r.impressions>0 ? r.clicks/r.impressions*100 : 0,
    cpa: r.conversions>0 ? r.spend/r.conversions : null
  }));

  const agg       = addMetrics(campAgg);
  const cmpAgg    = cmpCampAgg.length ? addMetrics(cmpCampAgg) : [];
  const ga4Agg    = ga4Channels;
  const cmpGA4Agg = cmpGA4Channels.length ? cmpGA4Channels : [];

  const gAgg  = agg.filter(r=>r.platform==='google_ads');
  const mAgg  = agg.filter(r=>r.platform==='meta');
  const cgAgg = cmpAgg.filter(r=>r.platform==='google_ads');
  const cmAgg = cmpAgg.filter(r=>r.platform==='meta');

  const totalSpend  = sum(agg,'spend');
  const gSpend      = sum(gAgg,'spend');
  const mSpend      = sum(mAgg,'spend');
  const totalSess   = sum(ga4Agg,'sessions');
  const totalClicks = sum(agg,'clicks');
  const totalImpr   = sum(agg,'impressions');
  const ctr         = totalImpr>0 ? totalClicks/totalImpr*100 : 0;

  const cSpend  = cmpAgg.length    ? sum(cmpAgg,'spend')          : undefined;
  const cgSpend = cgAgg.length     ? sum(cgAgg,'spend')           : undefined;
  const cmSpend = cmAgg.length     ? sum(cmAgg,'spend')           : undefined;
  const cSess   = cmpGA4Agg.length ? sum(cmpGA4Agg,'sessions')    : undefined;

  // Daily spend chart — by platform
  const dailyMap = {};
  for (const r of dailyByPlatform) {
    if (!dailyMap[r.date]) dailyMap[r.date]={g:0,m:0};
    if (r.platform==='google_ads') dailyMap[r.date].g += +r.spend||0;
    if (r.platform==='meta')       dailyMap[r.date].m += +r.spend||0;
  }
  const days  = Object.keys(dailyMap).sort();
  const maxD  = Math.max(...days.map(d=>dailyMap[d].g+dailyMap[d].m),1);
  const diffDays = (new Date(S.end)-new Date(S.start))/864e5;

  let chartHtml = '';
  if (days.length===0) {
    chartHtml = '<div class="c-muted" style="text-align:center;padding:20px;font-size:13px">Sem dados</div>';
  } else if (diffDays<=45) {
    chartHtml = days.map(d=>{
      const g=dailyMap[d].g, m=dailyMap[d].m, tot=g+m;
      return `<div class="chart-day">
        <span class="chart-label">${d.slice(5)}</span>
        <div class="chart-bars">
          ${g>0?`<div style="flex:${g};background:#58a6ff;border-radius:2px 0 0 2px" title="Google: ${fR(g)}"></div>`:''}
          ${m>0?`<div style="flex:${m};background:#d29922;${g===0?'border-radius:2px':'border-radius:0 2px 2px 0'}" title="Meta: ${fR(m)}"></div>`:''}
          <div style="flex:${maxD-tot};opacity:0"></div>
        </div>
        <span class="chart-val">${fR(tot)}</span>
      </div>`;
    }).join('');
  } else {
    const mMap = {};
    for (const d of days) {
      const mon = d.slice(0,7);
      if (!mMap[mon]) mMap[mon]={g:0,m:0};
      mMap[mon].g += dailyMap[d].g;
      mMap[mon].m += dailyMap[d].m;
    }
    const maxM = Math.max(...Object.values(mMap).map(x=>x.g+x.m),1);
    chartHtml = Object.entries(mMap).sort(([a],[b])=>a<b?-1:1).map(([mon,v])=>{
      const tot=v.g+v.m;
      const label=new Date(mon+'-15').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
      return `<div class="chart-day">
        <span class="chart-label">${label}</span>
        <div class="chart-bars">
          ${v.g>0?`<div style="flex:${v.g};background:#58a6ff;border-radius:2px 0 0 2px" title="Google: ${fR(v.g)}"></div>`:''}
          ${v.m>0?`<div style="flex:${v.m};background:#d29922;${v.g===0?'border-radius:2px':'border-radius:0 2px 2px 0'}" title="Meta: ${fR(v.m)}"></div>`:''}
          <div style="flex:${maxM-tot};opacity:0"></div>
        </div>
        <span class="chart-val">${fR(tot)}</span>
      </div>`;
    }).join('');
  }

  // Sessões por origem (UTM source)
  const srcMap = {};
  for (const r of ga4Agg) {
    if (!srcMap[r.source]) srcMap[r.source]=0;
    srcMap[r.source] += r.sessions;
  }
  const sources = Object.entries(srcMap).sort(([,a],[,b])=>b-a);

  document.getElementById('content').innerHTML = `
  <div class="kpi-grid cols-4" style="margin-bottom:20px">
    ${kpiCard('Investimento Total', totalSpend,  cSpend,  fR, 'c-brand')}
    ${kpiCard('Google Ads',         gSpend,      cgSpend, fR, 'c-blue')}
    ${kpiCard('Meta Ads',           mSpend,      cmSpend, fR, 'c-yellow')}
    ${kpiCard('Sessões (GA4)',       totalSess,   cSess,   fN, 'c-green')}
  </div>
  <div class="kpi-grid cols-3" style="margin-bottom:20px">
    ${kpiCard('CTR Médio',        ctr,      undefined,  fP, 'c-muted')}
    ${kpiCard('Campanhas Ativas', new Set(agg.map(r=>r.campaign_name)).size, undefined, fN, 'c-muted')}
    ${kpiCard('Conversões Totais (Metabase)', realTotal, undefined, fN, 'c-blue')}
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Conversões Reais por Canal (Metabase)</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Canal</th><th class="r">Clientes Únicos</th><th class="r">% do Total</th></tr></thead>
      <tbody>
        ${channelOrder.map(ch => {
          const v = realByChannel[ch] || { clientes_unicos: 0 };
          const pct = realTotal>0 ? v.clientes_unicos/realTotal*100 : 0;
          return `<tr>
            <td><strong>${ch}</strong></td>
            <td class="r c-blue">${fN(v.clientes_unicos)}</td>
            <td class="r c-muted">${fP(pct)}</td>
          </tr>`;
        }).join('')}
        <tr style="border-top:1px solid #30363d">
          <td><strong>Total</strong></td>
          <td class="r c-blue"><strong>${fN(realTotal)}</strong></td>
          <td class="r c-muted">100%</td>
        </tr>
      </tbody>
    </table></div>
  </div>

  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-title">
        Spend Diário por Plataforma
        <div style="display:flex;gap:10px;font-size:11px;font-weight:400">
          <span><span style="display:inline-block;width:10px;height:10px;background:#58a6ff;border-radius:2px;margin-right:3px;vertical-align:middle"></span>Google</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#d29922;border-radius:2px;margin-right:3px;vertical-align:middle"></span>Meta</span>
        </div>
      </div>
      <div style="overflow-y:auto;max-height:320px">${chartHtml}</div>
    </div>
    <div class="card">
      <div class="card-title">Distribuição por Plataforma</div>
      ${[
        {label:'Google Ads', badge:'bb', val:gSpend, cls:'c-blue',   pct:totalSpend>0?gSpend/totalSpend:0, bg:'#58a6ff'},
        {label:'Meta Ads',   badge:'by', val:mSpend, cls:'c-yellow', pct:totalSpend>0?mSpend/totalSpend:0, bg:'#d29922'},
      ].map(x=>`
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span class="badge ${x.badge}">${x.label}</span>
            <strong class="${x.cls}">${fR(x.val)}</strong>
          </div>
          <div style="height:8px;background:#21262d;border-radius:4px;overflow:hidden;margin-bottom:3px">
            <div style="height:100%;background:${x.bg};border-radius:4px;width:${(x.pct*100).toFixed(1)}%;transition:width .4s"></div>
          </div>
          <div style="font-size:11px;color:#8b949e;text-align:right">${(x.pct*100).toFixed(1)}% do total</div>
        </div>`).join('')}
      <div style="border-top:1px solid #30363d;padding-top:12px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span class="c-muted">Total de dias</span><strong>${days.length}</strong>
        </div>
      </div>
    </div>
  </div>

  `;
}
