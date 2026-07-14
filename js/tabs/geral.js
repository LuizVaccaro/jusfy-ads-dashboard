async function tabGeral() {
  loading();
  const [campAgg, dailyByPlatform, ga4Channels, cmpCampAgg, cmpGA4Channels, realConvTotals, campsRaw, convDaily] = await Promise.all([
    fetchCampAgg(S.start, S.end),
    fetchCampDailyByPlatform(S.start, S.end),
    fetchGA4ChannelsAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCampAgg(S.cmpStart, S.cmpEnd)        : [],
    S.compare && S.cmpStart ? fetchGA4ChannelsAgg(S.cmpStart, S.cmpEnd) : [],
    fetchJusfyConversionsTotals(S.start, S.end),
    fetchCamps(S.start, S.end),
    fetchJusfyConversionsDailyAgg(S.start, S.end),
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
  const biAgg = agg.filter(r=>r.platform==='bing_ads');
  const cgAgg = cmpAgg.filter(r=>r.platform==='google_ads');
  const cmAgg = cmpAgg.filter(r=>r.platform==='meta');
  const cbiAgg = cmpAgg.filter(r=>r.platform==='bing_ads');

  const totalSpend  = sum(agg,'spend');
  const gSpend      = sum(gAgg,'spend');
  const mSpend      = sum(mAgg,'spend');
  const biSpend     = sum(biAgg,'spend');
  const totalSess   = sum(ga4Agg,'sessions');
  const totalClicks = sum(agg,'clicks');
  const totalImpr   = sum(agg,'impressions');
  const ctr         = totalImpr>0 ? totalClicks/totalImpr*100 : 0;

  const cSpend  = cmpAgg.length    ? sum(cmpAgg,'spend')          : undefined;
  const cgSpend = cgAgg.length     ? sum(cgAgg,'spend')           : undefined;
  const cmSpend = cmAgg.length     ? sum(cmAgg,'spend')           : undefined;
  const cbiSpend = cbiAgg.length   ? sum(cbiAgg,'spend')          : undefined;
  const cSess   = cmpGA4Agg.length ? sum(cmpGA4Agg,'sessions')    : undefined;

  // Daily spend chart — by platform + linha de cadastros reais (Chart.js)
  const dailyMap = {};
  for (const r of dailyByPlatform) {
    if (!dailyMap[r.date]) dailyMap[r.date]={g:0,m:0,bi:0};
    if (r.platform==='google_ads') dailyMap[r.date].g  += +r.spend||0;
    if (r.platform==='meta')       dailyMap[r.date].m  += +r.spend||0;
    if (r.platform==='bing_ads')   dailyMap[r.date].bi += +r.spend||0;
  }
  const convByDate = {};
  for (const r of convDaily) convByDate[r.date] = (convByDate[r.date]||0) + (+r.clientes_unicos||0);

  const days = Object.keys(dailyMap).sort();
  const diffDays = (new Date(S.end)-new Date(S.start))/864e5;

  let chartLabels, chartG, chartM, chartBi, chartConv, chartTotalSpend;
  if (diffDays <= 45) {
    chartLabels = days.map(d => d.slice(5).split('-').reverse().join('/'));
    chartG    = days.map(d => dailyMap[d].g);
    chartM    = days.map(d => dailyMap[d].m);
    chartBi   = days.map(d => dailyMap[d].bi);
    chartConv = days.map(d => convByDate[d] || 0);
  } else {
    const mMap = {};
    for (const d of days) {
      const mon = d.slice(0,7);
      if (!mMap[mon]) mMap[mon] = {g:0,m:0,bi:0,conv:0};
      mMap[mon].g    += dailyMap[d].g;
      mMap[mon].m    += dailyMap[d].m;
      mMap[mon].bi   += dailyMap[d].bi;
      mMap[mon].conv += (convByDate[d] || 0);
    }
    const months = Object.keys(mMap).sort();
    chartLabels = months.map(mon => new Date(mon+'-15').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}));
    chartG    = months.map(mon => mMap[mon].g);
    chartM    = months.map(mon => mMap[mon].m);
    chartBi   = months.map(mon => mMap[mon].bi);
    chartConv = months.map(mon => mMap[mon].conv);
  }
  chartTotalSpend = chartG.map((g,i) => g + chartM[i] + chartBi[i]);
  const chartCac = chartTotalSpend.map((s,i) => chartConv[i] > 0 ? s / chartConv[i] : null);

  function renderGeralChart() {
    renderComboChart('geralChart', chartLabels, [
      { label:'Google Ads', data:chartG,  backgroundColor:'#01563F' },
      { label:'Meta Ads',   data:chartM,  backgroundColor:'#02A378' },
      { label:'Bing Ads',   data:chartBi, backgroundColor:'#41C78F' },
    ], [
      { label:'Cadastros Reais', data:chartConv, borderColor:'#212121', yAxisID:'y1' },
      { label:'CAC', data:chartCac, borderColor:'#e05a69', yAxisID:'y', borderDash:[5,3] },
    ]);
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
    ${kpiCard('Bing Ads',           biSpend,     cbiSpend, fR, 'c-green')}
  </div>
  <div class="kpi-grid cols-4" style="margin-bottom:20px">
    ${kpiCard('Sessões (GA4)',    totalSess, cSess, fN, 'c-green')}
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
        <tr style="border-top:1px solid #E7E8EC">
          <td><strong>Total</strong></td>
          <td class="r c-blue"><strong>${fN(realTotal)}</strong></td>
          <td class="r c-muted">100%</td>
        </tr>
      </tbody>
    </table></div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Investimento Diário por Plataforma × Cadastros Reais</div>
    <div style="height:320px;position:relative">
      ${days.length===0 ? '<div class="c-muted" style="text-align:center;padding:40px;font-size:13px">Sem dados</div>' : '<canvas id="geralChart"></canvas>'}
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
      <div class="card-title">Distribuição por Plataforma</div>
      ${[
        {label:'Google Ads', val:gSpend,  pct:totalSpend>0?gSpend/totalSpend:0,  bg:'#01563F'},
        {label:'Meta Ads',   val:mSpend,  pct:totalSpend>0?mSpend/totalSpend:0,  bg:'#02A378'},
        {label:'Bing Ads',   val:biSpend, pct:totalSpend>0?biSpend/totalSpend:0, bg:'#41C78F'},
      ].map(x=>`
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span class="badge" style="background:${x.bg}22;color:${x.bg};border:1px solid ${x.bg}44">${x.label}</span>
            <strong style="color:#212121">${fR(x.val)}</strong>
          </div>
          <div style="height:8px;background:#FAFAFA;border-radius:4px;overflow:hidden;margin-bottom:3px">
            <div style="height:100%;background:${x.bg};border-radius:4px;width:${(x.pct*100).toFixed(1)}%;transition:width .4s"></div>
          </div>
          <div style="font-size:11px;color:#212121BF;text-align:right">${(x.pct*100).toFixed(1)}% do total</div>
        </div>`).join('')}
      <div style="border-top:1px solid #E7E8EC;padding-top:12px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span class="c-muted">Total de dias</span><strong>${days.length}</strong>
        </div>
      </div>
  </div>

  `;

  renderGeralChart();
}
