import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { errMsg } from '../api/client';
import usePage from '../hooks/usePage';
import usePublicConfig from '../hooks/usePublicConfig';
import GoogleAuthButton from '../components/GoogleAuthButton';
import {
  ID_KIND,
  typeName,
  formatName,
  nameProblem,
  typeEmail,
  emailProblem as emailRuleProblem,
  typeId,
  idProblem,
  typePassword,
  passwordProblem,
  confirmProblem,
} from '../utils/fieldRules';
import css from '../styles/signup.css?raw';

// TEMPORARY: lets one test admin sign in with a Gmail address. Remove before real use. const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;
const EMAIL_PATTERN = /^([^@\s]+@(student\.)?buksu\.edu\.ph|sharmagnegamboa11@gmail\.com)$/i;
const TEMP_ADMIN_EMAIL = 'sharmagnegamboa11@gmail.com'; // TEMPORARY, see above

// Which email addresses can sign up (the format rules themselves are in utils/fieldRules.js)
const EMAIL_OPTIONS = {
  domains: ['student.buksu.edu.ph', 'buksu.edu.ph'],
  allowEmails: [TEMP_ADMIN_EMAIL],
  domainMessage: 'Use your BukSU email (@student.buksu.edu.ph or @buksu.edu.ph).',
};

// Mirrors the backend rule: returns 'Student', 'Regular Staff' or null
const emailType = (email) => {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(clean)) return null;
  return clean.endsWith('@student.buksu.edu.ph') ? ID_KIND.student : ID_KIND.staff;
};

// Typing: cleaned value + a message ONLY when the user just broke a rule
const typeField = (name, raw, vals) => {
  switch (name) {
    case 'firstName':
      return typeName(raw, 'First name');
    case 'lastName':
      return typeName(raw, 'Last name');
    case 'email':
      return typeEmail(raw, EMAIL_OPTIONS);
    case 'idNumber':
      return typeId(raw, emailType(vals.email));
    case 'password':
      return typePassword(raw);
    case 'confirmPassword': {
      const { value, notice } = typePassword(raw);
      // As many characters as the password, but different: already a mismatch
      const mismatch = value.length >= vals.password.length && value !== vals.password;
      return { value, notice: notice || (mismatch ? 'Passwords do not match.' : '') };
    }
    default:
      return { value: raw, notice: '' };
  }
};

// Completeness check (on blur and on submit)
const problemOf = (name, value, vals) => {
  switch (name) {
    case 'firstName':
      return nameProblem(value, 'First name');
    case 'lastName':
      return nameProblem(value, 'Last name');
    case 'email':
      return emailRuleProblem(value, EMAIL_OPTIONS);
    case 'idNumber':
      return idProblem(emailType(vals.email), value);
    case 'password':
      return passwordProblem(value);
    case 'confirmPassword':
      return confirmProblem(vals.password, value);
    default:
      return '';
  }
};

const INITIAL = {
  firstName: '',
  lastName: '',
  email: '',
  idNumber: '',
  password: '',
  confirmPassword: '',
  termsAgreement: false,
};

// Placeholder copy: have PSMO / your Data Protection Officer review before launch
const LEGAL = {
  terms: {
    title: 'Terms & Conditions',
    sections: [
      [
        '1. Acceptance of Terms',
        'By creating a BukSUPPLY account, you agree to follow these terms and all applicable BukSU policies.',
      ],
      [
        '2. Eligibility',
        'Accounts are limited to currently enrolled students and active BukSU personnel with a valid institutional email address.',
      ],
      [
        '3. Account Responsibility',
        'You are responsible for keeping your password confidential and for all activity under your account. Report unauthorized use to PSMO immediately.',
      ],
      [
        '4. Requisitions & Reservations',
        'Requests must be accurate and made for official university purposes only. PSMO may approve, modify, or decline any request.',
      ],
      [
        '5. Acceptable Use',
        'You may not misuse the system, submit false information, or attempt to access data or accounts that are not yours.',
      ],
      ['6. Suspension', 'PSMO may suspend or terminate accounts that violate these terms.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      [
        '1. Information We Collect',
        'Your name, institutional email, ID number, and records of your requisitions and reservations.',
      ],
      [
        '2. How We Use It',
        'To verify your identity, process requests, and keep records for inventory and audit purposes.',
      ],
      [
        '3. Google Sign-In',
        'If you sign up with Google, we receive your name and email from Google. We do not receive your Google password.',
      ],
      [
        '4. Data Sharing',
        'Your data is shared only with authorized BukSU offices and is never sold to third parties.',
      ],
      [
        '5. Your Rights',
        'Under the Data Privacy Act of 2012 (RA 10173), you may access, correct, or request deletion of your personal data by contacting PSMO.',
      ],
      [
        '6. Security',
        'We apply reasonable technical and organizational safeguards, but no system is completely secure.',
      ],
    ],
  },
};

