
import { Voice, VoiceSettings, UserSubscription } from "../types";

export const fetchVoices = async (apiKey: string): Promise<Voice[]> => {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey }
  });
  if (!response.ok) throw new Error("Failed to fetch voices");
  const data = await response.json();
  return data.voices;
};

export const fetchSubscription = async (apiKey: string): Promise<UserSubscription> => {
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey }
  });
  if (!response.ok) throw new Error("Invalid API Key or server error");
  return await response.json();
};

export const generateTTS = async (
  apiKey: string,
  text: string,
  voiceId: string,
  settings: VoiceSettings
): Promise<Blob> => {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text,
      model_id: settings.model_id || "eleven_multilingual_v2",
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
        style: settings.style,
        use_speaker_boost: settings.use_speaker_boost
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail?.message || "TTS Generation failed");
  }

  return await response.blob();
};

export const cloneVoice = async (
  apiKey: string,
  name: string,
  samples: File[]
): Promise<{ voice_id: string }> => {
  const formData = new FormData();
  formData.append("name", name);
  samples.forEach((file) => {
    formData.append("files", file);
  });
  formData.append("description", "Cloned via Vocalize AI");

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail?.message || "Voice cloning failed");
  }

  return await response.json();
};

export const deleteVoice = async (apiKey: string, voiceId: string): Promise<void> => {
  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": apiKey
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail?.message || "Failed to delete voice");
  }
};
