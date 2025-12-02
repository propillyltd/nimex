import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { logger } from './logger';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase configuration
const validateConfig = () => {
    const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
    const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

    if (missingKeys.length > 0) {
        logger.error('Missing Firebase configuration keys:', missingKeys);
        throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`);
    }
};

// Initialize Firebase
let app;
let auth;
let db;
let storage;
let analytics: Analytics | null = null;

try {
    validateConfig();

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Initialize Analytics (only in browser environment)
    if (typeof window !== 'undefined') {
        analytics = getAnalytics(app);
    }

    // Connect to emulators in development
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
        connectAuthEmulator(auth, 'http://localhost:9099');
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectStorageEmulator(storage, 'localhost', 9199);
        logger.info('Connected to Firebase emulators');
    }

    logger.info('Firebase initialized successfully');
} catch (error) {
    logger.error('Error initializing Firebase:', error);
    throw error;
}

export { app, auth, db, storage, analytics };
