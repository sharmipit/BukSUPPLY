import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import '../../assets/css/signup.css';

// =========================================================================
// BACKEND NOTE FOR DEVELOPER:
// 1. Ensure Express server is running on PORT 5000 (or update API_BASE_URL below).
// 2. ENABLE CORS in your Express server:
//    const cors = require('cors');
//    app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
// 3. Ensure your registration routes are registered under `/api/auth/signup`:
//    - POST /api/auth/signup
//    - POST /api/auth/google
// =========================================================================
const API_BASE_URL = 'http://localhost:5000/api/auth';

export default function SignUp() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    idNumber: '',
    password: '',
    confirmPassword: '',
    termsAgreement: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  useEffect(() => {
    const clientId = '119378619205-32j7sol7rdlks9jmda04geetnlng6ovu.apps.googleusercontent.com';

    const handleGoogleCallback = async (response) => {
      try {
        setGeneralError('');
        
        // =========================================================================
        // BACKEND NOTE:
        // POST /api/auth/google expects `{ credential: response.credential, agreedToTerms: true }`.
        // Server creates/finds the user, assigns role by domain (`@student.buksu.edu.ph` vs `@buksu.edu.ph`),
        // and returns `{ user, token }`.
        // =========================================================================
        const res = await fetch(`${API_BASE_URL}/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential, agreedToTerms: true }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Google registration failed.');

        if (data.token) {
          login(data.user, data.token);
        }
        setIsSuccessModalOpen(true);
      } catch (err) {
        const errorMsg = err.name === 'TypeError' && err.message === 'Failed to fetch'
          ? 'Cannot connect to backend server. Verify Express server is running on http://localhost:5000 and CORS is enabled.'
          : err.message;
        setGeneralError(errorMsg);
      }
    };

    const initializeGoogleBtn = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const targetDiv = document.getElementById('googleSsoBtn');
        if (targetDiv) {
          targetDiv.innerHTML = '';
          window.google.accounts.id.renderButton(targetDiv, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            width: 380,
          });
        }
      }
    };

    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleBtn;
      document.body.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initializeGoogleBtn();
          clearInterval(checkInterval);
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!formData.email.trim()) {
      newErrors.email = 'Institutional email is required';
    } else if (!/^[^@\s]+@(student\.)?buksu\.edu\.ph$/.test(formData.email)) {
      newErrors.email = 'Must be an institutional email (@student.buksu.edu.ph or @buksu.edu.ph)';
    }

    if (!formData.idNumber.trim()) newErrors.idNumber = 'ID Number is required';

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.termsAgreement) {
      newErrors.termsAgreement = 'You must agree to the terms and privacy policy to proceed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      // =========================================================================
      // BACKEND NOTE:
      // POST /api/auth/signup expects `{ firstName, lastName, email, idNumber, password, confirmPassword, termsAgreement }`.
      // The backend will automatically map role based on domain:
      // - @student.buksu.edu.ph => Student
      // - @buksu.edu.ph => Regular Staff
      // =========================================================================
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed.');

      setIsSuccessModalOpen(true);
    } catch (err) {
      const errorMsg = err.name === 'TypeError' && err.message === 'Failed to fetch'
        ? 'Cannot connect to backend server. Verify Express API is running on http://localhost:5000 and cors() middleware is active.'
        : err.message;
      setGeneralError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-wrapper">
      <div className="signup-card">
        <Link to="/signin" className="back-link">
          <i className="bi bi-arrow-left"></i> Go Back
        </Link>

        <div className="signup-header">
          <h1 className="signup-title">
            Create your <span>account</span>
          </h1>
          <p className="signup-subtitle">Register to submit requisitions and reservations</p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className={`input-group ${errors.firstName ? 'has-error' : ''}`}>
              <label htmlFor="firstName" className="form-label">
                First Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                className="form-input"
                placeholder="e.g. Juan"
                value={formData.firstName}
                onChange={handleChange}
              />
              {errors.firstName && <span className="error-msg">{errors.firstName}</span>}
            </div>

            <div className={`input-group ${errors.lastName ? 'has-error' : ''}`}>
              <label htmlFor="lastName" className="form-label">
                Last Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                className="form-input"
                placeholder="e.g. Dela Cruz"
                value={formData.lastName}
                onChange={handleChange}
              />
              {errors.lastName && <span className="error-msg">{errors.lastName}</span>}
            </div>

            <div className={`input-group full-width ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="email" className="form-label">
                Institutional Email <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                placeholder="Enter your institutional email"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>

            <div className={`input-group full-width ${errors.idNumber ? 'has-error' : ''}`}>
              <label htmlFor="idNumber" className="form-label">
                ID Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="idNumber"
                name="idNumber"
                className="form-input"
                placeholder="Student ID or Personnel ID Number"
                value={formData.idNumber}
                onChange={handleChange}
              />
              {errors.idNumber && <span className="error-msg">{errors.idNumber}</span>}
            </div>

            <div className={`input-group ${errors.password ? 'has-error' : ''}`}>
              <label htmlFor="password" className="form-label">
                <i className="bi bi-lock"></i> Password <span className="required">*</span>
              </label>
              <div className="input-icon-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  className="form-input with-suffix"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  <i className={`bi bi-${showPassword ? 'eye-slash' : 'eye'}`}></i>
                </button>
              </div>
              {errors.password && <span className="error-msg">{errors.password}</span>}
            </div>

            <div className={`input-group ${errors.confirmPassword ? 'has-error' : ''}`}>
              <label htmlFor="confirmPassword" className="form-label">
                <i className="bi bi-lock"></i> Confirm Password <span className="required">*</span>
              </label>
              <div className="input-icon-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  className="form-input with-suffix"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle password visibility"
                >
                  <i className={`bi bi-${showConfirmPassword ? 'eye-slash' : 'eye'}`}></i>
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error-msg">{errors.confirmPassword}</span>
              )}
            </div>
          </div>

          <div className={`terms-group ${errors.termsAgreement ? 'has-error' : ''}`}>
            <label className="custom-checkbox-container">
              <input
                type="checkbox"
                name="termsAgreement"
                checked={formData.termsAgreement}
                onChange={handleChange}
              />
              <span className="checkmark"></span>
              <span className="checkbox-label">
                I agree to the{' '}
                <a href="#terms" className="inline-link">
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a href="#privacy" className="inline-link">
                  Privacy Policy
                </a>{' '}
                of BukSU PSMO.
              </span>
            </label>
            {errors.termsAgreement && (
              <span className="error-msg">{errors.termsAgreement}</span>
            )}
          </div>

          {generalError && <p className="form-error" style={{ color: '#dc2626', marginTop: '10px' }}>{generalError}</p>}

          <div className="btn-wrapper">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="social-section">
          <div className="divider">
            <span>or Sign Up with</span>
          </div>

          <div className="google-sso-wrapper">
            <button type="button" className="sso-google-btn">
              <i className="bi bi-google"></i> Continue with Google
            </button>
            <div id="googleSsoBtn" className="google-overlay"></div>
          </div>
        </div>

        <div className="signup-footer">
          <p>
            Already have an account?{' '}
            <Link to="/signin" className="create-account-link">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      <div className={`modal-overlay ${!isSuccessModalOpen ? 'hidden' : ''}`}>
        <div className="modal-card">
          <div className="modal-icon-wrapper success-icon">
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <h2 className="modal-title">Account Created Successfully!</h2>
          <p className="modal-description">
            Welcome to <strong>BukSUPPLY</strong>! Your account has been registered and activated. You can now proceed to sign in.
          </p>
          <button
            type="button"
            className="btn-submit modal-btn"
            onClick={() => navigate('/signin')}
          >
            Proceed to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}