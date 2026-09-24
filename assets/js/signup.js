// BukSUPPLY - Sign Up Page 

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. DOM ELEMENTS
    // =========================================================================
    const roleTabs = document.querySelectorAll('.role-tab');
    const userSection = document.getElementById('userSection');
    const staffSection = document.getElementById('staffSection');
    const signupForm = document.getElementById('signupForm');
    
    // User Dynamic Fields Elements
    const userTypeSelect = document.getElementById('userType');
    const userCollegeGroup = document.getElementById('userCollegeGroup');
    const userCollegeSelect = document.getElementById('userCollege');
    const userOfficeGroup = document.getElementById('userOfficeGroup');
    const userOfficeSelect = document.getElementById('userOffice');
    const userOrgNameGroup = document.getElementById('userOrgNameGroup');
    const userOrgPositionGroup = document.getElementById('userOrgPositionGroup');

    // Staff Dynamic Fields Elements
    const staffAffiliationTypeSelect = document.getElementById('staffAffiliationType');
    const staffCollegeGroup = document.getElementById('staffCollegeGroup');
    const staffCollegeSelect = document.getElementById('staffCollege');
    const staffOfficeGroup = document.getElementById('staffOfficeGroup');
    const staffOfficeSelect = document.getElementById('staffOffice');

    // Shared Inputs & Controls
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn');
    const termsCheckbox = document.getElementById('termsAgreement');
    const googleSsoBtn = document.getElementById('googleSsoBtn');

    // Navigation Back / Sign In Links
    const backLink = document.querySelector('.back-link');
    const signinFooterLink = document.querySelector('.signup-footer .create-account-link');

    // Modal Elements
    const approvalModal = document.getElementById('approvalModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const registeredEmailDisplay = document.getElementById('registeredEmailDisplay');

    // Active Role State ('user' or 'staff')
    let currentRole = 'user';

    // Helper: Update back link and Sign In link with current role
    function updateSigninLinks(role) {
        [backLink, signinFooterLink].forEach(link => {
            if (link) {
                const baseUrl = link.getAttribute('href').split('?')[0];
                link.setAttribute('href', `${baseUrl}?role=${role}`);
            }
        });
    }

    // =========================================================================
    // 2. ROLE SWITCHER (Targeting .role-selector .role-tab)
    // =========================================================================
    roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetRole = tab.getAttribute('data-role');
            if (targetRole === currentRole) return;

            // Toggle tab active state
            roleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentRole = targetRole;

            // Update navigation links for Go Back & Sign In
            updateSigninLinks(currentRole);

            // Switch section visibility
            if (currentRole === 'user') {
                staffSection.classList.remove('active-section');
                staffSection.classList.add('d-none');
                
                userSection.classList.remove('d-none');
                setTimeout(() => userSection.classList.add('active-section'), 10);
            } else {
                userSection.classList.remove('active-section');
                userSection.classList.add('d-none');

                staffSection.classList.remove('d-none');
                setTimeout(() => staffSection.classList.add('active-section'), 10);
            }

            clearValidationErrors();
        });
    });

    // Check URL query parameters on load (e.g., signup.html?role=staff)
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');

    if (roleParam && (roleParam === 'user' || roleParam === 'staff')) {
        const targetTab = document.querySelector(`.role-tab[data-role="${roleParam}"]`);
        if (targetTab) {
            targetTab.click();
        }
    } else {
        // Initial sync for default role
        updateSigninLinks(currentRole);
    }

    // =========================================================================
    // 3. REGULAR USER DYNAMIC FIELD LOGIC
    // =========================================================================
    if (userTypeSelect) {
        userTypeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;

            if (selectedType === 'Student') {
                showField(userCollegeGroup, userCollegeSelect, true);
                hideField(userOfficeGroup, userOfficeSelect);
                showField(userOrgNameGroup, null, false);
                showField(userOrgPositionGroup, null, false);
            } else if (selectedType === 'Faculty') {
                showField(userCollegeGroup, userCollegeSelect, true);
                hideField(userOfficeGroup, userOfficeSelect);
                hideField(userOrgNameGroup, null);
                hideField(userOrgPositionGroup, null);
            } else if (selectedType === 'Non-Teaching Staff') {
                hideField(userCollegeGroup, userCollegeSelect);
                showField(userOfficeGroup, userOfficeSelect, true);
                hideField(userOrgNameGroup, null);
                hideField(userOrgPositionGroup, null);
            }
        });
    }

    // =========================================================================
    // 4. STAFF AFFILIATION DYNAMIC FIELD LOGIC
    // =========================================================================
    if (staffAffiliationTypeSelect) {
        staffAffiliationTypeSelect.addEventListener('change', (e) => {
            const affiliation = e.target.value;

            if (affiliation === 'College Staff') {
                showField(staffCollegeGroup, staffCollegeSelect, true);
                hideField(staffOfficeGroup, staffOfficeSelect);
            } else {
                hideField(staffCollegeGroup, staffCollegeSelect);
                showField(staffOfficeGroup, staffOfficeSelect, true);
            }
        });
    }

    function showField(groupElement, selectControl, isRequired = false) {
        if (!groupElement) return;
        groupElement.classList.remove('d-none');
        if (selectControl && isRequired) {
            selectControl.setAttribute('required', 'required');
        }
    }

    function hideField(groupElement, selectControl) {
        if (!groupElement) return;
        groupElement.classList.add('d-none');
        if (selectControl) {
            selectControl.removeAttribute('required');
            selectControl.value = '';
        }
        groupElement.classList.remove('has-error');
    }

    // =========================================================================
    // 5. PASSWORD VISIBILITY TOGGLE
    // =========================================================================
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

    // =========================================================================
    // 6. FORM VALIDATION LOGIC
    // =========================================================================
    const validateBuksuEmail = (email) => {
        const regex = /^[a-zA-Z0-9._%+-]+@buksu\.edu\.ph$/i;
        return regex.test(email.trim());
    };

    const validatePhoneNumber = (phone) => {
        const cleaned = phone.replace(/[\s-]/g, '');
        return /^(09|\+639)\d{9}$/.test(cleaned);
    };

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

    function clearValidationErrors() {
        document.querySelectorAll('.input-group, .terms-group').forEach(group => {
            group.classList.remove('has-error');
        });
    }

    document.querySelectorAll('.form-input, #termsAgreement').forEach(element => {
        element.addEventListener('input', () => clearError(element));
        element.addEventListener('change', () => clearError(element));
    });

    // =========================================================================
    // 7. FORM SUBMISSION WORKFLOW
    // =========================================================================
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let isValid = true;

        const activeContainer = currentRole === 'user' ? userSection : staffSection;
        const requiredInputs = activeContainer.querySelectorAll('[required]:not(.d-none [required])');

        // Check required inputs
        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                setError(input, 'This field is required');
                isValid = false;
            } else {
                clearError(input);
            }
        });

        // Email domain check
        const emailInput = currentRole === 'user' ? document.getElementById('userEmail') : document.getElementById('staffEmail');
        if (emailInput && emailInput.value.trim()) {
            if (!validateBuksuEmail(emailInput.value)) {
                setError(emailInput, 'Institutional email must end with @buksu.edu.ph');
                isValid = false;
            }
        }

        // Phone check
        const contactInput = currentRole === 'user' ? document.getElementById('userContact') : document.getElementById('staffContact');
        if (contactInput && contactInput.value.trim()) {
            if (!validatePhoneNumber(contactInput.value)) {
                setError(contactInput, 'Enter a valid PH mobile number (e.g. 09123456789)');
                isValid = false;
            }
        }

        // Passwords check
        if (!passwordInput.value) {
            setError(passwordInput, 'Password is required');
            isValid = false;
        } else if (passwordInput.value.length < 8) {
            setError(passwordInput, 'Password must be at least 8 characters long');
            isValid = false;
        }

        if (!confirmPasswordInput.value) {
            setError(confirmPasswordInput, 'Please confirm your password');
            isValid = false;
        } else if (passwordInput.value !== confirmPasswordInput.value) {
            setError(confirmPasswordInput, 'Passwords do not match');
            isValid = false;
        }

        // Terms check
        if (!termsCheckbox.checked) {
            setError(termsCheckbox, 'You must agree to the terms to complete registration');
            isValid = false;
        }

        // Submit Action
        if (isValid) {
            const submittedEmail = emailInput.value.trim();
            if (registeredEmailDisplay) {
                registeredEmailDisplay.textContent = submittedEmail;
            }
            if (approvalModal) {
                approvalModal.classList.add('active');
            }
        }
    });

    // SSO Handler
    if (googleSsoBtn) {
        googleSsoBtn.addEventListener('click', () => {
            alert('Connecting to BukSU Institutional Google OAuth...');
        });
    }

    // Modal Redirect
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            window.location.href = `signin.html?role=${currentRole}`;
        });
    }

});