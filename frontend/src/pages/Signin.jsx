import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { errMsg } from '../api/client';
import { useAuth, ROLE_HOME, homeFor } from '../context/AuthContext';
import usePage from '../hooks/usePage';
import usePublicConfig from '../hooks/usePublicConfig';
import css from '../styles/signin.css?raw';

const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;
const NO_BANNER = { message: '', type: '' };

// Renders nothing when there is no message (prevents flashing)
function Banner({ banner }) {
  if (!banner.message) return null;
  return <div className={`alert-banner ${banner.type}`}>{banner.message}</div>;
}

// Password input with a show/hide eye button
function PasswordInput({ id, value, onChange, placeholder, visible, onToggle }) {
  return (
    <div className="input-icon-wrapper">
      <input
        type={visible ? 'text' : 'password'}
        id={id}
        className="form-input with-suffix"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required
      />
      <button
        type="button"
        className="toggle-password-btn"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={onToggle}
      >
        <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`}></i>
      </button>
    </div>
  );
}

export default function Signin() {
  usePage(css, 'Sign In | BukSUPPLY');
  const { login } = useAuth();
  const navigate = useNavigate();
  const config = usePublicConfig(); // keys and on/off switches from System Settings

  // ---------- Sign in form ----------
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState(NO_BANNER);
  const [busy, setBusy] = useState(false);
  const recaptchaRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState(null);

  // 2FA: set when the server asks an admin for an authenticator code
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');

  // Shared by email/password, Google sign-in and the 2FA code step
  const completeSignIn = (data) => {
    // 2FA: admin with two-step verification on. No session yet, ask for the code.
    if (data.twoFactorRequired) {
      setChallenge(data.challengeToken);
      setCode('');
      setBanner(NO_BANNER);
      return;
    }

    const { token, user } = data;
    if (!ROLE_HOME[user.role]) {
      setBanner({ message: 'This account type is not supported here yet.', type: 'error' });
      return;
    }
    login(token, user);
    setBanner({ message: 'Signed in! Redirecting...', type: 'success' });
    navigate(homeFor(user.role), { replace: true });
  };

  // 2FA: second step, 6-digit authenticator code or a one-time backup code
  const verifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setBanner({ message: 'Enter the code from your authenticator app.', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/2fa/verify', {
        challengeToken: challenge,
        code: code.trim(),
      });
      completeSignIn(data);
    } catch (err) {
      setBanner({ message: errMsg(err), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // 2FA: leave the code step and return to the normal form
  const backToSignin = () => {
    setChallenge(null);
    setCode('');
    setBanner(NO_BANNER);
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBanner(NO_BANNER);

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setBanner({
        message:
          'Please use a valid BukSU institutional email address (@student.buksu.edu.ph or @buksu.edu.ph).',
        type: 'error',
      });
      return;
    }
    if (!password) {
      setBanner({ message: 'Please enter your password.', type: 'error' });
      return;
    }

    // reCAPTCHA check (only when it is turned on in System Settings)
    if (config.recaptchaEnabled && !captchaToken) {
      setBanner({ message: 'Please confirm you are not a robot.', type: 'error' });
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post('/auth/signin', {
        email: cleanEmail,
        password,
        recaptchaToken: captchaToken,
      });
      completeSignIn(data);
    } catch (err) {
      recaptchaRef.current?.reset(); // token is single-use
      setCaptchaToken(null);
      setBanner({ message: errMsg(err), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // ---------- Google sign in ----------
  const handleGoogle = async (credential) => {
    setBanner(NO_BANNER);
    try {
      const { data } = await api.post('/auth/google', { credential });
      completeSignIn(data);
    } catch (err) {
      // No account yet: new users must register (ID number + terms) on the sign-up page
      if (err.response?.status === 428) {
        navigate('/signup', { replace: true });
        return;
      }
      setBanner({ message: errMsg(err), type: 'error' });
    }
  };

  // ---------- Forgot / reset password modal ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [alert1, setAlert1] = useState(NO_BANNER);
  const [alert2, setAlert2] = useState(NO_BANNER);
  const [modalBusy, setModalBusy] = useState(false);

  const openModal = (e) => {
    e.preventDefault();
    setStep(1);
    setResetEmail('');
    setOtp('');
    setNewPass('');
    setConfirmPass('');
    setShowNewPass(false);
    setShowConfirmPass(false);
    setAlert1(NO_BANNER);
    setAlert2(NO_BANNER);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  // Step 1: request the code
  const requestCode = async (e) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    setAlert1({ message: 'Sending code...', type: 'info' });
    setModalBusy(true);
    try {
      await api.post('/auth/forgot-password/request-code', { email: cleanEmail });
      setResetEmail(cleanEmail);
      setStep(2);
      setAlert2({
        message: `Code sent to ${cleanEmail}! Check your inbox. It expires in 15 minutes.`,
        type: 'info',
      });
    } catch (err) {
      setAlert1({ message: errMsg(err), type: 'error' });
    } finally {
      setModalBusy(false);
    }
  };

  // Step 2: code + new password
  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      setAlert2({ message: 'Passwords do not match. Please try again.', type: 'error' });
      return;
    }
    setAlert2({ message: 'Updating password...', type: 'info' });
    setModalBusy(true);
    try {
      await api.post('/auth/forgot-password/reset-password', {
        email: resetEmail,
        otp: otp.trim(),
        newPassword: newPass,
        confirmPassword: confirmPass,
      });
      setAlert2({ message: 'Password successfully reset! You can now log in.', type: 'success' });
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      setAlert2({ message: errMsg(err), type: 'error' });
    } finally {
      setModalBusy(false);
    }
  };

  return (
    <>
      <main className="login-wrapper">
        <div className="login-card">
          <Link to="/" className="back-link">
            <i className="bi bi-arrow-left"></i> Go Back
          </Link>

          <header className="login-header">
            <h1 className="login-title">
              Log in to your <span>account</span>
            </h1>
            <p className="login-subtitle">
              {challenge ? (
                'Two-step verification: enter the code from your authenticator app.'
              ) : (
                <>
                  Welcome! Enter your institutional credentials to access{' '}
                  <strong>BukSUPPLY</strong>
                </>
              )}
            </p>
          </header>

          {challenge ? (
            /* 2FA: code step (replaces the sign-in form and Google button) */
            <form className="login-form" onSubmit={verifyCode}>
              <div className="form-group">
                <label htmlFor="twoFactorCode" className="form-label">
                  <i className="bi bi-shield-lock-fill"></i> Verification Code
                </label>
                <input
                  type="text"
                  id="twoFactorCode"
                  className="form-input"
                  placeholder="6-digit code or backup code"
                  maxLength={10}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.trim());
                    setBanner(NO_BANNER);
                  }}
                  autoFocus
                  required
                />
              </div>

              <Banner banner={banner} />

              <div className="btn-wrapper">
                <button type="submit" className="btn-submit" disabled={busy}>
                  {busy ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              <div className="forgot-wrapper">
                <a
                  href="#"
                  className="forgot-link"
                  onClick={(e) => {
                    e.preventDefault();
                    backToSignin();
                  }}
                >
                  Back to sign in
                </a>
              </div>
            </form>
          ) : (
            <>
              <form id="loginForm" className="login-form" onSubmit={onSubmit}>
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setBanner(NO_BANNER);
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    <i className="bi bi-lock-fill"></i> Password
                  </label>
                  <PasswordInput
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setBanner(NO_BANNER);
                    }}
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                  <div className="forgot-wrapper">
                    <a href="#" className="forgot-link" id="openForgotModal" onClick={openModal}>
                      Forgot Password?
                    </a>
                  </div>
                </div>

                {/* reCAPTCHA (hidden when turned off in System Settings) */}
                {config.recaptchaEnabled && (
                  <div className="recaptcha-group">
                    <ReCAPTCHA
                      key={config.recaptchaSiteKey}
                      ref={recaptchaRef}
                      sitekey={config.recaptchaSiteKey}
                      onChange={(token) => {
                        setCaptchaToken(token);
                        setBanner(NO_BANNER);
                      }}
                      onExpired={() => setCaptchaToken(null)}
                    />
                  </div>
                )}

                <Banner banner={banner} />

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit" disabled={busy || !config.loaded}>
                    {busy ? 'Signing in...' : 'Log In'}
                  </button>
                </div>
              </form>

              {/* Google (hidden when turned off in System Settings) */}
              {config.googleEnabled && (
                <div className="social-section" id="socialSection">
                  <div className="divider">
                    <span>or Log In with</span>
                  </div>

                  <div className="google-sso-wrapper">
                    <button type="button" className="sso-google-btn">
                      <i className="bi bi-google"></i> Continue with Google
                    </button>
                    <div className="google-overlay">
                      <GoogleOAuthProvider clientId={config.googleClientId}>
                        <GoogleLogin
                          theme="outline"
                          size="large"
                          width="320"
                          text="continue_with"
                          onSuccess={(res) => handleGoogle(res.credential)}
                          onError={() =>
                            setBanner({ message: 'Google sign-in failed.', type: 'error' })
                          }
                        />
                      </GoogleOAuthProvider>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="login-footer" id="signupFooter">
            <p>
              Don&rsquo;t have an account?{' '}
              <Link to="/signup" className="create-account-link">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* FORGOT / RESET PASSWORD MODAL (only mounted while open) */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="modal-card">
            <button
              type="button"
              className="modal-close-btn"
              title="Close Modal"
              onClick={closeModal}
            >
              <i className="bi bi-x-lg"></i>
            </button>

            {/* STEP 1 */}
            <div className={`modal-step${step === 1 ? '' : ' hidden'}`}>
              <header className="modal-header">
                <h2 className="modal-title">
                  Reset your <span>Password</span>
                </h2>
                <p className="modal-subtitle">
                  Enter your institutional email and we&apos;ll send you a verification code to
                  reset your password.
                </p>
              </header>

              <form className="login-form" onSubmit={requestCode}>
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

                <Banner banner={alert1} />

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit" disabled={modalBusy}>
                    Send Reset Code
                  </button>
                </div>
              </form>
            </div>

            {/* STEP 2 */}
            <div className={`modal-step${step === 2 ? '' : ' hidden'}`}>
              <header className="modal-header">
                <h2 className="modal-title">
                  Set New <span>Password</span>
                </h2>
                <p className="modal-subtitle">
                  Enter the 6-digit code sent to your email along with your new password.
                </p>
              </header>

              <form className="login-form" onSubmit={resetPassword}>
                <div className="form-group">
                  <label htmlFor="resetCode" className="form-label">
                    <i className="bi bi-shield-lock-fill"></i> 6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    id="resetCode"
                    className="form-input"
                    placeholder="e.g. 123456"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="form-label">
                    <i className="bi bi-lock-fill"></i> New Password
                  </label>
                  <PasswordInput
                    id="newPassword"
                    placeholder="Enter new password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    visible={showNewPass}
                    onToggle={() => setShowNewPass((v) => !v)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmNewPassword" className="form-label">
                    <i className="bi bi-lock-fill"></i> Confirm New Password
                  </label>
                  <PasswordInput
                    id="confirmNewPassword"
                    placeholder="Confirm new password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    visible={showConfirmPass}
                    onToggle={() => setShowConfirmPass((v) => !v)}
                  />
                </div>

                <Banner banner={alert2} />

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit" disabled={modalBusy}>
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}