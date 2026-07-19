import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin, useRegister } from '../lib/queries';
import { useAuth } from '../lib/AuthContext';
import { ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();
  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const data = await loginMutation.mutateAsync({ email, password });
        setAuth(data.token, data.user);
      } else {
        if (!name.trim()) { setError('Name is required'); return; }
        const data = await registerMutation.mutateAsync({ email, password, name });
        setAuth(data.token, data.user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="text-accent text-xs tracking-[0.2em] uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
            {isLogin ? 'Welcome back' : 'Get started'}
          </p>
          <h1 className="text-4xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-muted-foreground mt-3">
            {isLogin ? 'Access your photographer dashboard' : 'Start sharing event photos with AI face matching'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-2">Your Name <span className="text-accent">*</span></label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
              </div>
            </div>
          )}
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
                placeholder="••••••••" required minLength={6}
                className="w-full pl-11 pr-12 py-3 rounded-lg border border-border bg-input-background focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-accent transition-colors placeholder:text-muted-foreground/60" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
          <button type="submit" disabled={isLoading}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            {isLoading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>}
          </button>
        </form>
        <div className="mt-8 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-sm text-muted-foreground hover:text-accent transition-colors">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <span className="text-accent font-medium">{isLogin ? 'Sign Up' : 'Sign In'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
