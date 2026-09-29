// BukSUPPLY - Sign In Page

const GOOGLE_CLIENT_ID = "119378619205-32j7sol7rdlks9jmda04geetnlng6ovu.apps.googleusercontent.com";

document.addEventListener('DOMContentLoaded', () => {
  const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;

  // Where each role lands after signing in
  const ROLE_REDIRECTS = {
    'Student': '../user-interface/dashboard.html',
    'Regular Staff': '../user-interface/dashboard.html',
    // Moderator / Administrator will be added later
  };

  // ---------- Elements ----------
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const alertBanner = document.getElementById('alertBanner');

  const forgotModal = document.getElementById('forgotPasswordModal');
  const openForgotModalBtn = document.getElementById('openForgotModal');
  const closeForgotModalBtn = document.getElementById('closeForgotModal');
  const forgotStep1 = document.getElementById('forgotStep1');
  const forgotStep2 = document.getElementById('forgotStep2');
  const forgotForm = document.getElementById('forgotForm');
  const resetForm = document.getElementById('resetForm');
  const modalAlert1 = document.getElementById('modalAlert1');
  const modalAlert2 = document.getElementById('modalAlert2');

  // ---------- Helpers (type: 'info' | 'error' | 'success') ----------
  function showBanner(el, message, type = 'info') {
    if (!el) return;
    el.textContent = message;
    el.className = `alert-banner ${type}`;
  }

  function hideBanner(el) {
    if (!el) return;
    el.textContent = '';
    el.className = 'alert-banner hidden';
  }

  function setLoading(button, loading, loadingText) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = loading;
    button.textContent = loading ? loadingText : button.dataset.label;
  }

  function errorMessage(err) {
    return err.status ? err.message : 'Cannot reach the server. Please try again.';
  }

  // Shared by email/password and Google sign-in.
  // Returns true if the user was signed in and redirected.
  function completeSignIn({ token, user }) {
    const destination = ROLE_REDIRECTS[user.role];
    if (!destination) {
      showBanner(alertBanner, 'This account type is not supported here yet.', 'error');
      return false; // don't store the token
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    showBanner(alertBanner, 'Signed in! Redirecting...', 'success');
    window.location.href = destination;
    return true;
  }

  // ---------- Already signed in? Skip the form ----------
  try {
    const saved = JSON.parse(localStorage.getItem('user'));
    if (localStorage.getItem('token') && saved && ROLE_REDIRECTS[saved.role]) {
      window.location.href = ROLE_REDIRECTS[saved.role];
      return;
    }
  } catch { /* corrupt storage, show the form */ }

  // ---------- Email + password sign in ----------
  if (loginForm) {
    const loginBtn = loginForm.querySelector('.btn-submit');

    [emailInput, passwordInput].forEach((el) =>
      el.addEventListener('input', () => hideBanner(alertBanner))
    );

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideBanner(alertBanner);

      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      if (!EMAIL_PATTERN.test(email)) {
        showBanner(
          alertBanner,
          'Please use a valid BukSU institutional email address (@student.buksu.edu.ph or @buksu.edu.ph).',
          'error'
        );
        return;
      }
      if (!password) {
        showBanner(alertBanner, 'Please enter your password.', 'error');
        return;
      }

      setLoading(loginBtn, true, 'Signing in...');

      try {
        const data = await apiPost('/signin', { email, password });
        completeSignIn(data);
      } catch (err) {
        showBanner(alertBanner, errorMessage(err), 'error');
      } finally {
        setLoading(loginBtn, false);
      }
    });
  }

  // ---------- Google sign in ----------
  async function handleGoogleCredential(response, agreedToTerms = false) {
    hideBanner(alertBanner);
    try {
      const data = await apiPost('/google', {
        credential: response.credential,
        agreedToTerms,
      });
      completeSignIn(data);
    } catch (err) {
      // First-time Google users must accept the terms
      if (err.status === 428 && err.data && err.data.requiresTerms) {
        const confirmed = confirm(
          'By continuing you agree to the Terms and Conditions and Privacy Policy. Continue?'
        );
        if (confirmed) return handleGoogleCredential(response, true);
        return;
      }
      showBanner(alertBanner, errorMessage(err), 'error');
    }
  }

  function initGoogleSignIn() {
    const container = document.getElementById('googleSsoBtn');
    if (!container) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });

    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
    });
  }

  // The Google script loads with async, so wait for it
  function loadGoogleSignIn(retries = 20) {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      initGoogleSignIn();
      return;
    }
    if (retries <= 0) {
      console.error('Google Identity Services script failed to load.');
      return;
    }
    setTimeout(() => loadGoogleSignIn(retries - 1), 250);
  }
  loadGoogleSignIn();

  // ---------- Forgot / reset password modal ----------
  let resetEmail = ''; // remembered between step 1 and step 2

  function resetModalState() {
    forgotStep1.classList.remove('hidden');
    forgotStep2.classList.add('hidden');
    forgotForm.reset();
    resetForm.reset();
    resetEmail = '';
    hideBanner(modalAlert1);
    hideBanner(modalAlert2);
  }

  function openModal() {
    resetModalState();
    forgotModal.classList.remove('hidden');
  }

  function closeModal() {
    forgotModal.classList.add('hidden');
  }

  if (openForgotModalBtn && forgotModal) {
    openForgotModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }
  if (closeForgotModalBtn) closeForgotModalBtn.addEventListener('click', closeModal);
  if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && forgotModal && !forgotModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Only digits in the code box
  const codeInput = document.getElementById('resetCode');
  if (codeInput) {
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  // Step 1: request the code
  if (forgotForm) {
    const sendBtn = forgotForm.querySelector('.btn-submit');

    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideBanner(modalAlert1);

      const email = document.getElementById('resetEmail').value.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        showBanner(modalAlert1, 'Please use a valid BukSU institutional email address.', 'error');
        return;
      }

      setLoading(sendBtn, true, 'Sending code...');

      try {
        const data = await apiPost('/forgot-password/request-code', { email });
        resetEmail = email;
        forgotStep1.classList.add('hidden');
        forgotStep2.classList.remove('hidden');
        showBanner(modalAlert2, data.message, 'info');
      } catch (err) {
        showBanner(modalAlert1, errorMessage(err), 'error');
      } finally {
        setLoading(sendBtn, false);
      }
    });
  }

  // Step 2: code + new password
  if (resetForm) {
    const updateBtn = resetForm.querySelector('.btn-submit');

    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideBanner(modalAlert2);

      const otp = codeInput.value.trim();
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      if (!/^\d{6}$/.test(otp)) {
        showBanner(modalAlert2, 'Enter the 6-digit code from your email.', 'error');
        return;
      }
      if (newPassword.length < 8) {
        showBanner(modalAlert2, 'Password must be at least 8 characters.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showBanner(modalAlert2, 'Passwords do not match. Please try again.', 'error');
        return;
      }

      setLoading(updateBtn, true, 'Updating password...');

      try {
        const data = await apiPost('/forgot-password/reset-password', {
          email: resetEmail,
          otp,
          newPassword,
          confirmPassword,
        });
        showBanner(modalAlert2, data.message, 'success');
        setTimeout(() => {
          closeModal();
          emailInput.value = resetEmail;
          passwordInput.value = '';
          passwordInput.focus();
        }, 1500);
      } catch (err) {
        const hint = err.status === 400 && /code/i.test(err.message)
          ? ' After 5 wrong tries you need a new code: close this window and request one again.'
          : '';
        showBanner(modalAlert2, errorMessage(err) + hint, 'error');
      } finally {
        setLoading(updateBtn, false);
      }
    });
  }
});