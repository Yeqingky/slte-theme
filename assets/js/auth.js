/* ── Auth Pages: Login / Register / Forget Password ── */

async function getGuestConfig() {
  try {
    const res = await API.guestConfig();
    return (res && res.data) ? res.data : {};
  } catch (e) {
    console.warn('[SLTE] getGuestConfig failed:', e.message);
    return {};
  }
}

function startCodeCountdown(btn) {
  let count = 60;
  const timer = setInterval(() => {
    count--;
    btn.textContent = count > 0 ? (count + 's') : '发送验证码';
    btn.disabled = count > 0;
    if (count <= 0) clearInterval(timer);
  }, 1000);
  btn.disabled = true;
  btn.textContent = '60s';
}

function isRegisterEnabled(cfg) {
  if (window.settings && window.settings.is_register !== undefined) return !!window.settings.is_register;
  if (!cfg) return false;
  const v = cfg.is_register;
  if (v === 0 || v === false || v === '0' || v === null || v === undefined) return false;
  return true;
}

/* ── Login ── */
async function initLogin() {
  showView('view-login');

  (async () => {
    const cfg   = await getGuestConfig();
    const linkEl = document.getElementById('login-register-link');
    if (linkEl) linkEl.style.display = isRegisterEnabled(cfg) ? '' : 'none';
  })();

  const form = document.getElementById('login-form');
  if (!form || form._bound) return;
  form._bound = true;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn      = form.querySelector('[type=submit]');
    const email    = (document.getElementById('login-email').value || '').trim();
    const password = document.getElementById('login-password').value || '';
    if (!email || !password) return Toast.warning('请填写邮箱和密码');

    btn.classList.add('btn-loading');
    try {
      const res = await API.login({ email, password });
      State.token = res.data.auth_data;
      localStorage.setItem(TOKEN_KEY, State.token);
      await loadUserData();
      Router.navigate('/dashboard', true);
    } catch (e) {
      console.error('[SLTE] login failed:', e.message);
    } finally {
      btn.classList.remove('btn-loading');
    }
  });
}

