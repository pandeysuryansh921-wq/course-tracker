import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.degreetrack.quiz',
  appName: 'DegreeTrack & Quiz',
  webDir: 'out',
  plugins: {
    GoogleSignIn: {
      serverClientId: '551545873819-aej3m8g3jsraald03s0ep86267v80phr.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
