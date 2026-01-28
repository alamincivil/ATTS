
/**
 * Mocking Cloud Services for Google Drive and YouTube.
 * In a real-world scenario, these would use valid OAuth2 access tokens.
 */

export const uploadToGoogleDrive = async (audioBlob: Blob, fileName: string): Promise<string> => {
  // Real implementation would use: https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
  console.log(`[CloudService] Uploading ${fileName} to Google Drive...`);
  
  // Simulating network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock success probability
  if (Math.random() > 0.1) {
    return "drive_file_id_mock_123";
  } else {
    throw new Error("Google Drive API: Quota exceeded or connection lost.");
  }
};

export const uploadToYouTube = async (audioBlob: Blob, text: string, fileName: string): Promise<string> => {
  // YouTube requires a video file. In a real app, we'd combine audio + image on the client or server.
  // Real implementation would use: https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status
  console.log(`[CloudService] Uploading ${fileName} as audio-video to YouTube...`);
  
  await new Promise(resolve => setTimeout(resolve, 3500));
  
  if (Math.random() > 0.15) {
    return "youtube_video_id_mock_456";
  } else {
    throw new Error("YouTube API: Invalid video format or authentication error.");
  }
};
