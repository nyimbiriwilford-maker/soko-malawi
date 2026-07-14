import { AnimatePresence, motion } from 'framer-motion';
import '../styles/login.css';
import {
  LoginCard,
  Logo,
  InputField,
  PasswordField,
  Checkbox,
  PrimaryButton,
  SocialButton,
  Divider,
  TrustMessage,
  FooterLinks,
  Captcha,
} from '../components/auth';
import { AUTH_MODES, useAuthFlow } from '../hooks/useAuthFlow';

/**
 * SokoMw Login — premium CSS surface + full auth logic.
 */
export default function LoginPage() {
  const flow = useAuthFlow();
  const { mode, goTo, busy, message, loadingAction } = flow;

  return (
    <div className="login-page">
      <main className="login-page__main" aria-label="Authentication">
        <LoginCard>
          <Logo />

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              className="w-full min-w-0"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {mode === AUTH_MODES.LOGIN && <LoginMode flow={flow} />}
              {mode === AUTH_MODES.SIGNUP && <SignUpMode flow={flow} />}
              {mode === AUTH_MODES.VERIFY_SIGNUP && <VerifySignUpMode flow={flow} />}
              {mode === AUTH_MODES.FORGOT && <ForgotMode flow={flow} />}
              {mode === AUTH_MODES.OTP_RESET && <OtpResetMode flow={flow} />}
              {mode === AUTH_MODES.NEW_PASSWORD && <NewPasswordMode flow={flow} />}
            </motion.div>
          </AnimatePresence>

          <MessageBanner message={message} />

          {(mode === AUTH_MODES.LOGIN || mode === AUTH_MODES.SIGNUP) && (
            <>
              <Divider />
              <div className="login-social">
                <SocialButton
                  provider="google"
                  loading={loadingAction === 'google'}
                  disabled={busy && loadingAction !== 'google'}
                  onClick={() => flow.handlers.handleOAuth('google')}
                />
                <SocialButton
                  provider="facebook"
                  loading={loadingAction === 'facebook'}
                  disabled={busy && loadingAction !== 'facebook'}
                  onClick={() => flow.handlers.handleOAuth('facebook')}
                />
              </div>
            </>
          )}

          <TrustMessage />

          {(mode === AUTH_MODES.LOGIN || mode === AUTH_MODES.SIGNUP) && (
            <FooterLinks
              prompt={
                mode === AUTH_MODES.LOGIN
                  ? "Don't have an account?"
                  : 'Already have an account?'
              }
              linkText={mode === AUTH_MODES.LOGIN ? 'Create Account' : 'Sign In'}
              onClick={() =>
                goTo(mode === AUTH_MODES.LOGIN ? AUTH_MODES.SIGNUP : AUTH_MODES.LOGIN)
              }
            />
          )}

          {mode !== AUTH_MODES.LOGIN && mode !== AUTH_MODES.SIGNUP && (
            <p className="login-footer">
              <button
                type="button"
                onClick={() => goTo(AUTH_MODES.LOGIN)}
                className="login-footer__link"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </LoginCard>
      </main>
    </div>
  );
}

function MessageBanner({ message }) {
  if (!message?.text) return null;
  return (
    <AnimatePresence>
      <motion.div
        role={message.isError ? 'alert' : 'status'}
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className={[
          'login-banner',
          message.isError ? 'login-banner--error' : 'login-banner--info',
        ].join(' ')}
      >
        {message.text}
      </motion.div>
    </AnimatePresence>
  );
}

function ModeHeader({ title, subtitle }) {
  return (
    <header className="login-header">
      <h1 className="login-header__title">{title}</h1>
      {subtitle && <p className="login-header__subtitle">{subtitle}</p>}
    </header>
  );
}

function LoginMode({ flow }) {
  const {
    email,
    password,
    rememberMe,
    setRememberMe,
    showPassword,
    toggleShowPassword,
    fieldErrors,
    touched,
    busy,
    loadingAction,
    submitStatus,
    emailRef,
    passwordRef,
    handlers,
    goTo,
  } = flow;

  return (
    <>
      <ModeHeader
        title="Welcome Back"
        subtitle="Sign in to continue buying, selling and hiring on SokoMw."
      />

      <form
        className="login-form"
        onSubmit={handlers.handleLogin}
        noValidate
        aria-label="Login form"
      >
        <InputField
          ref={emailRef}
          id="login-email"
          name="email"
          label="Email Address"
          type="email"
          inputMode="email"
          enterKeyHint="next"
          value={email}
          onChange={handlers.handleEmailChange}
          onBlur={handlers.onEmailBlur}
          autoComplete="email"
          required
          error={fieldErrors.email}
          touched={Boolean(touched.email)}
          disabled={busy}
          placeholder="you@example.com"
        />

        <PasswordField
          ref={passwordRef}
          id="login-password"
          name="password"
          label="Password"
          value={password}
          onChange={handlers.handlePasswordChange}
          onBlur={handlers.onPasswordBlur}
          showPassword={showPassword}
          onToggleVisibility={toggleShowPassword}
          required
          error={fieldErrors.password}
          touched={Boolean(touched.password)}
          disabled={busy}
          autoComplete="current-password"
        />

        <div className="login-row">
          <Checkbox
            id="login-remember"
            name="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            label="Remember Me"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => goTo(AUTH_MODES.FORGOT)}
            className="login-link"
          >
            Forgot Password?
          </button>
        </div>

        <PrimaryButton
          type="submit"
          loading={loadingAction === 'signin'}
          success={submitStatus === 'success'}
          disabled={busy}
          aria-label="Sign in to SokoMw"
        >
          Sign In
        </PrimaryButton>
      </form>
    </>
  );
}

function SignUpMode({ flow }) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    agreedToTerms,
    setAgreedToTerms,
    showPassword,
    toggleShowPassword,
    busy,
    loadingAction,
    captchaKey,
    setCaptchaToken,
    captchaRequired,
    emailRef,
    passwordRef,
    handlers,
    clearMsg,
  } = flow;

  return (
    <>
      <ModeHeader
        title="Create Account"
        subtitle="Join SokoMw to buy, sell and hire across Malawi."
      />

      <form
        className="login-form"
        onSubmit={handlers.handleSignUpStart}
        noValidate
        aria-label="Sign up form"
      >
        <InputField
          ref={emailRef}
          id="signup-email"
          name="email"
          label="Email Address"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearMsg();
          }}
          autoComplete="email"
          required
          disabled={busy}
          placeholder="you@example.com"
        />

        <PasswordField
          ref={passwordRef}
          id="signup-password"
          name="password"
          label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearMsg();
          }}
          showPassword={showPassword}
          onToggleVisibility={toggleShowPassword}
          required
          disabled={busy}
          autoComplete="new-password"
        />

        <Checkbox
          id="signup-terms"
          name="agreedToTerms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          label="I agree to the Terms & Privacy Policy"
          disabled={busy}
        />

        {captchaRequired && (
          <Captcha
            key={`signup-${captchaKey}`}
            onToken={setCaptchaToken}
          />
        )}

        <PrimaryButton
          type="submit"
          loading={loadingAction === 'signup'}
          disabled={busy}
          aria-label="Continue sign up"
        >
          Continue
        </PrimaryButton>
      </form>
    </>
  );
}

