// Regra: GA4 → apenas sessões | conversões + spend → plataformas (campaign_daily)
async function tabDiario() {
  loading();
  const [camps, ga4, cmpCamps, cmpGA4] = await Promise.all([
    fetchCamps(S.start, S.end),
    fetchGA4(S.start, S.end),
    S.compare && S.cmpStart ? fetchCamps(S.cmpStart, S.cmpEnd) : [],
    S.compare && S.cmpStart ? fetchGA4(S.cmpStart, S.cmpEnd)   : [],
  ]);

  function spendByDate(rows) {
    const m = {};
    for (const r of rows) { if (!m[r.date]) m[r.date]=0; m[r.date] += +r.spend||0; }
    return m;
  }
  function convByDate(rows) {
    const m = {};
    for (const r of rows) { if (!m[r.date]) m[r.date]=0; m[r.date] += +r.conversions||0; }
    return m;
  }
  function sessionsByDate(rows) {
    const m = {};
    for (const r of rows) { if (!m[r.date]) m[r.date]=0; m[r.date] += +r.sessions||0; }
    return m;
  }

  const spendMap    = spendByDate(camps);
  const convMap     = convByDate(camps);
  const ga4Map      = sessionsByDate(ga4);
  const cmpSpendMap = spendByDate(cmpCamps);
  const cmpConvMap  = convByDate(cmpCamps);
  const cmpGa4Map   = sessionsByDate(cmpGA4);

  const dates = [...new Set([...Object.keys(spendMap), ...Object.keys(ga4Map)])].sort().reverse();

  const totSpend = Object.values(spendMap).reduce((s,v)=>s+v, 0);
  const totSess  = Object.values(ga4Map).reduce((s,v)=>s+v, 0);
  const totConv  = Object.values(convMap).reduce((s,v)=>s+v, 0);
  const totCAC   = totConv > 0 ? totSpend / totConv : null;
  const totTX    = totSess > 0 ? totConv / totSess * 100 : 0;

  const cTotSpend = cmpCamps.length ? Object.values(cmpSpendMap).reduce((s,v)=>s+v, 0) : undefined;
  const cTotSess  = cmpGA4.length   ? Object.values(cmpGa4Map).reduce((s,v)=>s+v, 0)   : undefined;
  const cTotConv  = cmpCamps.length ? Object.values(cmpConvMap).reduce((s,v)=>s+v, 0)  : undefined;
  const cTotCAC   = (cTotConv && cTotSpend && cTotConv > 0) ? cTotSpend / cTotConv : undefined;

  const rows = dates.map(d => {
    const spend       = spendMap[d] || 0;
    const sessions    = ga4Map[d]   || 0;
    const conversions = convMap[d]  || 0;
    const cac = conversions > 0 ? spend / conversions : null;
    const tx  = sessions > 0 ? conversions / sessions * 100 : 0;

    let cmpRow = null;
    if (S.compare && S.cmpStart) {
      const diffDays = Math.round((new Date(d) - new Date(S.start)) / 864e5);
      const cd  = fmt(addDays(new Date(S.cmpStart), diffDays));
      const cs  = cmpSpendMap[cd] || 0;
      const ccs = cmpGa4Map[cd]   || 0;
      const ccv = cmpConvMap[cd]  || 0;
      cmpRow = { spend: cs, sessions: ccs, conversions: ccv, cac: ccv > 0 ? cs / ccv : null };
    }

    return { date: d, spend, sessions, conversions, cac, tx, cmpRow };
  });

  const hasCmp = S.compare && cmpCamps.length > 0;

  document.getElementById('content').innerHTML = `
  <div class="kpi-grid cols-5" style="margin-bottom:20px">
    ${kpiCard('Investimento Total', totSpend, cTotSpend, fR, 'c-brand')}
    ${kpiCard('Sessões (GA4)',      totSess,  cTotSess,  fN, 'c-green')}
    ${kpiCard('Cadastros',          totConv,  cTotConv,  fN, 'c-blue')}
    ${kpiCard('TX. Conversão',      totTX,    undefined, fP, 'c-muted')}
    ${kpiCard('CAC Real',           totCAC,   cTotCAC,   fR, 'c-brand', true)}
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:14px">
      Performance Diária — ${disp(S.start)} → ${disp(S.end)}
      <span style="font-size:11px;font-weight:400;color:#8b949e">${dates.length} dias</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Data</th>
        <th class="r">Sessões</th>
        <th class="r">Cadastros</th>
        <th class="r">TX. Conversão</th>
        <th class="r" style="color:#1D9E75">CAC Real</th>
        <th class="r">Investimento</th>
        ${hasCmp ? '<th class="r">Δ CAC</th><th class="r">Δ Invest.</th>' : ''}
      </tr></thead>
      <tbody>
        ${rows.length ? rows.map(r => {
          const cacCls = r.cac !== null && r.cac < 300 ? 'c-brand' : r.cac !== null && r.cac < 600 ? 'c-yellow' : 'c-red';
          const txCls  = r.tx > 0.5 ? 'c-green' : r.tx > 0.2 ? '' : 'c-muted';
          const noData = r.spend === 0 && r.sessions === 0;
          return `<tr style="${noData ? 'opacity:.45' : ''}">
            <td><strong>${disp(r.date)}</strong></td>
            <td class="r">${fN(r.sessions)}</td>
            <td class="r"><strong>${fN(r.conversions)}</strong></td>
            <td class="r ${txCls}">${fP(r.tx)}</td>
            <td class="r"><strong class="${cacCls}">${r.cac !== null ? fR(r.cac) : '—'}</strong></td>
            <td class="r">${fR(r.spend)}</td>
            ${hasCmp && r.cmpRow ? `
              <td class="r">${r.cmpRow.cac !== null ? deltaHtml(r.cac, r.cmpRow.cac, true) || fR(r.cmpRow.cac) : '—'}</td>
              <td class="r">${deltaHtml(r.spend, r.cmpRow.spend) || fR(r.cmpRow.spend)}</td>
            ` : hasCmp ? '<td class="r c-muted">—</td><td class="r c-muted">—</td>' : ''}
          </tr>`;
        }).join('') : emptyRow(hasCmp ? 8 : 6)}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #30363d;background:#161b22">
          <td><strong>Total</strong></td>
          <td class="r"><strong>${fN(totSess)}</strong></td>
          <td class="r"><strong>${fN(totConv)}</strong></td>
          <td class="r"><strong>${fP(totTX)}</strong></td>
          <td class="r"><strong class="c-brand">${totCAC !== null ? fR(totCAC) : '—'}</strong></td>
          <td class="r"><strong class="c-brand">${fR(totSpend)}</strong></td>
          ${hasCmp ? '<td></td><td></td>' : ''}
        </tr>
      </tfoot>
    </table></div>
  </div>`;
}
