import { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useEventBySlug, useFaceSearch } from '../lib/queries';
import { Camera, Download, X, ChevronLeft, ChevronRight, Scan, Loader2, Search, Sliders, Film, Lock, Music, Play, CheckCircle } from 'lucide-react';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_BASE = isLocalhost ? 'http://localhost:3001' : 'https://qr-photo-scan-backend.onrender.com';

const getPhotoUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_BASE}${url}`;
};

// Helper to force-download a photo via the server's download endpoint
const downloadPhoto = async (photoUrl: string, fileName?: string) => {
  try {
    const filename = photoUrl.split('/').pop() || 'photo.jpg';
    const res = await fetch(`${BACKEND_BASE}/api/photos/download/${filename}`);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName || filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

export default function GuestPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: eventData, isLoading: eventLoading, error: eventError } = useEventBySlug(slug || '');
  const [showCamera, setShowCamera] = useState(false);
  const [matchedPhotos, setMatchedPhotos] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  
  // Real-time slider matching sensitivity (defaults to 0.72 for balanced results)
  const [sensitivity, setSensitivity] = useState(0.72);

  // Photo Selection Mode for Reel Generation
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [showReelModal, setShowReelModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);

  // Reel Configuration State
  const [reelDuration, setReelDuration] = useState<15 | 30>(15);
  const [reelTransition, setReelTransition] = useState<'fade' | 'slide' | 'zoom'>('fade');
  const [reelFilter, setReelFilter] = useState<'vintage' | 'golden' | 'sparkles' | 'none'>('golden');
  const [reelMusic, setReelMusic] = useState<string>('acoustic');
  const [reelAspectRatio, setReelAspectRatio] = useState<'portrait' | 'landscape'>('portrait');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceSearch = useFaceSearch();

  // Hidden canvas for video compiler rendering
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { console.error('Camera error:', err); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  const captureSelfie = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !eventData) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      stopCamera();
      try {
        const result = await faceSearch.mutateAsync({ eventId: eventData.id, selfie: file });
        setMatchedPhotos(result.matchedPhotos);
        setHasSearched(true);
        setIsSelectMode(false);
        setSelectedPhotoIds([]);
      } catch (err) { console.error('Face search error:', err); }
    }, 'image/jpeg', 0.9);
  }, [eventData, faceSearch]);

  // Client-side filtering based on distance threshold
  const displayedPhotos = matchedPhotos.filter(
    (photo) => (photo.matchDistance ?? 0) <= sensitivity
  );

  const nav = (dir: 1 | -1) => {
    if (lightbox === null) return;
    setLightbox((lightbox + dir + displayedPhotos.length) % displayedPhotos.length);
  };

  // Toggle selection of a photo for highlight reel
  const handleToggleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId) 
        : prev.length >= 8 
          ? prev // limit to 8 photos max for mobile performance
          : [...prev, photoId]
    );
  };

  // Check PRO status or trigger lock upsell modal
  const handleTriggerReelMode = () => {
    if (!eventData) return;
    if (eventData.subscriptionTier !== 'PRO') {
      setShowUpsellModal(true);
    } else {
      setIsSelectMode(true);
      setSelectedPhotoIds([]);
    }
  };

  // Easing functions
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
  const easeInQuad = (t: number): number => t * t;

  // Ken Burns pan directions per image (deterministic based on index)
  const panDirections = [
    { sx: -0.05, sy: -0.03, ex: 0.05, ey: 0.03 },   // top-left → bottom-right
    { sx: 0.05, sy: -0.03, ex: -0.05, ey: 0.03 },    // top-right → bottom-left
    { sx: 0, sy: -0.05, ex: 0, ey: 0.05 },            // top → bottom
    { sx: -0.06, sy: 0, ex: 0.06, ey: 0 },            // left → right
    { sx: 0.04, sy: 0.04, ex: -0.04, ey: -0.04 },     // bottom-right → top-left
    { sx: 0, sy: 0.05, ex: 0, ey: -0.05 },            // bottom → top
  ];

  // Cinema-grade Highlight Reel Exporter
  const handleExportReel = async () => {
    if (selectedPhotoIds.length < 3) {
      alert('Please select at least 3 photos to generate your reel!');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    const canvas = hiddenCanvasRef.current;
    if (!canvas) { setIsGenerating(false); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsGenerating(false); return; }

    // Canvas dimensions
    if (reelAspectRatio === 'portrait') {
      canvas.width = 720;
      canvas.height = 1280;
    } else {
      canvas.width = 1280;
      canvas.height = 720;
    }
    const W = canvas.width;
    const H = canvas.height;

    // Load images
    const photosToRender = displayedPhotos.filter(p => selectedPhotoIds.includes(p.id));
    const loadedImages: HTMLImageElement[] = [];
    for (const photo of photosToRender) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.src = getPhotoUrl(photo.url);
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('load fail'));
        });
        loadedImages.push(img);
      } catch { /* skip broken images */ }
    }

    if (loadedImages.length === 0) {
      alert('Error loading photos. Please try again.');
      setIsGenerating(false);
      return;
    }

    // Audio setup
    let audioElement: HTMLAudioElement | null = null;
    let audioContext: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    const audioUrls: Record<string, string> = {
      acoustic: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      pop: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      ambient: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
    };

    try {
      audioContext = new AudioContext();
      audioElement = new Audio(audioUrls[reelMusic]);
      audioElement.crossOrigin = 'anonymous';
      const src = audioContext.createMediaElementSource(audioElement);
      audioDest = audioContext.createMediaStreamDestination();
      src.connect(audioDest);
      src.connect(audioContext.destination);
    } catch { /* audio optional */ }

    // ─── STRICT FRAME-COUNTED TIMING ───
    const FPS = 30;
    const TOTAL_FRAMES = reelDuration * FPS; // 15s=450 frames, 30s=900 frames EXACTLY
    const FRAME_INTERVAL = 1000 / FPS;       // 33.333ms per frame
    const INTRO_FRAMES = Math.round(FPS * 0.8);  // 0.8s fade-in from black
    const OUTRO_FRAMES = Math.round(FPS * 1.0);  // 1.0s fade-out to black
    const FRAMES_PER_IMAGE = TOTAL_FRAMES / loadedImages.length;
    const TRANSITION_FRAMES = Math.round(FRAMES_PER_IMAGE * 0.25); // 25% crossfade zone
    let currentFrame = 0;

    // Recorder setup
    const videoStream = canvas.captureStream(FPS);
    const tracks = [...videoStream.getVideoTracks()];
    if (audioDest) tracks.push(...audioDest.stream.getAudioTracks());

    const recorder = new MediaRecorder(new MediaStream(tracks), {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm',
      videoBitsPerSecond: 6000000
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${eventData?.eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-highlight-reel.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (audioElement) { audioElement.pause(); }
      if (audioContext) { audioContext.close(); }
      setIsGenerating(false);
      setShowReelModal(false);
      setIsSelectMode(false);
      setSelectedPhotoIds([]);
    };

    // Helper: draw image with Ken Burns pan + zoom
    const drawImageKenBurns = (image: HTMLImageElement, progress: number, dirIdx: number) => {
      const imgRatio = image.width / image.height;
      const canvasRatio = W / H;
      let baseW: number, baseH: number;

      // Cover-fit: image always fills canvas
      if (imgRatio > canvasRatio) {
        baseH = H;
        baseW = H * imgRatio;
      } else {
        baseW = W;
        baseH = W / imgRatio;
      }

      // Ken Burns: gentle zoom from 1.0→1.18 with directional pan
      const smoothT = easeInOutCubic(progress);
      const scale = 1.0 + smoothT * 0.18;
      const dir = panDirections[dirIdx % panDirections.length];
      const panX = (dir.sx + (dir.ex - dir.sx) * smoothT) * W;
      const panY = (dir.sy + (dir.ey - dir.sy) * smoothT) * H;

      const drawW = baseW * scale;
      const drawH = baseH * scale;
      const x = (W - drawW) / 2 + panX;
      const y = (H - drawH) / 2 + panY;

      ctx.drawImage(image, x, y, drawW, drawH);
    };

    // Helper: cinematic vignette overlay
    const drawVignette = () => {
      const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.9);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    };

    // Helper: event name text overlay
    const drawTextOverlay = (alpha: number) => {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;

      // Bottom gradient bar
      const grad = ctx.createLinearGradient(0, H * 0.82, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.82, W, H * 0.18);

      // Event name
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(W * 0.035)}px 'Playfair Display', Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(eventData?.eventName || '', W / 2, H * 0.92);

      // Date subtitle
      if (eventData?.eventDate) {
        ctx.font = `300 ${Math.round(W * 0.018)}px 'Lato', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(
          new Date(eventData.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          W / 2, H * 0.955
        );
      }
      ctx.restore();
    };

    // ─── RENDER SINGLE FRAME ───
    const renderFrame = () => {
      const globalProgress = currentFrame / TOTAL_FRAMES; // 0.0 → 1.0

      // Which image are we on?
      const imgIdx = Math.min(Math.floor(currentFrame / FRAMES_PER_IMAGE), loadedImages.length - 1);
      const nextIdx = Math.min(imgIdx + 1, loadedImages.length - 1);
      const frameInImage = currentFrame - imgIdx * FRAMES_PER_IMAGE;
      const imageProgress = frameInImage / FRAMES_PER_IMAGE; // 0→1 within this image

      // Black background
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(0, 0, W, H);

      // Determine if we're in transition zone (last 25% of each image, except last image)
      const inTransition = imgIdx < loadedImages.length - 1 && frameInImage > (FRAMES_PER_IMAGE - TRANSITION_FRAMES);
      const transitionProgress = inTransition
        ? (frameInImage - (FRAMES_PER_IMAGE - TRANSITION_FRAMES)) / TRANSITION_FRAMES
        : 0;
      const easedTransition = easeInOutCubic(transitionProgress);

      ctx.save();

      if (inTransition && reelTransition === 'fade') {
        // ── CROSSFADE ──
        ctx.globalAlpha = 1 - easedTransition;
        drawImageKenBurns(loadedImages[imgIdx], imageProgress, imgIdx);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = easedTransition;
        drawImageKenBurns(loadedImages[nextIdx], transitionProgress * 0.25, nextIdx);

      } else if (inTransition && reelTransition === 'slide') {
        // ── SLIDE ──
        const offset = -W * easedTransition;
        ctx.translate(offset, 0);
        drawImageKenBurns(loadedImages[imgIdx], imageProgress, imgIdx);
        ctx.restore();
        ctx.save();
        ctx.translate(offset + W, 0);
        drawImageKenBurns(loadedImages[nextIdx], transitionProgress * 0.25, nextIdx);

      } else if (inTransition && reelTransition === 'zoom') {
        // ── ZOOM BURST ──
        const zoomScale = 1 + easedTransition * 0.4;
        ctx.globalAlpha = 1 - easedTransition;
        ctx.translate(W / 2, H / 2);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-W / 2, -H / 2);
        drawImageKenBurns(loadedImages[imgIdx], imageProgress, imgIdx);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = easedTransition;
        drawImageKenBurns(loadedImages[nextIdx], transitionProgress * 0.25, nextIdx);

      } else {
        // ── STANDARD DISPLAY ──
        drawImageKenBurns(loadedImages[imgIdx], imageProgress, imgIdx);
      }

      ctx.restore();

      // ── FILTER OVERLAYS ──
      if (reelFilter === 'vintage') {
        // Warm sepia tint
        ctx.fillStyle = 'rgba(180, 130, 60, 0.12)';
        ctx.fillRect(0, 0, W, H);
        // Subtle grain noise
        ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`;
        ctx.fillRect(0, 0, W, H);
        // Occasional film scratch
        if (currentFrame % 12 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          const sx = Math.random() * W;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx + (Math.random() - 0.5) * 20, H);
          ctx.stroke();
        }
      } else if (reelFilter === 'golden') {
        // Warm golden bloom
        ctx.fillStyle = 'rgba(255, 160, 40, 0.06)';
        ctx.fillRect(0, 0, W, H);
      } else if (reelFilter === 'sparkles') {
        // Floating bokeh circles (deterministic position from frame index)
        for (let i = 0; i < 25; i++) {
          const seed = i * 137.508; // golden angle offset
          const x = ((seed + currentFrame * (0.3 + i * 0.05)) % W);
          const y = H - ((currentFrame * (0.8 + i * 0.12) + seed) % (H + 40));
          const radius = 3 + (i % 5) * 2;
          const alpha = 0.15 + (Math.sin(currentFrame * 0.05 + i) * 0.5 + 0.5) * 0.25;
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Always draw cinematic vignette
      drawVignette();

      // Text overlay (visible during middle portion of each image)
      const textFadeIn = Math.min(1, imageProgress * 4);     // fade in over first 25%
      const textFadeOut = Math.min(1, (1 - imageProgress) * 4); // fade out over last 25%
      drawTextOverlay(Math.min(textFadeIn, textFadeOut) * 0.8);

      // ── INTRO: Fade from black ──
      if (currentFrame < INTRO_FRAMES) {
        const introAlpha = 1 - easeOutQuad(currentFrame / INTRO_FRAMES);
        ctx.fillStyle = `rgba(10,8,6,${introAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      // ── OUTRO: Fade to black ──
      const outroStart = TOTAL_FRAMES - OUTRO_FRAMES;
      if (currentFrame > outroStart) {
        const outroAlpha = easeInQuad((currentFrame - outroStart) / OUTRO_FRAMES);
        ctx.fillStyle = `rgba(10,8,6,${outroAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Progress update
      setGenerationProgress(Math.round((currentFrame / TOTAL_FRAMES) * 100));
    };

    // ─── START RECORDING ───
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.play().catch(() => {});
    }
    recorder.start();

    // Draw first frame immediately
    renderFrame();
    currentFrame++;

    // Strict setInterval clock: fires every 33.33ms, exactly TOTAL_FRAMES times
    const intervalId = setInterval(() => {
      if (currentFrame >= TOTAL_FRAMES) {
        clearInterval(intervalId);
        // Small delay to let the last frame flush into the recorder
        setTimeout(() => { recorder.stop(); }, 100);
        return;
      }
      renderFrame();
      currentFrame++;
    }, FRAME_INTERVAL);
  };

  if (eventLoading) return <div className="min-h-screen pt-24 flex items-center justify-center bg-[#fafafa]"><Loader2 size={32} className="animate-spin text-accent" /></div>;
  if (eventError || !eventData) return (
    <div className="min-h-screen pt-24 flex items-center justify-center px-6"><div className="text-center">
      <h1 className="text-3xl font-medium mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Event Not Found</h1>
      <p className="text-muted-foreground">This event link may be invalid or expired.</p>
    </div></div>
  );

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 bg-[#fafafa] text-foreground">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-accent text-xs tracking-[0.2em] uppercase mb-3" style={{ fontFamily: "'DM Mono', monospace" }}>
            {eventData.eventDate ? new Date(eventData.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Event Gallery'}
          </p>
          <h1 className="text-4xl md:text-5xl font-medium mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{eventData.eventName}</h1>
          <p className="text-muted-foreground">{eventData.photoCount} photos available · Scan your face to find yours</p>
        </div>

        {eventData.pendingPhotos > 0 && (
          <div className="mb-8 p-4 bg-accent/5 border border-accent/15 rounded-2xl flex items-start gap-3 text-left">
            <Loader2 size={16} className="animate-spin text-accent mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-accent mb-0.5">AI Scan in Progress</p>
              <p className="text-muted-foreground">
                Our AI is currently indexing {eventData.pendingPhotos} newly uploaded photo(s). If you don't find your photos, some results might still be loading. Please check back or try searching again shortly.
              </p>
            </div>
          </div>
        )}

        {!hasSearched && !showCamera && (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center shadow-sm"><Scan size={40} className="text-accent" /></div>
            <div className="text-center">
              <h2 className="text-2xl font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Find Your Photos</h2>
              <p className="text-muted-foreground max-w-sm">Take a quick selfie and our AI will instantly find all the professional photos you appear in.</p>
            </div>
            <button onClick={startCamera} className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg">
              <Camera size={18} /> Take a Selfie to Find My Photos
            </button>
          </div>
        )}

        {showCamera && (
          <div className="relative rounded-2xl overflow-hidden bg-black mb-8 shadow-md">
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
              <button onClick={captureSelfie} className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform">
                <div className="w-12 h-12 rounded-full border-4 border-accent" />
              </button>
              <button onClick={stopCamera} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30 transition-colors"><X size={20} /></button>
            </div>
          </div>
        )}

        {faceSearch.isPending && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="text-muted-foreground">Searching for your face in {eventData.photoCount} photos...</p>
          </div>
        )}

        {hasSearched && !faceSearch.isPending && (
          <div>
            {/* Header controls block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 bg-white border border-border p-6 rounded-2xl shadow-sm gap-4">
              <div>
                <h2 className="text-2xl font-medium" style={{ fontFamily: "'Playfair Display', serif" }}>Your Photos</h2>
                <p className="text-muted-foreground text-xs">{displayedPhotos.length} photos found</p>
              </div>

              {/* Sensitivity slider */}
              <div className="flex items-center gap-3 bg-[#fafafa] px-4 py-2.5 rounded-xl border border-border/50 max-w-sm w-full">
                <Sliders size={14} className="text-muted-foreground" />
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 select-none">Strict</span>
                <input 
                  type="range" 
                  min="0.40" 
                  max="0.85" 
                  step="0.01" 
                  value={sensitivity} 
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))} 
                  className="flex-1 accent-accent cursor-pointer h-1 rounded bg-border focus:outline-none"
                />
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 select-none">Relaxed</span>
                <div className="bg-white border border-border px-1.5 py-0.5 rounded text-[10px] font-semibold text-accent" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {((0.85 - sensitivity) * 222).toFixed(0)}%
                </div>
              </div>

              {/* Exporter triggers */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTriggerReelMode}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm border transition-all ${
                    isSelectMode
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'bg-white text-foreground border-border hover:bg-secondary'
                  }`}
                >
                  <Film size={14} />
                  {isSelectMode ? 'Selecting Photos' : 'Make Highlight Reel'}
                  {eventData.subscriptionTier !== 'PRO' && <Lock size={10} className="text-muted-foreground/60 ml-0.5" />}
                </button>

                <button 
                  onClick={() => { setHasSearched(false); setMatchedPhotos([]); setIsSelectMode(false); setSelectedPhotoIds([]); }} 
                  className="flex items-center gap-1.5 text-xs text-accent hover:underline font-semibold"
                >
                  <Search size={12} /> Search Again
                </button>
              </div>
            </div>

            {/* Instruction bar for select mode */}
            {isSelectMode && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6 flex justify-between items-center text-xs animate-fade-in">
                <p className="font-medium text-accent">
                  Select 3 to 8 photos of yourself to compile into your custom wedding Highlight Reel video!
                </p>
                <div className="flex items-center gap-3 font-semibold">
                  <span>{selectedPhotoIds.length} / 8 Selected</span>
                  <button 
                    onClick={() => { setIsSelectMode(false); setSelectedPhotoIds([]); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {displayedPhotos.length > 0 ? (
              <div className="columns-2 md:columns-3 gap-3 space-y-3">
                {displayedPhotos.map((photo: any, idx: number) => {
                  const isSelected = selectedPhotoIds.includes(photo.id);
                  return (
                    <div 
                      key={photo.id} 
                      className={`break-inside-avoid rounded-lg overflow-hidden bg-muted group relative cursor-pointer shadow-sm hover:shadow-md transition-all ${
                        isSelectMode && isSelected ? 'ring-2 ring-accent scale-[0.98]' : ''
                      }`} 
                      onClick={() => isSelectMode ? handleToggleSelectPhoto(photo.id) : setLightbox(idx)}
                    >
                      <img src={getPhotoUrl(photo.url)} alt="Event photo" className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-500" />
                      
                      {/* select mode check circle overlay */}
                      {isSelectMode && (
                        <div className="absolute top-2.5 right-2.5 z-10">
                          {isSelected ? (
                            <CheckCircle size={20} className="text-accent fill-white" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-white/80 bg-black/40 backdrop-blur-sm" />
                          )}
                        </div>
                      )}

                      {!isSelectMode && (
                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <button onClick={(e) => { e.stopPropagation(); downloadPhoto(photo.url, photo.fileName || undefined); }} className="flex items-center gap-1 text-white text-xs bg-white/20 backdrop-blur px-2.5 py-1.5 rounded-full hover:bg-white/30 transition-colors"><Download size={12} /> Save</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white border border-border rounded-xl shadow-sm">
                <p className="text-muted-foreground text-sm">No matching photos found at this sensitivity level.</p>
                <button 
                  onClick={() => setSensitivity(0.65)} 
                  className="mt-2 text-xs text-accent hover:underline font-medium"
                >
                  Try increasing matching sensitivity
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Actions Bar (Select Mode only) */}
      {isSelectMode && selectedPhotoIds.length >= 3 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white/95 border border-border shadow-2xl px-6 py-3.5 rounded-2xl flex items-center gap-6 animate-slide-up backdrop-blur-md">
          <div className="text-xs">
            <span className="font-semibold text-foreground">{selectedPhotoIds.length} Photos selected</span>
          </div>
          <button
            onClick={() => setShowReelModal(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <Film size={12} /> Make Highlight Reel
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightbox !== null && displayedPhotos[lightbox] && (
        <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={() => setLightbox(null)}><X size={20} /></button>
          <button className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={(e) => { e.stopPropagation(); nav(-1); }}><ChevronLeft size={22} /></button>
          <button className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" onClick={(e) => { e.stopPropagation(); nav(1); }}><ChevronRight size={22} /></button>
          <div className="max-w-4xl max-h-[85vh] mx-12 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img src={getPhotoUrl(displayedPhotos[lightbox].url)} alt="Photo" className="max-h-[70vh] max-w-full object-contain rounded-lg" />
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 hover:border-white/40 transition-colors text-sm text-white" onClick={(e) => { e.stopPropagation(); downloadPhoto(displayedPhotos[lightbox].url, displayedPhotos[lightbox].fileName || undefined); }}><Download size={14} /> Download</button>
            <p className="text-white/30 text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>{lightbox + 1} / {displayedPhotos.length}</p>
          </div>
        </div>
      )}

      {/* SaaS Lock Upsell Modal */}
      {showUpsellModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-8 shadow-2xl relative text-center">
            <button onClick={() => setShowUpsellModal(false)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6"><Lock size={28} className="text-accent" /></div>
            <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Reels Feature Locked</h3>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Compile your wedding selfies into a 15-second or 30-second Highlight Reel with professional transitions, overlays, and wedding music tracks.
            </p>
            <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 text-xs text-muted-foreground mb-6 leading-relaxed">
              🚨 <strong>Exclusive Pro Gallery Feature</strong>: Ask your wedding photographer to upgrade this gallery package to unlock Highlight Reels for all guests!
            </div>
            <button onClick={() => setShowUpsellModal(false)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">Got It</button>
          </div>
        </div>
      )}

      {/* Reel Builder Customization Modal */}
      {showReelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-5 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button onClick={() => !isGenerating && setShowReelModal(false)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"><X size={18} /></button>
            
            <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>Customize Highlight Reel</h3>
            <p className="text-muted-foreground text-xs mb-6">Select your style options before compiling your high-definition video.</p>

            {isGenerating ? (
              <div className="space-y-6 py-6 text-center animate-pulse">
                <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Compiling HD Frames...</p>
                  <p className="text-xs text-muted-foreground">Rendering transitions, backing music, and filters. Do not close this window.</p>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden border border-border">
                  <div className="bg-accent h-full transition-all duration-300" style={{ width: `${generationProgress}%` }} />
                </div>
                <span className="text-xs font-semibold text-accent" style={{ fontFamily: "'DM Mono', monospace" }}>{generationProgress}% Complete</span>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Aspect Ratio */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">Orientation / Aspect Ratio</label>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { id: 'portrait', name: 'Portrait (9:16)', desc: 'For Instagram/TikTok' },
                      { id: 'landscape', name: 'Landscape (16:9)', desc: 'For TV/Widescreen' }
                    ].map(aspect => (
                      <button 
                        key={aspect.id} 
                        onClick={() => setReelAspectRatio(aspect.id as 'portrait' | 'landscape')} 
                        className={`p-3 rounded-lg border text-left flex flex-col gap-0.5 font-semibold ${
                          reelAspectRatio === aspect.id ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-white text-muted-foreground'
                        }`}
                      >
                        <span>{aspect.name}</span>
                        <span className="text-[9px] font-normal text-muted-foreground">{aspect.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">Video Duration</label>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[15, 30].map(d => (
                      <button key={d} onClick={() => setReelDuration(d as 15 | 30)} className={`py-2.5 rounded-lg border font-semibold ${reelDuration === d ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-white text-muted-foreground'}`}>{d} Seconds</button>
                    ))}
                  </div>
                </div>

                {/* Transition */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">Transition Style</label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {['fade', 'slide', 'zoom'].map(t => (
                      <button key={t} onClick={() => setReelTransition(t as any)} className={`py-2 rounded-lg border font-semibold capitalize ${reelTransition === t ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-white text-muted-foreground'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                {/* Filter */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">Filter Overlay</label>
                  <div className="grid grid-cols-4 gap-2 text-[10px] tracking-wide">
                    {['none', 'vintage', 'golden', 'sparkles'].map(f => (
                      <button key={f} onClick={() => setReelFilter(f as any)} className={`py-2 rounded-lg border font-semibold capitalize ${reelFilter === f ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-white text-muted-foreground'}`}>{f}</button>
                    ))}
                  </div>
                </div>

                {/* Backing Music */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">Backing Soundtrack</label>
                  <div className="space-y-2 text-xs">
                    {[
                      { id: 'acoustic', name: 'Acoustic Folk Romance', desc: 'Warm guitars & light rhythm' },
                      { id: 'pop', name: 'Pop Beats Ceremony', desc: 'Upbeat electronic wedding pop' },
                      { id: 'ambient', name: 'Ambient Love Horizon', desc: 'Slow synth strings & dreamy pad' }
                    ].map(track => (
                      <label key={track.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-secondary/20 transition-colors ${reelMusic === track.id ? 'border-accent bg-accent/5' : 'border-border bg-white'}`}>
                        <input type="radio" name="music" checked={reelMusic === track.id} onChange={() => setReelMusic(track.id)} className="accent-accent" />
                        <div className="flex-1">
                          <p className="font-semibold text-xs flex items-center gap-1.5"><Music size={12} className="text-accent" /> {track.name}</p>
                          <p className="text-[10px] text-muted-foreground">{track.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleExportReel}
                  className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Film size={14} /> Export HD Reel (WebM format)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Canvas for video compilation */}
      <canvas ref={hiddenCanvasRef} className="hidden" />
    </div>
  );
}