function VerifySignUpMode({ flow }) {
  const {
    email,
    otpCode,
    setOtpCode,
    username,
    setUsername,
    usernameRef,
    busy,
    loadingAction,
    resendCooldown,
    captchaKey,
    setCaptchaToken,
    captchaRequired,
    handlers,
    clearMsg,
  } = flow;

  return (
    <>
      <ModeHeader
        title="Verify Email"
        subtitle={`Enter the 6-digit code sent to ${email || 'your email'}, then choose a username.`}
      />

      <form
        className="login-form"
        onSubmit={handlers.handleVerifyAndCreate}
        noValidate
        aria-label="Verify signup"
      >
        <InputField
          id="signup-otp"
          name="otp"
          label="Verification Code"
          type="text"
          inputMode="numeric"
          value={otpCode}
          onChange={(e) => {
            setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            clearMsg();
          }}
          autoComplete="one-time-code"
          required
          disabled={busy}
          placeholder="6-digit code"
          maxLength={6}
        />

        <InputField
          ref={usernameRef}
          id="signup-username"
          name="username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.replace(/\s/g, ''));
            clearMsg();
          }}
          autoComplete="username"
          required
          disabled={busy}
          placeholder="e.g. chikondi.mw"
          maxLength={20}
        />

        {captchaRequired && resendCooldown <= 0 && (
          <Captcha
            key={`verify-resend-${captchaKey}`}
            onToken={setCaptchaToken}
          />
        )}

        <PrimaryButton
          type="submit"
          loading={loadingAction === 'verifySignup'}
          disabled={busy}
          aria-label="Create account"
        >
          Create Account
        </PrimaryButton>

        <ResendRow
          cooldown={resendCooldown}
          loading={loadingAction === 'resend'}
          onResend={handlers.handleResendOtp}
          disabled={busy}
        />
      </form>
    </>
  );
}

