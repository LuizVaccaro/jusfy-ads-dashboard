// ── Busca Orgânica (Google Search Console) — volume de marca ──
// Dados via gsc_queries_daily (Supabase), sincronizados por sync-search-console (Edge Function).
// Classificação marca/não-marca é feita no banco (is_gsc_brand_query), não no cliente.

let _seoData = null;

const _seoChart = { instance: null };

function seoBuildChartSeries(daily) {
  const days = daily.map(d => d.date).sort();
  const diffDays = days.length ? (new Date(days[days.length-1]) - new Date(days[0])) / 864e5 : 0;
  const byDate = Object.fromEntries(daily.map(d => [d.date, d]));

  const label = d => diffDays <= 45
    ? d.slice(5).split('-').reverse().join('/')
    : new Date(d+'-15'.slice(0,0)+d.slice(7)).toLocaleDateString('pt-BR',{month:'short'});

  return {
    labels: days.map(d => d.slice(5).split('-').reverse().join('/')),
    brand: days.map(d => +byDate[d]?.brand_clicks || 0),
    other: days.map(d => +byDate[d]?.other_clicks || 0),
  };
}

function seoRenderChart(canvasId, series) {
  const canvas = document.getElementById(canvasId);
  if (_seoChart.instance) { _seoChart.instance.destroy(); _seoChart.instance = null; }
  if (!canvas || !series.labels.length) return;

  _seoChart.instance = new Chart(canvas.getContext('2d'), {
    data: {
      labels: series.labels,
      datasets: [
        { type:'bar', label:'Cliques de Marca', data:series.brand, backgroundColor:'#02A378', stack:'clicks', borderRadius:4, borderWidth:0 },
        { type:'bar', label:'Cliques Não-Marca', data:series.other, backgroundColor:'#CECED2', stack:'clicks', borderRadius:4, borderWidth:0 },
      ],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      scales:{
        x:{ stacked:true, grid:{display:false}, ticks:{color:'#212121BF', font:{size:10}} },
        y:{ stacked:true, grid:{color:'#FAFAFA'}, ticks:{color:'#212121BF', font:{size:10}, callback:v=>fAxisCompact(v)} },
      },
      plugins:{
        legend:{display:true, position:'top', align:'end', labels:{color:'#212121', boxWidth:10, usePointStyle:true, font:{size:11}}},
        tooltip:{
          backgroundColor:'#212121', titleColor:'#fff', bodyColor:'#fff', padding:10, cornerRadius:8,
          callbacks:{ label: ctx => `${ctx.dataset.label}: ${fN(ctx.parsed.y)}` },
        },
      },
    },
  });
}

const fPos = n => n!=null&&!isNaN(n) ? Number(n).toFixed(2) : '—';

function seoRenderTable() {
  if (!_seoData) return;
  const { queries } = _seoData;
  const st = getSort('seo-queries', 'clicks', 'desc');
  const sorted = sortRows(queries, st.key, st.dir);

  document.getElementById('seo-thead').innerHTML =
    `<th>#</th>${sortTh('seo-queries','Query','query','asc','')}
     ${sortTh('seo-queries','Cliques','clicks')}
     ${sortTh('seo-queries','Impressões','impressions')}
     ${sortTh('seo-queries','CTR','ctr')}
     ${sortTh('seo-queries','Posição','avg_position','asc')}`;

  document.getElementById('seo-tbody').innerHTML = sorted.length ? sorted.map((r,i) => `
    <tr>
      <td class="c-muted">${i+1}</td>
      <td><strong>${escHtml(r.query)}</strong></td>
      <td class="r c-brand">${fN(r.clicks)}</td>
      <td class="r c-muted">${fN(r.impressions)}</td>
      <td class="r">${fP(r.ctr)}</td>
      <td class="r">${fPos(r.avg_position)}</td>
    </tr>`).join('') : emptyRow(6);
}

function seoRenderBody() {
  if (!_seoData) return;
  const { totals, cmpTotals, daily } = _seoData;

  const brandShare = totals.total_clicks > 0 ? (totals.brand_clicks / totals.total_clicks * 100) : null;
  const cmpBrandShare = cmpTotals && cmpTotals.total_clicks > 0 ? (cmpTotals.brand_clicks / cmpTotals.total_clicks * 100) : undefined;

  document.getElementById('content').innerHTML = `
    <div class="kpi-grid cols-4" id="seo-kpis"></div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Cliques Orgânicos por Dia — Marca × Não-Marca</div>
      <div style="height:280px;position:relative">
        ${daily.length===0 ? '<div class="c-muted" style="text-align:center;padding:40px;font-size:13px">Sem dados no período — rode a sincronização em ⚙️</div>' : '<canvas id="seoChart"></canvas>'}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Principais Termos de Marca (${disp(S.start)} → ${disp(S.end)})</div>
      <div class="table-wrap"><table>
        <thead><tr id="seo-thead"></tr></thead>
        <tbody id="seo-tbody"></tbody>
      </table></div>
    </div>`;

  document.getElementById('seo-kpis').innerHTML =
    kpiCard('Cliques de Marca', totals.brand_clicks, cmpTotals?.brand_clicks, fN, 'c-brand') +
    kpiCard('% do Tráfego Orgânico', brandShare, cmpBrandShare, fP, 'c-brand') +
    kpiCard('Impressões de Marca', totals.brand_impressions, cmpTotals?.brand_impressions, fN, 'c-blue') +
    kpiCard('Posição Média', totals.brand_avg_position!=null?+totals.brand_avg_position:null, cmpTotals?.brand_avg_position!=null?+cmpTotals.brand_avg_position:undefined, fPos, 'c-brand', true);

  seoRenderChart('seoChart', seoBuildChartSeries(daily));
  registerSortRenderer('seo-queries', seoRenderTable);
  seoRenderTable();
}

async function tabSeo() {
  loading();
  const [totals, cmpTotals, daily, queries] = await Promise.all([
    fetchGscTotals(S.start, S.end),
    S.compare && S.cmpStart ? fetchGscTotals(S.cmpStart, S.cmpEnd) : null,
    fetchGscDailyAgg(S.start, S.end),
    fetchGscTopQueries(S.start, S.end, 30, true),
  ]);

  _seoData = { totals, cmpTotals, daily, queries };
  seoRenderBody();
}
