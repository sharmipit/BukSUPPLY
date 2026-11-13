import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { errMsg } from '../api/client';
import usePage from '../hooks/usePage';
import usePublicConfig from '../hooks/usePublicConfig';
import css from '../styles/signup.css?raw';

const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;

// ID formats (based on the placeholders shown in the form).
// CONFIRM these match your backend rule, and change them here if they do not.
const STUDENT_ID_PATTERN = /^\d{10}$/; // e.g. 2400000000
const STAFF_ID_PATTERN = /^P-\d{3,6}$/i; // e.g. P-0000

// Mirrors the backend rule: returns 'Student', 'Regular Staff' or null
const emailType = (email) => {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(clean)) return null;
  return clean.endsWith('@student.buksu.edu.ph') ? 'Student' : 'Regular Staff';
};

const emailProblem = (email) => {
  if (!email.trim()) return 'Institutional email is required';
  if (!emailType(email))
    return 'Please use a valid BukSU institutional email (@student.buksu.edu.ph or @buksu.edu.ph).';
  return '';
};

// kind = 'Student' | 'Regular Staff' | null (email not valid yet)
const idProblem = (kind, raw) => {
  const id = raw.trim();
  if (!id) return 'This field is required';
  if (kind === 'Student')
    return STUDENT_ID_PATTERN.test(id) ? '' : 'Student ID must be 10 digits, e.g. 2400000000.';
  if (kind === 'Regular Staff')
    return STAFF_ID_PATTERN.test(id) ? '' : 'Employee ID must look like P-0000.';
  return STUDENT_ID_PATTERN.test(id) || STAFF_ID_PATTERN.test(id)
    ? ''
    : 'Enter a valid Student ID (10 digits) or Employee ID (e.g. P-0000).';
};

const passwordProblem = (pw) => {
  if (!pw) return 'Password is required';
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    return 'Password must include at least one letter and one number';
  return '';
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
function Field({ id, label, icon, full, error, hint, children }) {
  return (
    <div className={`input-group${full ? ' full-width' : ''}${error ? ' has-error' : ''}`}>
      <label htmlFor={id} className="form-label">
        {icon && <i className={`bi ${icon}`}></i>} {label} <span className="required">*</span>
      </label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      <span className="error-msg">{error}</span>
    </div>
  );
}

export default function Signup() {
  usePage(css, 'Create Account | BukSUPPLY');
  const navigate = useNavigate();
  const location = useLocation();
  const config = usePublicConfig(); // keys and on/off switches from System Settings

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  // A message passed from the Sign In page (e.g. "no account yet for that Google account")
  const [formError, setFormError] = useState(location.state?.notice || '');
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const recaptchaRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState(null);

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
        setGoogleIdError(problem === 'This field is required' ? 'Please enter your ID number to continue.' : problem);
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

  // The ID field label changes with the email domain
  const { label: idLabel, placeholder: idPlaceholder } = idTexts(emailType(values.email));
  const googleId = idTexts(emailType(googleEmail));

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    // Changing the email can change which ID format applies, so clear that error too
    setErrors((er) => ({
      ...er,
      [name]: undefined,
      ...(name === 'email' ? { idNumber: undefined } : {}),
    }));
    setFormError('');
  };

  // Check a field when the user leaves it (only if something was typed)
  const onBlur = (e) => {
    const { name } = e.target;
    if (!values[name]) return;
    let message = '';
    if (name === 'email') message = emailProblem(values.email);
    if (name === 'idNumber') message = idProblem(emailType(values.email), values.idNumber);
    if (name === 'password') message = passwordProblem(values.password);
    if (message) setErrors((er) => ({ ...er, [name]: message }));
  };

  const validate = () => {
    const found = {};
    ['firstName', 'lastName'].forEach((k) => {
      if (!values[k].trim()) found[k] = 'This field is required';
    });

    const emailMsg = emailProblem(values.email);
    if (emailMsg) found.email = emailMsg;

    const idMsg = idProblem(emailType(values.email), values.idNumber);
    if (idMsg) found.idNumber = idMsg;

    const passwordMsg = passwordProblem(values.password);
    if (passwordMsg) found.password = passwordMsg;

    if (!values.confirmPassword) found.confirmPassword = 'Please confirm your password';
    else if (values.password !== values.confirmPassword)
      found.confirmPassword = 'Passwords do not match';

    if (!values.termsAgreement)
      found.termsAgreement = 'You must agree to the terms to complete registration';

    return found;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    // reCAPTCHA check (only when it is turned on in System Settings)
    if (config.recaptchaEnabled && !captchaToken) {
      setFormError('Please confirm you are not a robot.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/signup', {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        idNumber: values.idNumber.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        termsAgreement: values.termsAgreement,
        recaptchaToken: captchaToken,
      });
      setShowModal(true);
    } catch (err) {
      recaptchaRef.current?.reset(); // token is single-use
      setCaptchaToken(null);
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
              <Field id="firstName" label="First Name" error={errors.firstName}>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  className="form-input"
                  placeholder="e.g. Juan"
                  autoComplete="given-name"
                  maxLength={60}
                  value={values.firstName}
                  onChange={onChange}
                />
              </Field>

              <Field id="lastName" label="Last Name" error={errors.lastName}>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className="form-input"
                  placeholder="e.g. Dela Cruz"
                  autoComplete="family-name"
                  maxLength={60}
                  value={values.lastName}
                  onChange={onChange}
                />
              </Field>

              <Field id="email" label="Institutional Email" full error={errors.email}>
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

              <Field id="idNumber" label={idLabel} full error={errors.idNumber}>
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
                error={errors.password}
                hint="At least 8 characters, with a letter and a number."
              >
                <div className="input-icon-wrapper">
                  <input
                    type={visible.password ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className="form-input with-suffix"
                    placeholder="••••••••"
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
                error={errors.confirmPassword}
              >
                <div className="input-icon-wrapper">
                  <input
                    type={visible.confirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    className="form-input with-suffix"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    onChange={onChange}
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

            {/* reCAPTCHA (hidden when turned off in System Settings) */}
            {config.recaptchaEnabled && (
              <div className="recaptcha-group">
                <ReCAPTCHA
                  key={config.recaptchaSiteKey}
                  ref={recaptchaRef}
                  sitekey={config.recaptchaSiteKey}
                  onChange={(token) => {
                    setCaptchaToken(token);
                    setFormError('');
                  }}
                  onExpired={() => setCaptchaToken(null)}
                />
              </div>
            )}

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
                      text="signup_with"
                      onSuccess={(res) => handleGoogle(res.credential)}
                      onError={() => setFormError('Google sign-up failed. Please try again.')}
                    />
                  </GoogleOAuthProvider>
                </div>
              </div>
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
                  Almost done! Enter your ID number and agree to the terms to finish signing up
                  with Google.
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
                    setGoogleIdNumber(e.target.value);
                    setGoogleIdError('');
                  }}
                />
                <span className="error-msg">{googleIdError}</span>
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