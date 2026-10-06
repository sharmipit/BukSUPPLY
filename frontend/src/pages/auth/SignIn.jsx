import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../../assets/css/signin.css';

export default function SignIn() {
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState({ message: '', type: '' });

  // Forgot Password Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [modalAlert1, setModalAlert1] = useState({ message: '', type: '' });
  const [modalAlert2, setModalAlert2] = useState({ message: '', type: '' });

  // Initialize Google OAuth Overlay
  useEffect(() => {
    const clientId = '119378619205-32j7sol7rdlks9jmda04geetnlng6ovu.apps.googleusercontent.com';

    const handleGoogleCallback = (response) => {
      // =========================================================================
      // TODO FOR BACKEND DEVELOPER:
      // 1. Send `response.credential` (ID Token JWT) to backend endpoint (e.g., POST /api/auth/google).
      // 2. Verify token integrity using Google Auth Library (`google-auth-library` or equivalent).
      // 3. Match `email` against existing database records and return session JWT/token.
      // 4. Resolve `origin_mismatch` (Error 400) by registering your domain/localhost in 
      //    Google Cloud Console under "Authorized JavaScript origins".
      // =========================================================================
      console.log('Google Auth Credential Received:', response.credential);
      setAlert({ message: 'Google Authentication Successful!', type: 'success' });
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
          targetDiv.innerHTML = ''; // Clear prior iframe renders to enable unlimited multi-clicks
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
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setAlert({ message: 'Please fill in all required fields.', type: 'error' });
      return;
    }
    setAlert({ message: 'Logging in...', type: 'info' });
  };

  // Handle Step 1 Reset Password Submission
  const handleForgotStep1 = (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setModalAlert1({ message: 'Please enter your email.', type: 'error' });
      return;
    }
    setModalAlert1({ message: '', type: '' });
    setResetStep(2);
  };

  // Handle Step 2 Password Update
  const handleForgotStep2 = (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setModalAlert2({ message: 'Passwords do not match.', type: 'error' });
      return;
    }
    setModalAlert2({ message: 'Password updated successfully!', type: 'success' });
    setTimeout(() => {
      closeModal();
    }, 1500);
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
        {/* Go Back Link */}
        <Link to="/" className="back-link">
          <i className="bi bi-arrow-left"></i> Go Back
        </Link>

        {/* Header Section */}
        <header className="login-header">
          <h1 className="login-title">
            Log in to your <span>account</span>
          </h1>
          <p className="login-subtitle">
            Welcome! Enter your institutional credentials to access{' '}
            <strong>BukSUPPLY</strong>
          </p>
        </header>

        {/* Universal Login Form */}
        <form id="loginForm" className="login-form" onSubmit={handleLoginSubmit}>
          {/* Email Address */}
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

          {/* Password */}
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
            {/* Forgot Password Link */}
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

          {/* Notification Banner */}
          {alert.message && (
            <div className={`alert-banner ${alert.type}`}>{alert.message}</div>
          )}

          {/* Submit Button */}
          <div className="btn-wrapper">
            <button type="submit" className="btn-submit">
              Log In
            </button>
          </div>
        </form>

        {/* SSO / Google Section */}
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

        {/* Footer Account Link */}
        <div className="login-footer" id="signupFooter">
          <p>
            Don’t have an account?{' '}
            <Link to="/signup" className="create-account-link">
              Create Account
            </Link>
          </p>
        </div>
      </div>

      {/* FORGOT / RESET PASSWORD MODAL */}
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

          {/* STEP 1: Request Reset Link */}
          {resetStep === 1 && (
            <div id="forgotStep1" className="modal-step">
              <header className="modal-header">
                <h2 className="modal-title">
                  Reset your <span>Password</span>
                </h2>
                <p className="modal-subtitle">
                  Enter your institutional email and we'll send you a verification
                  code to reset your password.
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

          {/* STEP 2: Enter Code & Set New Password */}
          {resetStep === 2 && (
            <div id="forgotStep2" className="modal-step">
              <header className="modal-header">
                <h2 className="modal-title">
                  Set New <span>Password</span>
                </h2>
                <p className="modal-subtitle">
                  Enter the 6-digit code sent to your email along with your new
                  password.
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