
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Plus, 
  Layers, 
  Download, 
  Trash2, 
  Play, 
  Upload, 
  Clock, 
  Sparkles, 
  Mic, 
  X, 
  Loader2, 
  RefreshCw, 
  Copy, 
  Volume2, 
  Video, 
  Music, 
  FileText, 
  ToggleLeft, 
  ToggleRight, 
  Table, 
  Terminal, 
  RotateCcw, 
  Edit3, 
  Ear, 
  Calendar, 
  BarChart3, 
  SlidersHorizontal, 
  Users, 
  MessageSquare, 
  Sparkle, 
  Settings2, 
  FileAudio, 
  History as HistoryIcon, 
  BookOpen, 
  Fingerprint, 
  Database, 
  TriangleAlert, 
  Beaker, 
  Bug, 
  XCircle, 
  ShieldCheck, 
  ShieldAlert, 
  Gauge, 
  AlarmClock, 
  Activity as ActivityIcon, 
  CheckCircle2 as SuccessIcon, 
  Monitor, 
  BrainCircuit, 
  Settings2 as ConfigIcon, 
  ArrowRight, 
  ZapOff, 
  Maximize, 
  Minimize, 
  UserCircle2, 
  ListChecks, 
  AlertOctagon, 
  Smartphone, 
  Tablet as TabletIcon, 
  Monitor as MonitorIcon, 
  Wand,
  Eye,
  EyeOff,
  FileUp,
  GripVertical,
  Info,
  Search,
  Save,
  Bookmark,
  ChevronDown
} from 'lucide-react';
import { 
  Language, 
  TaskStatus, 
  UploadStatus,
  TTSTask, 
  Voice, 
  VoiceSettings, 
  HistoryItem,
  VoiceEffect,
  NamingConvention,
  ScheduledJob,
  AnalyticsData,
  CharacterVoice,
  DialogueSegment,
  UserSubscription,
  VoicePreset
} from './types';
import { fetchVoices, generateTTS, cloneVoice, deleteVoice, fetchSubscription } from './services/elevenLabsService';
import { detectLanguageAndOptimize, OptimizationResult } from './services/geminiService';
import { uploadToGoogleDrive, uploadToYouTube } from './services/cloudService';
import { processAudioBuffer, generateSRT, applyVoiceEffect, stitchAudioBuffers, bufferToWavBlob } from './services/audioProcessingService';

const STORAGE_KEY_API = "elevenlabs_api_key";
const STORAGE_KEY_HISTORY = "tts_history_logs";
const STORAGE_KEY_SCHEDULE = "tts_scheduled_jobs";
const STORAGE_KEY_ANALYTICS = "vocalize_analytics";
const STORAGE_KEY_PRESETS = "vocalize_presets";

const NEURAL_MODELS = [
  { id: 'eleven_multilingual_v3', name: 'Eleven v3 (Ultra-HD)' },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (Legacy Core)' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Fast & Natural)' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 (Lowest Latency)' }
];

