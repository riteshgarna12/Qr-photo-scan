import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin, useRegister, useForgotPassword, useResetPassword } from '../lib/queries';
import { useAuth } from '../lib/AuthContext';
import { ArrowRight, Mail, Lock, User, Eye, EyeOff, KeyRound, ArrowLeft, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Timer } from 'lucide-react';

// ─── Password strength helper ────────────────────────────────────────

type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong';

interface PasswordCheck {
  label: string;
  met: boolean;
}

function getPasswordStrength(password: string): { level: PasswordStrength; checks: PasswordCheck[] } {
  const checks: PasswordCheck[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One digit', met: /[0-9]/.test(password) },
  ];
  if (!password) return { level: 'empty', checks };
  const metCount = checks.filter((c) => c.met).length;
  if (metCount <= 2) return { level: 'weak', checks };
  if (metCount === 3) return { level: 'medium', checks };
  return { level: 'strong', checks };
}

const strengthColors: Record<PasswordStrength, string> = {
  empty: 'bg-muted',
  weak: 'bg-red-500',
  medium: 'bg-amber-400',
  strong: 'bg-emerald-500',
};

const strengthLabels: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Weak',
  medium: 'Fair',
  strong: 'Strong',
};

// ─── Email format validation ─────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Main Component ──────────────────────────────────────────────────

type AuthView = 'login' | 'register' | 'forgot' | 'reset' | 'reset-success';

export default function AuthPage() {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const navigate = useNavigate();
  const { login: setAuth } = useAuth();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const forgotMutation = useForgotPassword();
  const resetMutation = useResetPassword();

  const passwordStrength = useMemo(() => getPasswordStrength(view === 'reset' ? newPassword : password), [view, password, newPassword]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Handlers ────────────────────────────────────────────────────

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) { setError('Please enter a valid email address'); return; }
    if (!password) { setError('Password is required'); return; }

    try {
      const data = await loginMutation.mutateAsync({ email, password });
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      // Check for rate limit
      if (err.message?.includes('Too many')) {
        setLockoutSeconds(900); // 15 min
        setError(err.message);
      } else {
        setError(err.message || 'Invalid credentials');
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address'); return; }
    if (passwordStrength.level !== 'strong') { setError('Please meet all password requirements'); return; }

    try {
      const data = await registerMutation.mutateAsync({ email, password, name });
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotMsg('');

    if (!isValidEmail(email)) { setError('Please enter a valid email address'); return; }

    try {
      const data = await forgotMutation.mutateAsync(email);
      setForgotMsg(data.message);
      setView('reset');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!resetToken.trim()) { setError('Please enter the reset token'); return; }

    const strength = getPasswordStrength(newPassword);
    if (strength.level !== 'strong') { setError('Please meet all password requirements'); return; }

    try {
      await resetMutation.mutateAsync({ token: resetToken, password: newPassword });
      setView('reset-success');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired token');
    }
  };

  const switchView = (newView: AuthView) => {
    setView(newView);
    setError('');
    setForgotMsg('');
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending || forgotMutation.isPending || resetMutation.isPending;

  // ─── Render Helpers ──────────────────────────────────────────────

  const renderPasswordStrengthBar = (pwd: string) => {
    const strength = getPasswordStrength(pwd);
    if (!pwd) return null;
    return (
      <div className="mt-2.5 space-y-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              (strength.level === 'weak' && i === 0) ? strengthColors.weak :
              (strength.level === 'medium' && i <= 1) ? strengthColors.medium :
              (strength.level === 'strong') ? strengthColors.strong :
              'bg-muted'
            }`} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${
            strength.level === 'weak' ? 'text-red-500' :
            strength.level === 'medium' ? 'text-amber-500' :
            strength.level === 'strong' ? 'text-emerald-500' : 'text-muted-foreground'
          }`}>{strengthLabels[strength.level]}</span>
        </div>
        <div className="space-y-1">
          {strength.checks.map((check) => (
            <div key={check.label} className="flex items-center gap-1.5">
              {check.met
                ? <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                : <XCircle size={12} className="text-muted-foreground/50 shrink-0" />
              }
              <span className={`text-xs ${check.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'}`}>{check.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  };

  const renderLockout = () => {
    if (lockoutSeconds <= 0) return null;
    return (
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
        <Timer size={16} className="shrink-0" />
        <span>Account locked. Try again in <strong>{formatCountdown(lockoutSeconds)}</strong></span>
      </div>
    );
  };

  // ─── Views ───────────────────────────────────────────────────────

  // ── Reset Success ──
  if (view === 'reset-success') {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-3xl font-medium mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Password Reset!</h1>
          <p className="text-muted-foreground mb-8">Your password has been updated. You can now sign in with your new password.</p>
          <button onClick={() => { switchView('login'); setPassword(''); setNewPassword(''); setResetToken(''); }}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
            Sign In <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="text-accent text-xs tracking-[0.2em] uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
            {view === 'login' ? 'Welcome back' : view === 'register' ? 'Get started' : view === 'forgot' ? 'Account recovery' : 'New password'}
          </p>
          <h1 className="text-4xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
            {view === 'login' ? 'Sign In' : view === 'register' ? 'Create Account' : view === 'forgot' ? 'Forgot Password' : 'Reset Password'}
          </h1>
          <p className="text-muted-foreground mt-3">
            {view === 'login' ? 'Access your photographer dashboard' :
             view === 'register' ? 'Start sharing event photos with AI face matching' :
             view === 'forgot' ? 'Enter your email and we\'ll send you a reset token' :
             'Enter the token and your new password'}
          </p>
        </div>

        {/* ── Login Form ── */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email <span className="text-accent">*</span></label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password <span className="text-accent">*</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full pl-11 pr-12 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-2 text-right">
                <button type="button" onClick={() => switchView('forgot')} className="text-xs text-accent hover:underline transition-colors">
                  Forgot Password?
                </button>
              </div>
            </div>
            {renderLockout()}
            {renderError()}
            <button type="submit" disabled={isLoading || lockoutSeconds > 0}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              {isLoading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* ── Register Form ── */}
        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name <span className="text-accent">*</span></label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email <span className="text-accent">*</span></label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password <span className="text-accent">*</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full pl-11 pr-12 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {renderPasswordStrengthBar(password)}
            </div>
            {renderError()}
            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              {isLoading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* ── Forgot Password Form ── */}
        {view === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email Address <span className="text-accent">*</span></label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
              </div>
            </div>
            {renderError()}
            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              {isLoading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>Send Reset Token <ArrowRight size={16} /></>}
            </button>
            <button type="button" onClick={() => switchView('login')}
              className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back to Sign In
            </button>
          </form>
        )}

        {/* ── Reset Password Form ── */}
        {view === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-5">
            {forgotMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>{forgotMsg}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Reset Token <span className="text-accent">*</span></label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste the token from your email / console"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60 text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">New Password <span className="text-accent">*</span></label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full pl-11 pr-12 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {renderPasswordStrengthBar(newPassword)}
            </div>
            {renderError()}
            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              {isLoading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>Reset Password <ShieldCheck size={16} /></>}
            </button>
            <button type="button" onClick={() => switchView('forgot')}
              className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ── Toggle Login / Register ── */}
        {(view === 'login' || view === 'register') && (
          <div className="mt-8 text-center">
            <button onClick={() => switchView(view === 'login' ? 'register' : 'login')} className="text-sm text-muted-foreground hover:text-accent transition-colors">
              {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-accent font-medium">{view === 'login' ? 'Sign Up' : 'Sign In'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
