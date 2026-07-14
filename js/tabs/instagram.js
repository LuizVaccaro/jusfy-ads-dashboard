// ── Identidade visual "Jusfy" (herdada do dashboard antigo) — usada só nesta aba por enquanto ──
const IG_THEME = {
  bg:      '#FAFAFA',
  card:    '#ffffff',
  border:  '#E7E8EC',
  text:    '#212121',
  muted:   '#212121BF',
  faint:   '#2121218C',
  brand:   '#02A378',
  brandDk: '#017858',
  brandLt: '#e6f7f2',
};

// Mesma convenção de números do dashboard antigo (formatCompact): "15,1M" / "116,2k"
function fCompactIG(n) {
  if (n == null || isNaN(n)) return '—';
  if (!n) return '0';
  const abs = Math.abs(n);
  let formatted;
  if (abs >= 1000000) formatted = (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  else if (abs >= 1000) formatted = (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  else formatted = Math.floor(n).toString();
  return formatted.replace('.', ',');
}

function igFillForward(vals) {
  let last = 0;
  return vals.map(v => { if (v != null) last = v; return last; });
}

function igDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

// Mini-gráfico com grade horizontal (eixo Y) e datas no rodapé (eixo X), tema claro
function igAxisChart(dates, vals, color, height = 110) {
  const filled = igFillForward(vals);
  if (!filled.length) return `<div style="height:${height}px"></div>`;
  const max = Math.max(...filled);
  const min = Math.min(...filled);
  const range = (max - min) || 1;
  const yTicks = [max, (max + min) / 2, min];

  const stepX = 100 / ((filled.length - 1) || 1);
  const pts = filled.map((v, i) => `${(i * stepX).toFixed(2)},${(94 - (v - min) / range * 88).toFixed(2)}`).join(' ');

  const xCount = Math.min(4, dates.length);
  const xLabels = [];
  for (let i = 0; i < xCount; i++) {
    const idx = Math.round(i * (dates.length - 1) / ((xCount - 1) || 1));
    xLabels.push(igDateShort(dates[idx]));
  }

  return `<div style="display:flex;gap:8px">
    <div style="display:flex;flex-direction:column;justify-content:space-between;font-size:9px;color:${IG_THEME.faint};text-align:right;min-width:38px;padding:2px 0;font-weight:600">
      ${yTicks.map(t => `<span>${fCompactIG(t)}</span>`).join('')}
    </div>
    <div style="flex:1;position:relative;height:${height}px">
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none">
        <div style="border-top:1px dashed ${IG_THEME.border}"></div>
        <div style="border-top:1px dashed ${IG_THEME.border}"></div>
        <div style="border-top:1px dashed ${IG_THEME.border}"></div>
      </div>
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style="display:block;position:relative">
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:9px;color:${IG_THEME.faint};margin-top:4px;padding-left:46px;font-weight:600">
    ${xLabels.map(l => `<span>${l}</span>`).join('')}
  </div>`;
}

function igDeltaBadge(curr, prev) {
  if (prev == null || prev === 0 || !S.compare) return '';
  const d = (curr - prev) / Math.abs(prev);
  const pct = (d * 100).toFixed(1);
  const up = d > 0;
  const color = d === 0 ? IG_THEME.muted : up ? IG_THEME.brand : '#e05a69';
  const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '→';
  return `<span style="font-size:12px;font-weight:700;color:${color}">${arrow} ${d > 0 ? '+' : ''}${pct}%</span>`;
}

function igMetricCard(label, dates, series, total, cmpTotal, color) {
  return `<div style="background:${IG_THEME.card};border:1px solid ${IG_THEME.border};border-radius:12px;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.04)">
    <div style="font-size:12px;color:${IG_THEME.muted};font-weight:600;margin-bottom:6px">${label}</div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <div style="font-size:24px;font-weight:800;color:${IG_THEME.text}">${fCompactIG(total)}</div>
      ${igDeltaBadge(total, cmpTotal)}
    </div>
    ${igAxisChart(dates, series, color)}
  </div>`;
}

function igTypeBadge(mediaType, productType) {
  const label = productType === 'REELS' ? 'Reels' : mediaType === 'CAROUSEL_ALBUM' ? 'Carrossel' : mediaType === 'VIDEO' ? 'Vídeo' : 'Foto';
  const colors = { Reels: '#ed723e', Carrossel: '#0182ab', 'Vídeo': '#9551FB', Foto: IG_THEME.brand };
  const c = colors[label] || IG_THEME.muted;
  return `<span style="background:${c}18;color:${c};border:1px solid ${c}44;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">${label}</span>`;
}

function igMediaTable(rows, tableId) {
  if (!rows.length) return `<div style="background:${IG_THEME.card};border:1px solid ${IG_THEME.border};border-radius:12px;padding:32px;text-align:center;color:${IG_THEME.muted};font-size:13px">Sem posts no período</div>`;
  const withMetrics = rows.map(r => ({ ...r,
    engagement: (r.like_count||0) + (r.comments_count||0) + (r.saved||0) + (r.shares||0),
  }));
  const st     = getSort(tableId, 'posted_at', 'desc');
  const sorted = sortRows(withMetrics, st.key, st.dir);

  const th = (label, key, defaultDir='desc', align='right') => {
    const active = st.key === key;
    const arrow = active ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th onclick="onSortClick('${tableId}','${key}','${defaultDir}')" style="padding:10px 14px;text-align:${align};font-size:11px;color:${active?IG_THEME.brand:IG_THEME.muted};text-transform:uppercase;letter-spacing:.04em;font-weight:700;border-bottom:1px solid ${IG_THEME.border};white-space:nowrap;cursor:pointer;user-select:none">${label}${arrow}</th>`;
  };

  let body = '';
  for (const r of sorted) {
    const caption = (r.caption || '—').replace(/\n/g, ' ');
    const captionShort = caption.length > 60 ? caption.slice(0, 60) + '…' : caption;
    body += `<tr style="border-bottom:1px solid #FAFAFA">
      <td style="padding:9px 14px;text-align:center">${previewBtn(caption, r.thumbnail_url || r.media_url || '', '', r.permalink || '')}</td>
      <td style="padding:9px 14px">${igTypeBadge(r.media_type, r.media_product_type)}</td>
      <td style="padding:9px 14px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:${IG_THEME.text}" title="${caption.replace(/"/g,'&quot;')}">${captionShort}</td>
      <td style="padding:9px 14px;font-size:12px;color:${IG_THEME.muted}">${new Date(r.posted_at).toLocaleDateString('pt-BR')}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:${IG_THEME.text}">${fN(r.reach)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:${IG_THEME.text}">${fN(r.like_count)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:${IG_THEME.text}">${fN(r.comments_count)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:${IG_THEME.text}">${fN(r.saved)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;color:${IG_THEME.text}">${fN(r.shares)}</td>
      <td style="padding:9px 14px;text-align:right;font-size:13px;font-weight:800;color:${IG_THEME.brand}">${fN(r.engagement)}</td>
    </tr>`;
  }

  return `<div style="background:${IG_THEME.card};border:1px solid ${IG_THEME.border};border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:14px 18px;border-bottom:1px solid ${IG_THEME.border}">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:14px;font-weight:800;color:${IG_THEME.text}">📸 Posts Orgânicos</span>
        <span style="background:${IG_THEME.brandLt};color:${IG_THEME.brandDk};border:1px solid ${IG_THEME.brand}33;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700">${sorted.length} POSTS</span>
      </div>
      <span style="font-size:11px;color:${IG_THEME.muted}">Clique em ▶ para visualizar o post</span>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;background:${IG_THEME.card}">
        <thead style="background:#FAFAFA"><tr>
          <th style="padding:10px 14px;width:52px;border-bottom:1px solid ${IG_THEME.border}"></th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:${IG_THEME.muted};text-transform:uppercase;font-weight:700;border-bottom:1px solid ${IG_THEME.border}">Tipo</th>
          ${th('Legenda','caption','asc','left')}
          ${th('Data','posted_at')}
          ${th('Alcance','reach')}
          ${th('Curtidas','like_count')}
          ${th('Comentários','comments_count')}
          ${th('Salvos','saved')}
          ${th('Compart.','shares')}
          ${th('Engajamento','engagement')}
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

let _igData = null;

function renderInstagramBody() {
  if (!_igData) return;
  const { media, daily, cmpDaily, lastFollowerTotal, cmpLastFollowerTotal } = _igData;
  const s = (arr, k) => arr.reduce((acc, r) => acc + (+r[k] || 0), 0);
  const dates = daily.map(d => d.date);

  const cards = [
    igMetricCard('Visualizações', dates, daily.map(d=>+d.views||0), s(daily,'views'), S.compare?s(cmpDaily,'views'):undefined, '#0182ab'),
    igMetricCard('Alcance', dates, daily.map(d=>+d.reach||0), s(daily,'reach'), S.compare?s(cmpDaily,'reach'):undefined, IG_THEME.brand),
    igMetricCard('Interações com o Conteúdo', dates, daily.map(d=>+d.total_interactions||0), s(daily,'total_interactions'), S.compare?s(cmpDaily,'total_interactions'):undefined, '#9551FB'),
    igMetricCard('Cliques no Link', dates, daily.map(d=>+d.website_clicks||0), s(daily,'website_clicks'), S.compare?s(cmpDaily,'website_clicks'):undefined, '#ed723e'),
    igMetricCard('Visitas ao Perfil', dates, daily.map(d=>+d.profile_views||0), s(daily,'profile_views'), S.compare?s(cmpDaily,'profile_views'):undefined, '#b38b00'),
    igMetricCard('Seguidores (Variação)', dates, daily.map(d=>+d.follower_delta||0), s(daily,'follower_delta'), S.compare?s(cmpDaily,'follower_delta'):undefined, '#e05a69'),
    igMetricCard('Seguidores Totais', dates, daily.map(d=>d.follower_count!=null?+d.follower_count:null), lastFollowerTotal, S.compare?cmpLastFollowerTotal:undefined, IG_THEME.brandDk),
  ];

  document.getElementById('content').innerHTML = `
    <div style="background:${IG_THEME.bg};border-radius:16px;padding:20px">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px">${cards.join('')}</div>
      ${igMediaTable(media, 'ig-media')}
    </div>
  `;
}

async function tabInstagram() {
  loading();
  ensureCreativeModal();

  const [media, dailyRaw, cmpDailyRaw] = await Promise.all([
    fetchInstagramMediaAgg(S.start, S.end),
    fetchInstagramAccountDailyAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchInstagramAccountDailyAgg(S.cmpStart, S.cmpEnd) : [],
  ]);

  const daily    = dailyRaw.slice().sort((a,b) => a.date < b.date ? -1 : 1);
  const cmpDaily = cmpDailyRaw.slice().sort((a,b) => a.date < b.date ? -1 : 1);

  const lastFollowerTotal    = [...daily].reverse().find(d => d.follower_count != null)?.follower_count ?? null;
  const cmpLastFollowerTotal = [...cmpDaily].reverse().find(d => d.follower_count != null)?.follower_count ?? null;

  _igData = { media, daily, cmpDaily, lastFollowerTotal, cmpLastFollowerTotal };
  registerSortRenderer('ig-media', renderInstagramBody);
  renderInstagramBody();
}
