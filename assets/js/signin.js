// BukSUPPLY - Sign In Page 

document.addEventListener('DOMContentLoaded', () => {
  const roleTabs = document.querySelectorAll('.role-tab');
  const selectedRoleInput = document.getElementById('selectedRole');
  const emailInput = document.getElementById('email');
  const signupFooter = document.getElementById('signupFooter');
  const loginForm = document.getElementById('loginForm');
  const alertBanner = document.getElementById('alertBanner');
  const googleSsoBtn = document.getElementById('googleSsoBtn');

  // Handle Role Switching Tabs
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const role = tab.getAttribute('data-role');
      selectedRoleInput.value = role;

      if (role === 'admin') {
        emailInput.placeholder = 'e.g. admin@buksu.edu.ph';
        signupFooter.style.display = 'none';
        showAlert('Administrator accounts are pre-provisioned by system owners.', 'info');
      } else if (role === 'staff') {
        emailInput.placeholder = 'e.g. staff@buksu.edu.ph';
        signupFooter.style.display = 'block';
        hideAlert();
      } else {
        emailInput.placeholder = 'e.g. user@buksu.edu.ph';
        signupFooter.style.display = 'block';
        hideAlert();
      }
    });
  });

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