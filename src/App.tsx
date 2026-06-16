import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-400 font-medium font-sans" id="app-initializing-state">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm">Initializing FKAeSpace safety gateway...</p>
      </div>
    );
  }

  return (
    <div className="antialiased text-slate-800" id="fkaespace-root">
      {user ? (
        <Dashboard user={user} />
      ) : (
        <Login />
      )}
    </div>
  );
}
