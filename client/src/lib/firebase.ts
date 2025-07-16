import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key-placeholder",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project"}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app-id",
};

// Initialize Firebase with error handling
let app;
let auth;

try {
  // Check if we have valid Firebase configuration
  const hasValidConfig = firebaseConfig.apiKey && 
                        firebaseConfig.apiKey !== "demo-api-key-placeholder" &&
                        firebaseConfig.projectId && 
                        firebaseConfig.projectId !== "demo-project";

  if (hasValidConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log("✅ Firebase initialized successfully");
  } else {
    console.warn("⚠️ Firebase not configured - using demo mode. Please add VITE_FIREBASE_* environment variables for full functionality.");
    // Create a mock auth object for development
    auth = null;
  }
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
  console.warn("⚠️ Running in demo mode. Please check your Firebase configuration.");
  auth = null;
}

// Configure Google provider (only if Firebase is available)
let googleProvider = null;
if (auth) {
  googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({
    prompt: 'select_account',
    hd: '' // Force account picker for all domains
  });
}

// ✅ Google Login (Always ask for account)
export const signInWithGoogle = async () => {
  if (!auth) {
    throw new Error("Firebase not properly configured. Please add VITE_FIREBASE_* environment variables.");
  }

  const provider = new GoogleAuthProvider();

  // Force Google to show account chooser
  provider.setCustomParameters({
    prompt: "select_account"
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Clear logout flag on successful login
    localStorage.removeItem('user_logged_out');
    sessionStorage.removeItem('user_logged_out');

    console.log("✅ Signed in as:", user.email);
    return result;
  } catch (error) {
    console.error("❌ Sign-in error:", error);
    throw error;
  }
};

// ✅ Logout Function (Properly logout user)
export const signOutUser = async () => {
  try {
    // Set logout flag first to prevent auto-login
    localStorage.setItem('user_logged_out', 'true');
    sessionStorage.setItem('user_logged_out', 'true');

    // Call backend logout to clear server session
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    });

    // Then sign out from Firebase (if available)
    if (auth) {
      await signOut(auth);
      console.log("✅ Firebase signout completed");
    } else {
      console.log("✅ Logout completed (Firebase not configured)");
    }

    // Clear all stored session/local data except logout flag
    const logoutFlag = localStorage.getItem('user_logged_out');
    localStorage.clear();
    sessionStorage.clear();
    
    // Restore logout flag
    localStorage.setItem('user_logged_out', 'true');
    sessionStorage.setItem('user_logged_out', 'true');

    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    console.log("✅ Complete logout finished");
  } catch (error) {
    console.error("❌ Logout error:", error);
    // Even if logout fails, set logout flag and clear local data
    localStorage.setItem('user_logged_out', 'true');
    sessionStorage.setItem('user_logged_out', 'true');
    throw error;
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    // If Firebase is not configured, immediately call with null user
    callback(null);
    return () => {}; // Return empty unsubscribe function
  }
  return onAuthStateChanged(auth, callback);
};

// Export auth and googleProvider for use in other components
export { auth, googleProvider };
export default app;