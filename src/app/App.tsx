import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Camera, QrCode, Heart, Download, X, ChevronLeft, ChevronRight, Check, Menu, ArrowRight, LogIn, LogOut, Scan, Info, Sliders, Upload } from 'lucide-react';
import { useAuth } from './lib/AuthContext';
import AuthPage from './pages/AuthPage';
import GuestPage from './pages/GuestPage';
import DashboardPage from './pages/DashboardPage';

function QRCodeSVG({ size = 200 }: { size?: number }) {
  const cells = [
    [1,1,1,1,1,1,1,0,1,0,1,0,0,0,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,1],[1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,0,1,1,1,0,1],[1,0,1,1,1,0,1,0,1,0,0,0,1,0,1,0,1,1,1,0,1],[1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],[1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0],[1,1,0,1,1,0,1,1,0,0,1,0,0,1,1,0,1,0,1,1,0],[0,1,0,0,1,0,0,1,1,0,1,1,0,1,0,0,1,1,0,0,1],[1,0,1,0,0,1,1,0,0,1,0,0,1,0,1,1,0,1,0,0,1],[0,1,1,0,1,0,0,1,0,1,1,0,0,1,0,1,1,0,1,0,0],[1,0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,0,1,1],[0,0,0,0,0,0,0,0,1,0,1,1,0,0,0,1,1,0,0,1,0],[1,1,1,1,1,1,1,0,0,1,0,0,1,0,1,0,0,1,0,1,1],[1,0,0,0,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,0],[1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,0,1,1,0,1,0],[1,0,1,1,1,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1],[1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,0,1,1,0],[1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1],[1,1,1,1,1,1,1,0,0,0,1,0,1,0,1,0,1,0,0,1,0],
  ];
  const cellSize = size / 21;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill="white" rx="4" />
      {cells.map((row, r) => row.map((cell, c) => cell ? <rect key={`${r}-${c}`} x={c*cellSize} y={r*cellSize} width={cellSize} height={cellSize} fill="#2c2416" /> : null))}
      <rect x={size/2-14} y={size/2-14} width={28} height={28} fill="white" rx="3" />
      <text x={size/2} y={size/2+6} textAnchor="middle" fontSize="16" fill="#c8956c">{'\u2665'}</text>
    </svg>
  );
}

function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  if (location.pathname.startsWith('/e/')) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
            <span className="text-accent text-xl">{'\u2665'}</span>
            <span style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-medium tracking-tight">QR Photo Share</span>
          </button>
        </div>
      </header>
    );
  }

  const handleNavClick = (path: string) => {
    setMobileOpen(false);
    if (path.startsWith('scroll:')) {
      const id = path.replace('scroll:', '');
      navigate('/');
      setTimeout(() => {
        document.getElementById(id.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      navigate(path);
    }
  };

  const links = isAuthenticated
    ? [
        { label: 'Home', path: '/', icon: <Heart size={15} /> },
        { label: 'About Us', path: 'scroll:#about-us', icon: <Info size={15} /> },
        { label: 'Dashboard', path: '/dashboard', icon: <QrCode size={15} /> }
      ]
    : [
        { label: 'Home', path: '/', icon: <Heart size={15} /> },
        { label: 'About Us', path: 'scroll:#about-us', icon: <Info size={15} /> },
        { label: 'Sign In', path: '/auth', icon: <LogIn size={15} /> }
      ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <span className="text-accent text-xl">{'\u2665'}</span>
          <span style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg font-medium tracking-tight">QR Photo Share</span>
        </button>
        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ label, path, icon }) => (
            <button 
              key={path} 
              onClick={() => handleNavClick(path)} 
              className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm transition-all ${
                location.pathname === path || (path.startsWith('scroll:') && location.pathname === '/') 
                  ? 'text-foreground hover:bg-secondary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
          {isAuthenticated && (
            <button 
              onClick={() => { logout(); navigate('/'); }} 
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <LogOut size={15} />Sign Out
            </button>
          )}
        </nav>
        <button className="md:hidden p-2 rounded hover:bg-secondary transition-colors" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-6 py-3 flex flex-col gap-1">
          {links.map(({ label, path, icon }) => (
            <button 
              key={path} 
              onClick={() => handleNavClick(path)} 
              className="flex items-center gap-2 px-4 py-2.5 rounded text-sm transition-all text-left text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              {icon}
              {label}
            </button>
          ))}
          {isAuthenticated && (
            <button 
              onClick={() => { logout(); navigate('/'); setMobileOpen(false); }} 
              className="flex items-center gap-2 px-4 py-2.5 rounded text-sm text-left text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <LogOut size={15} />Sign Out
            </button>
          )}
        </div>
      )}
    </header>
  );
}

