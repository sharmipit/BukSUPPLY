import React, { useState, useEffect, useId } from 'react';
import { LIMITS, typeReason, reasonProblem } from '../utils/fieldRules';
import '../styles/DecisionModal.css';

// One modal for every approve / deny / reactivate / decline / archive confirmation.
// Pass `label` to show the reason box (with suggestion chips and a character counter).
// Leave `label` out for a plain confirmation.
// onConfirm(text) may throw: the message is shown inside the modal.
export default function DecisionModal({
  isOpen = true,
  title,
  message,
  tone = 'primary', // 'primary' | 'danger'
  label,
  placeholder = 'Pick a suggestion above or write your own',
  suggestions = [],
  required = false,
  minLength = LIMITS.reason.min,
  maxLength = LIMITS.reason.max,
  hint,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  note,
  error = '',
  busy: externalBusy = false,
  children,
  onConfirm,
  onClose,
}) {
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const titleId = useId();
  const fieldId = useId();

  const hasField = Boolean(label);
  const working = busy || externalBusy;

  useEffect(() => {
    if (isOpen) {
      setText('');
      setFieldError('');
      setNotice('');
      setSubmitError('');
      setBusy(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !working) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, working, onClose]);

  if (!isOpen) return null;

  const reasonMissing = hasField && required && text.trim().length < minLength;

  const check = (value) =>
    reasonProblem(value, { required, min: minLength, max: maxLength, label });

  const handleChange = (e) => {
    const { value, notice: typed } = typeReason(e.target.value, maxLength);
    setText(value);
    setNotice(typed);
    setFieldError('');
    setSubmitError('');
  };

  const handleBlur = () => {
    setNotice('');
    if (text.trim()) setFieldError(check(text));
  };

  const pick = (suggestion) => {
    setText(suggestion.slice(0, maxLength));
    setNotice('');
    setFieldError('');
    setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (working) return;

    const value = text.trim();
    if (hasField) {
      const problem = check(value);
      if (problem) {
        setFieldError(problem);
        return;
      }
    }

    setBusy(true);
    setSubmitError('');
    setNotice('');
    try {
      await onConfirm(value);
    } catch (err) {
      setSubmitError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const fieldMessage = notice || fieldError;
  const shownError = submitError || error;

  return (
    <div className="dm-backdrop" onClick={() => !working && onClose()}>
      <div
        className="dm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dm-header">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="dm-close"
            onClick={onClose}
            aria-label="Close"
            disabled={working}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form className="dm-form" onSubmit={handleSubmit} noValidate>
          <div className="dm-body">
            {message && <p className="dm-message">{message}</p>}

            {children}

            {hasField && (
              <div className="dm-field">
                <label htmlFor={fieldId}>
                  {label} {!required && <span className="dm-optional">(optional)</span>}
                </label>

                {suggestions.length > 0 && (
                  <div className="dm-chips" role="group" aria-label="Suggested comments">
                    {suggestions.map((suggestion) => {
                      const selected = text === suggestion;
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          className={`dm-chip${selected ? ' selected' : ''}`}
                          aria-pressed={selected}
                          onClick={() => pick(suggestion)}
                        >
                          <span>{suggestion}</span>
                          <i className="bi bi-check2 dm-chip-check" aria-hidden="true"></i>
                        </button>
                      );
                    })}
                  </div>
                )}

                <textarea
                  id={fieldId}
                  className={`dm-textarea${fieldMessage ? ' invalid' : ''}`}
                  rows={4}
                  placeholder={placeholder}
                  value={text}
                  maxLength={maxLength}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(fieldMessage)}
                />

                <div className="dm-field-meta">
                  {fieldMessage ? (
                    <span className="dm-field-error" role="alert">
                      {fieldMessage}
                    </span>
                  ) : hint ? (
                    <span className="dm-hint">{hint}</span>
                  ) : (
                    <span />
                  )}
                  <span className={`dm-char-count${text.length >= maxLength ? ' at-limit' : ''}`}>
                    {text.length}/{maxLength}
                  </span>
                </div>
              </div>
            )}

            {note && <p className="dm-note">{note}</p>}

            {shownError && (
              <div className="dm-error-box" role="alert">
                <strong>Could not save</strong>
                <p>{shownError}</p>
              </div>
            )}
          </div>

          <div className="dm-footer">
            <button type="button" className="dm-btn dm-btn-secondary" onClick={onClose} disabled={working}>
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={`dm-btn ${tone === 'danger' ? 'dm-btn-danger' : 'dm-btn-primary'}`}
              disabled={working || reasonMissing}
              title={reasonMissing ? 'Choose a suggestion or write a reason first' : undefined}
            >
              {working ? 'Please wait...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
