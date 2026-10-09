import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { errMsg } from '../api/client';
import usePage from '../hooks/usePage';
import css from '../styles/signup.css?raw';

const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;

// Mirrors the backend rule: returns 'Student', 'Regular Staff' or null
const emailType = (email) => {
  const clean = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(clean)) return null;
  return clean.endsWith('@student.buksu.edu.ph') ? 'Student' : 'Regular Staff';
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
      ['1. Acceptance of Terms', 'By creating a BukSUPPLY account, you agree to follow these terms and all applicable BukSU policies.'],
      ['2. Eligibility', 'Accounts are limited to currently enrolled students and active BukSU personnel with a valid institutional email address.'],
      ['3. Account Responsibility', 'You are responsible for keeping your password confidential and for all activity under your account. Report unauthorized use to PSMO immediately.'],
      ['4. Requisitions & Reservations', 'Requests must be accurate and made for official university purposes only. PSMO may approve, modify, or decline any request.'],
      ['5. Acceptable Use', 'You may not misuse the system, submit false information, or attempt to access data or accounts that are not yours.'],
      ['6. Suspension', 'PSMO may suspend or terminate accounts that violate these terms.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['1. Information We Collect', 'Your name, institutional email, ID number, and records of your requisitions and reservations.'],
      ['2. How We Use It', 'To verify your identity, process requests, and keep records for inventory and audit purposes.'],
      ['3. Google Sign-In', 'If you sign up with Google, we receive your name and email from Google. We do not receive your Google password.'],
      ['4. Data Sharing', 'Your data is shared only with authorized BukSU offices and is never sold to third parties.'],
      ['5. Your Rights', 'Under the Data Privacy Act of 2012 (RA 10173), you may access, correct, or request deletion of your personal data by contacting PSMO.'],
      ['6. Security', 'We apply reasonable technical and organizational safeguards, but no system is completely secure.'],
    ],
  },
};

// Label / placeholder for the ID field, based on the email domain
const idTexts = (kind) => ({
  label:
    kind === 'Student' ? 'Student ID Number'
    : kind === 'Regular Staff' ? 'Employee / Personnel ID'
    : 'ID Number',
  placeholder:
    kind === 'Student' ? 'e.g. 2400000000 (Student ID)'
    : kind === 'Regular Staff' ? 'e.g. 2024-1234 (Employee ID)'
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
      <span className="error-msg">{error}</span>
    </div>
  );
}

