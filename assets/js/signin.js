// BukSUPPLY - Sign In Page

const GOOGLE_CLIENT_ID = "119378619205-32j7sol7rdlks9jmda04geetnlng6ovu.apps.googleusercontent.com";

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const alertBanner = document.getElementById('alertBanner');

  function showAlert(message, type) {
    if (!alertBanner) return;
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
  }

  function hideAlert() {
    if (!alertBanner) return;
    alertBanner.textContent = '';
    alertBanner.className = 'alert-banner hidden';
  }

  function validateBuksuEmail(email) {
    const cleanEmail = email.trim().toLowerCase();
    return cleanEmail.endsWith('@student.buksu.edu.ph') || cleanEmail.endsWith('@buksu.edu.ph');
  }

  function redirectForRole(role) {
    const dest =
      role === 'Student' ? '/user-interface/dashboard.html' :
      role === 'Regular Staff' ? '/staff-interface/dashboard.html' :
      '/admin-interface/dashboard.html'; // Moderator / Administrator
    window.location.href = dest;
  }

  function storeSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  // --- Email + Password Sign In ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!validateBuksuEmail(email)) {
        showAlert('Please use a valid BukSU institutional email address (@student.buksu.edu.ph or @buksu.edu.ph).', 'info');
        return;
      }

      showAlert('Authenticating...', 'info');

      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          showAlert(data.message || 'Sign in failed.', 'error');
          return;
        }

        hideAlert();
        storeSession(data);
        redirectForRole(data.user.role);
      } catch (err) {
        console.error('Sign in error:', err);
        showAlert('Could not reach the server. Please try again.', 'error');
      }
    });
  }

  // --- Google Sign-In ---
  loadGoogleSignIn();

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

  initGoogleSignIn();

  async function handleGoogleCredential(response, agreedToTerms = false) {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential, agreedToTerms }),
      });
      const data = await res.json();

      if (res.status === 428 && data.requiresTerms) {
        const confirmed = confirm('By continuing you agree to the Terms and Conditions and Privacy Policy. Continue?');
        if (confirmed) return handleGoogleCredential(response, true);
        return;
      }

      if (!res.ok) {
        showAlert(data.message || 'Google sign-in failed.', 'error');
        return;
      }

      storeSession(data);
      redirectForRole(data.user.role);
    } catch (err) {
      console.error('Google sign-in error:', err);
      showAlert('Could not reach the server. Please try again.', 'error');
    }
  }

  function initGoogleSignIn() {
    const container = document.getElementById('googleSsoBtn');
    if (!container || typeof google === 'undefined') return;

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
});

// ==========================================
// Forgot / Reset Password Modal Logic
// ==========================================
const forgotModal = document.getElementById('forgotPasswordModal');
const openForgotModalBtn = document.getElementById('openForgotModal');
const closeForgotModalBtn = document.getElementById('closeForgotModal');

const forgotStep1 = document.getElementById('forgotStep1');
const forgotStep2 = document.getElementById('forgotStep2');

const forgotForm = document.getElementById('forgotForm');
const resetForm = document.getElementById('resetForm');

const modalAlert1 = document.getElementById('modalAlert1');
const modalAlert2 = document.getElementById('modalAlert2');

let resetEmailInProgress = ''; // remembered between step 1 and step 2

if (openForgotModalBtn) {
  openForgotModalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (forgotModal) {
      forgotModal.classList.remove('hidden');
      resetModalState();
    }
  });
}

if (closeForgotModalBtn) {
  closeForgotModalBtn.addEventListener('click', () => {
    if (forgotModal) forgotModal.classList.add('hidden');
  });
}

if (forgotModal) {
  forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) forgotModal.classList.add('hidden');
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && forgotModal && !forgotModal.classList.contains('hidden')) {
    forgotModal.classList.add('hidden');
  }
});

if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const resetEmail = document.getElementById('resetEmail').value.trim();

    showModalAlert(modalAlert1, 'Sending code...', 'info');

    try {
      const res = await fetch('/api/auth/forgot-password/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        showModalAlert(modalAlert1, data.message || 'Could not send reset code.', 'error');
        return;
      }

      resetEmailInProgress = resetEmail;
      forgotStep1.classList.add('hidden');
      forgotStep2.classList.remove('hidden');
      showModalAlert(modalAlert2, `Code sent to ${resetEmail}! Please check your inbox.`, 'info');
    } catch (err) {
      console.error('Request OTP error:', err);
      showModalAlert(modalAlert1, 'Could not reach the server. Please try again.', 'error');
    }
  });
}

if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('resetCode').value.trim();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (newPass !== confirmPass) {
      showModalAlert(modalAlert2, 'Passwords do not match. Please try again.', 'error');
      return;
    }

    showModalAlert(modalAlert2, 'Updating password...', 'info');

    try {
      const res = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmailInProgress,
          otp,
          newPassword: newPass,
          confirmPassword: confirmPass,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showModalAlert(modalAlert2, data.message || 'Could not reset password.', 'error');
        return;
      }

      showModalAlert(modalAlert2, 'Password successfully reset! You can now log in.', 'info');
      setTimeout(() => {
        if (forgotModal) forgotModal.classList.add('hidden');
      }, 1500);
    } catch (err) {
      console.error('Reset password error:', err);
      showModalAlert(modalAlert2, 'Could not reach the server. Please try again.', 'error');
    }
  });
}

function resetModalState() {
  if (forgotStep1 && forgotStep2) {
    forgotStep1.classList.remove('hidden');
    forgotStep2.classList.add('hidden');
  }
  if (forgotForm) forgotForm.reset();
  if (resetForm) resetForm.reset();
  resetEmailInProgress = '';
  hideModalAlert(modalAlert1);
  hideModalAlert(modalAlert2);
}

function showModalAlert(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `alert-banner ${type}`;
}

function hideModalAlert(element) {
  if (!element) return;
  element.textContent = '';
  element.className = 'alert-banner hidden';
}