const DEFAULT_MUSIC_LIBRARY = [
  { id: 'track-1', name: 'Ambient Focus', mood: 'Calm/Ambient', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'track-2', name: 'Lofi Chill', mood: 'Relaxing', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'track-3', name: 'Corporate Bright', mood: 'Corporate/Clean', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'track-4', name: 'Midnight Shadows', mood: 'Dramatic/Suspenseful', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'track-5', name: 'Sunrise Epic', mood: 'Inspirational', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' }
];

const INITIAL_ANALYTICS: AnalyticsData = {
  totalGenerated: 0,
  totalWords: 0,
  totalCharacters: 0,
  totalSuccess: 0,
  totalFailed: 0,
  totalProcessingTimeMs: 0,
  lastResetAt: Date.now()
};

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-none">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 px-1 flex items-center justify-between group"
      >
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
          {icon}
          {title}
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
};

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem(STORAGE_KEY_API) || "");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [manualText, setManualText] = useState("");
  const [tasks, setTasks] = useState<TTSTask[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [presets, setPresets] = useState<VoicePreset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PRESETS);
    return saved ? JSON.parse(saved) : [];
  });
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SCHEDULE);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<'input' | 'queue' | 'history' | 'analytics' | 'settings' | 'scheduler'>('input');
  const [inputMode, setInputMode] = useState<'simple' | 'story'>('simple');
  const [simpleInputSubMode, setSimpleInputSubMode] = useState<'manual' | 'batch'>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showApiModal, setShowApiModal] = useState(!localStorage.getItem(STORAGE_KEY_API));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  const [showPreviewSnippet, setShowPreviewSnippet] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.AUTO);
  const [dragActive, setDragActive] = useState(false);

  const [storyStep, setStoryStep] = useState<'cast' | 'script' | 'preview'>('cast');

  const [showCloningModal, setShowCloningModal] = useState(false);
  const [cloningTab, setCloningTab] = useState<'create' | 'manage'>('create');
  const [cloningSamples, setCloningSamples] = useState<File[]>([]);
  const [cloningName, setCloningName] = useState("");
  const [cloningProgress, setCloningProgress] = useState(0);
  const [isCloning, setIsCloning] = useState(false);
  const [cloningStatus, setCloningStatus] = useState("");
  const [cloningError, setCloningError] = useState<string | null>(null);
  const [cloningETA, setCloningETA] = useState<number>(0);
  
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [storyCharacters, setStoryCharacters] = useState<CharacterVoice[]>([]);
  const [storyScript, setStoryScript] = useState("");

  const [analytics, setAnalytics] = useState<AnalyticsData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ANALYTICS);
    return saved ? JSON.parse(saved) : INITIAL_ANALYTICS;
  });

  const [aiRecommendation, setAiRecommendation] = useState<OptimizationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [selectedDestinations, setSelectedDestinations] = useState({ local: true, googleDrive: false, youtube: false });
  const [namingConvention, setNamingConvention] = useState<NamingConvention>(NamingConvention.TIMESTAMP);
  const [customPrefix, setCustomPrefix] = useState("Vocalize_");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [globalSettings, setGlobalSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: true,
    normalize: true,
    trimSilence: true,
    maxClipDuration: 60,
    speed: 1.0,
    pitch: 1.0,
    model_id: 'eleven_multilingual_v2',
    extraFeatures: {
      generateSubtitles: false,
      generateVideo: false,
      voiceEffect: VoiceEffect.NONE,
      backgroundMusic: false,
      aiComposerMode: false,
      bgMusicVolume: 0.1,
      bgMusicTrackId: DEFAULT_MUSIC_LIBRARY[0].id,
      bgMusicTrackName: DEFAULT_MUSIC_LIBRARY[0].name,
      isStoryMode: false
    }
  });

  const musicLibrary = DEFAULT_MUSIC_LIBRARY;
  const musicBlobsRef = useRef<Record<string, Blob>>({});

  const filteredVoices = useMemo(() => {
    return voices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase()));
  }, [voices, voiceSearch]);

  const updateAnalytics = useCallback((task: TTSTask, success: boolean, processingTimeMs: number) => {
    setAnalytics(prev => ({
      ...prev,
      totalGenerated: prev.totalGenerated + 1,
      totalCharacters: prev.totalCharacters + task.text.length,
      totalWords: prev.totalWords + (task.text.trim() ? task.text.trim().split(/\s+/).length : 0),
      totalSuccess: success ? prev.totalSuccess + 1 : prev.totalSuccess,
      totalFailed: !success ? prev.totalFailed + 1 : prev.totalFailed,
      totalProcessingTimeMs: prev.totalProcessingTimeMs + processingTimeMs
    }));
  }, []);

  const clonedVoices = useMemo(() => voices.filter(v => v.category === 'cloned' || v.category === 'generated'), [voices]);

  const parsedSegments = useMemo(() => {
    if (!storyScript.trim()) return [];
    const lines = storyScript.split('\n').filter(line => line.includes(':'));
    return lines.map(line => {
      const parts = line.split(':');
      const name = parts[0].trim();
      const text = parts.slice(1).join(':').trim();
      const character = storyCharacters.find(c => c.name.toLowerCase() === name.toLowerCase());
      return {
        id: crypto.randomUUID(),
        characterId: character?.id || 'narrator',
        voiceId: character?.voiceId || selectedVoiceId,
        voiceName: character?.voiceName || voices.find(v => v.voice_id === selectedVoiceId)?.name || 'Default',
        text
      } as DialogueSegment;
    }).filter(s => s.text.length > 0);
  }, [storyScript, storyCharacters, selectedVoiceId, voices]);

  const exportMetadata = (format: 'csv' | 'json') => {
    if (history.length === 0) return;
    let content = "";
    let mimeType = "text/csv";
    let fileName = `vocalize_export_${Date.now()}.csv`;
    if (format === 'csv') {
      const headers = ["ID", "FileName", "Text", "Voice", "Language", "Created At", "Status"];
      const rows = history.map(h => [h.id, `"${h.fileName}"`, `"${h.text.replace(/"/g, '""')}"`, h.voiceName, h.language, new Date(h.createdAt).toISOString(), h.status]);
      content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    } else {
      content = JSON.stringify(history, null, 2);
      mimeType = "application/json";
      fileName = `vocalize_export_${Date.now()}.json`;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ANALYTICS, JSON.stringify(analytics));
  }, [analytics]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(scheduledJobs));
  }, [scheduledJobs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (apiKey) {
      loadVoices();
      refreshSubscription();
    }
    if (Notification.permission === 'default') Notification.requestPermission();
  }, [apiKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.status === TaskStatus.PROCESSING && t.estimatedRemainingSeconds && t.estimatedRemainingSeconds > 0) {
          return { ...t, estimatedRemainingSeconds: t.estimatedRemainingSeconds - 1 };
        }
        return t;
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleHardReload = () => {
    if (confirm("Hard reload the application kernel? All unsaved scripts will be lost.")) {
      window.location.reload();
    }
  };

  useEffect(() => {
    const textToAnalyze = inputMode === 'simple' ? manualText : storyScript;
    const timer = setTimeout(async () => {
      if (textToAnalyze.trim().length > 15) {
        setIsAnalyzing(true);
        try {
          const result = await detectLanguageAndOptimize(textToAnalyze);
          setAiRecommendation(result);
        } catch (e) {
          console.error("AI Analysis failed", e);
          setAiRecommendation(null);
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        setAiRecommendation(null);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [manualText, storyScript, inputMode]);

  const loadVoices = async () => {
    try {
      const v = await fetchVoices(apiKey);
      setVoices(v);
      if (v.length > 0 && !selectedVoiceId) setSelectedVoiceId(v[0].voice_id);
    } catch (e) { console.error("Error fetching voices:", e); }
  };

  const refreshSubscription = async () => {
    if (!apiKey) return;
    try {
      const sub = await fetchSubscription(apiKey);
      setSubscription(sub);
      setKeyValidationStatus('success');
    } catch (e) { setKeyValidationStatus('error'); }
  };

  const validateKey = async () => {
    setIsValidatingKey(true);
    setKeyValidationStatus('idle');
    try {
      const sub = await fetchSubscription(apiKey);
      setSubscription(sub);
      setKeyValidationStatus('success');
      localStorage.setItem(STORAGE_KEY_API, apiKey);
      loadVoices();
    } catch (e) { setKeyValidationStatus('error'); } finally { setIsValidatingKey(false); }
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY_API, key);
    setShowApiModal(false);
  };

  const generateFileName = (text: string, rowIndex?: number): string => {
    let base = "";
    switch (namingConvention) {
      case NamingConvention.ROW_INDEX: base = `Row_${rowIndex ?? 0}`; break;
      case NamingConvention.TEXT_PREVIEW: base = text.slice(0, 15).replace(/[^a-z0-9\u0980-\u09FF]/gi, '_').trim() || "audio"; break;
      case NamingConvention.CUSTOM_PREFIX: base = `${customPrefix}${Date.now()}`; break;
      case NamingConvention.TIMESTAMP:
      default: base = `Prod_${Date.now()}`; break;
    }
    return `${base}.mp3`;
  };

  const logTaskEntry = (taskId: string, message: string, severity: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') => {
    const time = new Date().toLocaleTimeString();
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      errorLog: [...(t.errorLog || []), `[${severity}] [${time}] ${message}`]
    } : t));
  };

  const updateTaskProgress = (taskId: string, progress: number, eta?: number) => {
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t, progress, estimatedRemainingSeconds: eta ?? t.estimatedRemainingSeconds
    } : t));
  };

  const retryTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, status: TaskStatus.PENDING, progress: 0, retryCount: t.retryCount + 1,
      errorLog: [...(t.errorLog || []), `[INFO] [${new Date().toLocaleTimeString()}] System restart: Initiating recovery attempt #${t.retryCount + 1}...`]
    } : t));
  };

  const skipTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const processQueue = useCallback(async () => {
    if (isProcessing) return;
    const pendingTask = tasks.find(t => t.status === TaskStatus.PENDING);
    if (!pendingTask) {
      setIsProcessing(false);
      return;
    }
    setIsProcessing(true);
    const startTime = Date.now();
    setTasks(prev => prev.map(t => t.id === pendingTask.id ? { 
      ...t, status: TaskStatus.PROCESSING, progress: 5, startTime,
      estimatedRemainingSeconds: Math.ceil(pendingTask.text.length / 30),
      errorLog: [`[INFO] [${new Date().toLocaleTimeString()}] Production initialized. Node Node-TX-Alpha allocating.`]
    } : t));
    try {
      let finalBlob: Blob;
      if (pendingTask.settings.extraFeatures.isStoryMode && pendingTask.segments) {
        const buffers: AudioBuffer[] = [];
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
        for (let i = 0; i < pendingTask.segments.length; i++) {
          const seg = pendingTask.segments[i];
          updateTaskProgress(pendingTask.id, 10 + Math.floor((i / pendingTask.segments!.length) * 50), Math.ceil((pendingTask.segments.length - i) * 3));
          logTaskEntry(pendingTask.id, `Synthesis: Rendering segment ${i+1}/${pendingTask.segments.length} with voice "${seg.voiceName}".`, 'INFO');
          const rawBlob = await generateTTS(apiKey, seg.text, seg.voiceId, pendingTask.settings);
          const arrayBuffer = await rawBlob.arrayBuffer();
          const buffer = await audioContext.decodeAudioData(arrayBuffer);
          buffers.push(buffer);
        }
        logTaskEntry(pendingTask.id, "Mastering: Stitching dialogue segments into master stream.", 'INFO');
        const stitched = stitchAudioBuffers(buffers);
        finalBlob = await bufferToWavBlob(stitched);
      } else {
        updateTaskProgress(pendingTask.id, 25, 5);
        logTaskEntry(pendingTask.id, `Synthesis: Rendering broadcast via ElevenLabs Multi-Lingual Engine.`, 'INFO');
        finalBlob = await generateTTS(apiKey, pendingTask.text, pendingTask.voiceId, pendingTask.settings);
      }
      
      logTaskEntry(pendingTask.id, "Mastering: Applying selected creative configuration and acoustic mastering.", 'INFO');
      let bgMusicBlob: Blob | undefined;
      const mood = pendingTask.settings.extraFeatures.suggestedMood;
      
      if (pendingTask.settings.extraFeatures.backgroundMusic) {
        let track;
        if (pendingTask.settings.extraFeatures.aiComposerMode && mood) {
          track = musicLibrary.find(t => t.mood === mood) || musicLibrary[0];
        } else {
          track = musicLibrary.find(t => t.id === pendingTask.settings.extraFeatures.bgMusicTrackId);
        }

        if (track) {
          bgMusicBlob = await (async () => {
            if (musicBlobsRef.current[track.id]) return musicBlobsRef.current[track.id];
            const res = await fetch(track.url);
            const blob = await res.blob();
            musicBlobsRef.current[track.id] = blob;
            return blob;
          })();
        }
      }
      
      const processed = await processAudioBuffer(finalBlob, {
        normalize: pendingTask.settings.normalize, trimSilence: pendingTask.settings.trimSilence, maxClipDuration: pendingTask.settings.maxClipDuration,
        effect: pendingTask.settings.extraFeatures.voiceEffect, bgMusicVolume: pendingTask.settings.extraFeatures.bgMusicVolume, bgMusic: bgMusicBlob,
        speed: pendingTask.settings.speed ?? 1.0, pitch: pendingTask.settings.pitch ?? 1.0, generateSubtitles: pendingTask.settings.extraFeatures.generateSubtitles,
        generateVideo: pendingTask.settings.extraFeatures.generateVideo, originalText: pendingTask.text
      });
      
      logTaskEntry(pendingTask.id, "Delivery: Transmitting final asset to designated targets.", 'INFO');
      const primaryAudioBlob = processed.audioBlobs[0];
      if (pendingTask.destinations.googleDrive) {
        try { await uploadToGoogleDrive(primaryAudioBlob, pendingTask.fileName); logTaskEntry(pendingTask.id, "Success: Synchronized with Google Drive.", 'SUCCESS'); } catch (e) { logTaskEntry(pendingTask.id, `Cloud Error: Drive upload interrupted. ${e}`, 'WARN'); }
      }
      if (pendingTask.destinations.youtube) {
        try { await uploadToYouTube(primaryAudioBlob, pendingTask.text, pendingTask.fileName); logTaskEntry(pendingTask.id, "Success: Broadcasted to YouTube.", 'SUCCESS'); } catch (e) { logTaskEntry(pendingTask.id, `Cloud Error: YouTube broadcast interrupted. ${e}`, 'WARN'); }
      }
      
      const audioUrl = URL.createObjectURL(primaryAudioBlob);
      const srtUrl = processed.srtBlob ? URL.createObjectURL(processed.srtBlob) : undefined;
      const videoUrl = processed.videoBlob ? URL.createObjectURL(processed.videoBlob) : undefined;
      const processingTime = Date.now() - startTime;
      updateAnalytics(pendingTask, true, processingTime);
      refreshSubscription();
      logTaskEntry(pendingTask.id, `Success: Production cycle complete in ${(processingTime/1000).toFixed(2)}s.`, 'SUCCESS');
      
      const historyItem: HistoryItem = { 
        ...pendingTask, status: TaskStatus.COMPLETED, progress: 100, audioUrl, srtUrl, videoUrl,
        downloadCount: 0, lastUsedAt: Date.now() 
      };
      setHistory(prev => {
        const updated = [historyItem, ...prev];
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated.slice(0, 1000)));
        return updated;
      });
      setTasks(prev => prev.filter(t => t.id !== pendingTask.id));
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      updateAnalytics(pendingTask, false, processingTime);
      logTaskEntry(pendingTask.id, `CRITICAL: Production aborted. Error: ${error.message}`, 'ERROR');
      setTasks(prev => prev.map(t => t.id === pendingTask.id ? { ...t, status: TaskStatus.FAILED, error: error.message, progress: 0 } : t));
    } finally { setIsProcessing(false); }
  }, [tasks, isProcessing, apiKey, musicLibrary, updateAnalytics]);

  useEffect(() => {
    if (!isProcessing && tasks.some(t => t.status === TaskStatus.PENDING)) {
      processQueue();
    }
  }, [tasks, isProcessing, processQueue]);

  const addToQueue = async (text: string) => {
    if (!text.trim() || isDuplicate(text)) return;
    
    let lang = selectedLanguage;
    if (lang === Language.AUTO) {
       lang = /[\u0980-\u09FF]/.test(text) ? Language.BENGALI : Language.ENGLISH;
    }

    const task: TTSTask = {
      id: crypto.randomUUID(), text, language: lang, voiceId: selectedVoiceId,
      voiceName: voices.find(v => v.voice_id === selectedVoiceId)?.name || "Default", 
      settings: { 
        ...globalSettings, 
        extraFeatures: { 
          ...globalSettings.extraFeatures, 
          suggestedMood: aiRecommendation?.suggestedMood 
        } 
      }, 
      status: TaskStatus.PENDING,
      progress: 0, createdAt: Date.now(), fileName: generateFileName(text), retryCount: 0,
      destinations: { ...selectedDestinations }, uploadStatuses: { googleDrive: UploadStatus.IDLE, youtube: UploadStatus.IDLE }
    };
    setTasks(prev => [task, ...prev]);
    if (simpleInputSubMode === 'manual') setManualText("");
    setActiveTab('queue');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: FileList | null = null;
    if ('files' in e.target) files = (e.target as HTMLInputElement).files;
    else if ('dataTransfer' in e) files = (e as React.DragEvent).dataTransfer.files;

    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const rows = content.split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);
      
      const uniqueRows = Array.from(new Set(rows));
      
      const newTasks: TTSTask[] = uniqueRows.map((text, index) => {
        let lang = selectedLanguage;
        if (lang === Language.AUTO) {
           lang = /[\u0980-\u09FF]/.test(text) ? Language.BENGALI : Language.ENGLISH;
        }
        return {
          id: crypto.randomUUID(),
          text,
          language: lang,
          voiceId: selectedVoiceId,
          voiceName: voices.find(v => v.voice_id === selectedVoiceId)?.name || "Default",
          settings: { ...globalSettings },
          status: TaskStatus.PENDING,
          progress: 0,
          createdAt: Date.now() + index,
          fileName: generateFileName(text, index + 1),
          retryCount: 0,
          destinations: { ...selectedDestinations },
          uploadStatuses: { googleDrive: UploadStatus.IDLE, youtube: UploadStatus.IDLE }
        };
      });

      setTasks(prev => [...newTasks, ...prev]);
      setActiveTab('queue');
    };
    reader.readAsText(file);
  };

  const createStoryTask = async () => {
    if (parsedSegments.length === 0 || isDuplicate(storyScript)) return;
    const task: TTSTask = {
      id: crypto.randomUUID(), text: storyScript, language: Language.AUTO, voiceId: selectedVoiceId,
      voiceName: "Story Engine", 
      settings: { 
        ...globalSettings, 
        extraFeatures: { 
          ...globalSettings.extraFeatures, 
          isStoryMode: true,
          suggestedMood: aiRecommendation?.suggestedMood 
        } 
      },
      status: TaskStatus.PENDING, progress: 0, createdAt: Date.now(), fileName: generateFileName(storyScript),
      segments: parsedSegments, retryCount: 0, destinations: { ...selectedDestinations }, uploadStatuses: { googleDrive: UploadStatus.IDLE, youtube: UploadStatus.IDLE }
    };
    setTasks(prev => [task, ...prev]);
    setStoryScript("");
    setStoryStep('cast');
    setActiveTab('queue');
  };

  const isDuplicate = (text: string): boolean => {
    if (!skipDuplicates) return false;
    const cleanText = text.trim();
    return tasks.some(t => t.text.trim() === cleanText) || history.some(h => h.text.trim() === cleanText);
  };

  const editFailedTask = (task: TTSTask) => {
    if (task.settings.extraFeatures.isStoryMode) {
      setInputMode('story');
      setStoryScript(task.text);
      setStoryStep('script');
    } else {
      setInputMode('simple');
      setManualText(task.text);
    }
    setGlobalSettings(task.settings);
    setSelectedVoiceId(task.voiceId);
    setTasks(prev => prev.filter(t => t.id !== task.id));
    setActiveTab('input');
  };

  const handlePreviewEffect = async () => {
    const voice = voices.find(v => v.voice_id === selectedVoiceId);
    if (!voice || !voice.preview_url || isPreviewing) return;
    setIsPreviewing(true);
    try {
      const response = await fetch(voice.preview_url);
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      await audio.play();
      audio.onended = () => { setIsPreviewing(false); URL.revokeObjectURL(audioUrl); };
    } catch (e) { setIsPreviewing(false); }
  };

  const handleCloningAction = async () => {
    if (!cloningName || cloningSamples.length === 0) return;
    setIsCloning(true);
    setCloningStatus("Transmitting vectors to neural gateway...");
    setCloningProgress(10);
    setCloningETA(15); 
    setCloningError(null);
    
    const interval = setInterval(() => {
      setCloningProgress(prev => {
        if (prev < 90) return prev + Math.floor(Math.random() * 5);
        return prev;
      });
    }, 500);

    try {
      await cloneVoice(apiKey, cloningName, cloningSamples);
      clearInterval(interval);
      setCloningProgress(100);
      setCloningStatus("Vector synchronization complete.");
      setCloningETA(0);
      await loadVoices();
      setTimeout(() => {
        setIsCloning(false);
        setCloningSamples([]);
        setCloningName("");
        setCloningTab('manage');
      }, 1500);
    } catch (err: any) {
      clearInterval(interval);
      setIsCloning(false);
      setCloningError(err.message || "Failed to establish vector link.");
    }
  };

  const removeCloningSample = (index: number) => {
    setCloningSamples(prev => prev.filter((_, i) => i !== index));
  };

  const deleteClonedVoiceAction = async (voiceId: string) => {
    if (!confirm("Are you sure you want to permanently delete this cloned voice?")) return;
    try {
      await deleteVoice(apiKey, voiceId);
      await loadVoices();
    } catch (err: any) {
      alert("Error deleting voice: " + err.message);
    }
  };

  const acceptAiRecommendation = () => {
    if (aiRecommendation) {
      setGlobalSettings(prev => ({
        ...prev,
        stability: aiRecommendation.suggestedStability,
        similarity_boost: aiRecommendation.suggestedSimilarity,
        speed: aiRecommendation.suggestedSpeed,
        pitch: aiRecommendation.suggestedPitch,
        extraFeatures: {
          ...prev.extraFeatures,
          backgroundMusic: true,
          aiComposerMode: true,
          suggestedMood: aiRecommendation.suggestedMood
        }
      }));
    }
  };

  const savePreset = () => {
    const name = prompt("Enter a name for this voice preset:");
    if (!name) return;
    const vName = voices.find(v => v.voice_id === selectedVoiceId)?.name || "Unknown";
    const newPreset: VoicePreset = {
      id: crypto.randomUUID(),
      name,
      voiceId: selectedVoiceId,
      voiceName: vName,
      model_id: globalSettings.model_id,
      settings: { ...globalSettings }
    };
    setPresets(prev => [...prev, newPreset]);
  };

  const loadPreset = (preset: VoicePreset) => {
    setSelectedVoiceId(preset.voiceId);
    setGlobalSettings(preset.settings);
  };

  const queueStats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
    const processing = tasks.filter(t => t.status === TaskStatus.PROCESSING).length;
    const failed = tasks.filter(t => t.status === TaskStatus.FAILED).length;
    return { total, pending, processing, failed };
  }, [tasks]);

  const batchProgressPercent = useMemo(() => {
    if (tasks.length === 0) return 0;
    const totalProgress = tasks.reduce((acc, t) => acc + t.progress, 0);
    return Math.round(totalProgress / tasks.length);
  }, [tasks]);

  const characterUsagePercentage = useMemo(() => {
    if (!subscription) return 0;
    return (subscription.character_count / subscription.character_limit) * 100;
  }, [subscription]);

  const analyticsStats = useMemo(() => {
    const successRate = analytics.totalGenerated > 0 ? (analytics.totalSuccess / analytics.totalGenerated) * 100 : 0;
    const avgLeadTime = analytics.totalSuccess > 0 ? (analytics.totalProcessingTimeMs / analytics.totalSuccess / 1000) : 0;
    return { successRate, avgLeadTime };
  }, [analytics]);

  const NavTab: React.FC<{ id: typeof activeTab, label: string, icon: React.ReactNode, badge?: number }> = ({ id, label, icon, badge }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${activeTab === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {badge ? <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{badge}</span> : null}
    </button>
  );

  const previewSnippet = useMemo(() => {
    if (!manualText) return "";
    return manualText.length > 100 ? manualText.substring(0, 100) + "..." : manualText;
  }, [manualText]);

  return (
    <div className={`min-h-screen flex flex-col transition-all duration-500 bg-gray-50/50 overflow-hidden ${isFullscreen ? 'max-w-none w-full p-0' : 'max-w-7xl mx-auto px-0 sm:px-6 py-0 sm:py-8'}`}>
      
      <div className={`mx-auto transition-all duration-700 flex flex-col h-screen ${
        viewportMode === 'mobile' ? 'w-[375px]' : 
        viewportMode === 'tablet' ? 'w-[768px]' : 
        'w-full'
      }`}>

        <nav className="sticky top-0 z-[100] w-full bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-600 rounded-xl shadow-lg"><Sparkles className="text-white w-5 h-5" /></div>
             <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tighter uppercase leading-tight">Vocalize</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
             <NavTab id="input" label="Studio" icon={<Sparkle className="w-4 h-4" />} />
             <NavTab id="scheduler" label="Schedule" icon={<AlarmClock className="w-4 h-4" />} badge={scheduledJobs.filter(j => j.status === 'PENDING').length} />
             <NavTab id="queue" label="Queue" icon={<Layers className="w-4 h-4" />} badge={tasks.length} />
             <NavTab id="history" label="Vault" icon={<HistoryIcon className="w-4 h-4" />} />
             <NavTab id="analytics" label="Stats" icon={<BarChart3 className="w-4 h-4" />} />
             <NavTab id="settings" label="API" icon={<Settings2 className="w-4 h-4" />} />
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-2xl">
             <div className="hidden lg:flex items-center gap-1 mr-2 px-2 border-r border-gray-200">
               <button onClick={() => setViewportMode('mobile')} title="Mobile View" className={`p-2 rounded-xl transition-all ${viewportMode === 'mobile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Smartphone className="w-4 h-4" /></button>
               <button onClick={() => setViewportMode('tablet')} title="Tablet View" className={`p-2 rounded-xl transition-all ${viewportMode === 'tablet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><TabletIcon className="w-4 h-4" /></button>
               <button onClick={() => setViewportMode('desktop')} title="Desktop View" className={`p-2 rounded-xl transition-all ${viewportMode === 'desktop' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><MonitorIcon className="w-4 h-4" /></button>
             </div>

             <button onClick={handleHardReload} title="Hard Reload App" className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"><RotateCcw className="w-5 h-5" /></button>
             <button onClick={toggleFullscreen} title="App Fullscreen" className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all">
               {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
             </button>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Config" className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"><SlidersHorizontal className="w-5 h-5" /></button>
          </div>
        </nav>

        <main className={`flex-1 bg-white overflow-hidden flex flex-col md:flex-row relative border-t border-gray-100 transition-all duration-500 ${isFullscreen ? 'rounded-none shadow-none' : 'sm:mt-6 sm:rounded-[40px] sm:shadow-2xl sm:border'}`}>
          
          <aside className={`fixed inset-y-0 right-0 z-[60] w-[85%] sm:w-80 bg-white shadow-2xl transition-transform duration-500 transform md:relative md:translate-x-0 md:shadow-none md:w-80 md:flex md:flex-col border-l border-gray-100 bg-gray-50/20 overflow-y-auto no-scrollbar ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6 space-y-4">
              <CollapsibleSection title="Voice Core" icon={<Mic className="w-3 h-3" />} defaultOpen>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Model Engine</label>
                    <div className="relative group">
                      <select 
                        value={globalSettings.model_id} 
                        onChange={(e) => setGlobalSettings(prev => ({ ...prev, model_id: e.target.value }))}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl text-[10px] font-bold shadow-sm outline-none appearance-none"
                      >
                        {NEURAL_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronDownIcon className="w-3 h-3" /></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Search Library</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search 10,000+ voices..." 
                        value={voiceSearch}
                        onChange={(e) => setVoiceSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[10px] font-bold shadow-sm outline-none focus:border-indigo-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Selected Signature</label>
                    <select 
                      value={selectedVoiceId} 
                      onChange={(e) => setSelectedVoiceId(e.target.value)} 
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-[10px] font-bold shadow-sm outline-none"
                    >
                      {filteredVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.category})</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handlePreviewEffect} disabled={isPreviewing} className="py-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 text-[8px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-all">
                      {isPreviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ear className="w-3 h-3" />} PREVIEW
                    </button>
                    <button onClick={() => setShowCloningModal(true)} className="py-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 text-[8px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-all">
                      <Fingerprint className="w-3 h-3" /> CLONE
                    </button>
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                       <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Presets</label>
                       <button onClick={savePreset} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"><Save className="w-3.5 h-3.5" /></button>
                    </div>
                    {presets.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1.5">
                        {presets.slice(-3).map(p => (
                          <button key={p.id} onClick={() => loadPreset(p)} className="text-left px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-bold text-gray-600 flex items-center justify-between hover:bg-white transition-all">
                             <span className="truncate">{p.name}</span>
                             <Bookmark className="w-2.5 h-2.5 text-indigo-400" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[8px] text-gray-300 font-medium italic text-center py-2">No saved presets</p>
                    )}
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Synthesis Lab" icon={<ConfigIcon className="w-3 h-3" />} defaultOpen>
                 <div className="space-y-6 pt-2">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[9px] font-black uppercase text-gray-400">Stability</label>
                        <span className="text-[9px] font-black text-indigo-600">{globalSettings.stability}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={globalSettings.stability} onChange={(e) => setGlobalSettings(prev => ({...prev, stability: parseFloat(e.target.value)}))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[9px] font-black uppercase text-gray-400">Similarity</label>
                        <span className="text-[9px] font-black text-indigo-600">{globalSettings.similarity_boost}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={globalSettings.similarity_boost} onChange={(e) => setGlobalSettings(prev => ({...prev, similarity_boost: parseFloat(e.target.value)}))} className="w-full accent-indigo-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-gray-400">Speed</label>
                          <input type="number" step="0.05" min="0.5" max="2.0" value={globalSettings.speed} onChange={(e) => setGlobalSettings(prev => ({...prev, speed: parseFloat(e.target.value)}))} className="w-full p-2 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-gray-400">Pitch</label>
                          <input type="number" step="0.05" min="0.5" max="2.0" value={globalSettings.pitch} onChange={(e) => setGlobalSettings(prev => ({...prev, pitch: parseFloat(e.target.value)}))} className="w-full p-2 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none" />
                       </div>
                    </div>
                 </div>
              </CollapsibleSection>

              <CollapsibleSection title="Creative Lab" icon={<Beaker className="w-3 h-3" />} defaultOpen>
                 <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Acoustic Effect</label>
                      <select 
                        value={globalSettings.extraFeatures.voiceEffect} 
                        onChange={(e) => setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, voiceEffect: e.target.value as VoiceEffect}}))}
                        className="w-full p-2.5 bg-white border border-gray-100 rounded-xl text-[10px] font-bold outline-none"
                      >
                        {Object.values(VoiceEffect).map(eff => <option key={eff} value={eff}>{eff}</option>)}
                      </select>
                    </div>

                    <div className="space-y-3 p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase text-gray-500 flex items-center gap-2"><Music className="w-3 h-3" /> AI Composer</label>
                        <button 
                          onClick={() => setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, backgroundMusic: !prev.extraFeatures.backgroundMusic, aiComposerMode: !prev.extraFeatures.backgroundMusic}}))}
                          className={`p-1 rounded-full transition-all ${globalSettings.extraFeatures.aiComposerMode ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                        >
                          {globalSettings.extraFeatures.aiComposerMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      </div>
                      
                      {!globalSettings.extraFeatures.aiComposerMode && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black uppercase text-gray-500 flex items-center gap-2">Manual Track</label>
                            <button 
                              onClick={() => setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, backgroundMusic: !prev.extraFeatures.backgroundMusic}}))}
                              className={`p-1 rounded-full transition-all ${globalSettings.extraFeatures.backgroundMusic ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                            >
                              {globalSettings.extraFeatures.backgroundMusic ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                          </div>
                          {globalSettings.extraFeatures.backgroundMusic && (
                            <select 
                              value={globalSettings.extraFeatures.bgMusicTrackId}
                              onChange={(e) => {
                                const track = musicLibrary.find(t => t.id === e.target.value);
                                setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, bgMusicTrackId: track?.id, bgMusicTrackName: track?.name}}));
                              }}
                              className="w-full p-2 bg-white border border-gray-200 rounded-lg text-[10px] font-bold outline-none"
                            >
                              {musicLibrary.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          )}
                        </div>
                      )}

                      {(globalSettings.extraFeatures.backgroundMusic || globalSettings.extraFeatures.aiComposerMode) && (
                        <div className="space-y-3 pt-3 animate-in fade-in">
                          <div className="flex items-center gap-3">
                            <Volume2 className="w-3 h-3 text-gray-400" />
                            <input 
                              type="range" min="0" max="0.5" step="0.01" 
                              value={globalSettings.extraFeatures.bgMusicVolume}
                              onChange={(e) => setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, bgMusicVolume: parseFloat(e.target.value)}}))}
                              className="flex-1 accent-indigo-600"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, generateSubtitles: !prev.extraFeatures.generateSubtitles}}))}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${globalSettings.extraFeatures.generateSubtitles ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-100 text-gray-400 opacity-60'}`}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-[7px] font-black uppercase">Subtitles</span>
                      </button>
                      <button 
                        onClick={() => setGlobalSettings(prev => ({...prev, extraFeatures: {...prev.extraFeatures, generateVideo: !prev.extraFeatures.generateVideo}}))}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${globalSettings.extraFeatures.generateVideo ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-100 text-gray-400 opacity-60'}`}
                      >
                        <Video className="w-4 h-4" />
                        <span className="text-[7px] font-black uppercase">To Video</span>
                      </button>
                    </div>
                 </div>
              </CollapsibleSection>
            </div>
          </aside>

          <div className="flex-1 p-6 sm:p-12 overflow-y-auto bg-white relative no-scrollbar">
            
            {activeTab === 'input' && (
              <div className="space-y-8 animate-in fade-in duration-700">
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl w-fit">
                      <button onClick={() => setInputMode('simple')} className={`px-6 py-3 text-[10px] font-black rounded-xl flex items-center gap-2.5 transition-all ${inputMode === 'simple' ? 'bg-white shadow-xl text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><MessageSquare className="w-4 h-4" /> BROADCAST</button>
                      <button onClick={() => setInputMode('story')} className={`px-6 py-3 text-[10px] font-black rounded-xl flex items-center gap-2.5 transition-all ${inputMode === 'story' ? 'bg-white shadow-xl text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><BookOpen className="w-4 h-4" /> STORY MODE</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsScheduling(true)} className="flex items-center gap-2 px-5 py-3.5 bg-amber-50 text-amber-700 rounded-2xl cursor-pointer hover:bg-amber-100 transition-all font-black text-[10px] uppercase tracking-widest border border-amber-100 shadow-sm active:scale-95">
                        <AlarmClock className="w-4 h-4" /> SCHEDULE BATCH
                      </button>
                      <button 
                        onClick={inputMode === 'simple' ? (simpleInputSubMode === 'manual' ? () => addToQueue(manualText) : () => {}) : createStoryTask} 
                        disabled={(inputMode === 'simple' && simpleInputSubMode === 'manual' && !manualText.trim()) || (inputMode === 'story' && parsedSegments.length === 0)} 
                        className={`px-5 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-30 ${simpleInputSubMode === 'batch' && inputMode === 'simple' ? 'hidden' : ''}`}
                      >
                        PRODUCE NOW
                      </button>
                    </div>
                 </div>

                 {inputMode === 'simple' && (
                    <div className="bg-white border-2 border-gray-100 rounded-[50px] p-8 shadow-sm space-y-8 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Sparkle className="w-6 h-6" /></div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Text & Batch Input</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Multi-lingual engine with batch synthesis</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                <button onClick={() => setSimpleInputSubMode('manual')} className={`px-4 py-2 text-[9px] font-black rounded-xl transition-all ${simpleInputSubMode === 'manual' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-indigo-400'}`}>MANUAL ENTRY</button>
                                <button onClick={() => setSimpleInputSubMode('batch')} className={`px-4 py-2 text-[9px] font-black rounded-xl transition-all ${simpleInputSubMode === 'batch' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-indigo-400'}`}>BATCH UPLOAD</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-8 space-y-6">
                                {simpleInputSubMode === 'manual' ? (
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <textarea 
                                                value={manualText} 
                                                onChange={(e) => setManualText(e.target.value)} 
                                                placeholder="Type or paste text in Bengali or English..."
                                                className="w-full h-80 p-8 text-lg font-medium border-2 border-transparent focus:border-indigo-400 outline-none transition-all resize-none bg-gray-50/50 rounded-[40px] shadow-inner"
                                            />
                                            {showPreviewSnippet && manualText && (
                                                <div className="absolute inset-x-4 bottom-4 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-indigo-100 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Eye className="w-3 h-3 text-indigo-600" />
                                                        <span className="text-[8px] font-black uppercase text-indigo-600 tracking-widest">Neural Preview Snippet</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 italic line-clamp-2">"{previewSnippet}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        className={`w-full h-80 border-4 border-dashed rounded-[50px] flex flex-col items-center justify-center gap-6 transition-all ${dragActive ? 'border-indigo-600 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/50 hover:border-indigo-200'}`}
                                        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                                        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e); }}
                                    >
                                        <div className="p-8 bg-white rounded-[35px] shadow-xl text-indigo-600">
                                            <FileUp className="w-16 h-16" />
                                        </div>
                                        <div className="text-center px-8">
                                            <p className="text-xl font-black text-gray-900 uppercase tracking-tighter">Transmission Gateway</p>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">Drag CSV file here or <label className="text-indigo-600 cursor-pointer hover:underline">browse files<input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} /></label></p>
                                        </div>
                                        <div className="flex items-center gap-4 py-2 px-6 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 shadow-sm">
                                            <TriangleAlert className="w-4 h-4" />
                                            <span className="text-[8px] font-black uppercase tracking-widest">Auto-cleans empty rows and duplicates</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-4 space-y-6">
                                <div className="p-6 bg-gray-50/80 border border-gray-100 rounded-[35px] space-y-6 shadow-inner">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-[0.2em] ml-2 block">Language Logic</label>
                                        <div className="relative group">
                                            <select 
                                                value={selectedLanguage} 
                                                onChange={(e) => setSelectedLanguage(e.target.value as Language)}
                                                className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-bold shadow-sm outline-none appearance-none cursor-pointer focus:ring-4 ring-indigo-50 transition-all"
                                            >
                                                <option value={Language.AUTO}>Auto-Detect Protocol</option>
                                                <option value={Language.ENGLISH}>English (US/UK Core)</option>
                                                <option value={Language.BENGALI}>Bengali (Regional Native)</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronDownIcon className="w-4 h-4" /></div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                {showPreviewSnippet ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-700 tracking-widest">Real-time Preview</span>
                                        </div>
                                        <button 
                                            onClick={() => setShowPreviewSnippet(!showPreviewSnippet)}
                                            className={`p-1 rounded-full transition-all ${showPreviewSnippet ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                                        >
                                            {showPreviewSnippet ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                                        </button>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 text-indigo-900">
                                            <Info className="w-5 h-5 shrink-0" />
                                            <p className="text-[9px] font-medium leading-relaxed">System handles script formatting and whitespace automatically during the synthesis cycle.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                 )}

                 {isAnalyzing && (
                   <div className="p-8 bg-indigo-600 text-white rounded-[40px] flex items-center gap-6 shadow-2xl animate-in slide-in-from-top-4 duration-500 overflow-hidden relative group">
                      <div className="absolute inset-0 bg-white/10 animate-shimmer skew-x-12" />
                      <div className="p-4 bg-white/20 rounded-3xl relative"><Loader2 className="w-8 h-8 animate-spin" /></div>
                      <div className="relative">
                        <h4 className="text-sm font-black uppercase tracking-widest">AI Mastering Analysis</h4>
                        <p className="text-xs font-medium opacity-80 mt-1">Gemini is decoding linguistics and emotional cadence...</p>
                      </div>
                   </div>
                 )}

                 {!isAnalyzing && aiRecommendation && (
                   <div className="p-8 bg-white border-2 border-indigo-100 rounded-[50px] shadow-2xl animate-in zoom-in duration-500 flex flex-col lg:flex-row items-center gap-10">
                      <div className="p-6 bg-indigo-50 rounded-[40px]"><BrainCircuit className="w-16 h-16 text-indigo-600" /></div>
                      <div className="flex-1 space-y-4 text-center lg:text-left">
                         <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                            <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">AI Insight</span>
                            <span className="text-sm font-black text-gray-900 uppercase tracking-tighter">Recommended Config: {aiRecommendation.language}</span>
                         </div>
                         <p className="text-sm font-medium text-gray-600 leading-relaxed max-w-2xl">{aiRecommendation.reasoning}</p>
                         <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2">
                            {[
                              { l: 'Stability', v: aiRecommendation.suggestedStability },
                              { l: 'Similarity', v: aiRecommendation.suggestedSimilarity },
                              { l: 'Speed', v: aiRecommendation.suggestedSpeed },
                              { l: 'Pitch', v: aiRecommendation.suggestedPitch },
                              { l: 'AI Mood', v: aiRecommendation.suggestedMood }
                            ].map((rec, idx) => (
                              <div key={idx} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center">
                                 <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{rec.l}</span>
                                 <span className="text-xs font-black text-indigo-600">{rec.v}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                      <button 
                        onClick={acceptAiRecommendation}
                        className="px-10 py-5 bg-indigo-600 text-white rounded-[30px] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-4 group"
                      >
                        APPLY CONFIG <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                      </button>
                   </div>
                 )}

                 {inputMode === 'story' && (
                   <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700">
                      <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-[30px] w-fit">
                         <button onClick={() => setStoryStep('cast')} className={`px-6 py-3 text-[10px] font-black rounded-[20px] transition-all flex items-center gap-2 ${storyStep === 'cast' ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-400 hover:text-indigo-400'}`}><UserCircle2 className="w-4 h-4" /> 1. CASTING</button>
                         <div className="w-4 h-px bg-gray-200" />
                         <button onClick={() => setStoryStep('script')} className={`px-6 py-3 text-[10px] font-black rounded-[20px] transition-all flex items-center gap-2 ${storyStep === 'script' ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-400 hover:text-indigo-400'}`}><Edit3 className="w-4 h-4" /> 2. SCRIPT</button>
                         <div className="w-4 h-px bg-gray-200" />
                         <button onClick={() => setStoryStep('preview')} className={`px-6 py-3 text-[10px] font-black rounded-[20px] transition-all flex items-center gap-2 ${storyStep === 'preview' ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-400 hover:text-indigo-400'}`}><ListChecks className="w-4 h-4" /> 3. PREVIEW</button>
                      </div>

                      {storyStep === 'cast' && (
                        <section className="bg-white p-10 rounded-[50px] border-2 border-indigo-50 shadow-sm animate-in zoom-in duration-500">
                           <div className="flex items-center justify-between mb-10">
                              <div>
                                 <h4 className="text-xl font-black text-indigo-900 uppercase tracking-tighter leading-none">Story Ensemble</h4>
                                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Define your digital actors and assign their neural signatures</p>
                              </div>
                              <button 
                                onClick={() => setStoryCharacters([...storyCharacters, { id: crypto.randomUUID(), name: `Actor ${storyCharacters.length + 1}`, voiceId: selectedVoiceId, voiceName: voices.find(v => v.voice_id === selectedVoiceId)?.name || "Default" }])} 
                                className="p-4 bg-indigo-600 text-white rounded-[24px] hover:bg-indigo-700 shadow-xl active:scale-90 transition-all flex items-center gap-3 font-black text-[10px] uppercase tracking-widest"
                              >
                                 <Plus className="w-5 h-5" /> ADD ACTOR
                              </button>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {storyCharacters.length === 0 ? (
                                 <div className="col-span-full py-20 text-center text-gray-300 border-2 border-dashed border-gray-100 rounded-[40px]">
                                    <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.3em]">No Actors Assigned</p>
                                 </div>
                              ) : storyCharacters.map(char => (
                                 <div key={char.id} className="bg-gray-50/50 p-6 rounded-[35px] border border-transparent hover:border-indigo-200 transition-all group animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between mb-4">
                                       <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xs uppercase">{char.name.charAt(0)}</div>
                                          <input 
                                            value={char.name} 
                                            onChange={(e) => setStoryCharacters(prev => prev.map(c => c.id === char.id ? { ...c, name: e.target.value } : c))} 
                                            className="text-xs font-black text-gray-900 uppercase tracking-widest bg-transparent outline-none w-28" 
                                          />
                                       </div>
                                       <button onClick={() => setStoryCharacters(prev => prev.filter(c => c.id !== char.id))} className="p-2 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <select 
                                      value={char.voiceId} 
                                      onChange={(e) => {
                                        const vName = voices.find(v => v.voice_id === e.target.value)?.name || "Default";
                                        setStoryCharacters(prev => prev.map(c => c.id === char.id ? { ...c, voiceId: e.target.value, voiceName: vName } : c));
                                      }} 
                                      className="w-full text-[11px] font-bold text-gray-600 bg-white border border-gray-100 rounded-xl p-3 outline-none shadow-sm focus:border-indigo-400 transition-all"
                                    >
                                       {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                                    </select>
                                 </div>
                              ))}
                           </div>
                           {storyCharacters.length > 0 && (
                             <div className="mt-10 pt-10 border-t border-gray-100 flex justify-end">
                                <button onClick={() => setStoryStep('script')} className="px-10 py-5 bg-gray-900 text-white rounded-[30px] font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-4 group">
                                   CONTINUE TO SCRIPTING <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                                </button>
                             </div>
                           )}
                        </section>
                      )}

                      {storyStep === 'script' && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                           <div className="bg-white p-10 rounded-[50px] border-2 border-indigo-50 shadow-sm">
                              <div className="flex items-center justify-between mb-8">
                                 <div>
                                    <h4 className="text-xl font-black text-indigo-900 uppercase tracking-tighter leading-none">Manuscript Input</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Format: "CharacterName: Dialogue Text"</p>
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl flex items-center gap-2 font-black text-[9px] uppercase tracking-widest"><AlertOctagon className="w-3.5 h-3.5" /> Case Sensitive</div>
                                 </div>
                              </div>
                              <textarea 
                                value={storyScript} 
                                onChange={(e) => setStoryScript(e.target.value)} 
                                placeholder="Narrator: Deep in the forest, a secret awaited...\nElora: I can feel the ancient magic rising." 
                                className="w-full h-[500px] p-10 text-xl font-medium border-2 border-gray-100 focus:border-indigo-400 outline-none transition-all resize-none bg-gray-50/50 rounded-[40px] shadow-inner font-mono leading-relaxed" 
                              />
                              <div className="mt-10 flex justify-between items-center">
                                 <button onClick={() => setStoryStep('cast')} className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 hover:text-indigo-600 transition-all"><X className="w-4 h-4" /> REVISE CAST</button>
                                 <button 
                                   onClick={() => setStoryStep('preview')} 
                                   disabled={!storyScript.trim()} 
                                   className="px-12 py-5 bg-indigo-600 text-white rounded-[30px] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-2xl transition-all flex items-center gap-4 group disabled:opacity-30"
                                 >
                                    PARSE & PREVIEW <ListChecks className="w-6 h-6" />
                                 </button>
                              </div>
                           </div>
                        </div>
                      )}

                      {storyStep === 'preview' && (
                        <div className="space-y-8 animate-in zoom-in duration-500">
                           <div className="bg-white p-10 rounded-[50px] border-2 border-indigo-50 shadow-sm">
                              <div className="flex items-center justify-between mb-10">
                                 <div>
                                    <h4 className="text-xl font-black text-indigo-900 uppercase tracking-tighter leading-none">Production Preview</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Breakdown of dialogues enqueued for neural synthesis</p>
                                 </div>
                                 <button onClick={() => setStoryStep('script')} className="px-6 py-3 bg-gray-50 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all border border-gray-100">RE-EDIT SCRIPT</button>
                              </div>

                              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 thin-scrollbar">
                                 {parsedSegments.length === 0 ? (
                                   <div className="py-20 text-center text-gray-300 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-100">
                                      <Terminal className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                      <p className="text-[10px] font-black uppercase tracking-widest">Parsing Engine: No Dialogue Detected</p>
                                   </div>
                                 ) : parsedSegments.map((seg, idx) => (
                                   <div key={seg.id} className="p-6 bg-gray-50 border border-gray-100 rounded-[30px] flex gap-6 hover:bg-white transition-all group">
                                      <div className="flex flex-col items-center">
                                         <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-lg">{idx + 1}</div>
                                         <div className="w-px h-full bg-indigo-100 mt-2" />
                                      </div>
                                      <div className="flex-1 space-y-3">
                                         <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                               <span className="text-[11px] font-black text-indigo-900 uppercase tracking-[0.2em]">{seg.voiceName}</span>
                                               {seg.characterId === 'narrator' && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">UNASSIGNED</span>}
                                            </div>
                                            <div className="text-[9px] font-black text-gray-300 font-mono">TX-NODE-{seg.voiceId.slice(0, 4)}</div>
                                         </div>
                                         <p className="text-gray-700 text-lg font-medium leading-relaxed italic">"{seg.text}"</p>
                                      </div>
                                   </div>
                                 ))}
                              </div>

                              <div className="mt-12 flex flex-col items-center gap-6 p-10 bg-indigo-900 rounded-[45px] text-white shadow-2xl relative overflow-hidden group">
                                 <div className="absolute inset-0 bg-indigo-800/50 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />
                                 <div className="relative z-10 text-center">
                                    <h5 className="text-2xl font-black uppercase tracking-tighter mb-2">Initialize Production Pipeline?</h5>
                                    <p className="text-[11px] font-medium text-indigo-300 uppercase tracking-widest mb-10">Total Segments: {parsedSegments.length} • Multi-Voice Mastering Enabled</p>
                                    <button 
                                      onClick={createStoryTask} 
                                      disabled={parsedSegments.length === 0} 
                                      className="px-16 py-6 bg-white text-indigo-900 rounded-[35px] font-black text-xl uppercase tracking-[0.2em] hover:bg-indigo-50 shadow-2xl transition-all active:scale-95 flex items-center gap-6"
                                    >
                                       <Sparkles className="w-8 h-8 text-indigo-600" /> ENGAGE MASTERING
                                    </button>
                                 </div>
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
                 <div className="bg-gray-900 text-white p-10 rounded-[50px] shadow-2xl relative overflow-hidden group border border-white/5">
                    <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] group-hover:bg-indigo-600/30 transition-all duration-1000" />
                    <div className="relative z-10 space-y-8">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="p-4 bg-white/10 rounded-3xl border border-white/5 shadow-inner"><Monitor className="w-8 h-8 text-indigo-400" /></div>
                             <div>
                                <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Production Control</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Real-time Telemetry & Diagnostics</p>
                             </div>
                          </div>
                          <div className="flex gap-3">
                             {queueStats.failed > 0 && (
                                <button onClick={() => tasks.filter(t => t.status === TaskStatus.FAILED).forEach(t => retryTask(t.id))} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-900/40 flex items-center gap-2 group/retry"><RotateCcw className="w-4 h-4 group-hover/retry:rotate-180 transition-transform" /> RETRY ALL FAILURES</button>
                             )}
                             <button onClick={() => setTasks([])} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all flex items-center gap-2"><ZapOff className="w-4 h-4" /> ABORT PIPELINE</button>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          {[
                            { label: 'Active Pipeline', val: queueStats.total, icon: ActivityIcon, color: 'text-indigo-400' },
                            { label: 'Synthesizing', val: queueStats.processing, icon: Loader2, color: 'text-blue-400', spin: queueStats.processing > 0 },
                            { label: 'Batch ETA', val: tasks.find(t => t.status === TaskStatus.PROCESSING)?.estimatedRemainingSeconds !== undefined ? `${tasks.find(t => t.status === TaskStatus.PROCESSING)?.estimatedRemainingSeconds}s` : '---', icon: Clock, color: 'text-amber-400' },
                            { label: 'Failed Cycles', val: queueStats.failed, icon: TriangleAlert, color: 'text-red-400', alert: queueStats.failed > 0 }
                          ].map((stat, i) => (
                             <div key={i} className="p-6 bg-white/5 rounded-3xl border border-white/5 group-hover:border-white/10 transition-all shadow-inner backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-2">
                                   <stat.icon className={`w-4 h-4 ${stat.color} ${stat.spin ? 'animate-spin' : ''} ${stat.alert ? 'animate-pulse' : ''}`} />
                                   <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</p>
                                </div>
                                <p className="text-3xl font-black tracking-tight">{stat.val}</p>
                             </div>
                          ))}
                       </div>

                       {tasks.length > 0 && (
                         <div className="space-y-3 pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-400">
                               <span className="flex items-center gap-2"><ZapIcon className="w-3 h-3" /> Cumulative Batch Progress</span>
                               <span>{batchProgressPercent}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden shadow-inner">
                               <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.4)]" style={{ width: `${batchProgressPercent}%` }} />
                            </div>
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="grid gap-6">
                    {tasks.length === 0 ? (
                      <div className="py-48 text-center bg-gray-50/50 rounded-[60px] border-4 border-dashed border-gray-100 group">
                         <SuccessIcon className="w-24 h-24 text-gray-200 mx-auto mb-6 group-hover:text-indigo-200 transition-colors" />
                         <p className="text-[12px] font-black text-gray-400 uppercase tracking-[0.3em]">System Standby: Awaiting Instructions</p>
                      </div>
                    ) : tasks.map(task => (
                      <div key={task.id} className={`bg-white border rounded-[45px] overflow-hidden shadow-2xl transition-all border-l-[16px] animate-in slide-in-from-bottom-4 ${
                        task.status === TaskStatus.PROCESSING ? 'border-indigo-600 ring-4 ring-indigo-50' : 
                        task.status === TaskStatus.FAILED ? 'border-red-500 bg-red-50/10' : 'border-gray-100 opacity-90'
                      }`}>
                         <div className="p-10">
                            <div className="flex items-start justify-between gap-10">
                               <div className="flex-1 min-w-0 space-y-6">
                                  <div className="flex items-center gap-4">
                                     <div className={`p-4 rounded-[28px] shadow-sm ${task.status === TaskStatus.FAILED ? 'bg-red-100 text-red-600 animate-in shake' : 'bg-gray-100 text-gray-500'}`}>
                                        {task.settings.extraFeatures.isStoryMode ? <BookOpen className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                     </div>
                                     <div>
                                        <h3 className="text-2xl font-black text-gray-900 truncate tracking-tighter leading-none">{task.fileName}</h3>
                                        <div className="flex items-center gap-3 mt-2">
                                           <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg tracking-widest">{task.language}</span>
                                           <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5 font-mono">• {task.voiceName}</span>
                                           {task.settings.extraFeatures.aiComposerMode && (
                                              <span className="text-[8px] font-black uppercase text-white bg-indigo-600 px-2 py-0.5 rounded-md flex items-center gap-1"><Wand className="w-3 h-3" /> AI SCORE</span>
                                           )}
                                        </div>
                                     </div>
                                  </div>

                                  {task.status === TaskStatus.PROCESSING ? (
                                     <div className="space-y-5">
                                        <div className="flex justify-between items-end">
                                           <div className="flex items-center gap-3">
                                              <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                                                <span className="text-[11px] font-black uppercase text-indigo-600 tracking-widest animate-pulse">
                                                  {task.settings.extraFeatures.aiComposerMode ? "Composing Neural Score..." : "Encoding Neural Stream..."}
                                                </span>
                                              </div>
                                           </div>
                                           <div className="text-right">
                                              <span className="text-3xl font-black text-indigo-600 leading-none">{task.progress}%</span>
                                              {task.estimatedRemainingSeconds !== undefined && task.estimatedRemainingSeconds > 0 && (
                                                 <p className="text-[10px] font-black text-gray-400 uppercase mt-2 tracking-widest flex items-center justify-end gap-2"><Clock className="w-3.5 h-3.5" /> ~{task.estimatedRemainingSeconds}s to delivery</p>
                                              )}
                                           </div>
                                        </div>
                                        <div className="h-5 w-full bg-indigo-50 rounded-full overflow-hidden p-1 shadow-inner border border-indigo-100">
                                           <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-800 rounded-full transition-all duration-700 relative shadow-lg" style={{ width: `${task.progress}%` }}>
                                              <div className="absolute inset-0 bg-white/30 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
                                           </div>
                                        </div>
                                     </div>
                                  ) : task.status === TaskStatus.FAILED ? (
                                     <div className="p-8 bg-white rounded-[40px] border-2 border-red-200 shadow-xl space-y-6 relative group/fail animate-in shake duration-500">
                                        <div className="flex items-start gap-5">
                                           <div className="p-3 bg-red-50 rounded-2xl"><TriangleAlert className="w-8 h-8 text-red-500" /></div>
                                           <div>
                                              <p className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-2">Cycle Interrupted: Critical Error</p>
                                              <p className="text-lg font-bold text-gray-900 leading-tight">{task.error || "Uplink connection refused by synthesis node."}</p>
                                           </div>
                                        </div>
                                        <div className="flex items-center gap-3 pt-5 border-t border-red-50">
                                           <button onClick={() => retryTask(task.id)} className="px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-red-700 transition-all flex items-center gap-3 shadow-xl shadow-red-200 group/btn">
                                              <RefreshCw className="w-4 h-4 group-hover/btn:rotate-180 transition-transform" /> RETRY SYNTHESIS
                                           </button>
                                           <button onClick={() => editFailedTask(task)} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center gap-3 shadow-xl">
                                              <Edit3 className="w-4 h-4" /> RE-EDIT SCRIPT
                                           </button>
                                           <button onClick={() => skipTask(task.id)} className="px-8 py-4 bg-white text-gray-400 border border-gray-100 rounded-2xl text-[10px] font-black uppercase hover:bg-gray-50 transition-all flex items-center gap-3">
                                              <XCircle className="w-4 h-4" /> DISCARD TASK
                                           </button>
                                        </div>
                                     </div>
                                  ) : (
                                     <div className="flex items-center gap-3 py-5 px-8 bg-gray-50 rounded-[30px] border border-gray-100 shadow-inner group-hover:bg-white transition-colors">
                                        <Clock className="w-5 h-5 text-gray-400" />
                                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Enqueued: Awaiting slot allocation in production kernel...</span>
                                     </div>
                                  )}
                               </div>

                               <div className="flex flex-col gap-3">
                                  <button onClick={() => setExpandedLogs(prev => ({ ...prev, [task.id]: !prev[task.id] }))} className={`p-6 rounded-[30px] transition-all shadow-xl ${expandedLogs[task.id] ? 'bg-indigo-600 text-white ring-8 ring-indigo-50' : 'bg-gray-900 text-white hover:bg-indigo-600'}`} title="Telemetry & Diagnostics">
                                     <Terminal className="w-7 h-7" />
                                  </button>
                                  <button onClick={() => skipTask(task.id)} className="p-6 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-[30px] transition-all" title="Purge Operation"><Trash2 className="w-7 h-7" /></button>
                               </div>
                            </div>
                         </div>

                         {expandedLogs[task.id] && (
                           <div className="bg-gray-950 p-12 animate-in slide-in-from-top-8 duration-500 border-t border-gray-800 overflow-hidden">
                              <div className="flex items-center justify-between mb-10">
                                 <div className="flex items-center gap-4 text-indigo-400">
                                    <div className="p-3 bg-indigo-500/10 rounded-2xl"><Bug className="w-6 h-6" /></div>
                                    <div>
                                      <span className="text-[12px] font-black uppercase tracking-[0.4em] block leading-none">Command Diagnostics Feed</span>
                                      <span className="text-[8px] text-gray-600 uppercase font-black mt-2 block tracking-widest">Protocol Kernel 4.1.0-SYNTH</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-6">
                                    <div className="text-right">
                                      <p className="text-[8px] font-black text-gray-700 uppercase tracking-tighter">Target Instance</p>
                                      <p className="text-[10px] font-mono text-gray-400 uppercase">SYNTH-TX-{task.id.slice(0, 4)}</p>
                                    </div>
                                    <button onClick={() => {
                                      const logText = task.errorLog?.join('\n') || "";
                                      navigator.clipboard.writeText(logText);
                                    }} className="p-3 bg-white/5 hover:bg-white/10 text-gray-500 rounded-xl transition-all" title="Copy Telemetry Logs"><Copy className="w-5 h-5" /></button>
                                 </div>
                              </div>
                               <div className="font-mono text-[12px] space-y-4 max-h-[400px] overflow-y-auto thin-scrollbar p-10 bg-black/60 rounded-[45px] border border-white/5 shadow-2xl relative">
                                 <div className="absolute top-0 right-10 text-[60px] font-black text-white/[0.02] pointer-events-none select-none tracking-tighter">TELEMETRY</div>
                                 {task.errorLog && task.errorLog.length > 0 ? task.errorLog.map((entry, idx) => {
                                   const isError = entry.includes('[ERROR]');
                                   const isWarn = entry.includes('[WARN]');
                                   const isSuccess = entry.includes('[SUCCESS]');
                                   return (
                                     <div key={idx} className={`flex gap-6 group transition-all p-2 rounded-lg hover:bg-white/5 ${isError ? 'text-red-400 bg-red-500/5' : isWarn ? 'text-amber-400' : isSuccess ? 'text-emerald-400' : 'text-indigo-300'}`}>
                                        <span className="opacity-10 text-[9px] w-8 shrink-0 group-hover:opacity-40 text-right leading-none">{idx+1}</span>
                                        <span className="leading-relaxed tracking-wider whitespace-pre-wrap">{entry}</span>
                                     </div>
                                   );
                                 }) : (
                                   <div className="flex flex-col items-center justify-center py-24 opacity-20">
                                      <RefreshCw className="w-12 h-12 animate-spin mb-6" />
                                      <p className="text-[11px] font-black uppercase tracking-[0.4em]">Establishing secure uplink to synthesis node...</p>
                                   </div>
                                 )}
                                 <div className="text-indigo-600 animate-pulse font-black pt-8 flex items-center gap-3">
                                    <span className="w-2.5 h-4 bg-indigo-600" />
                                    <span className="tracking-[0.2em]">PERSISTENT_UPLINK_ESTABLISHED_</span>
                                 </div>
                              </div>
                           </div>
                         )}
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'scheduler' && (
              <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between">
                   <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Job Scheduler</h2>
                   <button onClick={() => setScheduledJobs([])} className="p-3 text-gray-300 hover:text-red-500 transition-all"><Trash2 className="w-6 h-6" /></button>
                </div>
                <div className="grid gap-6">
                   {scheduledJobs.length === 0 ? (
                     <div className="py-48 text-center text-gray-200 border-2 border-dashed border-gray-100 rounded-[50px]"><Clock className="w-24 h-24 mx-auto mb-6 opacity-30" /><p className="font-black text-sm uppercase tracking-[0.3em]">Temporal Queue Empty</p></div>
                   ) : scheduledJobs.map(job => (
                     <div key={job.id} className="bg-white border-2 border-gray-100 rounded-[40px] p-8 flex items-center justify-between shadow-lg hover:border-amber-200 transition-all">
                        <div className="flex items-center gap-6">
                           <div className="p-4 bg-amber-50 rounded-3xl"><Calendar className="w-8 h-8 text-amber-500" /></div>
                           <div>
                              <h4 className="text-xl font-black text-gray-900">{job.name}</h4>
                              <div className="flex items-center gap-4 mt-1">
                                 <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">{new Date(job.executeAt).toLocaleString()}</p>
                                 <span className="text-[10px] text-gray-300">|</span>
                                 <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{job.tasks.length} Operations Pending</p>
                              </div>
                           </div>
                        </div>
                        <button onClick={() => setScheduledJobs(prev => prev.filter(j => j.id !== job.id))} className="p-5 text-red-400 hover:bg-red-50 rounded-[28px] transition-all"><Trash2 className="w-7 h-7" /></button>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-8 animate-in slide-in-from-left-8 duration-500">
                 <div className="flex items-center justify-between">
                   <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Asset Vault</h2>
                   <div className="flex gap-2">
                      <button onClick={() => exportMetadata('csv')} className="p-4 bg-gray-50 text-gray-600 rounded-2xl border border-gray-100 shadow-sm hover:bg-white transition-all"><Table className="w-6 h-6" /></button>
                      <button onClick={() => setHistory([])} className="p-4 bg-gray-50 text-gray-300 hover:text-red-500 rounded-2xl border border-gray-100 transition-all"><Trash2 className="w-6 h-6" /></button>
                   </div>
                 </div>
                 <div className="grid gap-6">
                    {history.length === 0 ? (
                      <div className="py-48 text-center text-gray-200 border-2 border-dashed border-gray-100 rounded-[50px]"><HistoryIcon className="w-24 h-24 mx-auto mb-6 opacity-30" /><p className="font-black text-sm uppercase tracking-[0.3em]">Vault Access Restricted: Empty</p></div>
                    ) : history.map(item => (
                      <div key={item.id} className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-xl hover:shadow-2xl transition-all flex items-center gap-8 group">
                        <button onClick={() => item.audioUrl && new Audio(item.audioUrl).play()} className="w-20 h-20 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center shadow-2xl active:scale-95 group-hover:scale-105 transition-all"><Play className="w-10 h-10 fill-current ml-1" /></button>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-black text-gray-900 truncate text-2xl tracking-tighter mb-1">{item.fileName}</h4>
                           <div className="flex items-center gap-4">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{item.voiceName}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                          <a href={item.audioUrl} download={item.fileName} className="p-5 bg-gray-900 text-white rounded-[24px] hover:bg-black transition-all shadow-xl hover:-translate-y-1"><Download className="w-6 h-6" /></a>
                          {item.srtUrl && <a href={item.srtUrl} download={item.fileName.replace('.mp3', '.srt')} className="p-5 bg-blue-600 text-white rounded-[24px] hover:bg-blue-700 transition-all shadow-xl hover:-translate-y-1"><FileText className="w-6 h-6" /></a>}
                          {item.videoUrl && <a href={item.videoUrl} download={item.fileName.replace('.mp3', '.mp4')} className="p-5 bg-purple-600 text-white rounded-[24px] hover:bg-purple-700 transition-all shadow-xl hover:-translate-y-1"><Video className="w-6 h-6" /></a>}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-12 animate-in fade-in duration-700">
                 <div className="flex items-center justify-between">
                   <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Intelligence Engine</h2>
                   <button onClick={() => setAnalytics(INITIAL_ANALYTICS)} className="px-6 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase border border-gray-100 hover:bg-white transition-all">Reset Stats</button>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      { l: 'Total Produced', v: analytics.totalGenerated, i: ActivityIcon, c: 'bg-indigo-50 text-indigo-600' },
                      { l: 'Success Cycles', v: analytics.totalSuccess, i: SuccessIcon, c: 'bg-emerald-50 text-emerald-600' },
                      { l: 'Mean Lead Time', v: `${analyticsStats.avgLeadTime.toFixed(1)}s`, i: Gauge, c: 'bg-blue-50 text-blue-600' },
                      { l: 'Units Encoded', v: analytics.totalCharacters.toLocaleString(), i: ZapIcon, c: 'bg-amber-50 text-amber-600' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white border border-gray-100 p-10 rounded-[50px] shadow-sm flex flex-col items-center text-center group hover:border-indigo-200 transition-all">
                         <div className={`p-6 ${stat.c} rounded-[28px] mb-6 group-hover:scale-110 transition-transform`}><stat.i className="w-10 h-10" /></div>
                         <p className="text-5xl font-black text-gray-900 tracking-tighter leading-none">{stat.v}</p>
                         <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mt-4">{stat.l}</p>
                      </div>
                    ))}
                 </div>

                 <div className="bg-gray-900 p-16 rounded-[60px] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
                    <div className="relative z-10">
                       <div className="flex items-center justify-between mb-12">
                          <div>
                            <h3 className="text-2xl font-black tracking-tighter uppercase leading-none">Infrastructure Quota</h3>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.3em] mt-3">Active Unit Telemetry</p>
                          </div>
                          <span className="text-4xl font-black text-indigo-400">{characterUsagePercentage.toFixed(1)}%</span>
                       </div>
                       <div className="h-8 w-full bg-white/5 rounded-full overflow-hidden p-1.5 border border-white/10 shadow-inner">
                          <div 
                             className={`h-full rounded-full transition-all duration-1000 relative ${characterUsagePercentage > 90 ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.5)]'}`}
                             style={{ width: `${characterUsagePercentage}%` }}
                          >
                             <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
                          </div>
                       </div>
                       <div className="flex justify-between mt-8">
                          <div>
                             <p className="text-5xl font-black tracking-tighter">{subscription?.character_count.toLocaleString() || '0'}</p>
                             <p className="text-[10px] text-gray-500 font-black uppercase mt-2 tracking-widest">CONSUMED UNITS</p>
                          </div>
                          <div className="text-right">
                             <p className="text-5xl font-black text-gray-800">{subscription?.character_limit.toLocaleString() || '---'}</p>
                             <p className="text-[10px] text-gray-600 font-black uppercase mt-2 tracking-widest">ALLOCATED CAPACITY</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-12 animate-in fade-in duration-700">
                 <div className="flex items-center gap-4">
                   <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl"><Settings2 className="text-white w-8 h-8" /></div>
                   <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase leading-none">Kernel Configuration</h2>
                 </div>
                 <div className="bg-white border-2 border-gray-100 p-16 rounded-[60px] shadow-2xl space-y-12 max-w-4xl">
                    <div className="space-y-10">
                       <div className="space-y-4">
                         <label className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block ml-4">Master API Access Link (xi-api-key)</label>
                         <div className="relative group">
                            <input 
                              type="password" 
                              value={apiKey} 
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="xi-api-key-master"
                              className="w-full p-8 bg-gray-50 border-4 border-transparent focus:border-indigo-500 rounded-[35px] font-mono text-xl outline-none transition-all shadow-inner group-hover:bg-white" 
                            />
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-3">
                               {keyValidationStatus === 'success' && <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>}
                               {keyValidationStatus === 'error' && <div className="p-2 bg-red-50 text-red-600 rounded-xl"><ShieldAlert className="w-6 h-6" /></div>}
                            </div>
                         </div>
                       </div>
                       <button onClick={validateKey} disabled={isValidatingKey || !apiKey} className="w-full bg-indigo-600 text-white py-8 rounded-[35px] font-black text-xl uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-2xl shadow-indigo-100 flex items-center justify-center gap-6 transition-all active:scale-[0.98]">
                          {isValidatingKey ? <Loader2 className="w-8 h-8 animate-spin" /> : <ZapIcon className="w-8 h-8" />}
                          AUTHORIZE SYSTEM KERNEL
                       </button>
                    </div>
                 </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {isScheduling && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[200] p-6 animate-in fade-in duration-500">
           <div className="bg-white rounded-[60px] p-16 max-w-2xl w-full shadow-2xl relative animate-in zoom-in duration-300">
              <button onClick={() => setIsScheduling(false)} className="absolute top-12 right-12 text-gray-300 hover:text-red-500 transition-all"><X className="w-10 h-10" /></button>
              <div className="text-center mb-12">
                 <div className="inline-block p-6 bg-amber-50 rounded-[35px] mb-6 shadow-xl"><AlarmClock className="w-16 h-16 text-amber-500" /></div>
                 <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">Temporal Scheduler</h3>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-4">Assign synthesis tasks to future temporal slots</p>
              </div>
              <div className="space-y-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Job Label</label>
                    <input type="text" value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="Batch operation name..." className="w-full p-6 bg-gray-50 border-4 border-transparent focus:border-amber-400 rounded-[30px] font-bold text-lg outline-none shadow-inner transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">Execution Window</label>
                    <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full p-6 bg-gray-50 border-4 border-transparent focus:border-amber-400 rounded-[30px] font-bold text-lg outline-none shadow-inner transition-all" />
                 </div>
                 <button onClick={() => {
                   const execTime = new Date(scheduleTime).getTime();
                   if (isNaN(execTime) || execTime <= Date.now()) { alert("Please select a future slot."); return; }
                   const textToSchedule = inputMode === 'simple' ? manualText : storyScript;
                   if (!textToSchedule.trim()) return;
                   const newTask: TTSTask = {
                     id: crypto.randomUUID(), text: textToSchedule, language: Language.AUTO, voiceId: selectedVoiceId, voiceName: voices.find(v => v.voice_id === selectedVoiceId)?.name || "Default",
                     settings: { 
                        ...globalSettings,
                        extraFeatures: { ...globalSettings.extraFeatures, suggestedMood: aiRecommendation?.suggestedMood } 
                     }, 
                     status: TaskStatus.PENDING, progress: 0, createdAt: Date.now(), fileName: generateFileName(textToSchedule), retryCount: 0,
                     destinations: { ...selectedDestinations }, uploadStatuses: { googleDrive: UploadStatus.IDLE, youtube: UploadStatus.IDLE }
                   };
                   setScheduledJobs(prev => [...prev, { id: crypto.randomUUID(), name: scheduleName || 'Job', tasks: [newTask], executeAt: execTime, status: 'PENDING', notifyOnCompletion: true }]);
                   setIsScheduling(false);
                 }} className="w-full bg-amber-500 text-white py-8 rounded-[35px] font-black text-xl uppercase tracking-[0.2em] shadow-2xl shadow-amber-100 hover:bg-amber-600 transition-all active:scale-95">COMMIT TO TEMPORAL QUEUE</button>
              </div>
           </div>
        </div>
      )}

      {showCloningModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[200] p-6 animate-in fade-in duration-500">
           <div className="bg-white rounded-[60px] p-10 sm:p-14 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in duration-300">
             <button onClick={() => !isCloning && setShowCloningModal(false)} className="absolute top-10 right-10 text-gray-300 hover:text-red-500 transition-all" disabled={isCloning}><X className="w-10 h-10" /></button>
             
             <div className="flex items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl w-fit mx-auto mb-10">
                <button onClick={() => setCloningTab('create')} className={`px-8 py-3.5 text-[11px] font-black rounded-xl flex items-center gap-3 transition-all ${cloningTab === 'create' ? 'bg-white shadow-xl text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><ZapIcon className="w-4 h-4" /> CREATE VECTOR</button>
                <button onClick={() => setCloningTab('manage')} className={`px-8 py-3.5 text-[11px] font-black rounded-xl flex items-center gap-3 transition-all ${cloningTab === 'manage' ? 'bg-white shadow-xl text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><Database className="w-4 h-4" /> MANAGE CLONES</button>
             </div>

             {cloningTab === 'create' ? (
               <div className="space-y-10">
                  <div className="text-center">
                    <div className="inline-block p-6 bg-indigo-50 rounded-[40px] mb-6 shadow-xl"><Mic className="w-14 h-14 text-indigo-600" /></div>
                    <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">Instant Replication</h3>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-4">Provide voice samples for neural synthesis</p>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-5">Vector Label</label>
                       <input 
                         type="text" 
                         placeholder="e.g., Corporate Narrator A" 
                         value={cloningName} 
                         onChange={(e) => setCloningName(e.target.value)} 
                         disabled={isCloning}
                         className="w-full p-6 bg-gray-50 border-4 border-transparent focus:border-indigo-400 rounded-[35px] font-bold text-lg outline-none shadow-inner transition-all disabled:opacity-50" 
                       />
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-5">Voice Samples (MP3/WAV)</label>
                       <label className={`w-full py-16 border-4 border-dashed rounded-[45px] flex flex-col items-center justify-center gap-6 cursor-pointer transition-all group ${isCloning ? 'opacity-50 pointer-events-none' : 'border-gray-100 hover:bg-gray-50 hover:border-indigo-200'}`}>
                          <div className="p-6 bg-gray-100 rounded-[30px] group-hover:bg-indigo-50 transition-colors"><Upload className="w-10 h-10 text-gray-400 group-hover:text-indigo-600" /></div>
                          <div className="text-center">
                            <span className="text-[13px] font-black uppercase text-gray-400 tracking-widest group-hover:text-indigo-600 block mb-1">Transmit Neural Data</span>
                            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">Total Limit: 25MB across all samples</span>
                          </div>
                          <input type="file" multiple accept="audio/*" onChange={(e) => e.target.files && setCloningSamples(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
                       </label>
                    </div>

                    {cloningSamples.length > 0 && (
                      <div className="space-y-4 animate-in slide-in-from-top-4">
                         <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center justify-between ml-2">
                            <span>Ready for Ingestion ({cloningSamples.length})</span>
                            <button onClick={() => setCloningSamples([])} className="text-red-400 hover:text-red-600">Clear All</button>
                         </h4>
                         <div className="grid gap-3 max-h-56 overflow-y-auto pr-2 thin-scrollbar">
                            {cloningSamples.map((file, idx) => (
                              <div key={idx} className="bg-gray-50 border border-gray-100 p-5 rounded-[28px] flex items-center justify-between group/item">
                                 <div className="flex items-center gap-4">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><FileAudio className="w-5 h-5" /></div>
                                    <div>
                                       <p className="text-xs font-black text-gray-800 truncate max-w-[200px] leading-none mb-1">{file.name}</p>
                                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                 </div>
                                 <button onClick={() => removeCloningSample(idx)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover/item:opacity-100 transition-all"><X className="w-5 h-5" /></button>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}

                    {isCloning ? (
                      <div className="space-y-8 p-10 bg-gray-900 rounded-[50px] shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px]" />
                         <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                               <div className="flex items-center gap-4">
                                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                                  <div>
                                     <p className="text-[11px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">{cloningStatus}</p>
                                     <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Establishing permanent neural link...</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Time to Sync</p>
                                  <p className="text-xl font-black text-white font-mono">{cloningETA}s</p>
                               </div>
                            </div>
                            <div className="h-5 w-full bg-white/5 rounded-full overflow-hidden p-1 shadow-inner border border-white/10">
                               <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-700 rounded-full transition-all duration-700 relative" style={{ width: `${cloningProgress}%` }}>
                                  <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                               </div>
                            </div>
                            <div className="flex justify-between mt-4">
                               <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">INGESTION PROGRESS</span>
                               <span className="text-[11px] font-black text-indigo-400">{cloningProgress}%</span>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <button 
                        onClick={handleCloningAction} 
                        disabled={!cloningName || cloningSamples.length === 0} 
                        className="w-full bg-indigo-600 text-white py-8 rounded-[40px] font-black text-xl uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6"
                      >
                        <ZapIcon className="w-8 h-8" /> INITIATE REPLICATION
                      </button>
                    )}

                    {cloningError && (
                      <div className="p-6 bg-red-50 border-2 border-red-100 rounded-[35px] flex items-center gap-5 animate-in shake">
                         <div className="p-3 bg-red-100 text-red-600 rounded-2xl"><TriangleAlert className="w-8 h-8" /></div>
                         <p className="text-xs font-black text-red-600 uppercase leading-relaxed">{cloningError}</p>
                      </div>
                    )}
                  </div>
               </div>
             ) : (
               <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="text-center mb-10">
                    <div className="inline-block p-6 bg-indigo-50 rounded-[40px] mb-6 shadow-xl"><Database className="w-14 h-14 text-indigo-600" /></div>
                    <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">Vector Management</h3>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-4">Review and maintain neural voice signatures</p>
                  </div>

                  <div className="grid gap-6">
                     {clonedVoices.length === 0 ? (
                       <div className="py-24 text-center text-gray-200 bg-gray-50 rounded-[50px] border-4 border-dashed border-gray-100">
                          <Fingerprint className="w-20 h-20 mx-auto mb-6 opacity-20" />
                          <p className="font-black text-[12px] uppercase tracking-[0.4em]">No Active Clones</p>
                       </div>
                     ) : clonedVoices.map(voice => (
                       <div key={voice.voice_id} className="bg-white border-2 border-gray-100 p-8 rounded-[45px] shadow-lg hover:border-indigo-200 transition-all flex items-center justify-between group">
                          <div className="flex items-center gap-8">
                             <div className="w-20 h-20 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center shadow-xl group-hover:scale-105 transition-all">
                                <Mic className="w-10 h-10" />
                             </div>
                             <div>
                                <h4 className="text-2xl font-black text-gray-900 tracking-tighter leading-none mb-2">{voice.name}</h4>
                                <div className="flex items-center gap-3">
                                   <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg tracking-widest">{voice.category}</span>
                                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono">NODE: {voice.voice_id.slice(0, 8)}</span>
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => { setSelectedVoiceId(voice.voice_id); setShowCloningModal(false); }} className="px-8 py-4 bg-gray-900 text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:bg-black shadow-xl transition-all">SELECT</button>
                             <button onClick={() => deleteClonedVoiceAction(voice.voice_id)} className="p-4 bg-gray-50 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-[24px] transition-all"><Trash2 className="w-7 h-7" /></button>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
             )}
           </div>
        </div>
      )}

      {showApiModal && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl flex items-center justify-center z-[250] p-6">
          <div className="bg-white rounded-[70px] p-20 max-w-2xl w-full shadow-2xl text-center animate-in zoom-in duration-500">
            <div className="p-10 bg-indigo-50 rounded-[45px] w-fit mx-auto mb-12 shadow-2xl ring-8 ring-indigo-50/50">
               <Sparkles className="text-indigo-600 w-24 h-24" />
            </div>
            <h3 className="text-5xl font-black mb-6 tracking-tighter uppercase leading-none">Authentication</h3>
            <p className="text-gray-400 font-bold text-[11px] uppercase tracking-[0.4em] mb-16">System requires valid ElevenLabs Master Key to engage.</p>
            <input type="password" placeholder="xi-api-key-master" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full p-8 bg-gray-50 border-4 border-transparent focus:border-indigo-500 rounded-[40px] mb-16 text-center text-3xl font-black outline-none shadow-inner tracking-widest" />
            <button onClick={() => saveApiKey(apiKey)} className="w-full bg-indigo-600 text-white py-10 rounded-[40px] font-black text-2xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 tracking-[0.2em]">ENGAGE CORE KERNEL</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        .animate-shimmer { animation: shimmer 2s infinite linear; }
        .thin-scrollbar::-webkit-scrollbar { width: 4px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .bg-gray-950::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-in.shake { animation: shake 0.2s ease-in-out 0s 2; }
        .appearance-none { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
};

const ZapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m11 13-3 5h6l-3 5"/></svg>
);

export default App;