function LandingView() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen">
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <p className="text-accent text-sm tracking-[0.2em] uppercase mb-6 font-light" style={{ fontFamily: "'DM Mono', monospace" }}>AI-Powered Photo Delivery</p>
            <h1 className="text-5xl md:text-6xl font-medium leading-tight mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Find Your<br /><em className="italic text-accent">Event</em><br />Photos Instantly</h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-md">Upload event photos, generate a QR code, and let guests find themselves with a single selfie scan. No app downloads required.</p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/auth')} className="flex items-center gap-2 px-7 py-3.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity text-sm font-medium"><Camera size={16} />{isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}</button>
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-2 px-7 py-3.5 bg-secondary text-secondary-foreground rounded hover:bg-muted transition-colors text-sm font-medium"><Scan size={16} />See How It Works<ArrowRight size={14} /></button>
            </div>
            <div className="mt-14 flex gap-8">
              {[{ value: '2s', label: 'Face match speed' }, { value: '99%', label: 'AI accuracy' }, { value: '0', label: 'Apps to install' }].map(({ value, label }) => (
                <div key={label}><div className="text-2xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>{value}</div><div className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>{label}</div></div>
              ))}
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="relative">
              <div className="absolute -top-8 -left-12 w-40 h-52 rounded-lg overflow-hidden rotate-[-8deg] shadow-lg border border-border/50 bg-muted"><img src="https://images.unsplash.com/photo-1519741497674-611481863552?w=300&h=400&fit=crop&auto=format" alt="Event" className="w-full h-full object-cover" /></div>
              <div className="absolute -bottom-6 -right-10 w-36 h-48 rounded-lg overflow-hidden rotate-[7deg] shadow-lg border border-border/50 bg-muted"><img src="https://images.unsplash.com/photo-1606800052052-a08af7148866?w=300&h=400&fit=crop&auto=format" alt="Event" className="w-full h-full object-cover" /></div>
              <div className="absolute top-16 -right-14 w-32 h-40 rounded-lg overflow-hidden rotate-[4deg] shadow-lg border border-border/50 bg-muted"><img src="https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=300&h=400&fit=crop&auto=format" alt="Event" className="w-full h-full object-cover" /></div>
              <div className="relative z-10 bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-foreground/5 flex flex-col items-center gap-5">
                <div className="text-center"><p className="text-xs tracking-widest uppercase text-muted-foreground mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>Scan to find</p><h3 className="text-lg font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>Your Event Photos</h3></div>
                <div className="p-3 bg-white rounded-xl border border-border shadow-inner"><QRCodeSVG size={180} /></div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs" style={{ fontFamily: "'DM Mono', monospace" }}><Camera size={12} />Selfie scan · AI face match</div>
                <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/auth')} className="w-full py-2.5 bg-accent text-accent-foreground rounded text-sm hover:opacity-90 transition-opacity">Start Your Event</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-6 bg-secondary/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14"><p className="text-accent text-xs tracking-[0.2em] uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>Simple & instant</p><h2 className="text-3xl md:text-4xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>How It Works</h2></div>
          <div className="grid md:grid-cols-3 gap-8">
            {[{ step: '01', icon: <Upload size={24} className="text-accent" />, title: 'Upload Event Photos', desc: 'Photographers upload all official high-resolution event photos to the secure dashboard.' },
              { step: '02', icon: <QrCode size={24} className="text-accent" />, title: 'Share the QR Code', desc: 'Print or display the auto-generated QR code at your venue. Guests scan it instantly.' },
              { step: '03', icon: <Scan size={24} className="text-accent" />, title: 'Selfie → Your Photos', desc: 'Guests take a quick selfie. AI matches their face and shows only their photos for download.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="relative p-8 bg-card rounded-xl border border-border hover:shadow-md transition-shadow">
                <span className="absolute top-5 right-6 text-4xl font-medium text-border select-none" style={{ fontFamily: "'Playfair Display', serif" }}>{step}</span>
                <div className="mb-5 w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">{icon}</div>
                <h3 className="text-xl mb-3 font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about-us" className="py-20 px-6 bg-white border-y border-border scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-accent text-xs tracking-[0.2em] uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>Our Story</p>
              <h2 className="text-3xl md:text-4xl font-medium mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Connecting Memories,<br />Smarter.</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                We believe that the joy of event photography shouldn't get lost in a shared folder link that guests never open. The typical process of hunting for your photo through thousands of wedding shots is slow and outdated.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                <strong>QR Photo Share</strong> was built to close the gap. Our local, privacy-first AI face recognition matches your selfie against indexed event galleries in milliseconds, instantly filtering out everything else so you can save your memories without the hassle.
              </p>
              
              <div className="grid grid-cols-2 gap-6 border-t border-border/85 pt-6">
                <div>
                  <h4 className="font-semibold text-foreground text-sm mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Privacy First</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">Selfie data is calculated locally and unlinked instantly. No face tracking or data sales.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Zero Friction</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">No application downloads, registration forms, or guest accounts required.</p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-secondary border border-border shadow-sm">
                <img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&h=450&fit=crop&auto=format" alt="Wedding guest matching" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-card border border-border p-5 rounded-xl shadow-lg flex items-center gap-3.5 max-w-[220px]">
                <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                  {'\u2728'}
                </div>
                <div>
                  <h5 className="font-bold text-xs" style={{ fontFamily: "'Playfair Display', serif" }}>Delivered in 2 Seconds</h5>
                  <p className="text-[10px] text-muted-foreground">Selfie search matching</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-6 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14"><p className="text-accent text-xs tracking-[0.2em] uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>Pricing plans</p><h2 className="text-3xl md:text-4xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>Choose Your Plan</h2></div>
          <div className="grid md:grid-cols-3 gap-6">
            {[{ name: 'Starter', price: 'Free', period: '', features: ['1 event', 'Up to 50 photos', 'AI face matching', 'Standard quality', '48-hour access'], cta: 'Start Free', highlight: false },
              { name: 'Premium', price: '$39', period: 'per event', features: ['1 event', 'Up to 1,000 photos', 'AI face matching', 'High-res downloads', '30-day access', 'Printable QR cards', 'Host moderation'], cta: 'Get Premium', highlight: true },
              { name: 'Pro', price: '$89', period: '/month', features: ['Unlimited events', 'Unlimited photos', 'Priority AI matching', '4K original quality', 'Guest Highlight Reels (15s/30s)', 'Custom branding', 'Analytics & CSV exports'], cta: 'Go Pro', highlight: false },
            ].map(({ name, price, period, features, cta, highlight }) => (
              <div key={name} className={`relative p-8 rounded-xl border transition-shadow ${highlight ? 'border-accent bg-accent/5 shadow-lg shadow-accent/10' : 'border-border bg-card hover:shadow-md'}`}>
                {highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-accent-foreground text-xs rounded-full" style={{ fontFamily: "'DM Mono', monospace" }}>Most Popular</div>}
                <h3 className="text-xl font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{name}</h3>
                <div className="flex items-baseline gap-1 mb-6"><span className="text-4xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>{price}</span>{period && <span className="text-sm text-muted-foreground">{period}</span>}</div>
                <ul className="space-y-3 mb-8">{features.map((f) => <li key={f} className="flex items-center gap-2 text-sm"><Check size={14} className="text-accent flex-shrink-0" />{f}</li>)}</ul>
                <button onClick={() => navigate('/auth')} className={`w-full py-3 rounded-lg text-sm transition-all ${highlight ? 'bg-accent text-accent-foreground hover:opacity-90' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>{cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Multi-Column Footer */}
      <footer className="border-t border-border bg-[#1a1612] text-white/70 py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Col 1 */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2 text-white font-medium">
              <span className="text-accent text-xl">{'\u2665'}</span>
              <span style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg">QR Photo Share</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed max-w-[200px]">
              AI-powered event photo delivery, bridging the gap between host photographers and guests.
            </p>
          </div>
          {/* Col 2 */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent" style={{ fontFamily: "'DM Mono', monospace" }}>Product</h4>
            <ul className="text-xs space-y-2">
              <li><button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">How It Works</button></li>
              <li><button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Pricing Options</button></li>
              <li><button onClick={() => navigate('/auth')} className="hover:text-white transition-colors">Get Started</button></li>
            </ul>
          </div>
          {/* Col 3 */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent" style={{ fontFamily: "'DM Mono', monospace" }}>Company</h4>
            <ul className="text-xs space-y-2">
              <li><button onClick={() => document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">About Us</button></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog News</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Partners</a></li>
            </ul>
          </div>
          {/* Col 4 */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent" style={{ fontFamily: "'DM Mono', monospace" }}>Legal</h4>
            <ul className="text-xs space-y-2">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">GDPR Privacy</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-5xl mx-auto border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} QR Photo Share. All rights reserved.</p>
          <p style={{ fontFamily: "'DM Mono', monospace" }}>Privacy guaranteed by local AI scanning</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Lato', sans-serif" }}>
      <Nav />
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/e/:slug" element={<GuestPage />} />
      </Routes>
    </div>
  );
}
