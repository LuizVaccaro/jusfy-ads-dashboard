// Aba Jusfy México (JusGPT) — funil cadastro → trial → pagante.
// Fontes: mx_conversions_daily (cadastros/pending_checkout/pagos, sem PII, do BigQuery via Metabase,
// manual — ver tarefa agendada jusfy-metabase-conversions-daily-update) e mx_campaign_daily (spend
// Google Ads MX, sincronizado automaticamente 2x/dia). Sem UTM/campanha nos cadastros: não dá pra
// atribuir cadastro a campanha específica, só o total do país. Ver Notion: Plano — Dashboard de Ads
// (MVP), Sessão 12.
let _mxData = null;

// mx_conversions_daily grão: "situação ATUAL dos cadastros feitos naquele dia" — pending_checkout/
// pagos de um dia já sincronizado podem mudar entre uma atualização e outra (não é bug).
function buildMxChartSeries(rows) {
  const sorted = [...rows].sort((a, b) => a.date < b.date ? -1 : 1);
  const mk = (getSpend, getCadastros, getPagos) => sorted.length <= 45
    ? {
        labels: sorted.map(r => r.date.slice(5).split('-').reverse().join('/')),
        spend: sorted.map(getSpend), cadastros: sorted.map(getCadastros), pagos: sorted.map(getPagos),
      }
    : (() => {
        const mMap = {};
        for (const r of sorted) {
          const mon = r.date.slice(0, 7);
          if (!mMap[mon]) mMap[mon] = { spend: 0, cadastros: 0, pagos: 0 };
          mMap[mon].spend     += getSpend(r);
          mMap[mon].cadastros += getCadastros(r);
          mMap[mon].pagos     += getPagos(r);
        }
        const months = Object.keys(mMap).sort();
        return {
          labels: months.map(mon => new Date(mon + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })),
          spend: months.map(m => mMap[m].spend), cadastros: months.map(m => mMap[m].cadastros), pagos: months.map(m => mMap[m].pagos),
        };
      })();
  return mk(r => r.spend, r => r.cadastros, r => r.pagos);
}

function renderMxChart() {
  const series = buildMxChartSeries(_mxData.rows);
  renderComboChart('mxChart', series.labels,
    [{ label: 'Investimento (Google Ads MX)', data: series.spend, backgroundColor: '#017858' }],
    [
      { label: 'Cadastros', data: series.cadastros, borderColor: '#212121', yAxisID: 'y1' },
      { label: 'Pagantes', data: series.pagos, borderColor: '#41C78F', yAxisID: 'y1' },
    ]);
}

function renderMxCampaignsTable() {
  const { campAgg } = _mxData;
  const st = getSort('mx-campaigns', 'spend', 'desc');
  const sorted = sortRows(campAgg, st.key, st.dir);

  document.getElementById('mx-camp-tbody').innerHTML = sorted.length ? sorted.map((r, i) => `
    <tr>
      <td class="c-muted">${i + 1}</td>
      <td><strong>${escHtml(r.campaign_name || r.campaign_id)}</strong></td>
      <td class="r c-brand">${fR(r.spend)}</td>
      <td class="r c-muted">${fN(r.impressions)}</td>
      <td class="r">${fN(r.clicks)}</td>
      <td class="r">${fP(r.ctr)}</td>
    </tr>`).join('') : emptyRow(6);
}

