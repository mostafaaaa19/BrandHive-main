import { useRef, useCallback } from 'react';

const OTP_LENGTH = 6;

/**
 * Reusable 6-digit OTP input component.
 *
 * Props:
 *   value    - string (up to 6 digits, e.g. "123456" or "12")
 *   onChange - (newValue: string) => void  — always called with a 6-char padded array joined
 *   error    - boolean — turns borders red when true
 *   disabled - boolean
 */
export default function OtpInput({ value = '', onChange, error = false, disabled = false }) {
  // Normalize value into an array of 6 single-digit strings
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  const inputRefs = useRef([]);

  // ── Focus first box on mount ─────────────────────────────────────────────
  // (caller is responsible for calling focus if needed; we expose a ref array
  //  here but keep the component self-contained for simple use-cases)

  const emitChange = useCallback((next) => {
    onChange(next.join(''));
  }, [onChange]);

  // ── Key handlers ─────────────────────────────────────────────────────────
  const handleChange = useCallback((index, rawValue) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    emitChange(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits, emitChange]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace') {
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        emitChange(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        next[index - 1] = '';
        emitChange(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits, emitChange]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] || '');
    emitChange(next);
    const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextFocus]?.focus();
  }, [emitChange]);

  return (
    <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={el => (inputRefs.current[idx] = el)}
          id={`otp-digit-${idx}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={e => handleChange(idx, e.target.value)}
          onKeyDown={e => handleKeyDown(idx, e)}
          className={`
            w-14 h-14 text-center text-xl font-bold rounded-xl border-2 bg-white dark:bg-dark-surface
            text-brand-navy dark:text-brand-gold transition-all duration-150 outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${digit
              ? 'border-brand-gold ring-2 ring-brand-gold/20'
              : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-dark-muted'}
            focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/25
            ${error ? 'border-red-400 ring-2 ring-red-200 dark:ring-red-500/20' : ''}
          `}
          aria-label={`OTP digit ${idx + 1}`}
        />
      ))}
    </div>
  );
}