/* ── Register ── */
async function initRegister() {
  showView('view-register');

  const closedEl        = document.getElementById('register-closed');
  const loadingEl       = document.getElementById('register-loading');
  const closedContentEl = document.getElementById('register-closed-content');
  const formWrap        = document.getElementById('register-form-wrap');
  const codeGroup       = document.getElementById('register-code-group');

  if (closedEl)        closedEl.style.display        = '';
  if (loadingEl)       loadingEl.style.display       = '';
  if (closedContentEl) closedContentEl.style.display = 'none';
  if (formWrap)        formWrap.style.display        = 'none';

  const oldForm    = document.getElementById('register-form');
  const oldSendBtn = document.getElementById('register-send-code');
  if (oldForm)    oldForm._bound    = false;
  if (oldSendBtn) oldSendBtn._bound = false;

  let cfg = null;
  try {
    cfg = await getGuestConfig();
  } catch (e) {
    console.warn('[SLTE] initRegister getGuestConfig failed:', e.message);
  }

  if (loadingEl) loadingEl.style.display = 'none';

  if (!isRegisterEnabled(cfg)) {
    if (closedEl)        closedEl.style.display        = '';
    if (closedContentEl) closedContentEl.style.display = '';
    if (formWrap)        formWrap.style.display        = 'none';
    return;
  }

  if (closedEl) closedEl.style.display = 'none';
  if (formWrap) formWrap.style.display = '';

  const needEmailCode  = !!(cfg && cfg.is_email_verify);
  const isInviteForced = !!(cfg && (cfg.is_invite_force || cfg.is_invite_register));

  if (needEmailCode && codeGroup) codeGroup.style.display = '';

  if (isInviteForced) {
    const optEl = document.getElementById('invite-optional');
    if (optEl) optEl.textContent = '（必填）';
  }

  const hash     = location.hash || '';
  const invMatch = hash.match(/invite_code=([^&]+)/);
  if (invMatch) {
    const invInput = document.getElementById('register-invite');
    if (invInput) invInput.value = invMatch[1];
  }

  const sendCodeBtn = document.getElementById('register-send-code');
  if (sendCodeBtn && !sendCodeBtn._bound) {
    sendCodeBtn._bound = true;
    sendCodeBtn.addEventListener('click', async () => {
      const email = (document.getElementById('register-email').value || '').trim();
      if (!email) return Toast.warning('请先填写邮箱');
      if (sendCodeBtn.disabled) return;
      try {
        await API.sendEmailCode({ email, isforget: 0 });
        Toast.success('验证码已发送，请查收邮件');
        startCodeCountdown(sendCodeBtn);
      } catch (e) {
        console.error('[SLTE] sendEmailCode (register) failed:', e.message);
      }
    });
  }

  const form = document.getElementById('register-form');
  if (!form || form._bound) return;
  form._bound = true;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn       = form.querySelector('[type=submit]');
    const email     = (document.getElementById('register-email').value || '').trim();
    const password  = document.getElementById('register-password').value || '';
    const password2 = document.getElementById('register-password2').value || '';
    const invite    = (document.getElementById('register-invite').value || '').trim();
    const codeEl    = document.getElementById('register-code');
    const code      = codeEl ? (codeEl.value || '').trim() : '';

    if (!email || !password)              return Toast.warning('请填写邮箱和密码');
    if (password !== password2)           return Toast.warning('两次密码不一致');
    if (password.length < 8)             return Toast.warning('密码至少需要 8 位');
    if (isInviteForced && !invite)        return Toast.warning('请填写邀请码');
    if (needEmailCode && !code)           return Toast.warning('请填写邮箱验证码');

    const postData = { email, password };
    if (invite) postData.invite_code = invite;
    if (needEmailCode && code) postData.email_code = code;

    btn.classList.add('btn-loading');
    try {
      const res = await API.register(postData);
      State.token = res.data.auth_data;
      localStorage.setItem(TOKEN_KEY, State.token);
      Toast.success('注册成功，欢迎加入！');
      await loadUserData();
      Router.navigate('/dashboard', true);
    } catch (e) {
      console.error('[SLTE] register failed:', e.message);
    } finally {
      btn.classList.remove('btn-loading');
    }
  });
}

/* ── Forget Password ── */
async function initForget() {
  showView('view-forget');

  const sendCodeBtn = document.getElementById('forget-send-code');
  if (sendCodeBtn && !sendCodeBtn._bound) {
    sendCodeBtn._bound = true;
    sendCodeBtn.addEventListener('click', async () => {
      const email = (document.getElementById('forget-email').value || '').trim();
      if (!email) return Toast.warning('请先填写邮箱');
      if (sendCodeBtn.disabled) return;
      try {
        await API.sendEmailCode({ email, isforget: 1 });
        Toast.success('验证码已发送，请查收邮件');
        startCodeCountdown(sendCodeBtn);
      } catch (e) {
        console.error('[SLTE] sendEmailCode (forget) failed:', e.message);
      }
    });
  }

  const form = document.getElementById('forget-form');
  if (!form || form._bound) return;
  form._bound = true;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn       = form.querySelector('[type=submit]');
    const email     = (document.getElementById('forget-email').value || '').trim();
    const code      = (document.getElementById('forget-code').value || '').trim();
    const password  = document.getElementById('forget-password').value || '';
    const password2 = document.getElementById('forget-password2').value || '';

    if (!email || !code || !password) return Toast.warning('请填写完整信息');
    if (password !== password2)       return Toast.warning('两次密码不一致');
    if (password.length < 8)         return Toast.warning('密码至少需要 8 位');

    btn.classList.add('btn-loading');
    try {
      await API.forget({ email, email_code: code, password });
      Toast.success('密码重置成功，请重新登录');
      Router.navigate('/login');
    } catch (e) {
      console.error('[SLTE] forget password failed:', e.message);
    } finally {
      btn.classList.remove('btn-loading');
    }
  });
}
