
export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum UploadStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export enum Language {
  ENGLISH = 'English',
  BENGALI = 'Bengali',
  AUTO = 'Auto-Detect'
}

export enum VoiceEffect {
  NONE = 'None',
  ROBOTIC = 'Robotic',
  ECHO = 'Echo',
  WHISPER = 'Whisper',
  REVERB = 'Reverb',
  NOISE_REDUCTION = 'Noise Reduction'
}

export enum NamingConvention {
  TIMESTAMP = 'Timestamp',
  TEXT_PREVIEW = 'Text Preview',
  CUSTOM_PREFIX = 'Custom Prefix',
  ROW_INDEX = 'Row Index'
}

export interface AnalyticsData {
  totalGenerated: number;
  totalWords: number;
  totalCharacters: number;
  totalSuccess: number;
  totalFailed: number;
  totalProcessingTimeMs: number;
  lastResetAt: number;
}

export interface UserSubscription {
  tier: string;
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
  next_character_count_reset_unix: number;
  voice_limit: number;
  max_can_use_delayed_payment_pro_tier_plan_until_unix: number;
}

export interface CharacterVoice {
  id: string;
  name: string;
  voiceId: string;
  voiceName: string;
}

export interface DialogueSegment {
  id: string;
  characterId: string;
  voiceId: string;
  voiceName: string;
  text: string;
}

export interface ExtraFeatures {
  generateSubtitles: boolean;
  generateVideo: boolean; 
  voiceEffect: VoiceEffect;
  backgroundMusic: boolean;
  aiComposerMode: boolean;
  suggestedMood?: string;
  bgMusicVolume: number;
  bgMusicTrackId?: string;
  bgMusicTrackName?: string;
  isStoryMode?: boolean;
}

export interface Voice {
  voice_id: string;
  name: string;
  preview_url: string;
  labels: Record<string, string>;
  category: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed?: number;
  pitch?: number;
  normalize: boolean;
  trimSilence: boolean;
  maxClipDuration: number;
  extraFeatures: ExtraFeatures;
  model_id: string; // New: Selected neural model
}

export interface VoicePreset {
  id: string;
  name: string;
  voiceId: string;
  voiceName: string;
  model_id: string;
  settings: VoiceSettings;
}

export interface TTSTask {
  id: string;
  text: string;
  language: Language;
  voiceId: string;
  voiceName: string;
  settings: VoiceSettings;
  status: TaskStatus;
  progress: number;
  audioUrl?: string;
  videoUrl?: string;
  srtUrl?: string;
  error?: string;
  errorLog?: string[];
  retryCount: number;
  startTime?: number;
  estimatedRemainingSeconds?: number;
  createdAt: number;
  fileName: string;
  segments?: DialogueSegment[]; 
  destinations: {
    local: boolean;
    googleDrive: boolean;
    youtube: boolean;
  };
  uploadStatuses: {
    googleDrive: UploadStatus;
    youtube: UploadStatus;
  };
}

export interface HistoryItem extends TTSTask {
  downloadCount: number;
  lastUsedAt: number;
}

export interface ScheduledJob {
  id: string;
  name: string;
  tasks: TTSTask[];
  executeAt: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  notifyOnCompletion: boolean;
}
