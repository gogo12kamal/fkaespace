import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { LogIn, UserPlus, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name.trim()) throw new Error("Please enter your name");
        if (password.length < 6) throw new Error("Password must be at least 6 characters long");

        // Create Firebase Authentication account
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        
        // Auto-assign admin role to the bootstrapped email or standard user profile
        const role = email.toLowerCase() === 'gogo12kamal@gmail.com' ? 'admin' : 'user';

        // Write user profile to users collection
        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          email: email.toLowerCase(),
          displayName: name,
          role: role,
          createdAt: new Date().toISOString()
        });

        setSuccessMsg("Account registered successfully! Logging you in...");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let friendlyMsg = err.message || "An authentication error occurred.";
      if (err.code === 'auth/user-not-found') friendlyMsg = "No account found with this email.";
      if (err.code === 'auth/wrong-password') friendlyMsg = "Incorrect password.";
      if (err.code === 'auth/invalid-email') friendlyMsg = "Please enter a valid email address.";
      if (err.code === 'auth/email-already-in-use') friendlyMsg = "This email is already registered.";
      if (err.code === 'auth/configuration-not-found') {
        friendlyMsg = "Email/Password sign-in is not yet enabled in the Firebase Console. Please enable it in the Authentication panel, or use Google Sign-In below.";
      }
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const user = userCred.user;
      
      const role = user.email?.toLowerCase() === 'gogo12kamal@gmail.com' ? 'admin' : 'user';

      // Ensure user profile metadata is present
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email?.toLowerCase() || '',
        displayName: user.displayName || 'FKAeSpace User',
        role: role,
        createdAt: new Date().toISOString()
      }, { merge: true });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-height-[90vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50" id="login-container">
      <div className="max-w-md w-full space-y-8" id="login-card-wrapper">
        
        {/* Brand Header */}
        <div className="text-center" id="brand-header">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 mb-4"
          >
            <span className="font-bold text-xl tracking-wider">FKA</span>
          </motion.div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            FKAeSpace
          </h2>
          <p className="mt-2 text-sm text-slate-600 font-medium">
            FKA Space Reservation System
          </p>
        </div>

        <motion.div 
          layout
          className="bg-white py-8 px-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 relative overflow-hidden"
          id="auth-card"
        >
          {/* Background subtle decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-16 -mt-16 -z-10" />

          {/* Form State Tabs */}
          <div className="flex border-b border-slate-100 mb-6" id="auth-tabs">
            <button
              onClick={() => { setIsRegistering(false); setError(null); setSuccessMsg(null); }}
              className={`flex-1 pb-4 text-sm font-semibold border-b-2 text-center transition-colors ${
                !isRegistering 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              id="signin-tab-btn"
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsRegistering(true); setError(null); setSuccessMsg(null); }}
              className={`flex-1 pb-4 text-sm font-semibold border-b-2 text-center transition-colors ${
                isRegistering 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
              id="signup-tab-btn"
            >
              Create Account
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.form 
              key={isRegistering ? 'register' : 'login'}
              initial={{ x: isRegistering ? 10 : -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRegistering ? -10 : 10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleEmailAuth} 
              className="space-y-4"
              id="auth-form"
            >
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2" id="auth-error">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-100 flex items-start gap-2" id="auth-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {isRegistering && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="full-name">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="full-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="email-address">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email-address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="auth-password">
                  Password
                </label>
                <input
                  type="password"
                  id="auth-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all outline-none"
                id="auth-submit-btn"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isRegistering ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Account
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          {/* Social login divider */}
          <div className="relative my-6" id="divider-container">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-white hover:bg-slate-50 disabled:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-sm transition-all outline-none"
            id="google-sigin-btn"
          >
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.44 1.68 14.9 1 12 1 7.35 1 3.39 3.65 1.5 7.5l3.6 2.8C5.97 7.07 8.74 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.68 2.85c2.14-1.98 3.75-4.89 3.75-8.59z"
              />
              <path
                fill="#FBBC05"
                d="M5.1 14.8c-.25-.76-.39-1.57-.39-2.4s.14-1.64.39-2.4L1.5 7.2C.54 9.12 0 11.26 0 13.5s.54 4.38 1.5 6.3l3.6-2.8z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.68-2.85c-1.12.75-2.55 1.2-4.28 1.2-3.26 0-6.03-2.03-7.01-5l-3.6 2.8C3.39 20.35 7.35 23 12 23z"
              />
            </svg>
            Sign In with Google
          </button>

          {/* Configuration Note */}
          <div className="mt-6 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2" id="provider-note">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 leading-relaxed font-medium">
              <p className="font-bold mb-0.5">Firebase Email Provider Configuration:</p>
              Please make sure to enable the <strong>Email/Password</strong> provider in your Firebase Authentication console (if not enabled already). Google sign-in works immediately without any extra setup.
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
