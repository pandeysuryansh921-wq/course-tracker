import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { db } from '@/lib/db';
import { exportDB, importInto } from 'dexie-export-import';

export const GOOGLE_WEB_CLIENT_ID = '551545873819-aej3m8g3jsraald03s0ep86267v80phr.apps.googleusercontent.com';
export const SCOPE_BACKUP = 'https://www.googleapis.com/auth/drive.appdata';
export const SCOPE_COURSE_LIBRARY = 'https://www.googleapis.com/auth/drive.readonly';

const BACKUP_FILE_NAME = 'degreetrack_backup.json';

let currentInitializedScope: string | null = null;

const initGoogleScope = async (scope: string) => {
  if (currentInitializedScope === scope) return;
  await GoogleSignIn.initialize({
    clientId: GOOGLE_WEB_CLIENT_ID,
    scopes: [scope],
  });
  currentInitializedScope = scope;
};

const initGoogle = async () => {
  await initGoogleScope(SCOPE_BACKUP);
};

// Common debug logging helper
const logAuthError = (flow: string, err: any) => {
  if (
    process.env.NODE_ENV !== 'production' ||
    (typeof window !== 'undefined' &&
      (Boolean((window as any).__DEV__) || localStorage.getItem('degreetrack_debug_auth') === 'true'))
  ) {
    console.group?.(`[GoogleSignIn Debug] Native Authentication Error (${flow})`);
    console.error('[GoogleSignIn Debug] Message:', err?.message);
    console.error('[GoogleSignIn Debug] Code:', err?.code);
    console.error('[GoogleSignIn Debug] Name:', err?.name);
    console.error('[GoogleSignIn Debug] Stack:', err?.stack);
    console.error('[GoogleSignIn Debug] Plugin/Native Details:', {
      flow,
      code: err?.code,
      message: err?.message,
      data: err?.data,
      errorMessage: err?.errorMessage,
      cause: err?.cause,
      raw: err,
    });
    console.groupEnd?.();
  } else {
    console.error(`Google SignIn Error (${flow}):`, err);
  }

  const errCodePrefix = err?.code ? `[${err.code}] ` : '';
  const formattedMessage = err?.message
    ? (err.message.includes(`[${err.code}]`) ? err.message : `${errCodePrefix}${err.message}`)
    : (errCodePrefix || 'Failed to authenticate with Google');

  const errorToThrow = new Error(formattedMessage);
  (errorToThrow as any).code = err?.code;
  (errorToThrow as any).originalError = err;
  return errorToThrow;
};

// Get a valid access token for Backup & Sync (drive.appdata)
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
    throw logAuthError('Backup & Sync', err);
  }
};

export const getBackupAccessToken = getAccessToken;

// Get a valid access token for Course Library (drive.readonly)
export const getCourseLibraryAccessToken = async (forcePrompt = false) => {
  try {
    // Check cached token if fresh
    const cachedToken = getCachedCourseLibraryToken();
    if (cachedToken && !forcePrompt) {
      return { token: cachedToken, user: getCourseLibraryUser() };
    }

    await initGoogleScope(SCOPE_COURSE_LIBRARY);
    const result = await GoogleSignIn.signIn();

    if (!result.accessToken) {
      throw new Error("No access token returned from Google Sign-In for Course Library");
    }

    saveCourseLibraryUser(result, result.accessToken);
    return { token: result.accessToken, user: result };
  } catch (err: any) {
    throw logAuthError('Course Library', err);
  }
};

export const getCachedCourseLibraryToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('courseLibraryToken');
  const expiry = localStorage.getItem('courseLibraryTokenExpiry');
  if (token && expiry) {
    const expiresAt = Number(expiry);
    // 5 minutes safety buffer
    if (Date.now() < expiresAt - 300000) {
      return token;
    }
  }
  return token || null;
};

export const getCourseLibraryUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('courseLibraryUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveCourseLibraryUser = (user: any, token?: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    'courseLibraryUser',
    JSON.stringify({
      name: user.displayName || user.name || 'Google User',
      email: user.email,
      imageUrl: user.imageUrl,
      connectedAt: new Date().toISOString(),
    })
  );
  if (token) {
    localStorage.setItem('courseLibraryToken', token);
    // Typical Google access token lasts 3600 seconds
    localStorage.setItem('courseLibraryTokenExpiry', String(Date.now() + 3600 * 1000));
  }
};

export const disconnectCourseLibrary = async () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('courseLibraryUser');
  localStorage.removeItem('courseLibraryToken');
  localStorage.removeItem('courseLibraryTokenExpiry');
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
