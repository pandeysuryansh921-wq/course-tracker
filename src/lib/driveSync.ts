import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { db } from '@/lib/db';
import { exportDB, importInto } from 'dexie-export-import';

const BACKUP_FILE_NAME = 'degreetrack_backup.json';

let isInitialized = false;

const initGoogle = async () => {
  if (isInitialized) return;
  await GoogleSignIn.initialize({
    clientId: '551545873819-aej3m8g3jsraald03s0ep86267v80phr.apps.googleusercontent.com',
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
  });
  isInitialized = true;
};

// Get a valid access token
const getAccessToken = async () => {
  try {
    await initGoogle();
    const result = await GoogleSignIn.signIn();
    
    if (!result.accessToken) {
      throw new Error("No access token returned from Google Sign-In");
    }
    saveUserLocally(result);
    return { token: result.accessToken, user: result };
  } catch (err: any) {
    console.error("Google SignIn Error:", err);
    throw new Error(err.message || "Failed to authenticate with Google");
  }
};

// Check if a backup exists in appDataFolder
const getExistingBackupId = async (accessToken: string) => {
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILE_NAME}'&fields=files(id,modifiedTime)`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check Drive for backups: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
};

export const syncToGoogleDrive = async (onProgress: (status: string) => void) => {
  onProgress('Authenticating with Google...');
  const { token } = await getAccessToken();

  onProgress('Exporting local database...');
  const blob = await exportDB(db, { prettyJson: true });
  
  onProgress('Preparing upload...');
  const existingFile = await getExistingBackupId(token);
  
  const metadata = {
    name: BACKUP_FILE_NAME,
    parents: ['appDataFolder']
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  onProgress('Uploading to Google Drive...');
  
  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  if (existingFile && existingFile.id) {
    // Overwrite existing file instead of creating duplicate
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    method = 'PATCH';
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  onProgress('Backup completed successfully!');
};

export const restoreFromGoogleDrive = async (onProgress: (status: string) => void) => {
  onProgress('Authenticating with Google...');
  const { token } = await getAccessToken();

  onProgress('Searching for backup...');
  const fileInfo = await getExistingBackupId(token);

  if (!fileInfo || !fileInfo.id) {
    throw new Error("No backup found on Google Drive.");
  }

  onProgress('Downloading backup...');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileInfo.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const blob = await response.blob();

  onProgress('Importing database (this may take a moment)...');
  await importInto(db, blob, { 
    clearTablesBeforeImport: true, 
    overwriteValues: true 
  });

  onProgress('Restore completed! Refreshing app...');
  // Reload the page to reflect new DB state
  setTimeout(() => window.location.reload(), 1000);
};

export const checkLastBackupTime = async () => {
  try {
    const userStr = localStorage.getItem('driveUser');
    if (userStr) {
      return { user: JSON.parse(userStr) };
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const saveUserLocally = (user: any) => {
  localStorage.setItem('driveUser', JSON.stringify({ name: user.displayName || 'User', email: user.email, imageUrl: user.imageUrl }));
};

export const signOutGoogle = async () => {
  try {
    await initGoogle();
    await GoogleSignIn.signOut();
    localStorage.removeItem('driveUser');
  } catch(e) {}
};
