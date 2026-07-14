import { memo, forwardRef, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const FloatingInput = forwardRef(function FloatingInput(
  {
    id: idProp,
    name,
    label,
    type = 'text',
    value,
    onChange,
    onBlur,
    autoComplete,
    required = false,
    error,
    touched = false,
    disabled = false,
    placeholder,
    inputMode,
    enterKeyHint,
    maxLength,
    className = '',
    'aria-label': ariaLabel,
  },
  ref
) {
  const reactId = useId();
  const id = idProp || reactId;
  const errorId = `${id}-error`;
  const hasValue = value != null && String(value).trim().length > 0;
  // Never show error styling for empty fields after blur-clear
  const showError = Boolean(touched && error);
  const showValid = Boolean(touched && !error && hasValue);

  return (
    <div
      className={[
        'login-field',
        showError ? 'is-error' : '',
        showValid ? 'is-valid' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label && (
        <label htmlFor={id} className="login-field__label">
          {label}
        </label>
      )}

      <div className="login-field__control">
        <input
          ref={ref}
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          maxLength={maxLength}
          placeholder={placeholder || label}
          aria-label={ariaLabel || label}
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? errorId : undefined}
          aria-required={required || undefined}
          className="login-field__input"
        />
      </div>

      <AnimatePresence mode="wait">
        {showError && (
          <motion.p
            id={errorId}
            key={error}
            role="alert"
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="login-field__error"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

export default memo(FloatingInput);