// Label / placeholder for the ID field, based on the email domain
const idTexts = (kind) => ({
  label:
    kind === 'Student'
      ? 'Student ID Number'
      : kind === 'Regular Staff'
        ? 'Employee / Personnel ID'
        : 'ID Number',
  placeholder:
    kind === 'Student'
      ? 'e.g. 2400000000 (Student ID)'
      : kind === 'Regular Staff'
        ? 'e.g. P-0000 (Employee ID)'
        : 'Student ID or Personnel ID Number',
});

// Defined outside Signup so inputs keep focus while typing
function Field({ id, label, icon, full, error, children }) {
  return (
    <div className={`input-group${full ? ' full-width' : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={id} className="form-label">
        {icon && <i className={`bi ${icon}`}></i>} {label} <span className="required">*</span>
      </label>
      {children}
      <span className="error-msg" role="alert">
        {error}
      </span>
    </div>
  );
}

export default function Signup() {
  usePage(css, 'Create Account | BukSUPPLY');
  const navigate = useNavigate();
  const location = useLocation();
  const config = usePublicConfig(); // keys and on/off switches from System Settings

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({}); // problems found on blur / submit
  const [notices, setNotices] = useState({}); // rule just broken while typing
  // A message passed from the Sign In page (e.g. "no account yet for that Google account")
  const [formError, setFormError] = useState(location.state?.notice || '');
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [captchaOpen, setCaptchaOpen] = useState(false); // reCAPTCHA pop-up

  // Terms / Privacy modal
  const [legal, setLegal] = useState(null); // null | 'terms' | 'privacy'
  const [pendingGoogle, setPendingGoogle] = useState(null); // Google credential waiting for agreement
  const [googleEmail, setGoogleEmail] = useState(''); // email returned by the backend (for the ID label)
  const [googleIdNumber, setGoogleIdNumber] = useState('');
  const [googleIdError, setGoogleIdError] = useState('');
  const googleBusyRef = useRef(false); // stops double submits of the Google sign-up

  const openLegal = (key) => (e) => {
    e.preventDefault();
    setLegal(key);
  };

  const closeLegal = () => {
    setLegal(null);
    // closing also cancels a pending Google sign-up
    setPendingGoogle(null);
    setGoogleEmail('');
    setGoogleIdNumber('');
    setGoogleIdError('');
  };

  const acceptLegal = () => {
    // Google flow: ID number + agree, then finish the sign-up
    if (pendingGoogle) {
      const problem = idProblem(emailType(googleEmail), googleIdNumber);
      if (problem) {
        setGoogleIdError(problem);
        return;
      }
      const credential = pendingGoogle;
      setLegal(null);
      setPendingGoogle(null);
      handleGoogle(credential, true, googleIdNumber.trim());
      return;
    }

    // Normal flow: just tick the checkbox
    setValues((v) => ({ ...v, termsAgreement: true }));
    setErrors((er) => ({ ...er, termsAgreement: undefined }));
    setLegal(null);
  };

  // Close the legal modal with Escape
  useEffect(() => {
    if (!legal) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeLegal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [legal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the reCAPTCHA pop-up with Escape
  useEffect(() => {
    if (!captchaOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setCaptchaOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captchaOpen]);

  // The ID field label changes with the email domain
  const { label: idLabel, placeholder: idPlaceholder } = idTexts(emailType(values.email));
  const googleId = idTexts(emailType(googleEmail));

  const onChange = (e) => {
    const { name, value: raw, type, checked } = e.target;

    if (type === 'checkbox') {
      setValues((v) => ({ ...v, [name]: checked }));
      setErrors((er) => ({ ...er, [name]: undefined }));
      setFormError('');
      return;
    }

    const { value, notice } = typeField(name, raw, values);
    const next = { ...values, [name]: value };
    setValues(next);

    // A message shows only while the user is breaking a rule
    setNotices((n) => ({
      ...n,
      [name]: notice,
      // Changing the email can change which ID format applies
      ...(name === 'email' ? { idNumber: '' } : {}),
    }));

    // A problem already on screen is re-checked live, so it disappears once fixed
    setErrors((er) => {
      const out = { ...er };
      if (er[name]) out[name] = problemOf(name, value, next) || undefined;
      if (name === 'email') out.idNumber = undefined;
      if (name === 'password' && er.confirmPassword) {
        out.confirmPassword = problemOf('confirmPassword', next.confirmPassword, next) || undefined;
      }
      return out;
    });
    setFormError('');
  };

  // Leaving a field: check it (only if something was typed)
  const onBlur = (e) => {
    const { name } = e.target;
    setNotices((n) => ({ ...n, [name]: '' }));
    if (!values[name]) return;
    const message = problemOf(name, values[name], values);
    setErrors((er) => ({ ...er, [name]: message || undefined }));
  };

  // What is shown under a field: a typing notice first, otherwise a saved problem
  const shown = (name) => notices[name] || errors[name];

  const validate = () => {
    const found = {};
    ['firstName', 'lastName', 'email', 'idNumber', 'password', 'confirmPassword'].forEach((k) => {
      const message = problemOf(k, values[k], values);
      if (message) found[k] = message;
    });

    if (!values.termsAgreement)
      found.termsAgreement = 'You must agree to the terms to complete registration';

    return found;
  };

  // Sends the sign-up request. captchaToken is null when reCAPTCHA is turned off.
  const signUp = async (captchaToken) => {
    setBusy(true);
    try {
      await api.post('/auth/signup', {
        firstName: formatName(values.firstName),
        lastName: formatName(values.lastName),
        email: values.email.trim().toLowerCase(),
        idNumber: values.idNumber.trim().toUpperCase(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        termsAgreement: values.termsAgreement,
        recaptchaToken: captchaToken,
      });
      setShowModal(true);
    } catch (err) {
      if (err.response?.status === 409) {
        // Show the duplicate under the right field (ID number vs email)
        const data = err.response.data || {};
        const msg = data.message || 'An account with these details already exists.';
        const isId = data.field === 'idNumber' || /id number/i.test(msg);
        setErrors(isId ? { idNumber: msg } : { email: msg });
      } else {
        setFormError(errMsg(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // Step 1: check the form. Step 2: reCAPTCHA pop-up (if on). Step 3: send.
  const onSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');

    const found = validate();
    setNotices({});
    setErrors(found);
    if (Object.keys(found).length) return;

    // reCAPTCHA is only asked once the form itself is valid
    if (config.recaptchaEnabled) {
      setCaptchaOpen(true);
      return;
    }
    signUp(null);
  };

  // The token is single-use, so we send it right away and close the pop-up
  const onCaptchaSolved = (token) => {
    if (!token) return;
    setCaptchaOpen(false);
    signUp(token);
  };

  // Google sign-up. New users must agree to the terms and give their ID number:
  // the backend answers 428 and we open the modal to collect both.
  const handleGoogle = async (credential, agreedToTerms = false, idNumber = '') => {
    if (googleBusyRef.current) return;
    googleBusyRef.current = true;
    setFormError('');
    try {
      const { data } = await api.post('/auth/google', { credential, agreedToTerms, idNumber });

      if (data?.isNewUser) {
        // Brand-new account: show the same success modal as manual sign-up
        setGoogleIdNumber('');
        setShowModal(true);
      } else {
        // Account already existed: nothing was "created", so send them to sign in with a note
        navigate('/signin', {
          replace: true,
          state: { notice: 'You already have an account. Please sign in.' },
        });
      }
    } catch (err) {
      const data = err.response?.data;

      if (err.response?.status === 428) {
        setPendingGoogle(credential);
        setGoogleEmail(data?.email || '');
        setLegal('terms');
        return;
      }

      // ID problem (e.g. already registered): reopen the modal with the message
      if (data?.field === 'idNumber') {
        setPendingGoogle(credential);
        setGoogleIdError(data.message || 'This ID number cannot be used.');
        setLegal('terms');
        return;
      }

      setFormError(data?.message || errMsg(err));
    } finally {
      googleBusyRef.current = false;
    }
  };

  const eyeToggle = (name) => (
    <button
      type="button"
      className="toggle-password-btn"
      aria-label={visible[name] ? 'Hide password' : 'Show password'}
      onClick={() => setVisible((v) => ({ ...v, [name]: !v[name] }))}
    >
      <i className={`bi ${visible[name] ? 'bi-eye-slash' : 'bi-eye'}`}></i>
    </button>
  );

  return (
    <>
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

          <form id="signupForm" className="signup-form" onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <Field id="firstName" label="First Name" error={shown('firstName')}>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  className="form-input"
                  placeholder="e.g. Juan"
                  autoComplete="given-name"
                  value={values.firstName}
                  onChange={onChange}
                  onBlur={onBlur}
                />
              </Field>

              <Field id="lastName" label="Last Name" error={shown('lastName')}>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className="form-input"
                  placeholder="e.g. Dela Cruz"
                  autoComplete="family-name"
                  value={values.lastName}
                  onChange={onChange}
                  onBlur={onBlur}
                />
              </Field>

              {/* Email and ID sit side by side on wide screens (saves a whole row of height) */}
              <Field id="email" label="Institutional Email" error={shown('email')}>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  placeholder="Enter your institutional email"
                  autoComplete="email"
                  value={values.email}
                  onChange={onChange}
                  onBlur={onBlur}
                />
              </Field>

              <Field id="idNumber" label={idLabel} error={shown('idNumber')}>
                <input
                  type="text"
                  id="idNumber"
                  name="idNumber"
                  className="form-input"
                  placeholder={idPlaceholder}
                  autoComplete="off"
                  value={values.idNumber}
                  onChange={onChange}
                  onBlur={onBlur}
                />
              </Field>

              <Field
                id="password"
                label="Password"
                icon="bi-lock"
                error={shown('password')}
              >
                <div className="input-icon-wrapper">
                  <input
                    type={visible.password ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className="form-input with-suffix"
                    placeholder="8+ characters, letter & number"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={onChange}
                    onBlur={onBlur}
                  />
                  {eyeToggle('password')}
                </div>
              </Field>

              <Field
                id="confirmPassword"
                label="Confirm Password"
                icon="bi-lock"
                error={shown('confirmPassword')}
              >
                <div className="input-icon-wrapper">
                  <input
                    type={visible.confirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    className="form-input with-suffix"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    onChange={onChange}
                    onBlur={onBlur}
                  />
                  {eyeToggle('confirmPassword')}
                </div>
              </Field>
            </div>

            <div className={`terms-group${errors.termsAgreement ? ' has-error' : ''}`}>
              <label className="custom-checkbox-container">
                <input
                  type="checkbox"
                  id="termsAgreement"
                  name="termsAgreement"
                  checked={values.termsAgreement}
                  onChange={onChange}
                />
                <span className="checkmark"></span>
                <span className="checkbox-label">
                  I agree to the{' '}
                  <a href="#" className="inline-link" onClick={openLegal('terms')}>
                    Terms &amp; Conditions
                  </a>{' '}
                  and{' '}
                  <a href="#" className="inline-link" onClick={openLegal('privacy')}>
                    Privacy Policy
                  </a>{' '}
                  of BukSU PSMO.
                </span>
              </label>
              <span className="error-msg">{errors.termsAgreement}</span>
            </div>

            <p className="form-error" id="formError">
              {formError}
            </p>

            <div className="btn-wrapper">
              <button
                type="submit"
                className="btn-submit"
                id="btnSubmit"
                disabled={busy || !config.loaded}
              >
                {busy ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </form>

          {/* Google (hidden when turned off in System Settings) */}
          {config.googleEnabled && (
            <div className="social-section">
              <div className="divider">
                <span>or Sign Up with</span>
              </div>

              <GoogleAuthButton
                clientId={config.googleClientId}
                text="signup_with"
                onCredential={handleGoogle}
                onError={() => setFormError('Google sign-up failed. Please try again.')}
              />
            </div>
          )}

          <div className="signup-footer">
            <p>
              Already have an account?{' '}
              <Link to="/signin" className="create-account-link">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* reCAPTCHA POP-UP (only mounted while open, and only when reCAPTCHA is on) */}
      {captchaOpen && config.recaptchaEnabled && (
        <div
          className="modal-overlay active"
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
            <p className="modal-description">
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

      {/* TERMS / PRIVACY MODAL (only mounted while open). Layout matches the Profile page. */}
      {legal && (
        <div className="modal-overlay active" onClick={closeLegal}>
          <div
            className="lgl-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legalTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lgl-header">
              <div>
                <h3 className="lgl-title" id="legalTitle">
                  {LEGAL[legal].title}
                </h3>
                <p className="lgl-subtitle">
                  BukSU Supply &amp; Property Management Office guidelines.
                </p>
              </div>
              <button type="button" className="lgl-close" aria-label="Close" onClick={closeLegal}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Original line separator with text links, kept as is */}
            <div className="lgl-tabs-wrap">
              <div className="legal-tabs">
                <button
                  type="button"
                  className={legal === 'terms' ? 'active' : ''}
                  onClick={() => setLegal('terms')}
                >
                  Terms &amp; Conditions
                </button>
                <button
                  type="button"
                  className={legal === 'privacy' ? 'active' : ''}
                  onClick={() => setLegal('privacy')}
                >
                  Privacy Policy
                </button>
              </div>
            </div>

            <div className="lgl-body">
              {pendingGoogle && (
                <p className="lgl-note">
                  Almost done! Enter your ID number and agree to the terms to finish signing up with
                  Google.
                </p>
              )}

              {LEGAL[legal].sections.map(([heading, text]) => (
                <div className="lgl-section" key={heading}>
                  <h4>{heading}</h4>
                  <p>{text}</p>
                </div>
              ))}
            </div>

            {/* ID number (Google sign-up only) */}
            {pendingGoogle && (
              <div className={`lgl-id-field input-group${googleIdError ? ' has-error' : ''}`}>
                <label htmlFor="googleIdNumber" className="form-label">
                  {googleId.label} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="googleIdNumber"
                  className="form-input"
                  placeholder={googleId.placeholder}
                  autoComplete="off"
                  value={googleIdNumber}
                  onChange={(e) => {
                    const { value, notice } = typeId(e.target.value, emailType(googleEmail));
                    setGoogleIdNumber(value);
                    setGoogleIdError(notice);
                  }}
                  onBlur={() => {
                    if (googleIdNumber)
                      setGoogleIdError(idProblem(emailType(googleEmail), googleIdNumber));
                  }}
                />
                <span className="error-msg" role="alert">
                  {googleIdError}
                </span>
              </div>
            )}

            <div className="lgl-footer">
              <button type="button" className="lgl-btn-secondary" onClick={closeLegal}>
                {pendingGoogle ? 'Cancel' : 'Close'}
              </button>
              <button type="button" className="lgl-btn-primary" onClick={acceptLegal}>
                {pendingGoogle ? 'I Agree & Continue' : 'I Agree'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL (only mounted while open) */}
      {showModal && (
        <div
          className="modal-overlay active"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
        >
          <div className="modal-card">
            <div className="modal-icon-wrapper success-icon">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h2 className="modal-title" id="modalTitle">
              Account Created Successfully!
            </h2>
            <p className="modal-description">
              Welcome to <strong>BukSUPPLY</strong>! Your account has been registered and activated
              instantly. You can now proceed to sign in or access your dashboard.
            </p>
            <button
              type="button"
              className="btn-submit modal-btn"
              onClick={() => navigate('/signin', { replace: true })}
            >
              Proceed to Sign In
            </button>
          </div>
        </div>
      )}
    </>
  );
}