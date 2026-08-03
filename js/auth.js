// ── Acesso restrito a e-mails @jusfy.com.br (Supabase Auth, login com Google/Workspace) ──
// Troquei o login por código/e-mail pelo Google porque o envio de e-mail padrão do
// Supabase (não é feito pra volume de produção) bateu no limite de bounce nos testes.
// O domínio continua bloqueado no banco (trigger em auth.users) como defesa real —
// o parâmetro hd= aqui é só UX (restringe a lista de contas no picker do Google).

const AUTH_STORAGE_KEY = 'jf_auth_session';
const ALLOWED_DOMAIN = 'jusfy.com.br';

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

async function refreshSession(s) {
  try {
    const data = await authFetch('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    const fresh = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, email: s.email || (s.user && s.user.email) };
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

// ── Google OAuth (redirect flow) ──
function authGoogleUrl() {
  const redirectTo = location.origin + location.pathname;
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
    hd: ALLOWED_DOMAIN, // restringe o seletor de contas do Google ao Workspace da Jusfy
  });
  return `${SURL}/auth/v1/authorize?${params.toString()}`;
}

function authSignInWithGoogle() {
  location.href = authGoogleUrl();
}

// Extrai a sessão do fragmento #access_token=...&refresh_token=... devolvido pelo Supabase
// depois do redirect do Google, e limpa a URL.
async function consumeOAuthRedirect() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  history.replaceState(null, '', location.pathname + location.search);

  if (params.get('error')) {
    const desc = params.get('error_description') || params.get('error');
    authRender(desc.includes('signup_domain_not_allowed')
      ? `Essa conta Google não é @${ALLOWED_DOMAIN}.`
      : decodeURIComponent(desc.replace(/\+/g, ' ')));
    return null;
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const expires_at = params.get('expires_at');
  if (!access_token) return null;

  let email = null;
  try {
    const r = await fetch(`${SURL}/auth/v1/user`, { headers: { apikey: SKEY, Authorization: `Bearer ${access_token}` } });
    const u = await r.json();
    email = u.email || null;
  } catch (_) { /* segue sem e-mail no header, não é crítico */ }

  const session = { access_token, refresh_token, expires_at: +expires_at, email };
  setSession(session);
  return session;
}

// ── Login gate UI ──
function authGateHtml(errorMsg) {
  return `
  <div id="authGate" class="auth-gate">
    <div class="auth-card">
      <div class="auth-logo">Jusfy<span> · Ads</span></div>
      <div class="auth-title">Acesso restrito</div>
      <div class="auth-sub">Só contas Google @${ALLOWED_DOMAIN} têm acesso a este painel.</div>
      ${errorMsg ? `<div class="auth-error">${escHtmlAuth(errorMsg)}</div>` : ''}
      <button class="filter-btn auth-btn auth-google-btn" onclick="authSignInWithGoogle()">
        <svg width="18" height="18" viewBox="0 0 18 18" style="margin-right:8px;vertical-align:-4px">
          <path fill="#fff" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
          <path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
          <path fill="#fff" d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/>
          <path fill="#fff" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/>
        </svg>
        Entrar com Google
      </button>
    </div>
  </div>`;
}

function escHtmlAuth(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function authRender(errorMsg) {
  const existing = document.getElementById('authGate');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('afterbegin', authGateHtml(errorMsg));
}

// ── Bootstrap ──
async function authBoot() {
  const fromRedirect = await consumeOAuthRedirect();
  if (fromRedirect) { startDashboard(); return; }
  if (document.getElementById('authGate')) return; // consumeOAuthRedirect já mostrou um erro

  const s = await ensureSession();
  if (s) { startDashboard(); return; }
  authRender();
}

authBoot();
