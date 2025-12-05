// Firebase Configuration and Initialization
// Re-export from the main firebase.ts file to ensure singleton instances
import { app, auth, db, storage, FirebaseConfig } from './firebase';

export { app, auth, db, storage };
export type { FirebaseConfig };
