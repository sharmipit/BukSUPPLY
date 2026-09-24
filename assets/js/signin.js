// BukSUPPLY - Sign In Page 

document.addEventListener('DOMContentLoaded', () => {
  const roleTabs = document.querySelectorAll('.role-tab');
  const selectedRoleInput = document.getElementById('selectedRole');
  const emailInput = document.getElementById('email');
  const signupFooter = document.getElementById('signupFooter');
  const signupLink = signupFooter ? signupFooter.querySelector('a') : null;
  const loginForm = document.getElementById('loginForm');
  const alertBanner = document.getElementById('alertBanner');
  const googleSsoBtn = document.getElementById('googleSsoBtn');

  // Helper: Update Create Account link with current role
  function updateSignupLink(role) {
    if (signupLink) {
      const baseUrl = signupLink.getAttribute('href').split('?')[0];
      signupLink.setAttribute('href', `${baseUrl}?role=${role}`);
    }
  }

  // Handle Role Switching Tabs
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const role = tab.getAttribute('data-role');
      selectedRoleInput.value = role;

      // Sync Create Account link with current role
      updateSignupLink(role);

      if (role === 'admin') {
        emailInput.placeholder = 'e.g. admin@buksu.edu.ph';
        signupFooter.style.display = 'none';
        showAlert('Administrator accounts are pre-provisioned by system owners.', 'info');
      } else if (role === 'staff') {
        emailInput.placeholder = 'e.g. staff@buksu.edu.ph';
        signupFooter.style.display = 'block';
        hideAlert();
      } else {
        emailInput.placeholder = 'e.g. user@buksu.edu.ph/student.buksu.edu.ph';
        signupFooter.style.display = 'block';
        hideAlert();
      }
    });
  });

  // Check URL query parameters on load (e.g., signin.html?role=staff)
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');

  if (roleParam) {
    const targetTab = document.querySelector(`.role-tab[data-role="${roleParam}"]`);
    if (targetTab) {
      targetTab.click();
    }
  } else {
    // Initial sync for default selection
    updateSignupLink(selectedRoleInput.value);
  }

  // Simulated Form Submission
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const currentRole = selectedRoleInput.value.toUpperCase();
    const email = emailInput.value;

    showAlert(`Logging in as [${currentRole}] with email: ${email}`, 'info');
  });

  // Google SSO Click Action
  if (googleSsoBtn) {
    googleSsoBtn.addEventListener('click', () => {
      const currentRole = selectedRoleInput.value.toUpperCase();
      showAlert(`Initiating BukSU Google SSO for [${currentRole}]...`, 'info');
    });
  }

  // Helper Banner Functions
  function showAlert(message, type) {
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
  }

  function hideAlert() {
    alertBanner.textContent = '';
    alertBanner.className = 'alert-banner hidden';
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

// Open Modal
if (openForgotModalBtn) {
  openForgotModalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.classList.remove('hidden');
    resetModalState();
  });
}

// Close Modal
if (closeForgotModalBtn) {
  closeForgotModalBtn.addEventListener('click', () => {
    forgotModal.classList.add('hidden');
  });
}

// Close Modal when clicking outside the card
if (forgotModal) {
  forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) {
      forgotModal.classList.add('hidden');
    }
  });
}

// Close Modal on Escape key press
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && forgotModal && !forgotModal.classList.contains('hidden')) {
    forgotModal.classList.add('hidden');
  }
});

// Step 1 Submission: Request Reset Code
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

// Step 2 Submission: Update Password
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
        forgotModal.classList.add('hidden');
      }, 1500);
    }, 1000);
  });
}

// Helper Functions for Modal
function resetModalState() {
  forgotStep1.classList.remove('hidden');
  forgotStep2.classList.add('hidden');
  forgotForm.reset();
  resetForm.reset();
  hideModalAlert(modalAlert1);
  hideModalAlert(modalAlert2);
}

function showModalAlert(element, message, type) {
  element.textContent = message;
  element.className = `alert-banner ${type}`;
}

function hideModalAlert(element) {
  element.textContent = '';
  element.className = 'alert-banner hidden';
}