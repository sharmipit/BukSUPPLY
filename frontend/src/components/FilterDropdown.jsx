import React, { useState, useEffect, useRef } from 'react';
import '../styles/FilterDropdown.css';

/*
  Reusable pill dropdown for list filters.

  options: [{ value, label, tone? }]
    - tone (optional) adds a small coloured dot: pending, processing,
      approved, cancelled, accepted, denied. Options without a tone get a neutral dot,
      but only when at least one option has a tone.
  value:     the currently selected option value
  onChange:  (value) => void
  allValue:  the value that means "no filter" (the trigger highlights otherwise)
  icon:      Bootstrap icon class shown before the label. Pass null for no icon.
  className: optional extra class on the wrapper (e.g. "fd--compact")
*/
export default function FilterDropdown({
  options,
  value,
  onChange,
  icon = 'bi-funnel',
  ariaLabel = 'Filter',
  allValue = 'All',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => o.value === value) || options[0];
  const filtered = value !== allValue;
  const showDots = options.some((o) => o.tone);

  // Close on outside click or Escape. Focus the active option when opening.
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

    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);

    const target =
      menuRef.current?.querySelector('[aria-selected="true"]') ||
      menuRef.current?.querySelector('button');
    target?.focus();

    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (next) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();

    const buttons = [...menuRef.current.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    let next = index;

    if (e.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (e.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = buttons.length - 1;

    buttons[next].focus();
  };

  return (
    <div className={`fd ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`fd-trigger ${open ? 'open' : ''} ${filtered ? 'filtered' : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected.label}`}
      >
        {icon && <i className={`bi ${icon} fd-icon`}></i>}
        <span className="fd-text">{selected.label}</span>
        <i className="bi bi-chevron-down fd-chevron"></i>
      </button>

      {open && (
        <ul
          className="fd-menu"
          role="listbox"
          aria-label={ariaLabel}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`fd-item ${active ? 'active' : ''}`}
                  onClick={() => choose(opt.value)}
                >
                  {showDots && <span className={`fd-dot fd-dot--${opt.tone || 'all'}`} />}
                  <span className="fd-item-text">{opt.label}</span>
                  <i className={`bi bi-check2 fd-check ${active ? 'show' : ''}`}></i>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}