import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatNumber, parseNumber } from '@stige/core';

/** Ark som glir opp fra bunnen. Trykk utenfor lukker. */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  // Portal til body: fullskjermsflater skal ikke ligge inne i rullefeltet (gir feil i Safari).
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Fullskjermsvisning over resten av appen. */
export function Overlay({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return createPortal(
    <div className={className ?? 'overlay'} role="dialog" aria-label={label}>
      {children}
    </div>,
    document.body,
  );
}

interface NumberFieldProps {
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  decimal?: boolean;
  label: string;
  disabled?: boolean;
}

/** Tallfelt som tåler komma og punktum. Teksten holdes lokalt mens feltet har fokus. */
export function NumberField({ value, placeholder, onChange, decimal, label, disabled }: NumberFieldProps) {
  const [text, setText] = useState(value != null ? formatNumber(value) : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value != null ? formatNumber(value) : '');
  }, [value, focused]);

  return (
    <input
      className="num"
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '');
        setText(t);
        onChange(parseNumber(t));
      }}
    />
  );
}
