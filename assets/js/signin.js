// BukSUPPLY - Sign In Page

const GOOGLE_CLIENT_ID =
  "883686994401-g3u7ag01hf2bjnn8kr1gdepri8ogeuta.apps.googleusercontent.com";

document.addEventListener("DOMContentLoaded", () => {
  const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;

  // Where each role lands after signing in
  const ROLE_REDIRECTS = {
    Student: "../user-interface/dashboard.html",
    "Regular Staff": "../user-interface/dashboard.html",
    Moderator: "../staff-interface/dashboard.html",
    Administrator: "../admin-interface/dashboard.html",
  };

  // ---------- Elements ----------
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const alertBanner = document.getElementById("alertBanner");

  const forgotModal = document.getElementById("forgotPasswordModal");
  const openForgotModalBtn = document.getElementById("openForgotModal");
  const closeForgotModalBtn = document.getElementById("closeForgotModal");
  const forgotStep1 = document.getElementById("forgotStep1");
  const forgotStep2 = document.getElementById("forgotStep2");
  const forgotForm = document.getElementById("forgotForm");
  const resetForm = document.getElementById("resetForm");
  const modalAlert1 = document.getElementById("modalAlert1");
  const modalAlert2 = document.getElementById("modalAlert2");

  // ---------- Helpers (type: 'info' | 'error' | 'success') ----------
  function showBanner(el, message, type = "info") {
    if (!el) return;
    el.textContent = message;
    el.className = `alert-banner ${type}`;
  }

  function hideBanner(el) {
    if (!el) return;
    el.textContent = "";
    el.className = "alert-banner hidden";
  }

  function setLoading(button, loading, loadingText) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = loading;
    button.textContent = loading ? loadingText : button.dataset.label;
  }

  function errorMessage(err) {
    return err.status
      ? err.message
      : "Cannot reach the server. Please try again.";
  }

  // Shared by email/password and Google sign-in.
  // Returns true if the user was signed in and redirected.
  function completeSignIn({ token, user }) {
    const destination = ROLE_REDIRECTS[user.role];

    if (!destination) {
      showBanner(
        alertBanner,
        "This account type is not supported here yet.",
        "error",
      );

      return false;
    }

    // Create session
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(user));

    showBanner(alertBanner, "Signed in! Redirecting...", "success");

    // IMPORTANT:
    // replace() instead of href
    window.location.replace(destination);

    return true;
  }

  // ---------- Email + password sign in ----------
  if (loginForm) {
    const loginBtn = loginForm.querySelector(".btn-submit");

    [emailInput, passwordInput].forEach((el) =>
      el.addEventListener("input", () => hideBanner(alertBanner)),
    );

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideBanner(alertBanner);

      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      if (!EMAIL_PATTERN.test(email)) {
        showBanner(
          alertBanner,
          "Please use a valid BukSU institutional email address (@student.buksu.edu.ph or @buksu.edu.ph).",
          "error",
        );
        return;
      }
      if (!password) {
        showBanner(alertBanner, "Please enter your password.", "error");
        return;
      }

      setLoading(loginBtn, true, "Signing in...");

      try {
        const data = await apiPost("/signin", { email, password });
        completeSignIn(data);
      } catch (err) {
        showBanner(alertBanner, errorMessage(err), "error");
      } finally {
        setLoading(loginBtn, false);
      }
    });
  }

  // ---------- Google sign in ----------
  async function handleGoogleCredential(response, agreedToTerms = false) {
    hideBanner(alertBanner);
    try {
      const data = await apiPost("/google", {
        credential: response.credential,
        agreedToTerms,
      });
      completeSignIn(data);
    } catch (err) {
      // First-time Google users must accept the terms
      if (err.status === 428 && err.data && err.data.requiresTerms) {
        const confirmed = confirm(
          "By continuing you agree to the Terms and Conditions and Privacy Policy. Continue?",
        );
        if (confirmed) return handleGoogleCredential(response, true);
        return;
      }
      showBanner(alertBanner, errorMessage(err), "error");
    }
  }

  function initGoogleSignIn() {
    const container = document.getElementById("googleSsoBtn");
    if (!container) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });

    google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
    });
  }

  // The Google script loads with async, so wait for it
  function loadGoogleSignIn(retries = 20) {
    if (
      typeof google !== "undefined" &&
      google.accounts &&
      google.accounts.id
    ) {
      initGoogleSignIn();
      return;
    }
    if (retries <= 0) {
      console.error("Google Identity Services script failed to load.");
      return;
    }
    setTimeout(() => loadGoogleSignIn(retries - 1), 250);
  }
  loadGoogleSignIn();

  // ---------- Forgot / reset password modal ----------
  let resetEmailInProgress = '';

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

  // STEP 1: request the code
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resetEmail = document.getElementById('resetEmail').value.trim().toLowerCase();
      const submitBtn = forgotForm.querySelector('.btn-submit');

      showModalAlert(modalAlert1, 'Sending code...', 'info');
      submitBtn.disabled = true;

      try {
        await apiPost('/forgot-password/request-code', { email: resetEmail });

        resetEmailInProgress = resetEmail;
        forgotStep1.classList.add('hidden');
        forgotStep2.classList.remove('hidden');
        showModalAlert(modalAlert2, `Code sent to ${resetEmail}! Check your inbox — it expires in 15 minutes.`, 'info');
      } catch (err) {
        showModalAlert(modalAlert1, err.message || 'Could not send reset code.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // STEP 2: submit code + new password
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otp = document.getElementById('resetCode').value.trim();
      const newPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmNewPassword').value;
      const submitBtn = resetForm.querySelector('.btn-submit');

      if (newPass !== confirmPass) {
        showModalAlert(modalAlert2, 'Passwords do not match. Please try again.', 'error');
        return;
      }

      showModalAlert(modalAlert2, 'Updating password...', 'info');
      submitBtn.disabled = true;

      try {
        await apiPost('/forgot-password/reset-password', {
          email: resetEmailInProgress,
          otp,
          newPassword: newPass,
          confirmPassword: confirmPass,
        });

        showModalAlert(modalAlert2, 'Password successfully reset! You can now log in.', 'info');
        setTimeout(() => {
          if (forgotModal) forgotModal.classList.add('hidden');
        }, 1500);
      } catch (err) {
        showModalAlert(modalAlert2, err.message || 'Could not reset password.', 'error');
      } finally {
        submitBtn.disabled = false;
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
});
