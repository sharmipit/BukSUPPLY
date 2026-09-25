// BukSUPPLY - Sign In Page

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const alertBanner = document.getElementById('alertBanner');
  const googleSsoBtn = document.getElementById('googleSsoBtn');

  // Helper Banner Functions
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

  // Validate Institutional Email Domain
  function validateBuksuEmail(email) {
    const cleanEmail = email.trim().toLowerCase();
    return cleanEmail.endsWith('@student.buksu.edu.ph') || cleanEmail.endsWith('@buksu.edu.ph');
  }

  // Handle Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();

      if (!validateBuksuEmail(email)) {
        showAlert('Please use a valid BukSU institutional email address (@student.buksu.edu.ph or @buksu.edu.ph).', 'info');
        return;
      }

      hideAlert();
      showAlert(`Authenticating ${email}...`, 'info');
    });
  }

  // Google SSO Click Action
  if (googleSsoBtn) {
    googleSsoBtn.addEventListener('click', () => {
      showAlert('Initiating BukSU Google SSO Authentication...', 'info');
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
    if (e.target === forgotModal) {
      forgotModal.classList.add('hidden');
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && forgotModal && !forgotModal.classList.contains('hidden')) {
    forgotModal.classList.add('hidden');
  }
});

if (forgotForm) {
  forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const resetEmail = document.getElementById('resetEmail').value;

    showModalAlert(modalAlert1, 'Sending code...', 'info');

    setTimeout(() => {
      forgotStep1.classList.add('hidden');
      forgotStep2.classList.remove('hidden');
      showModalAlert(modalAlert2, `Code sent to ${resetEmail}! Please check your inbox.`, 'info');
    }, 1000);
  });
}

if (resetForm) {
  resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    if (newPass !== confirmPass) {
      showModalAlert(modalAlert2, 'Passwords do not match. Please try again.', 'info');
      return;
    }

    showModalAlert(modalAlert2, 'Updating password...', 'info');

    setTimeout(() => {
      showModalAlert(modalAlert2, 'Password successfully reset! You can now log in.', 'info');
      setTimeout(() => {
        if (forgotModal) forgotModal.classList.add('hidden');
      }, 1500);
    }, 1000);
  });
}

function resetModalState() {
  if (forgotStep1 && forgotStep2) {
    forgotStep1.classList.remove('hidden');
    forgotStep2.classList.add('hidden');
  }
  if (forgotForm) forgotForm.reset();
  if (resetForm) resetForm.reset();
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