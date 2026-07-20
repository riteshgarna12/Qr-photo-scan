import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMyEvents,
  useCreateEvent,
  useEvent,
  useUploadPhotos,
  useDeletePhoto,
  useDeleteAllPhotos,
  useToggleEventLock,
  useUpdateEventCover,
  useUpgradeSubscription,
  useReindexPhotos,
  Event as EventType,
  Photo as PhotoType,
} from '../lib/queries';
import { useAuth } from '../lib/AuthContext';
import {
  Plus,
  Calendar,
  QrCode,
  Image as ImageIcon,
  Trash2,
  Upload,
  Check,
  Copy,
  Download,
  ExternalLink,
  ChevronLeft,
  Loader2,
  Lock,
  Unlock,
  Sparkles,
  CreditCard,
  User as UserIcon,
  X,
  Play,
  ArrowRight,
  Shield,
  Eye,
  RefreshCw,
} from 'lucide-react';

const BACKEND_BASE = 'https://qr-photo-scan-backend.onrender.com';

const getPhotoUrl = (url: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_BASE}${url}`;
};

export default function DashboardPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useMyEvents();
  const createEventMutation = useCreateEvent();
  const upgradeMutation = useUpgradeSubscription();

  const [activeTab, setActiveTab] = useState<'galleries' | 'subscription'>('galleries');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [createError, setCreateError] = useState('');

  // Handle new event submission
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newEventName.trim()) return;

    try {
      await createEventMutation.mutateAsync({
        eventName: newEventName,
        eventDate: newEventDate || undefined,
      });
      setShowCreateModal(false);
      setNewEventName('');
      setNewEventDate('');
      refetchEvents();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create event');
    }
  };

  // Handle plan upgrades
  const handleUpgradePlan = async (tier: string) => {
    try {
      const res = await upgradeMutation.mutateAsync(tier);
      // Re-login locally to store updated plan in context
      if (user) {
        login(localStorage.getItem('auth_token') || '', { ...user, subscriptionTier: tier });
      }
    } catch (err) {
      console.error('Plan upgrade failed:', err);
    }
  };

  if (eventsLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center bg-[#fafafa]">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  const events = eventsData?.events || [];
  const totalPhotos = events.reduce((sum, e) => sum + (e._count?.photos || 0), 0);

  // Sub limit helpers
  const planLimits: Record<string, { events: string; photos: string; label: string }> = {
    FREE: { events: '1 Event', photos: '50 Photos/Event', label: 'Free Trial' },
    PREMIUM: { events: '1 Event', photos: '1,000 Photos/Event', label: 'Premium host' },
    PRO: { events: 'Unlimited Events', photos: 'Unlimited Storage', label: 'Professional' },
  };

  const currentLimits = planLimits[user?.subscriptionTier || 'FREE'];

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 bg-[#fafafa] text-foreground">
      <div className="max-w-6xl mx-auto">
        {selectedEventId ? (
          <EventDetailView eventId={selectedEventId} onBack={() => setSelectedEventId(null)} />
        ) : (
          <>
            {/* Upper Dashboard Hero */}
            <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white border border-border p-8 rounded-2xl shadow-sm">
              <div>
                <span className="text-accent text-xs tracking-[0.25em] uppercase mb-2 block font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>
                  Host Console
                </span>
                <h1 className="text-4xl font-semibold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Hello, {user?.name || 'Photographer'}
                </h1>
                <p className="text-muted-foreground text-sm">
                  Manage your wedding events, upload official photos, download printable QR displays, or upgrade your storage plan.
                </p>
              </div>

              {/* Quick Status Pill */}
              <div className="flex items-center gap-3 bg-secondary/50 border border-border px-4 py-2.5 rounded-xl text-xs font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>
                <Sparkles size={14} className="text-accent" />
                <span>Plan: <span className="text-accent font-semibold">{currentLimits.label}</span></span>
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>Total Galleries</p>
                <p className="text-3xl font-medium">{events.length}</p>
              </div>
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>Total Shared Photos</p>
                <p className="text-3xl font-medium">{totalPhotos}</p>
              </div>
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>Storage Usage</p>
                <p className="text-3xl font-medium">{currentLimits.photos}</p>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-border mb-8">
              <button
                onClick={() => setActiveTab('galleries')}
                className={`pb-4 px-6 text-sm font-medium border-b-2 transition-all ${
                  activeTab === 'galleries'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                My Galleries
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`pb-4 px-6 text-sm font-medium border-b-2 transition-all ${
                  activeTab === 'subscription'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Settings & Subscription
              </button>
            </div>

            {/* TAB: Galleries list */}
            {activeTab === 'galleries' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Active Galleries
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-all font-medium shadow-sm"
                  >
                    <Plus size={16} />
                    New Gallery
                  </button>
                </div>

                {events.length === 0 ? (
                  <div className="bg-white border border-border rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar size={28} className="text-accent" />
                    </div>
                    <h3 className="text-2xl font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                      Create Your First Event
                    </h3>
                    <p className="text-muted-foreground text-sm mb-6">
                      Instantly get a dedicated photo link and unique QR code so guests can scan their face and download official wedding day photos.
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
                    >
                      Create First Gallery
                    </button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className="bg-white border border-border rounded-xl hover:shadow-md transition-all cursor-pointer flex flex-col group overflow-hidden"
                      >
                        {/* cover card view */}
                        <div className="h-40 bg-secondary/40 relative overflow-hidden flex items-center justify-center border-b border-border">
                          {event.coverImageUrl ? (
                            <img
                              src={getPhotoUrl(event.coverImageUrl)}
                              alt={event.eventName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="text-muted-foreground/40 flex flex-col items-center gap-1.5">
                              <ImageIcon size={32} />
                              <span className="text-xs uppercase tracking-wider font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>No Cover Photo</span>
                            </div>
                          )}

                          {/* Lock status dot indicator */}
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[10px] uppercase font-semibold tracking-wider">
                            {event.isLocked ? (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Locked
                              </>
                            ) : (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Active
                              </>
                            )}
                          </div>
                        </div>

                        {/* info body */}
                        <div className="p-6 flex-1 flex flex-col">
                          <span className="text-xs text-muted-foreground mb-1 block" style={{ fontFamily: "'DM Mono', monospace" }}>
                            {event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No Date Set'}
                          </span>
                          <h3 className="text-xl font-medium truncate mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {event.eventName}
                          </h3>

                          <div className="mt-auto flex justify-between items-center pt-4 border-t border-border/50 text-xs text-muted-foreground font-medium">
                            <span style={{ fontFamily: "'DM Mono', monospace" }}>{event._count?.photos || 0} photos</span>
                            <span className="text-accent flex items-center gap-1">Manage <ArrowRight size={12} /></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* TAB: subscription */}
            {activeTab === 'subscription' && (
              <div className="space-y-8 bg-white border border-border p-8 rounded-2xl shadow-sm">
                <div>
                  <h2 className="text-2xl font-medium mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Account & Plan Limits
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Select a tier that fits your volume of wedding shoots. Upgrade or downgrade instantly.
                  </p>
                </div>

                {/* current stats */}
                <div className="grid sm:grid-cols-2 gap-6 bg-secondary/30 p-6 rounded-xl border border-border/50 text-sm">
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Account Owner</p>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserIcon size={14} className="text-accent" />
                      {user?.name} ({user?.email})
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Current Tier</p>
                    <p className="font-semibold text-accent flex items-center gap-1.5 uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>
                      <Sparkles size={14} />
                      {user?.subscriptionTier} PLAN
                    </p>
                  </div>
                </div>

                {/* plan matrix details */}
                <div className="grid md:grid-cols-3 gap-6 pt-4">
                  {/* Free plan */}
                  <div className={`border rounded-xl p-6 flex flex-col transition-all ${user?.subscriptionTier === 'FREE' ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border bg-white'}`}>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>Starter Pack</span>
                    <h4 className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Free Trial</h4>
                    <p className="text-2xl font-semibold mb-4">$0 <span className="text-xs font-normal text-muted-foreground">/ forever</span></p>
                    <ul className="text-xs text-muted-foreground space-y-2 mb-6">
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Max 1 Event Gallery</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Max 50 Photos per event</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> AI Face-Matching & Lightbox</li>
                    </ul>
                    <button
                      onClick={() => handleUpgradePlan('FREE')}
                      disabled={user?.subscriptionTier === 'FREE' || upgradeMutation.isPending}
                      className="mt-auto w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {user?.subscriptionTier === 'FREE' ? 'Current Plan' : 'Switch to Free'}
                    </button>
                  </div>

                  {/* Premium Plan */}
                  <div className={`border rounded-xl p-6 flex flex-col relative overflow-hidden transition-all ${user?.subscriptionTier === 'PREMIUM' ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border bg-white'}`}>
                    <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-[9px] font-bold uppercase tracking-wider py-1 px-3 rounded-bl">Popular</div>
                    <span className="text-xs font-semibold text-accent uppercase tracking-widest block mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>Single Wedding</span>
                    <h4 className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Premium Host</h4>
                    <p className="text-2xl font-semibold mb-4">$29 <span className="text-xs font-normal text-muted-foreground">/ event</span></p>
                    <ul className="text-xs text-muted-foreground space-y-2 mb-6">
                      <li className="flex items-center gap-2"><Check size={12} className="text-accent" /> Max 1 Active Event</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-accent" /> 1,000 High-Res Photos</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-accent" /> Custom Branding & Cover Photo</li>
                    </ul>
                    <button
                      onClick={() => handleUpgradePlan('PREMIUM')}
                      disabled={user?.subscriptionTier === 'PREMIUM' || upgradeMutation.isPending}
                      className="mt-auto w-full py-2 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
                    >
                      {user?.subscriptionTier === 'PREMIUM' ? 'Current Plan' : 'Select Premium'}
                    </button>
                  </div>

                  {/* Pro Plan */}
                  <div className={`border rounded-xl p-6 flex flex-col transition-all ${user?.subscriptionTier === 'PRO' ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border bg-white'}`}>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2" style={{ fontFamily: "'DM Mono', monospace" }}>Studio Bundle</span>
                    <h4 className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Professional</h4>
                    <p className="text-2xl font-semibold mb-4">$79 <span className="text-xs font-normal text-muted-foreground">/ month</span></p>
                    <ul className="text-xs text-muted-foreground space-y-2 mb-6">
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Unlimited Event Galleries</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Unlimited Photos / Storage</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Guest Highlight Reels (15s/30s)</li>
                      <li className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Dedicated Priority Support</li>
                    </ul>
                    <button
                      onClick={() => handleUpgradePlan('PRO')}
                      disabled={user?.subscriptionTier === 'PRO' || upgradeMutation.isPending}
                      className="mt-auto w-full py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      {user?.subscriptionTier === 'PRO' ? 'Current Plan' : 'Go Professional'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#000]/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="text-2xl font-semibold mb-2 animate-fade-in" style={{ fontFamily: "'Playfair Display', serif" }}>
              New Wedding Gallery
            </h3>
            <p className="text-muted-foreground text-xs mb-6">Create a new dedicated client gallery link instantly.</p>
            <form onSubmit={handleCreateEvent} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">
                  Gallery / Event Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g., Sarah & John's Wedding"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-border bg-[#fafafa] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground font-medium">
                  Date <span className="text-muted-foreground/60 text-[10px] italic">(optional)</span>
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-[#fafafa] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>

              {createError && (
                <div className="p-3 bg-destructive/5 border border-destructive/10 text-destructive text-xs rounded-lg font-medium">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={createEventMutation.isPending}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-medium"
              >
                {createEventMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>Create Gallery</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Detail View Component ---
function EventDetailView({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const { data: eventData, isLoading, refetch } = useEvent(eventId);
  const deletePhotoMutation = useDeletePhoto();
  const deleteAllPhotosMutation = useDeleteAllPhotos();
  const reindexPhotosMutation = useReindexPhotos();
  const uploadPhotosMutation = useUploadPhotos();
  const toggleLockMutation = useToggleEventLock();
  const updateCoverMutation = useUpdateEventCover();

  const [copied, setCopied] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Upload Cover Photo
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      await updateCoverMutation.mutateAsync({ eventId, file });
      refetch();
    } catch (err) {
      console.error('Cover upload failed:', err);
    }
  };

  // Toggle Lock State
  const handleToggleLock = async (currentLock: boolean) => {
    try {
      await toggleLockMutation.mutateAsync({ eventId, isLocked: !currentLock });
      refetch();
    } catch (err) {
      console.error('Failed to change lock state:', err);
    }
  };

  // Upload multiple gallery photos
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploadingFiles(files);

    try {
      await uploadPhotosMutation.mutateAsync({ eventId, files });
      setUploadingFiles([]);
      refetch();
    } catch (err) {
      console.error('Photos upload failed:', err);
      setUploadingFiles([]);
    }
  };

  // Delete specific photo
  const handleDeletePhoto = async (photoId: string) => {
    if (confirm('Delete this photo from the event gallery?')) {
      try {
        await deletePhotoMutation.mutateAsync(photoId);
        refetch();
      } catch (err) {
        console.error('Photo delete failed:', err);
      }
    }
  };

  // Delete ALL photos for this event
  const handleDeleteAllPhotos = async () => {
    if (!confirm(`⚠️ Are you sure you want to delete ALL ${photos.length} photo(s)? This action cannot be undone.`)) return;
    if (!confirm('This will permanently remove every photo and their face data. Proceed?')) return;
    try {
      await deleteAllPhotosMutation.mutateAsync(eventId);
      refetch();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  // Re-index all photos for this event using the improved AI engine
  const handleReindexPhotos = async () => {
    if (!confirm('Would you like to re-scan all photos in this gallery with the upgraded AI face recognition? This process runs in the background.')) return;
    try {
      await reindexPhotosMutation.mutateAsync(eventId);
      alert('AI Face Re-indexing started! Photos will be scanned with the improved face engine in the background.');
      refetch();
    } catch (err) {
      console.error('Re-indexing failed:', err);
      alert('Failed to start re-indexing. Please try again.');
    }
  };

  if (isLoading || !eventData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  const { event } = eventData;
  const photos = event.photos || [];
  const eventUrl = `http://localhost:5173/e/${event.slug}`;

  // Slideshow helpers
  const nextSlide = () => {
    if (photos.length === 0) return;
    setSlideshowIndex((prev) => (prev + 1) % photos.length);
  };

  return (
    <div className="space-y-8">
      {/* Back button and title */}
      <div className="flex justify-between items-center border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded-full hover:bg-secondary border border-border transition-colors shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <span className="text-xs text-muted-foreground uppercase font-medium tracking-widest block" style={{ fontFamily: "'DM Mono', monospace" }}>
              Managing Event
            </span>
            <h2 className="text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {event.eventName}
            </h2>
          </div>
        </div>

        {/* Lock status actions */}
        <button
          onClick={() => handleToggleLock(event.isLocked)}
          disabled={toggleLockMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border shadow-sm ${
            event.isLocked
              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          }`}
        >
          {event.isLocked ? (
            <>
              <Lock size={12} /> Gallery: Locked
            </>
          ) : (
            <>
              <Unlock size={12} /> Gallery: Active
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column: Event Settings, Cover image, QR */}
        <div className="lg:w-1/3 space-y-6">
          {/* Custom Branding Cover Selector */}
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm overflow-hidden relative">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Cover Design
            </h3>
            <div className="h-44 bg-secondary/50 border rounded-lg relative overflow-hidden flex items-center justify-center mb-4">
              {event.coverImageUrl ? (
                <img
                  src={getPhotoUrl(event.coverImageUrl)}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground/40 flex flex-col items-center gap-1.5">
                  <ImageIcon size={28} />
                  <span className="text-[10px] uppercase font-semibold tracking-wider">No Cover Image</span>
                </div>
              )}
              {/* upload overlay */}
              <label className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 cursor-pointer text-white text-xs font-medium">
                <Upload size={16} />
                <span>Upload Cover Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              This photo will be displayed as the main background banner on the guest selfie matching page.
            </p>
          </div>

          {/* Printable QR CodeTent Display */}
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              QR Event Flyer
            </h3>
            {event.qrCodeData && (
              <div className="flex flex-col items-center gap-4 bg-secondary/20 p-4 rounded-lg border border-border/50">
                <img src={event.qrCodeData} alt="QR Code" className="w-44 h-44 bg-white p-2 rounded-md shadow-sm border border-border" />
                <p className="text-xs text-muted-foreground text-center">
                  Display this QR flyer at key venue spots like tables, entry bars, or photo-booths.
                </p>
                <a
                  href={event.qrCodeData}
                  download={`qr-flyer-${event.slug}.png`}
                  className="flex items-center gap-1.5 w-full justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 transition-all font-medium"
                >
                  <Download size={12} />
                  Download Flyer Asset
                </a>
              </div>
            )}
          </div>

          {/* Direct Link Share options */}
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Guest Sharing Link
              </h3>
              <div className="flex items-center gap-2 bg-secondary/50 p-2.5 rounded-lg border border-border/50 text-xs">
                <span className="flex-1 truncate select-all" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {eventUrl}
                </span>
                <button
                  onClick={() => handleCopyUrl(eventUrl)}
                  className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1 rounded hover:opacity-90 transition-opacity text-[10px] font-medium"
                >
                  {copied ? <Check size={8} /> : <Copy size={8} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-accent hover:underline font-medium"
            >
              Open Guest Portal <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Right column: Gallery list and uploads */}
        <div className="lg:w-2/3 space-y-6">
          {/* Uploader Box */}
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
                Add Official Wedding Photos
              </h3>
              <span className="text-xs text-muted-foreground font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>
                {photos.length} / {event.maxPhotosAllowed} Shared
              </span>
            </div>
            <label className="border-2 border-dashed border-border hover:border-accent/40 rounded-xl p-8 text-center cursor-pointer block hover:bg-secondary/10 transition-all">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploadPhotosMutation.isPending}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2.5">
                {uploadPhotosMutation.isPending ? (
                  <Loader2 size={28} className="animate-spin text-accent" />
                ) : (
                  <Upload size={28} className="text-accent" />
                )}
                <span className="text-sm font-semibold">Bulk Upload Client Photos</span>
                <span className="text-xs text-muted-foreground">JPEG, PNG, WEBP files up to 25MB per image. Max 50 per batch.</span>
              </div>
            </label>
            {uploadingFiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center animate-pulse font-medium">
                Uploading & running local AI face indexing on {uploadingFiles.length} photo(s)...
              </p>
            )}
          </div>

          {/* Photo moderation grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>
                Gallery Moderation
              </h3>
              {photos.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteAllPhotos}
                    disabled={deleteAllPhotosMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs hover:bg-destructive hover:text-destructive-foreground transition-all font-medium"
                  >
                    <Trash2 size={12} />
                    {deleteAllPhotosMutation.isPending ? 'Deleting...' : 'Delete All'}
                  </button>
                  <button
                    onClick={handleReindexPhotos}
                    disabled={reindexPhotosMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs hover:bg-primary hover:text-primary-foreground transition-all font-medium"
                  >
                    <RefreshCw size={12} className={reindexPhotosMutation.isPending ? "animate-spin" : ""} />
                    {reindexPhotosMutation.isPending ? 'Re-scanning...' : 'Re-index Faces'}
                  </button>
                  <button
                    onClick={() => setIsSlideshow(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-xs hover:opacity-90 transition-all shadow-sm font-medium"
                  >
                    <Play size={12} />
                    Live Slideshow Mode
                  </button>
                </div>
              )}
            </div>

            {photos.length === 0 ? (
              <div className="bg-white border border-border rounded-xl p-12 text-center shadow-sm">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <ImageIcon size={20} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  There are no wedding photos in this gallery yet. Drag or click the upload panel above to start.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square bg-muted rounded-xl overflow-hidden group border border-border/50">
                    <img
                      src={getPhotoUrl(photo.url)}
                      alt={photo.fileName || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-2 bg-destructive text-destructive-foreground rounded-full hover:scale-105 transition-all shadow-md"
                        title="Delete photo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Live Slideshow view */}
      {isSlideshow && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
          onClick={nextSlide}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsSlideshow(false); }}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50"
          >
            <X size={24} />
          </button>

          <img
            src={getPhotoUrl(photos[slideshowIndex].url)}
            alt="Slideshow View"
            className="max-h-screen max-w-full object-contain select-none transition-all duration-700 ease-in-out"
          />

          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center text-white/50 text-sm">
            <span style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg text-white font-medium">
              {event.eventName}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace" }}>
              {slideshowIndex + 1} / {photos.length} (Click screen for next)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
