import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { errMsg } from '../api/client';
import { useAuth, ROLE_HOME, homeFor } from '../context/AuthContext';
import usePage from '../hooks/usePage';
import usePublicConfig from '../hooks/usePublicConfig';
import GoogleAuthButton from '../components/GoogleAuthButton';
import css from '../styles/signin.css?raw';

// Matches institutional BukSU emails (@student.buksu.edu.ph or @buksu.edu.ph) and allowed test accounts.
const EMAIL_PATTERN = /^([^@\s]+@(student\.)?buksu\.edu\.ph|sharmagnegamboa11@gmail\.com)$/i;
const EMAIL_MESSAGE =
  'Please use a valid BukSU institutional email address (@student.buksu.edu.ph or @buksu.edu.ph).';
const NO_BANNER = { message: '', type: '' };
const REACTIVATION_MIN = 10;
const REACTIVATION_MAX = 500;

// Format date in Philippine time (Asia/Manila)
const fmtDay = (v) =>
  v ? new Date(v).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }) : '';

// Password validation rule for resetting password
const passwordProblem = (pw) => {
  if (!pw) return 'Please enter a new password.';
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    return 'Password must include at least one letter and one number.';
  return '';
};

// Renders nothing when there is no message (prevents flashing)
function Banner({ banner }) {
  if (!banner.message) return null;
  return <div className={`alert-banner ${banner.type}`}>{banner.message}</div>;
}

