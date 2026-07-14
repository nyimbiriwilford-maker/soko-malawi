import { memo, forwardRef, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const PasswordInput = forwardRef(function PasswordInput(
  {
    id: idProp,
    name = 'password',
    label = 'Password',
    value,
    onChange,
    onBlur,
    showPassword = false,
    onToggleVisibility,
    required = false,
    error,
    touched = false,
    disabled = false,
    autoComplete = 'current-password',
    className = '',
  },
  ref
) {
  const reactId = useId();
  const id = idProp || reactId;
  const errorId = `${id}-error`;
  const hasValue = value != null && String(value).length > 0;
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
      <label htmlFor={id} className="login-field__label">
        {label}
      </label>

      <div className="login-field__control">
        <input
          ref={ref}
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={label}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={label}
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? errorId : undefined}
          aria-required={required || undefined}
          className="login-field__input login-field__input--password"
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          disabled={disabled}
          tabIndex={0}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          className="login-field__eye"
        >
          <span aria-hidden="true" className="flex">
            {showPassword ? (
              <EyeOff size={18} strokeWidth={1.75} />
            ) : (
              <Eye size={18} strokeWidth={1.75} />
            )}
          </span>
        </button>
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

export default memo(PasswordInput);
