import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    User,
    UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logger } from '../lib/logger';


export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    role: 'admin' | 'vendor' | 'buyer' | 'marketer';
    created_at: any;
    updated_at: any;
    avatar_url?: string;
}

class AuthService {
    /**
     * Sign up a new user
     */
    async signUp(
        email: string,
        password: string,
        userData: {
            full_name: string;
            role: UserProfile['role'];
            phone?: string;
        }
    ): Promise<{ user: User; profile: UserProfile }> {
        try {
            // Create user in Firebase Auth
            const userCredential: UserCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );
            const user = userCredential.user;

            // Update display name
            await updateProfile(user, {
                displayName: userData.full_name,
            });

            // Create user profile in Firestore
            const profile: UserProfile = {
                id: user.uid,
                email: user.email!,
                full_name: userData.full_name,
                phone: userData.phone,
                role: userData.role,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            };

            await setDoc(doc(db, 'profiles', user.uid), profile);

            logger.info('User signed up successfully:', user.uid);
            return { user, profile };
        } catch (error: any) {
            logger.error('Error signing up:', error);
            throw new Error(error.message || 'Failed to sign up');
        }
    }

    /**
     * Sign in existing user
     */
    async signIn(email: string, password: string): Promise<{ user: User; profile: UserProfile }> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get user profile
            const profileDoc = await getDoc(doc(db, 'profiles', user.uid));

            if (!profileDoc.exists()) {
                throw new Error('User profile not found');
            }

            const profile = profileDoc.data() as UserProfile;

            logger.info('User signed in successfully:', user.uid);
            return { user, profile };
        } catch (error: any) {
            logger.error('Error signing in:', error);
            throw new Error(error.message || 'Failed to sign in');
        }
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<void> {
        try {
            await firebaseSignOut(auth);
            logger.info('User signed out successfully');
        } catch (error: any) {
            logger.error('Error signing out:', error);
            throw new Error(error.message || 'Failed to sign out');
        }
    }

    /**
     * Send password reset email
     */
    async resetPassword(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(auth, email);
            logger.info('Password reset email sent to:', email);
        } catch (error: any) {
            logger.error('Error sending password reset email:', error);
            throw new Error(error.message || 'Failed to send password reset email');
        }
    }

    /**
     * Get current user profile
     */
    async getCurrentUserProfile(): Promise<UserProfile | null> {
        try {
            const user = auth.currentUser;
            if (!user) return null;

            const profileDoc = await getDoc(doc(db, 'profiles', user.uid));

            if (!profileDoc.exists()) {
                return null;
            }

            return profileDoc.data() as UserProfile;
        } catch (error: any) {
            logger.error('Error getting current user profile:', error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
        try {
            await updateDoc(doc(db, 'profiles', userId), {
                ...updates,
                updated_at: serverTimestamp(),
            });

            logger.info('User profile updated:', userId);
        } catch (error: any) {
            logger.error('Error updating user profile:', error);
            throw new Error(error.message || 'Failed to update profile');
        }
    }

    /**
     * Subscribe to auth state changes
     */
    onAuthStateChange(callback: (user: User | null) => void): () => void {
        return onAuthStateChanged(auth, callback);
    }

    /**
     * Get current user
     */
    getCurrentUser(): User | null {
        return auth.currentUser;
    }
}

export const authService = new AuthService();