export default function Signup() {
  usePage(css, 'BukSUPPLY | Create Account');
  const navigate = useNavigate();

  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
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
      if (!googleIdNumber.trim()) {
        setGoogleIdError('Please enter your ID number to continue.');
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
    if (!legal) return;
    const onKey = (e) => e.key === 'Escape' && closeLegal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [legal]);

  // The ID field label changes with the email domain
  const { label: idLabel, placeholder: idPlaceholder } = idTexts(emailType(values.email));
  const googleId = idTexts(emailType(googleEmail));

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
    setFormError('');
  };

  const validate = () => {
    const found = {};
    ['firstName', 'lastName', 'idNumber'].forEach((k) => {
      if (!values[k].trim()) found[k] = 'This field is required';
    });

    if (!values.email.trim()) found.email = 'Institutional email is required';
    else if (!emailType(values.email))
      found.email = 'Please use a valid BukSU institutional email address.';

    if (!values.password) found.password = 'Password is required';
    else if (values.password.length < 8)
      found.password = 'Password must be at least 8 characters';

    if (!values.confirmPassword) found.confirmPassword = 'Please confirm your password';
    else if (values.password !== values.confirmPassword)
      found.confirmPassword = 'Passwords do not match';

    if (!values.termsAgreement)
      found.termsAgreement = 'You must agree to the terms to complete registration';

    return found;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    // reCAPTCHA check
    if (!captchaToken) {
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
        const msg = err.response.data.message;
        setErrors(msg.includes('ID number') ? { idNumber: msg } : { email: msg });
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
    setFormError('');
    try {
      const { data } = await api.post('/auth/google', { credential, agreedToTerms, idNumber });

      if (data?.isNewUser) {
        // Brand-new account: show the same success modal as manual sign-up
        setGoogleIdNumber('');
        setShowModal(true);
      } else {
        // Account already existed: nothing was "created", so just go to sign in
        navigate('/signin', { replace: true });
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
        setGoogleIdError(data.message);
        setLegal('terms');
        return;
      }

      setFormError(data?.message || errMsg(err));
    }
  };

  const eyeToggle = (name) => (
    <button
      type="button"
      className="toggle-password-btn"
      aria-label="Toggle password visibility"
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
            <h1 className="signup-title">Create your <span>account</span></h1>
            <p className="signup-subtitle">Register to submit requisitions and reservations</p>
          </div>

          <form id="signupForm" className="signup-form" onSubmit={onSubmit} noValidate>
            <div className="form-grid">
              <Field id="firstName" label="First Name" error={errors.firstName}>
                <input
                  type="text" id="firstName" name="firstName" className="form-input"
                  placeholder="e.g. Juan" value={values.firstName} onChange={onChange}
                />
              </Field>

              <Field id="lastName" label="Last Name" error={errors.lastName}>
                <input
                  type="text" id="lastName" name="lastName" className="form-input"
                  placeholder="e.g. Dela Cruz" value={values.lastName} onChange={onChange}
                />
              </Field>

              <Field id="email" label="Institutional Email" full error={errors.email}>
                <input
                  type="email" id="email" name="email" className="form-input"
                  placeholder="Enter your institutional email"
                  value={values.email} onChange={onChange}
                />
              </Field>

              <Field id="idNumber" label={idLabel} full error={errors.idNumber}>
                <input
                  type="text" id="idNumber" name="idNumber" className="form-input"
                  placeholder={idPlaceholder} value={values.idNumber} onChange={onChange}
                />
              </Field>

              <Field id="password" label="Password" icon="bi-lock" error={errors.password}>
                <div className="input-icon-wrapper">
                  <input
                    type={visible.password ? 'text' : 'password'}
                    id="password" name="password" className="form-input with-suffix"
                    placeholder="••••••••" value={values.password} onChange={onChange}
                  />
                  {eyeToggle('password')}
                </div>
              </Field>

              <Field
                id="confirmPassword" label="Confirm Password" icon="bi-lock"
                error={errors.confirmPassword}
              >
                <div className="input-icon-wrapper">
                  <input
                    type={visible.confirmPassword ? 'text' : 'password'}
                    id="confirmPassword" name="confirmPassword" className="form-input with-suffix"
                    placeholder="••••••••" value={values.confirmPassword} onChange={onChange}
                  />
                  {eyeToggle('confirmPassword')}
                </div>
              </Field>
            </div>

            <div className={`terms-group${errors.termsAgreement ? ' has-error' : ''}`}>
              <label className="custom-checkbox-container">
                <input
                  type="checkbox" id="termsAgreement" name="termsAgreement"
                  checked={values.termsAgreement} onChange={onChange}
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

            {/* reCAPTCHA */}
            <div className="recaptcha-group">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={(token) => {
                  setCaptchaToken(token);
                  setFormError('');
                }}
                onExpired={() => setCaptchaToken(null)}
              />
            </div>

            <p className="form-error" id="formError">{formError}</p>

            <div className="btn-wrapper">
              <button type="submit" className="btn-submit" id="btnSubmit" disabled={busy}>
                {busy ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <div className="social-section">
            <div className="divider"><span>or Sign Up with</span></div>

            <div className="google-sso-wrapper">
              <button type="button" className="sso-google-btn">
                <i className="bi bi-google"></i> Continue with Google
              </button>
              <div className="google-overlay">
                <GoogleLogin
                  theme="outline"
                  size="large"
                  width="320"
                  text="signup_with"
                  onSuccess={(res) => handleGoogle(res.credential)}
                  onError={() => setFormError('Google sign-up failed. Please try again.')}
                />
              </div>
            </div>
          </div>

          <div className="signup-footer">
            <p>
              Already have an account?{' '}
              <Link to="/signin" className="create-account-link">Sign In</Link>
            </p>
          </div>
        </div>
      </div>

      {/* TERMS / PRIVACY MODAL (only mounted while open) */}
      {legal && (
        <div
          className="modal-overlay active"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legalTitle"
          onClick={closeLegal}
        >
          <div className="modal-card legal-card" onClick={(e) => e.stopPropagation()}>
            <div className="legal-header">
              <h2 className="modal-title" id="legalTitle">{LEGAL[legal].title}</h2>
              <button
                type="button"
                className="legal-close"
                aria-label="Close"
                onClick={closeLegal}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

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

            {pendingGoogle && (
              <p className="legal-note">
                Almost done! Enter your ID number and agree to the terms to finish signing up
                with Google.
              </p>
            )}

            <div className="legal-body">
              {LEGAL[legal].sections.map(([heading, text]) => (
                <section key={heading}>
                  <h3>{heading}</h3>
                  <p>{text}</p>
                </section>
              ))}
            </div>

            {/* ID number (Google sign-up only) */}
            {pendingGoogle && (
              <div className={`legal-id-field input-group${googleIdError ? ' has-error' : ''}`}>
                <label htmlFor="googleIdNumber" className="form-label">
                  {googleId.label} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="googleIdNumber"
                  className="form-input"
                  placeholder={googleId.placeholder}
                  value={googleIdNumber}
                  onChange={(e) => {
                    setGoogleIdNumber(e.target.value);
                    setGoogleIdError('');
                  }}
                />
                <span className="error-msg">{googleIdError}</span>
              </div>
            )}

            <div className="legal-actions">
              <button type="button" className="btn-submit modal-btn" onClick={acceptLegal}>
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
            <h2 className="modal-title" id="modalTitle">Account Created Successfully!</h2>
            <p className="modal-description">
              Welcome to <strong>BukSUPPLY</strong>! Your account has been registered and
              activated instantly. You can now proceed to sign in or access your dashboard.
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