// Password input with a show/hide eye button
function PasswordInput({ id, value, onChange, placeholder, visible, onToggle, autoComplete }) {
  return (
    <div className="input-icon-wrapper">
      <input
        type={visible ? 'text' : 'password'}
        id={id}
        className="form-input with-suffix"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
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

// Pop-up shown when the account is deactivated: explains why and lets the user write to the administrator
function DeactivatedModal({ info, onRequest, onClose }) {
  const { deactivation, request, lastDecline } = info;
  const pending = request && request.status === 'Pending';
  const archived = Boolean(info.archived); // archived accounts cannot send a request

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card captcha-card deact-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactTitle"
      >
        {/* The icon badge is shown in every state (including "request sent") */}
        <div className="captcha-icon">
          <i className="bi bi-person-x"></i>
        </div>
        <h2 className="modal-title" id="deactTitle">
          Account deactivated
        </h2>

        {pending ? (
          <p className="modal-subtitle">
            Your reactivation request was sent on <strong>{fmtDay(request.date)}</strong>. The
            administrator will review it, and we will email you once there is a decision.
          </p>
        ) : (
          <>
            {deactivation?.source === 'self' ? (
              <p className="modal-subtitle">You deactivated this account yourself.</p>
            ) : deactivation?.reason ? (
              <>
                <p className="modal-subtitle">
                  An administrator deactivated your account for this reason:
                </p>
                <div className="deact-reason">{deactivation.reason}</div>
              </>
            ) : (
              <p className="modal-subtitle">An administrator deactivated this account.</p>
            )}

            {lastDecline && (
              <>
                <p className="modal-subtitle deact-gap">
                  Your last request was declined on {fmtDay(lastDecline.date)}
                  {lastDecline.note ? ' with this note:' : '.'}
                </p>
                {lastDecline.note && <div className="deact-reason note">{lastDecline.note}</div>}
              </>
            )}

            {archived ? (
              <p className="modal-subtitle deact-gap">
                This account has been archived. Please contact the administrator in person if you
                would like to come back.
              </p>
            ) : (
              <p className="modal-subtitle deact-gap">
                If you think this is a mistake, or you would like to come back, you can send a
                request to the administrator.
              </p>
            )}
          </>
        )}

        <div className="deact-actions">
          {!pending && !archived && (
            <button type="button" className="btn-submit" onClick={onRequest}>
              Request Reactivation
            </button>
          )}
          <button type="button" className="captcha-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Pop-up shown once, before the first sign-in after an administrator reactivated the account
function ReactivatedModal({ info, onContinue }) {
  return (
    <div className="modal-overlay">
      <div
        className="modal-card captcha-card deact-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reactivatedTitle"
      >
        <div className="captcha-icon success">
          <i className="bi bi-person-check"></i>
        </div>
        <h2 className="modal-title" id="reactivatedTitle">
          Account reactivated
        </h2>
        <p className="modal-subtitle">
          Good news! An administrator reactivated your account
          {info.date ? (
            <>
              {' '}
              on <strong>{fmtDay(info.date)}</strong>
            </>
          ) : null}
          .
        </p>

        {info.reason && (
          <>
            <p className="modal-subtitle deact-gap">Reason:</p>
            <div className="deact-reason good">{info.reason}</div>
          </>
        )}

        <p className="modal-subtitle deact-gap">You can now use your account again.</p>

        <div className="deact-actions">
          <button type="button" className="btn-submit" onClick={onContinue} autoFocus>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Signin() {
  usePage(css, 'Sign In | BukSUPPLY');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const config = usePublicConfig(); // keys and on/off switches from System Settings

  // Sign in form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // A message passed from the Sign Up page (e.g. "You already have an account")
  const [banner, setBanner] = useState(() =>
    location.state?.notice ? { message: location.state.notice, type: 'info' } : NO_BANNER
  );
  const [busy, setBusy] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false); // reCAPTCHA pop-up
  const googleBusyRef = useRef(false); // stops double submits of the Google sign-in
  // Set when the server says the account is deactivated: { info, credentials }.
  // credentials are kept only in memory so the request can prove who is asking.
  const [deactivated, setDeactivated] = useState(null);
  const [deactOpen, setDeactOpen] = useState(false); // the "account deactivated" pop-up
  const closeTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  // Set when the account was just reactivated: { token, user, reactivation: { reason, date } }.
  // The person is only signed in after they press Continue on the pop-up.
  const [welcomeBack, setWelcomeBack] = useState(null);

  const finishSignIn = ({ token, user }) => {
    login(token, user);
    setBanner({ message: 'Signed in! Redirecting...', type: 'success' });
    navigate(homeFor(user.role), { replace: true });
  };

  // Shared by email/password and Google sign-in
  const completeSignIn = (data) => {
    if (!ROLE_HOME[data.user.role]) {
      setBanner({ message: 'This account type is not supported here yet.', type: 'error' });
      return;
    }
    if (data.reactivation) {
      setWelcomeBack(data);
      return;
    }
    finishSignIn(data);
  };

  const continueAfterReactivation = () => {
    const data = welcomeBack;
    if (!data) return;
    setWelcomeBack(null);
    // Tell the server the pop-up was seen so it is not shown again (never blocks sign-in)
    api
      .post('/auth/reactivation-notice/seen', null, {
        headers: { Authorization: `Bearer ${data.token}` },
      })
      .catch(() => {});
    finishSignIn(data);
  };

  // Sends the sign-in request. captchaToken is null when reCAPTCHA is turned off.
  const signIn = async (captchaToken) => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/signin', {
        email: email.trim().toLowerCase(),
        password,
        recaptchaToken: captchaToken,
      });
      completeSignIn(data);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === 'ACCOUNT_DEACTIVATED') {
        setDeactivated({
          info: err.response.data,
          credentials: { email: email.trim().toLowerCase(), password },
        });
        setDeactOpen(true);
        return;
      }
      setBanner({ message: errMsg(err), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Step 1: check the form. Step 2: reCAPTCHA pop-up (if on). Step 3: send.
  const onSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    setBanner(NO_BANNER);
    setDeactivated(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setBanner({ message: EMAIL_MESSAGE, type: 'error' });
      return;
    }
    if (!password) {
      setBanner({ message: 'Please enter your password.', type: 'error' });
      return;
    }

    // reCAPTCHA is only asked once the form itself is valid
    if (config.recaptchaEnabled) {
      setCaptchaOpen(true);
      return;
    }
    signIn(null);
  };

  // The token is single-use, so we send it right away and close the pop-up
  const onCaptchaSolved = (token) => {
    if (!token) return;
    setCaptchaOpen(false);
    signIn(token);
  };

  useEffect(() => {
    if (!captchaOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setCaptchaOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [captchaOpen]);

  // Google sign in
  const handleGoogle = async (credential) => {
    if (googleBusyRef.current) return;
    googleBusyRef.current = true;
    setBanner(NO_BANNER);
    setDeactivated(null);
    try {
      const { data } = await api.post('/auth/google', { credential });
      completeSignIn(data);
    } catch (err) {
      // No account yet: new users must register (ID number + terms) on the sign-up page
      if (err.response?.status === 428) {
        navigate('/signup', {
          replace: true,
          state: { notice: 'No account found for that Google account yet. Please create one.' },
        });
        return;
      }
      if (err.response?.status === 403 && err.response?.data?.code === 'ACCOUNT_DEACTIVATED') {
        setDeactivated({ info: err.response.data, credentials: { credential } });
        setDeactOpen(true);
        return;
      }
      setBanner({ message: errMsg(err), type: 'error' });
    } finally {
      googleBusyRef.current = false;
    }
  };

  // Request reactivation modal
  const [reactOpen, setReactOpen] = useState(false);
  const [reactMessage, setReactMessage] = useState('');
  const [reactAlert, setReactAlert] = useState(NO_BANNER);
  const [reactBusy, setReactBusy] = useState(false);

  // Request pop-up replaces the "deactivated" pop-up; closing it brings that one back
  const openReactivation = () => {
    setReactMessage('');
    setReactAlert(NO_BANNER);
    setDeactOpen(false);
    setReactOpen(true);
  };
  const closeReactivation = () => {
    setReactOpen(false);
    setDeactOpen(true);
  };

  useEffect(() => {
    if (!deactOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDeactOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deactOpen]);

  useEffect(() => {
    if (!reactOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeReactivation();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reactOpen]);

  const markRequestPending = (date) =>
    setDeactivated((d) =>
      d ? { ...d, info: { ...d.info, request: { status: 'Pending', date } } } : d
    );

  const sendReactivation = async (e) => {
    e.preventDefault();
    if (reactBusy || !deactivated) return;

    const text = reactMessage.trim();
    if (text.length < REACTIVATION_MIN) {
      setReactAlert({
        message: `Please write at least ${REACTIVATION_MIN} characters so the administrator knows why.`,
        type: 'error',
      });
      return;
    }

    setReactBusy(true);
    setReactAlert({ message: 'Sending your request...', type: 'info' });
    try {
      const { data } = await api.post('/auth/reactivation-request', {
        ...deactivated.credentials,
        message: text,
      });
      markRequestPending(data.request?.date || new Date().toISOString());
      closeReactivation(); // shows the "request sent" message
    } catch (err) {
      if (err.response?.status === 409 && !err.response?.data?.message?.includes('not deactivated')) {
        // A request was already waiting
        markRequestPending(new Date().toISOString());
        closeReactivation();
      } else {
        setReactAlert({ message: errMsg(err), type: 'error' });
      }
    } finally {
      setReactBusy(false);
    }
  };

  // Forgot / reset password modal
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
    clearTimeout(closeTimerRef.current);
    setStep(1);
    setResetEmail(email.trim()); // reuse what was typed on the login form
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

  // Go back to step 1 (wrong email, or the code never arrived)
  const backToStep1 = (e) => {
    e.preventDefault();
    setOtp('');
    setAlert1(NO_BANNER);
    setAlert2(NO_BANNER);
    setStep(1);
  };

  // Step 1: request the code
  const requestCode = async (e) => {
    e.preventDefault();
    if (modalBusy) return;
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setAlert1({ message: EMAIL_MESSAGE, type: 'error' });
      return;
    }
    setAlert1({ message: 'Sending code...', type: 'info' });
    setModalBusy(true);
    try {
      await api.post('/auth/forgot-password/request-code', { email: cleanEmail });
      setResetEmail(cleanEmail);
      setStep(2);
      setAlert1(NO_BANNER);
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
    if (modalBusy) return;

    if (otp.trim().length !== 6) {
      setAlert2({ message: 'Enter the 6-digit code sent to your email.', type: 'error' });
      return;
    }
    const problem = passwordProblem(newPass);
    if (problem) {
      setAlert2({ message: problem, type: 'error' });
      return;
    }
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
      // Fill in the login form for them
      setEmail(resetEmail);
      setPassword('');
      closeTimerRef.current = setTimeout(() => setModalOpen(false), 1500);
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
              Welcome! Enter your institutional credentials to access <strong>BukSUPPLY</strong>
            </p>
          </header>

          <form id="loginForm" className="login-form" onSubmit={onSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <i className="bi bi-envelope-fill"></i> Institutional Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder="Enter your institutional email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setBanner(NO_BANNER);
                  setDeactivated(null);
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <i className="bi bi-lock-fill"></i> Password
              </label>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setBanner(NO_BANNER);
                  setDeactivated(null);
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

              <GoogleAuthButton
                clientId={config.googleClientId}
                text="continue_with"
                onCredential={handleGoogle}
                onError={() => setBanner({ message: 'Google sign-in failed.', type: 'error' })}
              />
            </div>
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

      {/* reCAPTCHA POP-UP (only mounted while open, and only when reCAPTCHA is on) */}
      {captchaOpen && config.recaptchaEnabled && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCaptchaOpen(false);
          }}
        >
          <div
            className="modal-card captcha-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="captchaTitle"
          >
            <div className="captcha-icon">
              <i className="bi bi-shield-check"></i>
            </div>
            <h2 className="modal-title" id="captchaTitle">
              Verify to continue
            </h2>
            <p className="modal-subtitle">
              Tick the box below to confirm you are not a robot.
            </p>

            <div className="captcha-body">
              <ReCAPTCHA
                key={config.recaptchaSiteKey}
                sitekey={config.recaptchaSiteKey}
                onChange={onCaptchaSolved}
              />
            </div>

            <button type="button" className="captcha-cancel" onClick={() => setCaptchaOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ACCOUNT REACTIVATED POP-UP (only mounted while open) */}
      {welcomeBack && (
        <ReactivatedModal info={welcomeBack.reactivation} onContinue={continueAfterReactivation} />
      )}

      {/* DEACTIVATED ACCOUNT POP-UP (only mounted while open) */}
      {deactOpen && deactivated && (
        <DeactivatedModal
          info={deactivated.info}
          onRequest={openReactivation}
          onClose={() => setDeactOpen(false)}
        />
      )}

      {/* REQUEST REACTIVATION MODAL (only mounted while open) */}
      {reactOpen && deactivated && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReactivation();
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reactivateTitle"
          >
            <button
              type="button"
              className="modal-close-btn"
              title="Close Modal"
              onClick={closeReactivation}
            >
              <i className="bi bi-x-lg"></i>
            </button>

            <header className="modal-header">
              <h2 className="modal-title" id="reactivateTitle">
                Request <span>Reactivation</span>
              </h2>
              <p className="modal-subtitle">
                Tell the administrator why your account should be reactivated. You will get an email
                when they decide.
              </p>
            </header>

            <form className="login-form" onSubmit={sendReactivation} noValidate>
              <div className="form-group">
                <label htmlFor="reactivateMessage" className="form-label">
                  <i className="bi bi-chat-left-text-fill"></i> Your message
                </label>
                <textarea
                  id="reactivateMessage"
                  className="form-input form-textarea"
                  placeholder="e.g. I deactivated my account by mistake and I need access to file requisitions."
                  maxLength={REACTIVATION_MAX}
                  rows={5}
                  value={reactMessage}
                  onChange={(e) => {
                    setReactMessage(e.target.value);
                    setReactAlert(NO_BANNER);
                  }}
                />
                <div className="char-count">
                  {reactMessage.length}/{REACTIVATION_MAX}
                </div>
              </div>

              <Banner banner={reactAlert} />

              <div className="deact-actions">
                <button type="submit" className="btn-submit" disabled={reactBusy}>
                  {reactBusy ? 'Sending...' : 'Send Request'}
                </button>
                <button type="button" className="captcha-cancel" onClick={closeReactivation}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              <form className="login-form" onSubmit={requestCode} noValidate>
                <div className="form-group">
                  <label htmlFor="resetEmail" className="form-label">
                    <i className="bi bi-envelope-fill"></i> Institutional Email
                  </label>
                  <input
                    type="email"
                    id="resetEmail"
                    className="form-input"
                    placeholder="Enter your institutional email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      setAlert1(NO_BANNER);
                    }}
                  />
                </div>

                <Banner banner={alert1} />

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit" disabled={modalBusy}>
                    {modalBusy ? 'Sending...' : 'Send Reset Code'}
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

              <form className="login-form" onSubmit={resetPassword} noValidate>
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
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ''));
                      setAlert2(NO_BANNER);
                    }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="form-label">
                    <i className="bi bi-lock-fill"></i> New Password
                  </label>
                  <PasswordInput
                    id="newPassword"
                    placeholder="At least 8 characters, with a letter and a number"
                    autoComplete="new-password"
                    value={newPass}
                    onChange={(e) => {
                      setNewPass(e.target.value);
                      setAlert2(NO_BANNER);
                    }}
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
                    autoComplete="new-password"
                    value={confirmPass}
                    onChange={(e) => {
                      setConfirmPass(e.target.value);
                      setAlert2(NO_BANNER);
                    }}
                    visible={showConfirmPass}
                    onToggle={() => setShowConfirmPass((v) => !v)}
                  />
                  <div className="forgot-wrapper">
                    <a href="#" className="forgot-link" onClick={backToStep1}>
                      Use a different email
                    </a>
                  </div>
                </div>

                <Banner banner={alert2} />

                <div className="btn-wrapper">
                  <button type="submit" className="btn-submit" disabled={modalBusy}>
                    {modalBusy ? 'Updating...' : 'Update Password'}
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