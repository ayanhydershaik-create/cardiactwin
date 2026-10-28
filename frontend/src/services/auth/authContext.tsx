import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthState, UserProfile } from '../../types/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInDemoResearch: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'cardiac_twin_session_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If Firebase Auth is initialized, listen to live auth state changes
    if (auth && isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(
        auth,
        (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            const mappedUser: UserProfile = {
              uid: fbUser.uid,
              displayName: fbUser.displayName || 'Authorized Investigator',
              email: fbUser.email,
              photoURL: fbUser.photoURL,
              isDemoUser: false,
            };
            setUser(mappedUser);
            try {
              sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(mappedUser));
            } catch {
              // Ignore session storage error
            }
          } else {
            // Check if demo user is stored in session
            try {
              const stored = sessionStorage.getItem(LOCAL_USER_KEY);
              if (stored) {
                const parsed: UserProfile = JSON.parse(stored);
                if (parsed.isDemoUser) {
                  setUser(parsed);
                } else {
                  setUser(null);
                }
              } else {
                setUser(null);
              }
            } catch {
              setUser(null);
            }
          }
          setIsLoading(false);
        },
        (authErr) => {
          console.error('Firebase Auth observer error:', authErr);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      // Demo session fallback when Firebase is not configured
      try {
        const stored = sessionStorage.getItem(LOCAL_USER_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch {
        // storage unavailable
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const signInWithGoogle = async () => {
    setError(null);

    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setError(
        'Firebase Google Sign-In is not configured yet. Set VITE_FIREBASE_API_KEY and credentials in frontend/.env, or use Local Investigator Sign-In.'
      );
      return;
    }

    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const mappedUser: UserProfile = {
        uid: fbUser.uid,
        displayName: fbUser.displayName || 'Authorized Investigator',
        email: fbUser.email,
        photoURL: fbUser.photoURL,
        isDemoUser: false,
      };
      setUser(mappedUser);
      sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(mappedUser));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signInDemoResearch = () => {
    const demoUser: UserProfile = {
      uid: 'investigator-demo-01',
      displayName: 'Cardiology Investigator (Demo)',
      email: 'investigator@cardiac-digital-twin.local',
      photoURL: null,
      isDemoUser: true,
    };
    setUser(demoUser);
    setError(null);
    try {
      sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoUser));
    } catch {
      // ignore
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      if (auth && isFirebaseConfigured) {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.warn('Firebase sign-out warning:', err);
    } finally {
      setUser(null);
      try {
        sessionStorage.removeItem(LOCAL_USER_KEY);
      } catch {
        // ignore
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isConfigured: isFirebaseConfigured,
        signInWithGoogle,
        signInDemoResearch,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
