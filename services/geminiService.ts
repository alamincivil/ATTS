
import { GoogleGenAI, Type } from "@google/genai";
import { Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface OptimizationResult {
  language: Language;
  suggestedStability: number;
  suggestedSimilarity: number;
  suggestedSpeed: number;
  suggestedPitch: number;
  suggestedMood: string; // New property
  reasoning: string;
}

export const detectLanguageAndOptimize = async (text: string): Promise<OptimizationResult> => {
  if (!text.trim()) {
    return {
      language: Language.ENGLISH,
      suggestedStability: 0.5,
      suggestedSimilarity: 0.75,
      suggestedSpeed: 1.0,
      suggestedPitch: 1.0,
      suggestedMood: "Ambient",
      reasoning: "No text provided."
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the following text for a professional TTS broadcast. 
    1. Determine if it is Bengali or English. 
    2. Suggest optimal TTS settings (stability, similarity, speed, pitch).
    3. Categorize the TEXT SENTIMENT into one of these musical moods: 'Inspirational', 'Dramatic/Suspenseful', 'Upbeat/Energetic', 'Melancholic/Sad', 'Corporate/Clean', 'Cinematic/Epic', or 'Calm/Ambient'.
    
    Text: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING, description: "Either 'Bengali' or 'English'" },
          suggestedStability: { type: Type.NUMBER },
          suggestedSimilarity: { type: Type.NUMBER },
          suggestedSpeed: { type: Type.NUMBER },
          suggestedPitch: { type: Type.NUMBER },
          suggestedMood: { type: Type.STRING, description: "The musical mood category" },
          reasoning: { type: Type.STRING }
        },
        required: ["language", "suggestedStability", "suggestedSimilarity", "suggestedSpeed", "suggestedPitch", "suggestedMood", "reasoning"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return {
      language: data.language === 'Bengali' ? Language.BENGALI : Language.ENGLISH,
      suggestedStability: data.suggestedStability,
      suggestedSimilarity: data.suggestedSimilarity,
      suggestedSpeed: data.suggestedSpeed,
      suggestedPitch: data.suggestedPitch,
      suggestedMood: data.suggestedMood,
      reasoning: data.reasoning
    };
  } catch (e) {
    const isBengali = /[\u0980-\u09FF]/.test(text);
    return {
      language: isBengali ? Language.BENGALI : Language.ENGLISH,
      suggestedStability: 0.5,
      suggestedSimilarity: 0.75,
      suggestedSpeed: 1.0,
      suggestedPitch: 1.0,
      suggestedMood: "Calm/Ambient",
      reasoning: "Fallback detection used."
    };
  }
};
