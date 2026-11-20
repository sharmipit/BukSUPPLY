import React, { useState, useEffect, useRef, useId } from 'react';
import '../styles/DateField.css';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const todayISO = () => {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
};
const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
const monthOf = (iso) => {
  if (iso) {
    const [y, m] = iso.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
};

// Custom date picker component (matches Activity Log calendar design)
// Props: value (YYYY-MM-DD), onChange, min/max limits, align ('left' | 'right')
export default function DateField({
  label,
  value = '',
  onChange,
  min = '',
  max = '',
  align = 'left',
  placeholder = 'Select date',
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value));
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const labelId = useId();

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setView(monthOf(value || min || max));
    setOpen((o) => !o);
  };

  const shiftMonth = (delta) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  const today = todayISO();
  const other = min || max; // the other end of the range, if any
  const isDisabled = (iso) => Boolean((min && iso < min) || (max && iso > max));

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const rangeLo = value && other ? (value < other ? value : other) : '';
  const rangeHi = value && other ? (value < other ? other : value) : '';

  return (
    <div className={`df-field ${align === 'right' ? 'align-right' : ''}`} ref={rootRef}>
      <span className="df-label" id={labelId}>
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        className={`df-btn ${open ? 'open' : ''} ${value ? 'filled' : 'placeholder'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={toggle}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <i className="bi bi-calendar3"></i>
      </button>

      {open && (
        <div className="df-calendar" role="dialog" aria-label={`Choose ${label.toLowerCase()} date`}>
          <div className="df-cal-head">
            <button
              type="button"
              className="df-cal-nav"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <span className="df-cal-title">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              className="df-cal-nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          <div className="df-cal-grid df-cal-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="df-cal-grid">
            {cells.map((day, i) => {
              if (!day) return <span key={`blank-${i}`} />;
              const iso = toISO(view.year, view.month, day);
              const classes = ['df-cal-day'];
              if (iso === today) classes.push('today');
              if (iso === value || iso === other) classes.push('selected');
              else if (rangeLo && iso > rangeLo && iso < rangeHi) classes.push('in-range');
              return (
                <button
                  key={iso}
                  type="button"
                  className={classes.join(' ')}
                  disabled={isDisabled(iso)}
                  onClick={() => pick(iso)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="df-cal-foot">
            <button type="button" className="df-cal-link" onClick={() => pick('')}>
              Clear
            </button>
            <button
              type="button"
              className="df-cal-link"
              disabled={isDisabled(today)}
              onClick={() => pick(today)}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}