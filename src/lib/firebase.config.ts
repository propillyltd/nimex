// Firebase Configuration and Initialization
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { logger } from './logger';

// Firebase configuration interface
interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
}

// Check if we're in Node.js environment (for testing)
const isNode = typeof window === 'undefined';

/**
 * Get environment variable from either browser or Node.js environment
 */
const getEnvVar = (name: string): string => {
    let value: string | undefined;

    if (isNode) {
        // In Node.js, use process.env
        value = process.env[name];
    } else {
        // In browser, use import.meta.env
        value = (import.meta as any).env?.[name];
    }

    if (!value) {
        logger.warn(`Missing Firebase environment variable: ${name}`);
        return '';
    }
    return value;
};

// Firebase configuration from environment variables
const firebaseConfig: FirebaseConfig = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID'),
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID') || undefined,
};

// Validate configuration
const isConfigValid = (): boolean => {
    const requiredFields: (keyof FirebaseConfig)[] = [
        'apiKey',
        'authDomain',
        'projectId',
        'storageBucket',
        'messagingSenderId',
        'appId',
    ];

    for (const field of requiredFields) {
        if (!firebaseConfig[field]) {
            logger.error(`Missing required Firebase config: ${field}`);
            return false;
        }
    }
    return true;
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
    if (isConfigValid()) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);

        logger.info('Firebase initialized successfully', {
            projectId: firebaseConfig.projectId,
        });
    } else {
        logger.error('Firebase configuration is invalid');
        throw new Error('Invalid Firebase configuration');
    }
} catch (error) {
    logger.error('Failed to initialize Firebase', error);
    throw error;
}

// Export Firebase instances
export { app, auth, db, storage };
export type { FirebaseConfig };
