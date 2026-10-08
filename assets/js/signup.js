// BukSUPPLY - Sign Up Page

const GOOGLE_CLIENT_ID =
  "883686994401-g3u7ag01hf2bjnn8kr1gdepri8ogeuta.apps.googleusercontent.com";

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const emailInput = document.getElementById("email");
  const idLabel = document.getElementById("idLabel");
  const idInput = document.getElementById("idNumber");

  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const togglePasswordBtns = document.querySelectorAll(".toggle-password-btn");
  const termsCheckbox = document.getElementById("termsAgreement");
  const googleSsoBtn = document.getElementById("googleSsoBtn");

  const submitBtn = document.getElementById("btnSubmit");
  const formError = document.getElementById("formError");

  const successModal = document.getElementById("successModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  // Email Domain Validation Helper (mirrors the backend rule)
  const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;

  const validateEmailDomain = (email) => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(clean)) {
      return { valid: false, type: null };
    }
    return {
      valid: true,
      type: clean.endsWith("@student.buksu.edu.ph")
        ? "Student"
        : "Regular Staff",
    };
  };

  // Form Error Handlers
  function setError(inputElement, message) {
    const group =
      inputElement.closest(".input-group") ||
      inputElement.closest(".terms-group");
    if (!group) return;
    group.classList.add("has-error");
    const errorSpan = group.querySelector(".error-msg");
    if (errorSpan && message) {
      errorSpan.textContent = message;
    }
  }

  function clearError(inputElement) {
    const group =
      inputElement.closest(".input-group") ||
      inputElement.closest(".terms-group");
    if (!group) return;
    group.classList.remove("has-error");
  }

  // Dynamic ID Label & Placeholder Detection
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      const result = validateEmailDomain(emailInput.value);

      if (result.valid && result.type === "Student") {
        idLabel.innerHTML = 'Student ID Number <span class="required">*</span>';
        idInput.placeholder = "e.g. 2400000000 (Student ID)";
        clearError(emailInput);
      } else if (result.valid && result.type === "Regular Staff") {
        idLabel.innerHTML =
          'Employee / Personnel ID <span class="required">*</span>';
        idInput.placeholder = "e.g. 2024-1234 (Employee ID)";
        clearError(emailInput);
      } else {
        idLabel.innerHTML = 'ID Number <span class="required">*</span>';
        idInput.placeholder = "Student ID or Personnel ID Number";
      }
    });
  }

  // Password Toggle Button Handler
  togglePasswordBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetInput = document.getElementById(
        btn.getAttribute("data-target"),
      );
      const icon = btn.querySelector("i");

      if (targetInput.type === "password") {
        targetInput.type = "text";
        icon.classList.replace("bi-eye", "bi-eye-slash");
      } else {
        targetInput.type = "password";
        icon.classList.replace("bi-eye-slash", "bi-eye");
      }
    });
  });

  // Clear errors as the user edits
  document
    .querySelectorAll(".form-input, #termsAgreement")
    .forEach((element) => {
      const clear = () => {
        clearError(element);
        formError.textContent = "";
      };
      element.addEventListener("input", clear);
      element.addEventListener("change", clear);
    });

  // Form Submission Workflow
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      formError.textContent = "";
      let isValid = true;

      const firstName = document.getElementById("firstName");
      const lastName = document.getElementById("lastName");

      // 1. Text Inputs Check
      [firstName, lastName, idInput].forEach((input) => {
        if (!input.value.trim()) {
          setError(input, "This field is required");
          isValid = false;
        } else {
          clearError(input);
        }
      });

      // 2. Email Domain Check
      if (!emailInput.value.trim()) {
        setError(emailInput, "Institutional email is required");
        isValid = false;
      } else if (!validateEmailDomain(emailInput.value).valid) {
        setError(
          emailInput,
          "Please use a valid BukSU institutional email address.",
        );
        isValid = false;
      } else {
        clearError(emailInput);
      }

      // 3. Password Check
      if (!passwordInput.value) {
        setError(passwordInput, "Password is required");
        isValid = false;
      } else if (passwordInput.value.length < 8) {
        setError(passwordInput, "Password must be at least 8 characters");
        isValid = false;
      }

      if (!confirmPasswordInput.value) {
        setError(confirmPasswordInput, "Please confirm your password");
        isValid = false;
      } else if (passwordInput.value !== confirmPasswordInput.value) {
        setError(confirmPasswordInput, "Passwords do not match");
        isValid = false;
      }

      // 4. Terms Check
      if (!termsCheckbox.checked) {
        setError(
          termsCheckbox,
          "You must agree to the terms to complete registration",
        );
        isValid = false;
      }

      // 5. reCAPTCHA Check
      const recaptchaToken = grecaptcha.getResponse();
      if (!recaptchaToken) {
          formError.textContent = 'Please confirm you are not a robot.';
          isValid = false;
      }

      if (!isValid) return;

      // 6. Send to the backend
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";

      try {
        await apiPost("/signup", {
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          email: emailInput.value.trim().toLowerCase(),
          idNumber: idInput.value.trim(),
          password: passwordInput.value,
          confirmPassword: confirmPasswordInput.value,
          termsAgreement: termsCheckbox.checked, // real boolean
          recaptchaToken,
        });

        if (successModal) successModal.classList.add("active");
      } catch (err) {
        grecaptcha.reset(); 
        if (err.status === 409) {
          setError(emailInput, err.message);
        } else if (err.status) {
          formError.textContent = err.message;
        } else {
          formError.textContent = "Cannot reach the server. Please try again.";
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account";
      }
    });
  }

  // --- Google Sign-In ---
  loadGoogleSignIn();

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

  function initGoogleSignIn() {
    if (!googleSsoBtn) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });

    google.accounts.id.renderButton(googleSsoBtn, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "signup_with",
    });
  }

  async function handleGoogleCredential(response, agreedToTerms = false) {
    try {
      const data = await apiPost("/google", {
        credential: response.credential,
        agreedToTerms,
      });

      // Backend returns 428 when this is a brand-new account and
      // terms haven't been confirmed yet.
      window.location.replace("signin.html");
    } catch (err) {
      if (err.status === 428) {
        const confirmed = confirm(
          "By continuing you agree to the Terms and Conditions and Privacy Policy. Continue?",
        );
        if (confirmed) return handleGoogleCredential(response, true);
        return;
      }
      formError.textContent =
        err.message || "Google sign-up failed. Please try again.";
    }
  }

  // Modal Redirect
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      window.location.replace("signin.html");
    });
  }

  // Modal Redirect
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      window.location.replace("signin.html");
    });
  }
});
