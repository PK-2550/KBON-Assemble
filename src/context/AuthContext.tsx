import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  AppUserProfile,
  loginWithGoogle as authLoginWithGoogle,
  loginWithUsername as authLoginWithUsername,
  registerWithUsername as authRegisterWithUsername,
  logout as authLogout,
  getStoredUserSession,
  saveUserSession,
  isUserAdmin,
} from '../services/authService';
import { UserRole } from '../types';

interface AuthContextType {
  currentUser: AppUserProfile | null;
  userProfile: AppUserProfile | null;
  loading: boolean;
  signInWithGoogle: (role?: UserRole) => Promise<AppUserProfile>;
  signInWithUsername: (username: string, pass: string) => Promise<AppUserProfile>;
  registerWithUsername: (username: string, pass: string, role?: UserRole) => Promise<AppUserProfile>;
  signOutUser: () => Promise<void>;
  updateUserRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUserProfile | null>(() => getStoredUserSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial check from stored local session
    const saved = getStoredUserSession();
    if (saved) {
      if (isUserAdmin(saved)) {
        saved.role = 'admin';
        saveUserSession(saved);
        // Sync to Firestore in background
        setDoc(doc(db, 'users', saved.uid), { role: 'admin' }, { merge: true }).catch(() => {});
      }
      setCurrentUser(saved);
    }

    // 2. Also listen to Firebase Auth for Google Sign-in state
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const currentSaved = getStoredUserSession();
        let role = currentSaved?.role || 'user';
        if (isUserAdmin({ uid: fbUser.uid, role, username: fbUser.displayName || '' })) {
          role = 'admin';
        }
        const googleProfile: AppUserProfile = {
          uid: fbUser.uid,
          username: fbUser.displayName || fbUser.email?.split('@')[0] || 'ผู้ใช้งาน Google',
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'ผู้ใช้งาน Google',
          photoURL: fbUser.photoURL || null,
          role: role,
          provider: 'google',
        };
        setCurrentUser(googleProfile);
        saveUserSession(googleProfile);
      } else {
        // If Firebase Auth logged out and provider was Google, clear user
        const current = getStoredUserSession();
        if (current && current.provider === 'google') {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    setLoading(false);
    return () => unsubscribeAuth();
  }, []);

  // 3. Real-time Firestore sync for user role / profile changes (e.g. upgraded to Manager by Admin)
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.role && data.role !== currentUser.role) {
          const updatedUser: AppUserProfile = {
            ...currentUser,
            role: data.role as UserRole,
          };
          setCurrentUser(updatedUser);
          saveUserSession(updatedUser);
        }
      }
    }, (err) => {
      // Ignored non-fatal snapshot error
    });

    return () => unsubscribeSnapshot();
  }, [currentUser?.uid, currentUser?.role]);

  const signInWithGoogle = async (role: UserRole = 'user') => {
    const profile = await authLoginWithGoogle(role);
    setCurrentUser(profile);
    return profile;
  };

  const signInWithUsername = async (username: string, pass: string) => {
    const profile = await authLoginWithUsername(username, pass);
    setCurrentUser(profile);
    return profile;
  };

  const registerWithUsername = async (username: string, pass: string, role: UserRole = 'user') => {
    const profile = await authRegisterWithUsername(username, pass, role);
    // Do not set currentUser so user stays on login screen
    return profile;
  };

  const signOutUser = async () => {
    await authLogout();
    setCurrentUser(null);
  };

  const updateUserRole = async (newRole: UserRole) => {
    if (!currentUser) return;
    const updated: AppUserProfile = { ...currentUser, role: newRole };
    setCurrentUser(updated);
    saveUserSession(updated);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { role: newRole }, { merge: true });
    } catch (err) {
      console.warn('Failed to update role in Firestore:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile: currentUser,
        loading,
        signInWithGoogle,
        signInWithUsername,
        registerWithUsername,
        signOutUser,
        updateUserRole,
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
