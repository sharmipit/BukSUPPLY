import React from 'react';
import { getPasswordStrength } from '../utils/passwordStrength';
import '../styles/PasswordStrength.css';

const FILLED = { weak: 1, medium: 2, strong: 3 };

// showBars={false} gives a plain colored text hint (red / orange / green) with no progress bar
export default function PasswordStrength({ password, showBars = true }) {
  const result = getPasswordStrength(password);
  if (!result) return null;

  return (
    <div
      className={`pw-strength ${result.level}${showBars ? '' : ' text-only'}`}
      aria-live="polite"
    >
      {showBars && (
        <div className="pw-strength-bars" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= FILLED[result.level] ? 'on' : ''}></span>
          ))}
        </div>
      )}
      <p className="pw-strength-text">
        <strong>{result.label}</strong>
        {result.hint ? ` · ${result.hint}` : ''}
      </p>
    </div>
  );
}