// ── Acesso restrito a e-mails @jusfy.com.br (Supabase Auth, login por código/OTP) ──
// O domínio também é bloqueado no banco (trigger em auth.users), isto aqui é só a UI +
// gerenciamento de sessão. Sem sessão válida, o dashboard nem tenta buscar dados (RLS
// já bloqueia de qualquer forma, mas evitamos a chamada e mostramos a tela de login).

const AUTH_STORAGE_KEY = 'jf_auth_session';
const ALLOWED_DOMAIN = '@jusfy.com.br';

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
    const fresh = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, email: s.email };
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
let _authStep = 'email';
let _authEmail = '';

function authGateHtml() {
  const emailStep = _authStep === 'email';
  return `
  <div id="authGate" class="auth-gate">
    <div class="auth-card">
      <div class="auth-logo">Jusfy<span> · Ads</span></div>
      <div class="auth-title">${emailStep ? 'Acesso restrito' : 'Digite o código'}</div>
      <div class="auth-sub">${emailStep
        ? `Só e-mails ${ALLOWED_DOMAIN} têm acesso a este painel.`
        : `Enviamos um código de 6 dígitos para <strong>${escHtmlAuth(_authEmail)}</strong>.`}</div>
      <div id="authError" class="auth-error" style="display:none"></div>
      ${emailStep ? `
        <input id="authEmail" class="auth-input" type="email" placeholder="voce${ALLOWED_DOMAIN}" autocomplete="email"/>
        <button class="filter-btn auth-btn" onclick="authRequestCode()">Enviar código</button>
      ` : `
        <input id="authCode" class="auth-input auth-code" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"/>
        <button class="filter-btn auth-btn" onclick="authVerifyCode()">Entrar</button>
        <button class="auth-link" onclick="_authStep='email';authRender()">Usar outro e-mail</button>
      `}
    </div>
  </div>`;
}

function escHtmlAuth(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function authRender() {
  document.body.insertAdjacentHTML('beforeend', ''); // no-op, mantém padrão de funções render
  const existing = document.getElementById('authGate');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('afterbegin', authGateHtml());
  const input = document.getElementById(_authStep === 'email' ? 'authEmail' : 'authCode');
  if (input) { input.focus(); input.addEventListener('keydown', e => { if (e.key === 'Enter') _authStep === 'email' ? authRequestCode() : authVerifyCode(); }); }
}

function authShowError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

async function authRequestCode() {
  const email = (document.getElementById('authEmail').value || '').trim().toLowerCase();
  if (!email.endsWith(ALLOWED_DOMAIN)) { authShowError(`Use um e-mail ${ALLOWED_DOMAIN}.`); return; }
  try {
    await authFetch('otp', { email, create_user: true });
    _authEmail = email;
    _authStep = 'code';
    authRender();
  } catch (e) {
    authShowError(e.message.includes('signup_domain_not_allowed') ? `Só e-mails ${ALLOWED_DOMAIN} têm acesso.` : e.message);
  }
}

async function authVerifyCode() {
  const token = (document.getElementById('authCode').value || '').trim();
  if (!token) { authShowError('Digite o código recebido por e-mail.'); return; }
  try {
    const data = await authFetch('verify', { email: _authEmail, token, type: 'email' });
    setSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, email: _authEmail });
    document.getElementById('authGate').remove();
    startDashboard();
  } catch (e) {
    authShowError('Código inválido ou expirado.');
  }
}

// ── Bootstrap ──
async function authBoot() {
  const s = await ensureSession();
  if (s) { startDashboard(); return; }
  _authStep = 'email';
  authRender();
}

authBoot();
