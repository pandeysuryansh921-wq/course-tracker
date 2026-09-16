import { Capacitor } from '@capacitor/core';
import { AndroidIntentLauncher } from '@capawesome/capacitor-android-intent-launcher';

export interface StudyContext {
  courseUri: string;
  moduleUri: string;
  topicUri: string;
  topicTitle: string;
  sessionId: string;
}

export const broadcastStudySessionStarted = async (context: StudyContext) => {
  const payload = {
    event: 'STUDY_SESSION_STARTED',
    source: 'ecosystem:learn',
    context,
    timestamp: new Date().toISOString()
  };

  console.log('[Ecosystem] Broadcasting Study Session:', payload);

  if (Capacitor.isNativePlatform()) {
    try {
      await AndroidIntentLauncher.startActivity({
        action: 'com.ecosystem.action.STUDY_SESSION_STARTED',
        extras: {
          'ecosystem_payload': JSON.stringify(payload)
        }
      });
    } catch (e) {
      console.warn('Failed to broadcast ecosystem intent:', e);
    }
  }
};
