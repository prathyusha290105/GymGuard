import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile, UserRole, Gym } from '../types';
import { DEMO_USERS, DEMO_GYM_ID, isDatabaseSeeded, seedDemoData } from '../services/seed/seedData';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  currentGym: Gym | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithDemo: (role: 'OWNER' | 'STAFF' | 'MEMBER') => Promise<void>;
  loginWithCredentials: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchGym: (gymId: string) => Promise<void>;
  seedDatabaseIfNeeded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_SESSION_KEY = 'gymguard_active_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentGym, setCurrentGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Auto seed database if not yet populated
  const seedDatabaseIfNeeded = async () => {
    try {
      const seeded = await isDatabaseSeeded();
      if (!seeded) {
        console.log('Database not yet seeded. Seeding demo gym and members...');
        await seedDemoData();
      }
    } catch (err) {
      console.warn('Seed check or seed error:', err);
    }
  };

  const fetchGym = async (gymId: string) => {
    try {
      const gDoc = await getDoc(doc(db, 'gyms', gymId));
      if (gDoc.exists()) {
        setCurrentGym(gDoc.data() as Gym);
        return;
      }
    } catch (e) {
      console.warn('Could not read gym document from Firestore, using default profile', e);
    }
    setCurrentGym({
      gymId: DEMO_GYM_ID,
      name: 'GymGuard Elite Fitness Center',
      address: '742 Evergreen Blvd, Suite 400, Metro City',
      phone: '+1 (555) 382-9901',
      email: 'contact@gymguard-elite.com',
      timezone: 'America/New_York',
      createdAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      await seedDatabaseIfNeeded();

      // Check stored local demo session first
      const stored = localStorage.getItem(DEMO_SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as UserProfile;
          if (isMounted) {
            setCurrentUser(parsed);
            await fetchGym(parsed.gymId || DEMO_GYM_ID);
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(DEMO_SESSION_KEY);
        }
      }

      // Check Firebase Auth state
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;
        setFirebaseUser(user);

        if (user) {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const profile = userDoc.data() as UserProfile;
              setCurrentUser(profile);
              await fetchGym(profile.gymId);
            } else {
              // Create default profile for newly signed-in Firebase user
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                fullName: user.displayName || 'Gym Administrator',
                role: 'GYM_OWNER',
                gymId: DEMO_GYM_ID,
                avatarUrl: user.photoURL || undefined,
                createdAt: new Date().toISOString(),
              };
              await setDoc(doc(db, 'users', user.uid), newProfile);
              setCurrentUser(newProfile);
              await fetchGym(DEMO_GYM_ID);
            }
          } catch (e) {
            console.error('Error fetching/saving user profile', e);
          }
        } else {
          // If neither stored session nor firebase user, default to OWNER for immediate preview usability
          const defaultDemoOwner: UserProfile = {
            uid: 'demo_owner_uid',
            email: DEMO_USERS.OWNER.email,
            fullName: DEMO_USERS.OWNER.fullName,
            role: DEMO_USERS.OWNER.role,
            gymId: DEMO_GYM_ID,
            createdAt: new Date().toISOString(),
          };
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(defaultDemoOwner));
          setCurrentUser(defaultDemoOwner);
          await fetchGym(DEMO_GYM_ID);
        }
        setLoading(false);
      });

      return () => {
        isMounted = false;
        unsubscribe();
      };
    };

    initAuth();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google Sign In Error', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithDemo = async (role: 'OWNER' | 'STAFF' | 'MEMBER') => {
    setLoading(true);
    let profile: UserProfile;
    if (role === 'OWNER') {
      profile = {
        uid: 'demo_owner_uid',
        email: DEMO_USERS.OWNER.email,
        fullName: DEMO_USERS.OWNER.fullName,
        role: 'GYM_OWNER',
        gymId: DEMO_GYM_ID,
        createdAt: new Date().toISOString(),
      };
    } else if (role === 'STAFF') {
      profile = {
        uid: 'demo_staff_uid',
        email: DEMO_USERS.STAFF.email,
        fullName: DEMO_USERS.STAFF.fullName,
        role: 'STAFF',
        gymId: DEMO_GYM_ID,
        createdAt: new Date().toISOString(),
      };
    } else {
      profile = {
        uid: 'demo_member_uid',
        email: DEMO_USERS.MEMBER.email,
        fullName: DEMO_USERS.MEMBER.fullName,
        role: 'MEMBER',
        gymId: DEMO_GYM_ID,
        memberId: DEMO_USERS.MEMBER.memberId,
        createdAt: new Date().toISOString(),
      };
    }

    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(profile));
    setCurrentUser(profile);
    await fetchGym(profile.gymId);
    setLoading(false);
  };

  const loginWithCredentials = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail === DEMO_USERS.OWNER.email.toLowerCase() && pass === DEMO_USERS.OWNER.password) {
      await loginWithDemo('OWNER');
      return { success: true };
    }
    if (cleanEmail === DEMO_USERS.STAFF.email.toLowerCase() && pass === DEMO_USERS.STAFF.password) {
      await loginWithDemo('STAFF');
      return { success: true };
    }
    if (cleanEmail === DEMO_USERS.MEMBER.email.toLowerCase() && pass === DEMO_USERS.MEMBER.password) {
      await loginWithDemo('MEMBER');
      return { success: true };
    }

    setLoading(false);
    return {
      success: false,
      error: 'Invalid credentials. Please use the demo credentials provided or sign in with Google.',
    };
  };

  const logout = async () => {
    setLoading(true);
    localStorage.removeItem(DEMO_SESSION_KEY);
    setCurrentUser(null);
    setCurrentGym(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const switchGym = async (gymId: string) => {
    if (!currentUser) return;
    const updated = { ...currentUser, gymId };
    setCurrentUser(updated);
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(updated));
    await fetchGym(gymId);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        currentGym,
        loading,
        loginWithGoogle,
        loginWithDemo,
        loginWithCredentials,
        logout,
        switchGym,
        seedDatabaseIfNeeded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
