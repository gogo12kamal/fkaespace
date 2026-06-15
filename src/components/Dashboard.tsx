import React, { useState, useEffect } from 'react';
import { signOut, User } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, doc, getDoc, 
  getDocFromServer, setDoc 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Room, Booking, UserProfile } from '../types';
import { seedRoomsIfEmpty } from '../seedData';
import RoomCard from './RoomCard';
import BookingForm from './BookingForm';
import BookingList from './BookingList';
import AdminPanel from './AdminPanel';
import RootAdminDashboard from './RootAdminDashboard';
import { 
  LogOut, ShieldAlert, Sliders, LayoutGrid, CheckSquare, 
  Calendar, ShieldCheck, HelpCircle, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<number>(0);
  
  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings' | 'admin'>('rooms');
  const [loading, setLoading] = useState(true);
  const [dbStatusError, setDbStatusError] = useState<string | null>(null);

  // isAdmin helper
  const isAdminUser = profile?.role === 'admin' || user.email?.toLowerCase() === 'gogo12kamal@gmail.com';

  useEffect(() => {
    // 1. Mandatory validation connection check to Firestore: getFromServer test
    async function testDbConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err: any) {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          console.error("Please check your Firebase connectivity configuration.");
          setDbStatusError("The client or server is offline. Please check your credentials.");
        }
      }
    }
    testDbConnection();

    // 2. Resolve or set up User profile details in Firestore
    async function syncUserProfile() {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        
        let userRole: 'user' | 'admin' = user.email?.toLowerCase() === 'gogo12kamal@gmail.com' ? 'admin' : 'user';

        if (!userSnap.exists()) {
          // Setup new profile
          const initialProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'SpaceBook User',
            role: userRole,
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, initialProfile);
          setProfile(initialProfile);
        } else {
          setProfile(userSnap.data() as UserProfile);
        }
      } catch (err: any) {
        console.error("Could not fetch user profile metadata from DB:", err);
      }
    }
    syncUserProfile();

    // Seed preset rooms if database is fresh
    seedRoomsIfEmpty();
  }, [user]);

  // 3. Real-time Rooms Listener
  useEffect(() => {
    const roomsCol = collection(db, 'rooms');
    const unsub = onSnapshot(roomsCol, (snapshot) => {
      const liveRooms: Room[] = [];
      snapshot.forEach((doc) => {
        liveRooms.push({ ...doc.data(), id: doc.id } as Room);
      });
      setRooms(liveRooms);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'rooms');
    });

    return () => unsub();
  }, []);

  // 4. Real-time Bookings Listener with branched queries for securer access
  useEffect(() => {
    if (!profile) return;

    setLoading(true);
    let bookingsQuery;
    
    // Check if current user is admin to decide the read scope
    if (isAdminUser) {
      // Admins load all bookings to review approvals
      bookingsQuery = collection(db, 'bookings');
    } else {
      // Standard guests can only query their own records, satisfying Query Enforcer rule
      bookingsQuery = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    }

    const unsub = onSnapshot(bookingsQuery, (snapshot) => {
      const liveBookings: Booking[] = [];
      snapshot.forEach((doc) => {
        liveBookings.push({ ...doc.data(), id: doc.id } as Booking);
      });
      setBookings(liveBookings);
      setLoading(false);
    }, (err) => {
      // Capture and detail permission failures as JSON
      handleFirestoreError(err, OperationType.LIST, 'bookings');
      setLoading(false);
    });

    return () => unsub();
  }, [profile, isAdminUser]);

  const handleSignOut = () => {
    signOut(auth).catch((err) => console.error("Sign-out failure:", err));
  };

  const filteredRooms = rooms.filter(room => {
    const matchesLayout = selectedLayout === 'all' || room.layoutType === selectedLayout;
    const matchesCapacity = room.capacity >= capacityFilter;
    return matchesLayout && matchesCapacity;
  });

  if (user.uid === 'U3ZvzThJVAdGN95lWSGNon5Cfrm2' || user.email?.toLowerCase() === 'gogo12kamal@gmail.com') {
    return <RootAdminDashboard user={user} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="dashboard-layout">
      {/* Premium Navigation Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40" id="dashboard-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          {/* Logo & Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-100">
              S
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">SpaceBook</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Enterprise Scheduler</p>
            </div>
          </div>

          {/* User badge and actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-800">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isAdminUser ? (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[9px] font-bold uppercase text-indigo-700 rounded-md">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    System Admin
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Staff</span>
                )}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-colors border border-slate-100 outline-none"
              title="Sign Out"
              id="header-signout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="dashboard-main-area">
        
        {dbStatusError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-100 flex items-start gap-3" id="db-health-banner">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Offline Connection Alert:</p>
              <p className="text-xs mt-0.5">{dbStatusError}</p>
            </div>
          </div>
        )}

        {/* Console Mode Navigation Router */}
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-6" id="dashboard-tabs">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'rooms'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Rooms Directory
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'bookings'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              My Bookings
            </button>

            {isAdminUser && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-white text-indigo-600 hover:bg-slate-100 border border-indigo-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Console
              </button>
            )}
          </div>
        </div>

        {/* Tab Contents */}
        {loading && rooms.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400" id="loading-spinner">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium">Synchronizing reservation catalog...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              
              {/* VIEW 1: Rooms Directory & Custom Reservation Grid */}
              {activeTab === 'rooms' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="view-rooms-catalog">
                  
                  {/* Left & Middle: Filters and available rooms */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Filter controls */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center justify-between" id="rooms-filters-bar">
                      <div className="flex items-center gap-2 text-slate-800" id="filter-lead">
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</span>
                      </div>

                      <div className="flex flex-wrap gap-3 items-center">
                        {/* Seating layout filter */}
                        <div>
                          <select
                            value={selectedLayout}
                            onChange={(e) => setSelectedLayout(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 py-1.5 px-3 rounded-xl outline-none focus:border-indigo-500"
                            id="layout-filter-sel"
                          >
                            <option value="all">All Seating Layouts</option>
                            <option value="Boardroom">Boardroom</option>
                            <option value="Conference">Conference</option>
                            <option value="U-Shape">U-Shape</option>
                            <option value="Lecture">Lecture</option>
                            <option value="Project Room">Project Room</option>
                          </select>
                        </div>

                        {/* Capacity selection filter */}
                        <div>
                          <select
                            value={capacityFilter}
                            onChange={(e) => setCapacityFilter(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 py-1.5 px-3 rounded-xl outline-none focus:border-indigo-500"
                            id="capacity-filter-sel"
                          >
                            <option value={0}>Any Capacity</option>
                            <option value={8}>8+ Seats</option>
                            <option value={15}>15+ Seats</option>
                            <option value={30}>30+ Seats</option>
                            <option value={50}>50+ Seats</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Rooms listings */}
                    {filteredRooms.length === 0 ? (
                      <div className="py-20 text-center text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-100" id="filtered-rooms-empty">
                        <Sliders className="w-8 h-8 text-slate-300 animate-pulse" />
                        <p>No meeting spaces match your filter parameters.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="rooms-tiles-grid">
                        {filteredRooms.map((room) => (
                          <RoomCard
                            key={room.id}
                            room={room}
                            onBook={(r) => setSelectedRoom(r)}
                            isSelected={selectedRoom?.id === room.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Dynamic Room Booking Form */}
                  <div className="lg:col-span-1" id="sidebar-booking-form">
                    <div className="sticky top-24">
                      <BookingForm
                        selectedRoom={selectedRoom}
                        currentUser={{
                          uid: user.uid,
                          email: user.email || '',
                          displayName: user.displayName || user.email?.split('@')[0] || 'SpaceBook User'
                        }}
                        existingBookings={bookings}
                        onBookingSuccess={() => {
                          // Jump user over to bookings tab to see progress
                          setActiveTab('bookings');
                        }}
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW 2: My Personal Bookings */}
              {activeTab === 'bookings' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="view-my-bookings">
                  <div className="lg:col-span-2">
                    <BookingList 
                      bookings={bookings} 
                      currentUser={{ uid: user.uid }}
                      onCancelSuccess={() => {}}
                    />
                  </div>

                  {/* Info Sidebar card explaining approval workflows */}
                  <div className="lg:col-span-1" id="bookings-rules-infobox">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md shadow-slate-100/50 space-y-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <HelpCircle className="w-5 h-5" />
                        <h4 className="font-bold text-sm text-slate-800">Booking Guidelines</h4>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-2.5">
                        <p>
                          Your bookings initially land in the <strong>Awaiting Review</strong> state.
                          Staff or system administrators review registrations in real time.
                        </p>
                        <p>
                          Our <strong>Conflict Prevention</strong> algorithm runs instantly. If you 
                          try to double-book a slot, the system will prevent submission.
                        </p>
                        <p className="font-semibold text-slate-800">
                          Can I modify or change layout types?
                        </p>
                        <p>
                          To protect audit logs, direct booking updates are restricted to cancellations.
                          To free up the space, click the red <strong>Cancel</strong> button next to future slots.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: Admin Approval Board */}
              {activeTab === 'admin' && isAdminUser && (
                <div className="space-y-6" id="view-admin-controls">
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/20" id="admin-badge-indicator">
                    <p className="text-xs font-semibold text-indigo-900 leading-relaxed">
                      💡 <strong>Administrator Intelligence Panel:</strong> Currently displaying all meeting room bookings from all staff users in the platform. You have global authority to evaluate pending slots, approve schedules, or void conflicts.
                    </p>
                  </div>
                  <AdminPanel 
                    bookings={bookings}
                    onReviewSuccess={() => {}}
                  />
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Aesthetic Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider" id="dashboard-footer">
        © 2026 SpaceBook Inc • Secure Physical Capital Optimizer
      </footer>
    </div>
  );
}
