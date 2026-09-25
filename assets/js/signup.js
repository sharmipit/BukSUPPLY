// BukSUPPLY - Sign Up Page

document.addEventListener('DOMContentLoaded', () => {

    const signupForm = document.getElementById('signupForm');
    const emailInput = document.getElementById('email');
    const idLabel = document.getElementById('idLabel');
    const idInput = document.getElementById('idNumber');
    
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn');
    const termsCheckbox = document.getElementById('termsAgreement');
    const googleSsoBtn = document.getElementById('googleSsoBtn');

    const successModal = document.getElementById('successModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    // Email Domain Validation Helper
    const validateEmailDomain = (email) => {
        const clean = email.trim().toLowerCase();
        if (clean.endsWith('@student.buksu.edu.ph')) {
            return { valid: true, type: 'Student' };
        } else if (clean.endsWith('@buksu.edu.ph')) {
            return { valid: true, type: 'Regular Staff' };
        }
        return { valid: false, type: null };
    };

    // Dynamic ID Label & Placeholder Detection
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const emailVal = emailInput.value.trim();
            const result = validateEmailDomain(emailVal);

            if (result.valid && result.type === 'Student') {
                if (idLabel) idLabel.innerHTML = 'Student ID Number <span class="required">*</span>';
                if (idInput) idInput.placeholder = 'e.g. 2400000000 (Student ID)';
                clearError(emailInput);
            } else if (result.valid && result.type === 'Regular Staff') {
                if (idLabel) idLabel.innerHTML = 'Employee / Personnel ID <span class="required">*</span>';
                if (idInput) idInput.placeholder = 'e.g. 2024-1234 (Employee ID)';
                clearError(emailInput);
            } else {
                if (idLabel) idLabel.innerHTML = 'ID Number <span class="required">*</span>';
                if (idInput) idInput.placeholder = 'Student ID or Personnel ID Number';
            }
        });
    }

    // Password Toggle Button Handler
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const icon = btn.querySelector('i');

            if (targetInput.type === 'password') {
                targetInput.type = 'text';
                icon.classList.replace('bi-eye', 'bi-eye-slash');
            } else {
                targetInput.type = 'password';
                icon.classList.replace('bi-eye-slash', 'bi-eye');
            }
        });
    });

    // Form Error Handlers
    function setError(inputElement, message) {
        const group = inputElement.closest('.input-group') || inputElement.closest('.terms-group');
        if (!group) return;
        group.classList.add('has-error');
        const errorSpan = group.querySelector('.error-msg');
        if (errorSpan && message) {
            errorSpan.textContent = message;
        }
    }

    function clearError(inputElement) {
        const group = inputElement.closest('.input-group') || inputElement.closest('.terms-group');
        if (!group) return;
        group.classList.remove('has-error');
    }

    document.querySelectorAll('.form-input, #termsAgreement').forEach(element => {
        element.addEventListener('input', () => clearError(element));
        element.addEventListener('change', () => clearError(element));
    });

    // Form Submission Workflow
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            let isValid = true;

            const firstName = document.getElementById('firstName');
            const lastName = document.getElementById('lastName');

            // 1. Text Inputs Check
            [firstName, lastName, idInput].forEach(input => {
                if (!input || !input.value.trim()) {
                    setError(input, 'This field is required');
                    isValid = false;
                } else {
                    clearError(input);
                }
            });

            // 2. Email Domain Check
            if (!emailInput.value.trim()) {
                setError(emailInput, 'Institutional email is required');
                isValid = false;
            } else {
                const domainResult = validateEmailDomain(emailInput.value);
                if (!domainResult.valid) {
                    setError(emailInput, 'Please use a valid BukSU institutional email address.');
                    isValid = false;
                } else {
                    clearError(emailInput);
                }
            }

            // 3. Password Check
            if (!passwordInput.value) {
                setError(passwordInput, 'Password is required');
                isValid = false;
            } else if (passwordInput.value.length < 8) {
                setError(passwordInput, 'Password must be at least 8 characters');
                isValid = false;
            }

            if (!confirmPasswordInput.value) {
                setError(confirmPasswordInput, 'Please confirm your password');
                isValid = false;
            } else if (passwordInput.value !== confirmPasswordInput.value) {
                setError(confirmPasswordInput, 'Passwords do not match');
                isValid = false;
            }

            // 4. Terms Check
            if (!termsCheckbox.checked) {
                setError(termsCheckbox, 'You must agree to the terms to complete registration');
                isValid = false;
            }

            // Execute Success Action (Instant Account Creation)
            if (isValid) {
                if (successModal) {
                    successModal.classList.add('active');
                }
            }
        });
    }

    // SSO Handler
    if (googleSsoBtn) {
        googleSsoBtn.addEventListener('click', () => {
            alert('Connecting to BukSU Institutional Google OAuth...');
        });
    }

    // Modal Redirect
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            window.location.href = 'signin.html';
        });
    }

});