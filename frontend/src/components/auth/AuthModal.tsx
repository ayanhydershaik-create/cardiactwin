import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../services/auth/authContext';
import { auth, isFirebaseConfigured } from '../../services/auth/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile 
} from 'firebase/auth';

export type AuthMode = 'signin' | 'signup' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { signInWithGoogle, signInDemoResearch } = useAuth();

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    confirmPassword && setConfirmPassword('');
    setFullName('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSwitchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isFirebaseConfigured || !auth) {
      setErrorMessage(
        'Firebase configuration is not active. Please ensure credentials in frontend/.env are set, or use Local Investigator Sign-In below.'
      );
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'signup') {
        if (!email.trim() || !password) {
          setErrorMessage('Please fill in all required fields.');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match.');
          setSubmitting(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim() && cred.user) {
          try {
            await updateProfile(cred.user, { displayName: fullName.trim() });
          } catch {
            // Profile display name update optional
          }
        }
        setSuccessMessage('Account created successfully! Logging you in...');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 800);
      } else if (mode === 'signin') {
        if (!email.trim() || !password) {
          setErrorMessage('Please provide both email and password.');
          setSubmitting(false);
          return;
        }
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setSuccessMessage('Authentication successful!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setErrorMessage('Please enter your account email address.');
          setSubmitting(false);
          return;
        }
        await sendPasswordResetEmail(auth, email.trim());
        setSuccessMessage('Password reset link has been dispatched to your email address.');
      }
    } catch (err: unknown) {
      let msg = 'An authentication error occurred.';
      if (err instanceof Error) {
        if (err.message.includes('auth/email-already-in-use')) {
          msg = 'An account with this email address already exists. Please sign in instead.';
        } else if (err.message.includes('auth/invalid-credential') || err.message.includes('auth/wrong-password') || err.message.includes('auth/user-not-found')) {
          msg = 'Invalid email or password. Please verify your credentials.';
        } else if (err.message.includes('auth/weak-password')) {
          msg = 'Password is too weak. Please use at least 6 characters with mixed letters and numbers.';
        } else if (err.message.includes('auth/operation-not-allowed')) {
          msg = 'Email/Password authentication is not yet enabled in your Firebase Console. Please enable it in Authentication > Sign-in method, or use Google Sign-In.';
        } else {
          msg = err.message;
        }
      }
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user')) {
        setErrorMessage('Sign-in popup was dismissed. Please try again.');
      } else if (msg.includes('auth/unauthorized-domain')) {
        setErrorMessage('Domain not authorized in Firebase Console. Add localhost to Authentication > Settings > Authorized domains.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = () => {
    signInDemoResearch();
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === 'signin' && 'Sign in to Cardiac Digital Twin'}
              {mode === 'signup' && 'Create your Account'}
              {mode === 'forgot' && 'Reset your Password'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'signin' && 'Access real-time biometrics, rhythm analysis, and patient records.'}
              {mode === 'signup' && 'Get started with precision digital twin electrophysiology.'}
              {mode === 'forgot' && 'Enter your email to receive password reset instructions.'}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Social Google Button */}
          {mode !== 'forgot' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl font-medium text-xs text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  or with email
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'signup' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                    placeholder="Dr. Jordan Hayes"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                  placeholder="name@institution.org"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot')}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-2"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'signin' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Link'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Mode Switcher Footer */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'signin' && (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="font-semibold text-sky-600 hover:underline"
                >
                  Create one now
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="font-semibold text-sky-600 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}

            {mode === 'forgot' && (
              <p>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="font-semibold text-sky-600 hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            )}

            {/* Offline demo access button */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors"
              >
                Access directly as Local Investigator (Demo)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
