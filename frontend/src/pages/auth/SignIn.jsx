import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import '../../assets/css/signin.css';

// =========================================================================
// BACKEND NOTE FOR DEVELOPER:
// 1. Ensure Express server is running on PORT 5000 (or update API_BASE_URL below).
// 2. ENABLE CORS in your Express server `app.js` or `server.js`:
//    const cors = require('cors');
//    app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
// 3. Ensure your authentication routes are registered under `/api/auth`:
//    - POST /api/auth/signin
//    - POST /api/auth/google
//    - POST /api/auth/forgot-password/request-code
//    - POST /api/auth/forgot-password/reset-password
// =========================================================================
const API_BASE_URL = 'http://localhost:5000/api/auth';

export default function SignIn() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [modalAlert1, setModalAlert1] = useState({ message: '', type: '' });
  const [modalAlert2, setModalAlert2] = useState({ message: '', type: '' });

  const navigateByRole = (role) => {
    switch (role) {
      case 'Administrator':
      case 'Moderator':
      case 'Regular Staff':
      case 'Student':
      default:
        navigate('/user-dashboard');
        break;
    }
  };

  // Initialize Google OAuth Overlay
  useEffect(() => {
    const clientId = '119378619205-32j7sol7rdlks9jmda04geetnlng6ovu.apps.googleusercontent.com';

    const handleGoogleCallback = async (response) => {
      try {
        setAlert({ message: 'Authenticating with Google...', type: 'info' });
        
        // =========================================================================
        // BACKEND NOTE:
        // POST /api/auth/google expects `{ credential: response.credential }`.
        // Server should verify token via Google Auth Library and return `{ user, token }`.
        // =========================================================================
        const res = await fetch(`${API_BASE_URL}/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential, agreedToTerms: true }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Google Sign-In failed.');

        login(data.user, data.token);
        setAlert({ message: 'Signed in successfully!', type: 'success' });
        navigateByRole(data.user?.role);
      } catch (err) {
        const errorMsg = err.name === 'TypeError' && err.message === 'Failed to fetch'
          ? 'Unable to connect to backend server. Check if Express server is running on PORT 5000 and CORS is enabled.'
          : err.message;
        setAlert({ message: errorMsg, type: 'error' });
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

  // Handle Login Form Submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAlert({ message: '', type: '' });

    if (!email || !password) {
      setAlert({ message: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      // =========================================================================
      // BACKEND NOTE:
      // POST /api/auth/signin expects `{ email, password }`.
      // Return payload format expected:
      // {
      //   message: "Login successful",
      //   token: "JWT_TOKEN_HERE",
      //   user: { id: "...", email: "...", role: "Student" | "Regular Staff" | "Moderator" | "Administrator" }
      // }
      // =========================================================================
      const response = await fetch(`${API_BASE_URL}/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Invalid email or password.');

      login(data.user, data.token);
      setAlert({ message: 'Signed in successfully!', type: 'success' });
      navigateByRole(data.user?.role);
    } catch (err) {
      const errorMsg = err.name === 'TypeError' && err.message === 'Failed to fetch'
        ? 'Cannot connect to server. Please verify Express API server is running on http://localhost:5000 and cors() middleware is enabled.'
        : err.message;
      setAlert({ message: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 1 Reset Password Submission
  const handleForgotStep1 = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setModalAlert1({ message: 'Please enter your email.', type: 'error' });
      return;
    }

    try {
      // =========================================================================
      // BACKEND NOTE:
      // POST /api/auth/forgot-password/request-code expects `{ email }`.
      // Should generate an OTP/Reset Code and send it via email (e.g. via Nodemailer).
      // =========================================================================
      const res = await fetch(`${API_BASE_URL}/forgot-password/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send reset code.');

      setModalAlert1({ message: '', type: '' });
      setResetStep(2);
    } catch (err) {
      const errorMsg = err.name === 'TypeError' && err.message === 'Failed to fetch'
        ? 'Server connection error. Check CORS & PORT 5000 backend status.'
        : err.message;
      setModalAlert1({ message: errorMsg, type: 'error' });
    }
  };

  // Handle Step 2 Password Update
  const handleForgotStep2 = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setModalAlert2({ message: 'Passwords do not match.', type: 'error' });
      return;
    }

    try {
      // =========================================================================
      // BACKEND NOTE:
      // POST /api/auth/forgot-password/reset-password expects `{ email, otp, newPassword, confirmPassword }`.
      // =========================================================================
      const res = await fetch(`${API_BASE_URL}/forgot-password/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          otp: resetCode,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password reset failed.');

      setModalAlert2({ message: 'Password updated successfully!', type: 'success' });
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err) {
      const errorMsg = err.name === 'TypeError' && err.message === 'Failed to fetch'
        ? 'Server connection error. Check CORS & PORT 5000 backend status.'
        : err.message;
      setModalAlert2({ message: errorMsg, type: 'error' });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setResetStep(1);
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setModalAlert1({ message: '', type: '' });
    setModalAlert2({ message: '', type: '' });
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <Link to="/" className="back-link">
          <i className="bi bi-arrow-left"></i> Go Back
        </Link>

        <header className="login-header">
          <h1 className="login-title">
            Log in to your <span>account</span>
          </h1>
          <p className="login-subtitle">
            Welcome! Enter your institutional credentials to access <strong>BukSUPPLY</strong>
          </p>
        </header>

        <form id="loginForm" className="login-form" onSubmit={handleLoginSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              <i className="bi bi-envelope-fill"></i> Institutional Email
            </label>
            <input
              type="email"
              id="email"
              className="form-input"
              placeholder="Enter your institutional email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              <i className="bi bi-lock-fill"></i> Password
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="forgot-wrapper">
              <button
                type="button"
                className="forgot-link"
                onClick={() => setIsModalOpen(true)}
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {alert.message && (
            <div className={`alert-banner ${alert.type}`}>{alert.message}</div>
          )}

          <div className="btn-wrapper">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>

        <div className="social-section" id="socialSection">
          <div className="divider">
            <span>or Log In with</span>
          </div>

          <div className="google-sso-wrapper">
            <button type="button" className="sso-google-btn">
              <i className="bi bi-google"></i> Continue with Google
            </button>
            <div id="googleSsoBtn" className="google-overlay"></div>
          </div>
        </div>

        <div className="login-footer" id="signupFooter">
          <p>
            Don’t have an account?{' '}
            <Link to="/signup" className="create-account-link">
              Create Account
            </Link>
          </p>
        </div>
      </div>

      <div className={`modal-overlay ${!isModalOpen ? 'hidden' : ''}`}>
        <div className="modal-card">
          <button
            type="button"
            className="modal-close-btn"
            title="Close Modal"
            onClick={closeModal}
          >
            <i className="bi bi-x-lg"></i>
          </button>

          {resetStep === 1 && (
            <div id="forgotStep1" className="modal-step">
              <header className="modal-header">
                <h2 className="modal-title">
                  Reset your <span>Password</span>
                </h2>
                <p className="modal-subtitle">
                  Enter your institutional email and we'll send you a verification code to reset your password.
                </p>
              </header>

              <form className="login-form" onSubmit={handleForgotStep1}>
                <div className="form-group">
                  <label htmlFor="resetEmail" className="form-label">
                    <i className="bi bi-envelope-fill"></i> Institutional Email
                  </label>
                  <input
                    type="email"
                    id="resetEmail"
                    className="form-input"
                    placeholder="Enter your institutional email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>

                {modalAlert1.message && (
                  <div className={`alert-banner ${modalAlert1.type}`}>
                    {modalAlert1.message}
                  </div>
                )}

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit">
                    Send Reset Code
                  </button>
                </div>
              </form>
            </div>
          )}

          {resetStep === 2 && (
            <div id="forgotStep2" className="modal-step">
              <header className="modal-header">
                <h2 className="modal-title">
                  Set New <span>Password</span>
                </h2>
                <p className="modal-subtitle">
                  Enter the 6-digit code sent to your email along with your new password.
                </p>
              </header>

              <form className="login-form" onSubmit={handleForgotStep2}>
                <div className="form-group">
                  <label htmlFor="resetCode" className="form-label">
                    <i className="bi bi-shield-lock-fill"></i> 6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    id="resetCode"
                    className="form-input"
                    placeholder="e.g. 123456"
                    maxLength="6"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="form-label">
                    <i className="bi bi-lock-fill"></i> New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    className="form-input"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmNewPassword" className="form-label">
                    <i className="bi bi-lock-fill"></i> Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmNewPassword"
                    className="form-input"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>

                {modalAlert2.message && (
                  <div className={`alert-banner ${modalAlert2.type}`}>
                    {modalAlert2.message}
                  </div>
                )}

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit">
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}