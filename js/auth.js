// ── Acesso restrito por senha única (Supabase Auth, usuário compartilhado) ──
// Login com Google exigia configurar OAuth Client + habilitar provider no Supabase (2
// passos manuais fora daqui) — pra simplificar, trocamos por uma senha única compartilhada,
// mas ainda logando de verdade no Supabase (não é só um "if" no JS): a senha vira uma sessão
// real (JWT "authenticated"), e é essa sessão que a RLS do banco exige pra liberar os dados.

const AUTH_STORAGE_KEY = 'jf_auth_session';
const SHARED_EMAIL = 'dashboard@jusfy.com.br';

function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function setSession(s) { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(AUTH_STORAGE_KEY); }

function sessionValid(s) {
  return !!(s && s.access_token && s.expires_at && s.expires_at * 1000 > Date.now() + 30000);
}

async function authFetch(path, body) {
  const r = await fetch(`${SURL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.msg || data.error_description || data.message || `Erro ${r.status}`);
  return data;
}

function toSession(data) {
  const expires_at = data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at };
}

async function refreshSession(s) {
  try {
    const data = await authFetch('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    const fresh = toSession(data);
    setSession(fresh);
    return fresh;
  } catch (_) { clearSession(); return null; }
}

async function ensureSession() {
  let s = getSession();
  if (sessionValid(s)) return s;
  if (s && s.refresh_token) return await refreshSession(s);
  return null;
}

function logout() {
  clearSession();
  location.reload();
}

// ── Login gate UI ──
function authGateHtml() {
  return `
  <div id="authGate" class="auth-gate">
    <div class="auth-card">
      <div class="auth-logo">Jusfy<span> · Ads</span></div>
      <div class="auth-title">Acesso restrito</div>
      <div class="auth-sub">Digite a senha do time pra entrar no painel.</div>
      <div id="authError" class="auth-error" style="display:none"></div>
      <input id="authPassword" class="auth-input" type="password" placeholder="Senha" autocomplete="current-password"/>
      <button class="filter-btn auth-btn" onclick="authLogin()">Entrar</button>
    </div>
  </div>`;
}

function authRender() {
  const existing = document.getElementById('authGate');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('afterbegin', authGateHtml());
  const input = document.getElementById('authPassword');
  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Enter') authLogin(); });
}

function authShowError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

async function authLogin() {
  const password = document.getElementById('authPassword').value || '';
  if (!password) { authShowError('Digite a senha.'); return; }
  try {
    const data = await authFetch('token?grant_type=password', { email: SHARED_EMAIL, password });
    setSession(toSession(data));
    document.getElementById('authGate').remove();
    startDashboard();
  } catch (e) {
    authShowError('Senha incorreta.');
  }
}

// ── Bootstrap ──
async function authBoot() {
  const s = await ensureSession();
  if (s) { startDashboard(); return; }
  authRender();
}

authBoot();
