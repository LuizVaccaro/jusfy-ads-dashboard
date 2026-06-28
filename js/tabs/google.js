async function tabGoogle() {
  loading();
  const [camps, cmpCamps] = await Promise.all([
    fetchCamps(S.start, S.end),
    S.compare && S.cmpStart ? fetchCamps(S.cmpStart, S.cmpEnd) : [],
  ]);

  const agg    = aggCamps(camps.filter(r=>r.platform==='google_ads')).sort((a,b)=>b.spend-a.spend);
  const cmpAgg = cmpCamps.length ? aggCamps(cmpCamps.filter(r=>r.platform==='google_ads')) : [];
  const cmpMap = Object.fromEntries(cmpAgg.map(r=>[r.campaign_name,r]));

  const totSpend = sum(agg,'spend'), totClicks=sum(agg,'clicks'), totConv=sum(agg,'conversions'), totImpr=sum(agg,'impressions');
  const cTotSpend = cmpAgg.length ? sum(cmpAgg,'spend')       : undefined;
  const cTotClick = cmpAgg.length ? sum(cmpAgg,'clicks')      : undefined;
  const cTotConv  = cmpAgg.length ? sum(cmpAgg,'conversions') : undefined;

  document.getElementById('content').innerHTML = `
  <div class="kpi-grid cols-4" style="margin-bottom:20px">
    ${kpiCard('Investimento', totSpend,  cTotSpend, fR, 'c-blue')}
    ${kpiCard('Cliques',      totClicks, cTotClick, fN, 'c-green')}
    ${kpiCard('Conversões',   totConv,   cTotConv,  fN, 'c-yellow')}
    ${kpiCard('CPA Médio', totConv>0?totSpend/totConv:null, (cTotConv&&cTotSpend&&cTotConv>0)?cTotSpend/cTotConv:undefined, fR, 'c-brand', true)}
  </div>
  <div class="card">
    <div class="card-title">Google Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Campanha</th><th class="r">Gasto</th>
        <th class="r">Cliques</th><th class="r">Impressões</th>
        <th class="r">CTR</th><th class="r">Conv.</th><th class="r">CPA</th>
        ${S.compare&&cmpAgg.length?'<th class="r">Δ Gasto</th>':''}
      </tr></thead>
      <tbody>${agg.length ? agg.map((r,i)=>{
        const cmp    = cmpMap[r.campaign_name];
        const cpaCls = r.cpa==null?'c-muted':r.cpa<100?'c-green':r.cpa<200?'c-yellow':'c-red';
        return `<tr>
          <td class="c-muted">${i+1}</td>
          <td><strong>${r.campaign_name}</strong></td>
          <td class="r c-brand">${fR(r.spend)}</td>
          <td class="r">${fN(r.clicks)}</td>
          <td class="r c-muted">${fN(r.impressions)}</td>
          <td class="r">${fP(r.ctr)}</td>
          <td class="r">${fN(r.conversions)}</td>
          <td class="r ${cpaCls}">${r.cpa?fR(r.cpa):'—'}</td>
          ${S.compare&&cmpAgg.length?`<td class="r">${cmp?deltaHtml(r.spend,cmp.spend):'<span class="d-neu">novo</span>'}</td>`:''}
        </tr>`;
      }).join('') : emptyRow(S.compare&&cmpAgg.length?9:8)}</tbody>
    </table></div>
  </div>`;
}
