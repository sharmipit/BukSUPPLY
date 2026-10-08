import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import ReCAPTCHAImport from 'react-google-recaptcha';
const ReCAPTCHA = ReCAPTCHAImport.default || ReCAPTCHAImport;
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

  // The ID field label changes with the email domain
  const kind = emailType(values.email);
  const idLabel =
    kind === 'Student' ? 'Student ID Number'
    : kind === 'Regular Staff' ? 'Employee / Personnel ID'
    : 'ID Number';
  const idPlaceholder =
    kind === 'Student' ? 'e.g. 2400000000 (Student ID)'
    : kind === 'Regular Staff' ? 'e.g. 2024-1234 (Employee ID)'
    : 'Student ID or Personnel ID Number';

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

    //reCAPTCHA check
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
      recaptchaRef.current?.reset();   //token is single-use
      setCaptchaToken(null);
      if (err.response?.status === 409) {
        setErrors({ email: err.response.data.message });
      } else {
        setFormError(errMsg(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // Google sign-up (same behavior as your old signup.js: then go to sign in)
  const handleGoogle = async (credential, agreedToTerms = false) => {
    try {
      await api.post('/auth/google', { credential, agreedToTerms });
      navigate('/signin', { replace: true });
    } catch (err) {
      if (err.response?.status === 428) {
        const confirmed = window.confirm(
          'By continuing you agree to the Terms and Conditions and Privacy Policy. Continue?'
        );
        if (confirmed) return handleGoogle(credential, true);
        return;
      }
      setFormError(err.response?.data?.message || errMsg(err));
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
                  <a href="#" className="inline-link" onClick={(e) => e.preventDefault()}>
                    Terms &amp; Conditions
                  </a>{' '}
                  and{' '}
                  <a href="#" className="inline-link" onClick={(e) => e.preventDefault()}>
                    Privacy Policy
                  </a>{' '}
                  of BukSU PSMO.
                </span>
              </label>
              <span className="error-msg">{errors.termsAgreement}</span>
            </div>

            {/*reCAPTCHA */}
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

      {/* SUCCESS MODAL */}
      <div
        className={`modal-overlay${showModal ? ' active' : ''}`}
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
    </>
  );
}