function ForgotMode({ flow }) {
  const {
    email,
    setEmail,
    busy,
    loadingAction,
    captchaKey,
    setCaptchaToken,
    captchaRequired,
    emailRef,
    handlers,
    clearMsg,
  } = flow;

  return (
    <>
      <ModeHeader
        title="Reset Password"
        subtitle="We’ll email you a secure one-time code to reset access."
      />

      <form
        className="login-form"
        onSubmit={handlers.handleSendResetOtp}
        noValidate
        aria-label="Forgot password"
      >
        <InputField
          ref={emailRef}
          id="reset-email"
          name="email"
          label="Email Address"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearMsg();
          }}
          autoComplete="email"
          required
          disabled={busy}
          placeholder="you@example.com"
        />

        {captchaRequired && (
          <Captcha
            key={`forgot-${captchaKey}`}
            onToken={setCaptchaToken}
          />
        )}

        <PrimaryButton
          type="submit"
          loading={loadingAction === 'sendReset'}
          disabled={busy}
          aria-label="Send reset code"
        >
          Send Reset Code
        </PrimaryButton>
      </form>
    </>
  );
}

function OtpResetMode({ flow }) {
  const {
    email,
    otpCode,
    setOtpCode,
    busy,
    loadingAction,
    resendCooldown,
    captchaKey,
    setCaptchaToken,
    captchaRequired,
    handlers,
    clearMsg,
  } = flow;

  return (
    <>
      <ModeHeader
        title="Enter Reset Code"
        subtitle={`Check ${email || 'your inbox'} for a 6-digit verification code.`}
      />

      <form
        className="login-form"
        onSubmit={handlers.handleVerifyResetOtp}
        noValidate
        aria-label="Verify reset code"
      >
        <InputField
          id="reset-otp"
          name="otp"
          label="6-digit Code"
          type="text"
          inputMode="numeric"
          value={otpCode}
          onChange={(e) => {
            setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            clearMsg();
          }}
          autoComplete="one-time-code"
          required
          disabled={busy}
          placeholder="••••••"
        />

        {captchaRequired && resendCooldown <= 0 && (
          <Captcha
            key={`otp-resend-${captchaKey}`}
            onToken={setCaptchaToken}
          />
        )}

        <PrimaryButton
          type="submit"
          loading={loadingAction === 'verifyReset'}
          disabled={busy || otpCode.length !== 6}
          aria-label="Verify code"
        >
          Verify Code
        </PrimaryButton>

        <ResendRow
          cooldown={resendCooldown}
          loading={loadingAction === 'resend'}
          onResend={handlers.handleResendOtp}
          disabled={busy}
        />
      </form>
    </>
  );
}

function NewPasswordMode({ flow }) {
  const {
    newPass,
    setNewPass,
    confirmPass,
    setConfirmPass,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    busy,
    loadingAction,
    handlers,
    clearMsg,
  } = flow;

  return (
    <>
      <ModeHeader
        title="Set New Password"
        subtitle="Choose a strong password you haven’t used before."
      />

      <form
        className="login-form"
        onSubmit={handlers.handleSetNewPassword}
        noValidate
        aria-label="Set new password"
      >
        <PasswordField
          id="new-password"
          name="newPassword"
          label="New Password"
          value={newPass}
          onChange={(e) => {
            setNewPass(e.target.value);
            clearMsg();
          }}
          showPassword={showNewPassword}
          onToggleVisibility={() => setShowNewPassword((v) => !v)}
          required
          disabled={busy}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          value={confirmPass}
          onChange={(e) => {
            setConfirmPass(e.target.value);
            clearMsg();
          }}
          showPassword={showConfirmPassword}
          onToggleVisibility={() => setShowConfirmPassword((v) => !v)}
          required
          disabled={busy}
          autoComplete="new-password"
        />

        <PrimaryButton
          type="submit"
          loading={loadingAction === 'setPassword'}
          disabled={busy}
          aria-label="Update password"
        >
          Update Password
        </PrimaryButton>
      </form>
    </>
  );
}

function ResendRow({ cooldown, loading, onResend, disabled }) {
  return (
    <div className="text-center text-[13px] text-[#64748b]">
      {cooldown > 0 ? (
        <p className="text-xs text-[#94a3b8]">Resend available in {cooldown}s</p>
      ) : (
        <button
          type="button"
          onClick={onResend}
          disabled={disabled || loading}
          className="login-link disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Resend code'}
        </button>
      )}
    </div>
  );
}