function renderMxBody() {
  if (!_mxData) return;
  const { rows, cmpRows, campAgg } = _mxData;

  const totCadastros = sum(rows, 'cadastros');
  const totTrial      = sum(rows, 'pending_checkout');
  const totPagos       = sum(rows, 'pagos');
  const totSpend        = sum(rows, 'spend');
  const txConv           = totCadastros > 0 ? totPagos / totCadastros * 100 : 0;
  const cac                = totPagos > 0 ? totSpend / totPagos : null;
  const cpl                 = totCadastros > 0 ? totSpend / totCadastros : null;

  const hasCmp = S.compare && cmpRows && cmpRows.length > 0;
  const cTotCadastros = hasCmp ? sum(cmpRows, 'cadastros') : undefined;
  const cTotTrial      = hasCmp ? sum(cmpRows, 'pending_checkout') : undefined;
  const cTotPagos       = hasCmp ? sum(cmpRows, 'pagos') : undefined;
  const cTotSpend        = hasCmp ? sum(cmpRows, 'spend') : undefined;
  const cCac                = hasCmp && cTotPagos > 0 ? cTotSpend / cTotPagos : undefined;
  const cCpl                 = hasCmp && cTotCadastros > 0 ? cTotSpend / cTotCadastros : undefined;

  const st = getSort('mx-daily', 'date', 'desc');
  const sorted = sortRows(rows, st.key, st.dir);

  document.getElementById('content').innerHTML = `
  <div style="background:#e6f7f2;border:1px solid #02A37844;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#017858">
    ⚠️ Cadastros/Trial/Pagantes vêm do BigQuery via rotina manual (Metabase) — não é sincronizado automaticamente.
    Status é sempre a situação <strong>atual</strong> das assinaturas, não a do dia do cadastro. Ainda não há atribuição por campanha (só total do país).
  </div>

  <div class="kpi-grid cols-4" style="margin-bottom:12px">
    ${kpiCard('Investimento (Google Ads MX)', totSpend, cTotSpend, fR, 'c-brand')}
    ${kpiCard('Cadastros', totCadastros, cTotCadastros, fN, 'c-blue')}
    ${kpiCard('Em Trial (Pendente)', totTrial, cTotTrial, fN, 'c-yellow')}
    ${kpiCard('Pagantes', totPagos, cTotPagos, fN, 'c-green')}
  </div>
  <div class="kpi-grid cols-3" style="margin-bottom:20px">
    ${kpiCard('Tx. Conversão (Cadastro → Pago)', txConv, undefined, fP, 'c-muted')}
    ${kpiCard('CPL (Custo por Cadastro)', cpl, cCpl, fR, 'c-blue', true)}
    ${kpiCard('CAC Real (Custo por Pagante)', cac, cCac, fR, 'c-brand', true)}
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Investimento × Cadastros × Pagantes</div>
    <div style="height:300px;position:relative">
      ${rows.length === 0 ? '<div class="c-muted" style="text-align:center;padding:40px;font-size:13px">Sem dados</div>' : '<canvas id="mxChart"></canvas>'}
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-title" style="margin-bottom:14px">
      Performance Diária — ${disp(S.start)} → ${disp(S.end)}
      <span style="font-size:11px;font-weight:400;color:#212121BF">${rows.length} dias</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        ${sortTh('mx-daily', 'Data', 'date', 'desc', '')}
        ${sortTh('mx-daily', 'Investimento', 'spend')}
        ${sortTh('mx-daily', 'Cadastros', 'cadastros')}
        ${sortTh('mx-daily', 'Em Trial', 'pending_checkout')}
        ${sortTh('mx-daily', 'Pagantes', 'pagos')}
        ${sortTh('mx-daily', 'CAC', 'cac')}
      </tr></thead>
      <tbody>
        ${sorted.length ? sorted.map(r => `
          <tr>
            <td><strong>${disp(r.date)}</strong></td>
            <td class="r">${fR(r.spend)}</td>
            <td class="r">${fN(r.cadastros)}</td>
            <td class="r c-yellow">${fN(r.pending_checkout)}</td>
            <td class="r c-green">${fN(r.pagos)}</td>
            <td class="r">${r.cac != null ? fR(r.cac) : '—'}</td>
          </tr>`).join('') : emptyRow(6)}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #E7E8EC;background:#ffffff">
          <td><strong>Total</strong></td>
          <td class="r"><strong class="c-brand">${fR(totSpend)}</strong></td>
          <td class="r"><strong>${fN(totCadastros)}</strong></td>
          <td class="r"><strong class="c-yellow">${fN(totTrial)}</strong></td>
          <td class="r"><strong class="c-green">${fN(totPagos)}</strong></td>
          <td class="r"><strong class="c-brand">${cac != null ? fR(cac) : '—'}</strong></td>
        </tr>
      </tfoot>
    </table></div>
  </div>

  <div class="card">
    <div class="card-title">Google Ads México — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Campanha</th>
        ${sortTh('mx-campaigns', 'Gasto', 'spend')}
        ${sortTh('mx-campaigns', 'Impressões', 'impressions')}
        ${sortTh('mx-campaigns', 'Cliques', 'clicks')}
        ${sortTh('mx-campaigns', 'CTR', 'ctr')}
      </tr></thead>
      <tbody id="mx-camp-tbody"></tbody>
    </table></div>
  </div>`;

  renderMxCampaignsTable();
  if (rows.length) renderMxChart();
}

function buildMxRows(convDaily, campsRaw) {
  const spendByDate = {};
  for (const r of campsRaw) spendByDate[r.date] = (spendByDate[r.date] || 0) + (+r.spend || 0);

  const convMap = Object.fromEntries(convDaily.map(r => [r.date, r]));
  const dates = [...new Set([...Object.keys(spendByDate), ...Object.keys(convMap)])].sort();
  return dates.map(d => {
    const c = convMap[d] || { cadastros: 0, pending_checkout: 0, pagos: 0 };
    const spend = spendByDate[d] || 0;
    return {
      date: d, spend,
      cadastros: +c.cadastros || 0,
      pending_checkout: +c.pending_checkout || 0,
      pagos: +c.pagos || 0,
      cac: (+c.pagos || 0) > 0 ? spend / (+c.pagos) : null,
    };
  });
}

async function tabMexico() {
  loading();
  const [convDaily, campsRaw, cmpConvDaily, cmpCampsRaw] = await Promise.all([
    fetchMxConversionsDaily(S.start, S.end),
    fetchMxCampaignDaily(S.start, S.end),
    S.compare && S.cmpStart ? fetchMxConversionsDaily(S.cmpStart, S.cmpEnd) : [],
    S.compare && S.cmpStart ? fetchMxCampaignDaily(S.cmpStart, S.cmpEnd) : [],
  ]);

  const rows    = buildMxRows(convDaily, campsRaw);
  const cmpRows = buildMxRows(cmpConvDaily, cmpCampsRaw);

  const campMap = {};
  for (const r of campsRaw) {
    const key = r.campaign_id || r.campaign_name;
    if (!campMap[key]) campMap[key] = { campaign_id: r.campaign_id, campaign_name: r.campaign_name, spend: 0, clicks: 0, impressions: 0 };
    campMap[key].spend += +r.spend || 0;
    campMap[key].clicks += +r.clicks || 0;
    campMap[key].impressions += +r.impressions || 0;
  }
  const campAgg = Object.values(campMap).map(r => ({ ...r, ctr: r.impressions > 0 ? r.clicks / r.impressions * 100 : 0 }));

  _mxData = { rows, cmpRows, campAgg };
  registerSortRenderer('mx-daily', renderMxBody);
  registerSortRenderer('mx-campaigns', renderMxCampaignsTable);
  renderMxBody();
}
