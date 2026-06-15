import React, { useState, useEffect } from 'react';
import { signOut, User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Booking, Room, RoomLayoutType } from '../types';
import { 
  LogOut, Shield, Users, Calendar, Paperclip, Search, 
  FileText, ExternalLink, Database, Loader2, ArrowUpRight,
  User as UserIcon, HelpCircle, ShieldAlert, Plus, Edit2, 
  Trash2, Image, Layers, Tag, X, Check, Eye, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RootAdminDashboardProps {
  user: User;
}

// Beautiful standard Unsplash presets for easy premium styling selection
const ROOM_IMAGE_PRESETS = [
  {
    name: 'Workspace Suite',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Executive Boardroom',
    url: 'https://images.unsplash.com/photo-1517502884422-41eaaced0168?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Large Conference Hall',
    url: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Auditorium & Theater',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Breakout Agile Hub',
    url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=800'
  },
  {
    name: 'Collaborative Studio',
    url: 'https://images.unsplash.com/photo-1517502474097-f9b3020b9147?auto=format&fit=crop&q=80&w=800'
  }
];

export default function RootAdminDashboard({ user }: RootAdminDashboardProps) {
  // Navigation tabs
  const [adminTab, setAdminTab] = useState<'users' | 'rooms' | 'bookings'>('users');

  // Core Data States
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  
  // Interaction/UI States
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Form Modals States
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null); // null means "Adding"
  const [roomForm, setRoomForm] = useState({
    id: '',
    name: '',
    capacity: 10,
    layoutType: 'Boardroom' as RoomLayoutType,
    description: '',
    amenitiesInput: '',
    imageUrl: ROOM_IMAGE_PRESETS[0].url
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState(false);

  // Booking Approvals states
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [bookingLoadingId, setBookingLoadingId] = useState<string | null>(null);
  const [bookingActionError, setBookingActionError] = useState<string | null>(null);

  const handleReviewBooking = async (booking: Booking, newStatus: 'approved' | 'rejected') => {
    setBookingActionError(null);
    setBookingLoadingId(`${booking.id}-${newStatus}`);

    try {
      const bookingDocRef = doc(db, 'bookings', booking.id);
      
      const updatePayload = {
        ...booking,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(bookingDocRef, updatePayload);
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
      } catch (formattedErr: any) {
        setBookingActionError(`Gagal mengemaskini status tempahan: ${formattedErr.message || "Akses pentadbir ditolak."}`);
      }
    } finally {
      setBookingLoadingId(null);
    }
  };

  // 1. Fetch Users List in Real Time
  useEffect(() => {
    setLoadingUsers(true);
    const usersCol = collection(db, 'users');
    
    const unsub = onSnapshot(usersCol, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      setUsersList(users);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Failed to load users for administrator review:", err);
      setErrorStatus("Ralat had akses pangkalan data. Kebenaran pentadbir diperlukan.");
      setLoadingUsers(false);
    });

    return () => unsub();
  }, []);

  // 2. Fetch All Bookings to calculate uploads
  useEffect(() => {
    const bookingsCol = collection(db, 'bookings');
    
    const unsub = onSnapshot(bookingsCol, (snapshot) => {
      const bookings: Booking[] = [];
      snapshot.forEach((doc) => {
        bookings.push({ ...doc.data(), id: doc.id } as Booking);
      });
      setBookingsList(bookings);
    }, (err) => {
      console.error("Failed to fetch booking ledger objects for file auditing:", err);
    });

    return () => unsub();
  }, []);

  // 3. Fetch All Rooms in Real Time
  useEffect(() => {
    setLoadingRooms(true);
    const roomsCol = collection(db, 'rooms');
    
    const unsub = onSnapshot(roomsCol, (snapshot) => {
      const rooms: Room[] = [];
      snapshot.forEach((doc) => {
        rooms.push({ ...doc.data(), id: doc.id } as Room);
      });
      setRoomsList(rooms);
      setLoadingRooms(false);
    }, (err) => {
      console.error("Failed to fetch space listings for rooms review:", err);
      setLoadingRooms(false);
    });

    return () => unsub();
  }, []);

  const handleSignOut = () => {
    signOut(auth).catch((err) => console.error("Admin workspace sign out crash:", err));
  };

  // Calculation Helpers
  const getUserBookingsWithFiles = (targetUid: string) => {
    return bookingsList.filter(b => b.userId === targetUid && b.attachmentUrl);
  };

  const getUploadedFilesCount = (targetUid: string) => {
    return getUserBookingsWithFiles(targetUid).length;
  };

  // Filter users based on search
  const filteredUsers = usersList.filter(u => {
    const searchLower = searchTerm.toLowerCase();
    const matchesEmail = u.email.toLowerCase().includes(searchLower);
    const matchesName = u.displayName?.toLowerCase().includes(searchLower) || false;
    const matchesUid = u.uid.toLowerCase().includes(searchLower);
    return matchesEmail || matchesName || matchesUid;
  });

  const selectedUser = usersList.find(u => u.uid === selectedUserId);
  const selectedUserFiles = selectedUserId ? getUserBookingsWithFiles(selectedUserId) : [];

  // Opening Form to CREATE or EDIT Space
  const openRoomModal = (roomToEdit?: Room) => {
    setFormError(null);
    if (roomToEdit) {
      setEditingRoomId(roomToEdit.id);
      setRoomForm({
        id: roomToEdit.id,
        name: roomToEdit.name,
        capacity: roomToEdit.capacity,
        layoutType: roomToEdit.layoutType,
        description: roomToEdit.description || '',
        amenitiesInput: roomToEdit.amenities ? roomToEdit.amenities.join(', ') : '',
        imageUrl: roomToEdit.imageUrl || ROOM_IMAGE_PRESETS[0].url
      });
    } else {
      setEditingRoomId(null);
      // Auto generate arbitrary safe temporary ID
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      setRoomForm({
        id: `ruang-${randomSuffix}`,
        name: '',
        capacity: 10,
        layoutType: 'Boardroom',
        description: '',
        amenitiesInput: '8K Screen, Wi-Fi 6, Video Streaming, Espresso Bar',
        imageUrl: ROOM_IMAGE_PRESETS[0].url
      });
    }
    setIsRoomModalOpen(true);
  };

  // Submit add or edit room handler
  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingProgress(true);

    const sanitiseId = roomForm.id.trim();
    const sanitiseName = roomForm.name.trim();
    const sanitiseDesc = roomForm.description.trim();
    
    // Parsing Amenities comma formatted
    const amenitiesArr = roomForm.amenitiesInput
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    // Validation
    if (!sanitiseId) {
      setFormError('Sila nyatakan ID Ruangan unik.');
      setSavingProgress(false);
      return;
    }

    // Safety Slug checking matching isValidId() pattern `^[a-zA-Z0-9_\-]+$` for firestore rules compatibility
    const safeIdRegex = /^[a-zA-Z0-9_\-]+$/;
    if (!safeIdRegex.test(sanitiseId)) {
      setFormError('ID Ruangan tidak sah. Hanya aksara abjad-angka, tanda sempang (-) dan garis bawah (_) dibenarkan.');
      setSavingProgress(false);
      return;
    }

    if (sanitiseId.length > 128) {
      setFormError('ID Ruangan tidak boleh melebihi 128 aksara.');
      setSavingProgress(false);
      return;
    }

    if (!sanitiseName) {
      setFormError('Sila nyatakan Nama Ruangan.');
      setSavingProgress(false);
      return;
    }

    if (roomForm.capacity <= 0 || isNaN(Number(roomForm.capacity))) {
      setFormError('Kapasiti ruangan mestilah nombor bulat positif sah.');
      setSavingProgress(false);
      return;
    }

    // Check duplicate ID if creating brand new
    if (!editingRoomId) {
      const isDuplicated = roomsList.some(r => r.id.toLowerCase() === sanitiseId.toLowerCase());
      if (isDuplicated) {
        setFormError('ID Ruangan ini sudah wujud dalam sistem. Sila pilih ID lain.');
        setSavingProgress(false);
        return;
      }
    }

    try {
      const roomPayload: Omit<Room, 'id'> = {
        name: sanitiseName,
        capacity: Number(roomForm.capacity),
        layoutType: roomForm.layoutType,
        amenities: amenitiesArr,
        description: sanitiseDesc,
        imageUrl: roomForm.imageUrl || ROOM_IMAGE_PRESETS[0].url
      };

      // Write directly to Firebase
      const targetDocRef = doc(db, 'rooms', sanitiseId);
      await setDoc(targetDocRef, roomPayload);

      setIsRoomModalOpen(false);
      setEditingRoomId(null);
    } catch (err) {
      console.error("Failed to commit room specs update to database:", err);
      setFormError('Ralat write pangkalan data. Sila sahkan kelayakan akses pentadbir.');
    } finally {
      setSavingProgress(false);
    }
  };

  // Delete Room Action Handler
  const handleRoomDelete = async (idToDelete: string) => {
    try {
      await deleteDoc(doc(db, 'rooms', idToDelete));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Could not drop selected space record:", err);
      alert("Gagal menghapuskan ruangan. Ralat kebenaran keselamatan.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans" id="admin-workspace-layout">
      
      {/* Premium Security Header for Administrators */}
      <header className="bg-slate-950/60 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md" id="admin-bar-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          {/* Logo with strict admin badge indication */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-orange-500/10">
              SB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 tracking-tight">SpaceBook Console</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-[9px] font-black uppercase text-red-400 tracking-wider rounded-md" id="admin-indicator-badge">
                  <Shield className="w-2.5 h-2.5 animate-pulse" />
                  KONSOL PENTADBIR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Secure Cloud Space Admin</p>
            </div>
          </div>

          {/* Admin Profile Details */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-200">System Root Override</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-700/65 outline-none"
              title="Terminate Admin Session"
              id="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6" id="admin-workspace-body">
        
        {/* Glow Status Alert Dashboard Header */}
        <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm" id="admin-status-bar">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 shrink-0">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Papan Pemuka Pentadbir Awam (Admin Dashboard)</h2>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                Uruskan profil pengguna, jejak fail dimuat naik, serta kemaskini secara langsung katalog ruangan mesyuarat SpaceBook.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-400 font-medium">
                <span>Total Pengguna: <strong className="text-indigo-400 font-bold">{usersList.length}</strong></span>
                <span>•</span>
                <span>Total Ruangan Semasa: <strong className="text-emerald-400 font-bold">{roomsList.length}</strong></span>
                <span>•</span>
                <span>Dokumen Tersimpan: <strong className="text-orange-400 font-bold">{bookingsList.filter(b => b.attachmentUrl).length}</strong></span>
              </div>
            </div>
          </div>

          {/* Tab Selection Navigation Segment */}
          <div className="bg-slate-955/85 p-1 rounded-2xl border border-slate-800 flex gap-1 self-start md:self-auto shrink-0" id="admin-view-toggle">
            <button
              onClick={() => setAdminTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                adminTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Pengguna / User & Fail
            </button>
            <button
              onClick={() => setAdminTab('rooms')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                adminTab === 'rooms'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="admin-tab-rooms-btn"
            >
              <Layers className="w-4 h-4" />
              Sistem Urus Ruang
            </button>
            <button
              onClick={() => setAdminTab('bookings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                adminTab === 'bookings'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="admin-tab-bookings-btn"
            >
              <Calendar className="w-4 h-4" />
              Kelulusan Tempahan
            </button>
          </div>
        </div>

        {errorStatus && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-2xl flex items-start gap-3" id="admin-fatal-error">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Access Authority Protocol Error:</p>
              <p className="text-slate-400 mt-0.5">{errorStatus}</p>
            </div>
          </div>
        )}

        {/* Dynamic Tab Body rendering */}
        <AnimatePresence mode="wait">
          {adminTab === 'users' ? (
            <motion.div
              key="users-tab-layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              id="admin-users-tab-grid"
            >
              {/* Left Column: Users Directory (Lg: col-span-7) */}
              <section className="lg:col-span-7 flex flex-col gap-4" id="admin-users-list-section">
                
                {/* Search User Input bar */}
                <div className="bg-slate-955/40 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-4" id="admin-user-filter">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required={false}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari emel pengguna, nama paparan, ID unik..."
                      className="w-full bg-slate-900/80 pl-10 pr-4 py-2.5 border border-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500"
                      id="user-search-input"
                    />
                  </div>
                </div>

                {/* List Table container */}
                <div className="bg-slate-950/20 rounded-3xl border border-slate-800/60 overflow-hidden flex flex-col shadow-inner min-h-[460px]" id="admin-users-table">
                  <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Direktori Pengguna Berdaftar</h3>
                  </div>

                  {loadingUsers ? (
                    <div className="py-24 flex-1 flex flex-col items-center justify-center gap-3 text-slate-500" id="dir-loading">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <p className="text-xs font-semibold uppercase tracking-wider">Mendapatkan semula senarai profil...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-24 flex-1 text-center text-slate-500 flex flex-col items-center justify-center gap-3" id="dir-empty">
                      <UserIcon className="w-10 h-10 text-slate-600 animate-pulse" />
                      <p className="text-xs font-bold uppercase tracking-wider">Tiada penggunakan ditemui dalam pangkalan.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/50 flex-1 overflow-y-auto max-h-[500px]" id="user-rows-list">
                      {filteredUsers.map((item) => {
                        const filesCount = getUploadedFilesCount(item.uid);
                        const isSelected = selectedUserId === item.uid;
                        const dateFormatted = item.createdAt 
                          ? new Date(item.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Not Seeded';

                        return (
                          <button
                            key={item.uid}
                            onClick={() => setSelectedUserId(item.uid)}
                            className={`w-full text-left p-4.5 transition-all outline-none flex items-center justify-between gap-4 border-l-2 ${
                              isSelected 
                                ? 'bg-slate-800/40 border-l-indigo-500 text-white' 
                                : 'hover:bg-slate-800/10 border-l-transparent text-slate-300'
                            }`}
                            id={`user-row-btn-${item.uid}`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center uppercase font-bold text-xs shrink-0 ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-slate-850 text-slate-400 border border-slate-700/40'
                              }`}>
                                {item.email.slice(0, 2)}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <h4 className="text-xs font-bold truncate leading-snug">
                                  {item.displayName || 'Nama Rawak'}
                                </h4>
                                <p className="text-[10px] text-slate-505 font-mono truncate">{item.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 shrink-0">
                              <div className="hidden sm:flex flex-col items-end text-right">
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Didaftarkan</span>
                                <span className="text-[11px] font-semibold text-slate-300 mt-0.5">{dateFormatted}</span>
                              </div>

                              <div className="flex flex-col items-end">
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Jumlah Fail</span>
                                <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                                  filesCount > 0 
                                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' 
                                    : 'bg-slate-800 text-slate-500 border border-slate-700/40'
                                }`}>
                                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                  {filesCount}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Right Column: Uploaded Files Viewer (Lg: col-span-5) */}
              <section className="lg:col-span-5 flex flex-col font-sans" id="admin-files-inspector-section">
                <div className="bg-slate-950/40 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-full min-h-[480px]" id="files-inspector-wrapper">
                  
                  <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center gap-2">
                    <Paperclip className="w-4.5 h-4.5 text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Pemeriksa Fail Pengguna</h3>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between" id="inspector-canvas">
                    <AnimatePresence mode="wait">
                      {!selectedUser ? (
                        <motion.div
                          key="no-selection"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3"
                          id="inspector-unselected-state"
                        >
                          <HelpCircle className="w-12 h-12 text-slate-800 animate-pulse" />
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Pilih Operator</p>
                          <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed mx-auto mt-1">
                            Sila klik pada senarai nama pengguna di sebelah kiri untuk mengaudit fail-fail lampiran tempahan mereka.
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={selectedUser.uid}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-6 flex-1 flex flex-col"
                        >
                          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2.5">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-400">Pemerhatian Profil</span>
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-200">{selectedUser.displayName || 'SpaceBook User'}</p>
                              <p className="text-xs text-slate-500 font-mono break-all">{selectedUser.email}</p>
                              <p className="text-[10px] text-slate-600 font-mono mt-1 break-all select-all">UID: {selectedUser.uid}</p>
                            </div>
                          </div>

                          <div className="flex-1 space-y-4" id="audited-individual-files-box">
                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Lampiran Fail ({selectedUserFiles.length})</h4>
                            
                            {selectedUserFiles.length === 0 ? (
                              <div className="py-14 text-center rounded-2xl border border-dashed border-slate-800/50 text-slate-600 flex flex-col items-center justify-center gap-2" id="files-empty-state">
                                <FileText className="w-8 h-8 text-slate-850" />
                                <p className="text-xs font-bold uppercase tracking-wider">Tiada fail dimuat naik.</p>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1" id="inspector-files-list">
                                {selectedUserFiles.map((fileRecord) => (
                                  <div
                                    key={fileRecord.id}
                                    className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 hover:border-slate-855/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    id={`audited-file-${fileRecord.id}`}
                                  >
                                    <div className="min-w-0 space-y-1">
                                      <p className="text-xs font-semibold text-slate-305 truncate" title={fileRecord.attachmentName || 'Review Attachment'}>
                                        {fileRecord.attachmentName || 'File Lampiran'}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-medium">
                                        <span>Ruang: <strong className="text-slate-400 font-semibold">{fileRecord.roomName}</strong></span>
                                        <span>•</span>
                                        <span>Tarikh: <strong className="text-slate-400 font-semibold">{fileRecord.date}</strong></span>
                                      </div>
                                    </div>

                                    <a
                                      href={fileRecord.attachmentUrl}
                                      target="_blank"
                                      referrerPolicy="no-referrer"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-xs font-bold text-white rounded-lg transition-all"
                                      id={`open-attachment-btn-${fileRecord.id}`}
                                    >
                                      Lihat Fail
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <div className="pt-4 border-t border-slate-800/70 text-[10px] text-slate-600 text-center leading-relaxed">
                      🔐 Integritas Keselamatan Sistem Maksimum. Semua akses fail direkod secara langsung pada kitaran audit.
                    </div>
                  </div>

                </div>
              </section>
            </motion.div>
          ) : adminTab === 'rooms' ? (
            // Room Management Tab Block
            <motion.div
              key="rooms-tab-layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
              id="admin-rooms-tab-container"
            >
              {/* Header and Add Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-4.5 rounded-3xl border border-slate-800/80">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">Katalog & Fasiliti Ruangan SpaceBook</h3>
                  <p className="text-xs text-slate-400 font-medium">Ubahsuai butiran ruangan, kemudahan, kapasiti, serta visualisasi bilik.</p>
                </div>

                <button
                  type="button"
                  onClick={() => openRoomModal()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 font-bold text-xs text-white rounded-2xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                  id="admin-add-room-trigger-btn"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Ruang Baru
                </button>
              </div>

              {/* Grid of Current Rooms */}
              {loadingRooms ? (
                <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3 bg-slate-950/10 rounded-3xl border border-slate-800/60" id="rooms-loading">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Menghubungkan rekod inventori ruangan...</p>
                </div>
              ) : roomsList.length === 0 ? (
                <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800" id="rooms-empty">
                  <Database className="w-10 h-10 text-slate-600 animate-pulse" />
                  <p className="text-xs font-bold uppercase tracking-wider">Tiada inventori ruangan berdaftar.</p>
                  <button
                    onClick={() => openRoomModal()}
                    className="mt-2 text-xs text-emerald-400 underline font-semibold cursor-pointer"
                  >
                    Mulakan menambah ruang pertama anda
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="admin-rooms-grid">
                  {roomsList.map((room) => {
                    const bookingsCount = bookingsList.filter(b => b.roomId === room.id).length;
                    
                    return (
                      <div
                        key={room.id}
                        className="bg-slate-950/20 border border-slate-800/80 rounded-3xl overflow-hidden flex flex-col h-full hover:border-slate-700/80 transition-all shadow-lg group font-sans"
                        id={`admin-room-card-${room.id}`}
                      >
                        {/* Image Preview Container */}
                        <div className="relative h-44 bg-slate-900 overflow-hidden shrink-0">
                          <img
                            src={room.imageUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800'}
                            alt={room.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                          
                          {/* Layout Style Badge */}
                          <div className="absolute top-3 left-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900/85 backdrop-blur-sm border border-slate-755/50 text-[10px] uppercase font-black tracking-wider text-indigo-300 rounded-lg">
                              <Layers className="w-3 h-3" />
                              {room.layoutType}
                            </span>
                          </div>

                          {/* Capacity indicators */}
                          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-white font-bold">
                            <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-[10px] text-emerald-300 rounded-md">
                              Hingga {room.capacity} Orang
                            </span>
                          </div>
                        </div>

                        {/* Description and Info */}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-5 bg-slate-950/40">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-slate-100 group-hover:text-indigo-400 transition-colors truncate">
                                {room.name}
                              </h4>
                              <p className="text-[10px] font-mono text-slate-500 tracking-wider">ID RUANG: {room.id}</p>
                            </div>

                            <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2">
                              {room.description || 'Tiada keterangan khas.'}
                            </p>

                            {/* Clean Amenities Tags view */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {room.amenities && room.amenities.map((tech, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-950/80 border border-slate-800 text-[9px] text-slate-400 font-semibold rounded"
                                >
                                  <Tag className="w-2.5 h-2.5 text-slate-500" />
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Interactive Card Action Footer */}
                          <div className="pt-4 border-t border-slate-900 flex items-center justify-between gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Total Tempahan: <strong className="text-slate-350">{bookingsCount}</strong>
                            </span>

                            <div className="flex items-center gap-1.5">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => openRoomModal(room)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-505/10 hover:bg-indigo-600/25 border border-indigo-500/30 hover:border-indigo-500 text-xs font-bold text-indigo-400 hover:text-white rounded-xl transition-all cursor-pointer"
                                id={`edit-room-btn-${room.id}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Ubahsuai
                              </button>

                              {/* Delete Confirm inline trigger */}
                              {deleteConfirmId === room.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRoomDelete(room.id)}
                                    className="px-2.5 py-1.5 bg-red-650 hover:bg-red-600 font-bold text-xs text-white rounded-xl transition-all"
                                  >
                                    Pasti?
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(room.id)}
                                  className="p-1.5 hover:p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                  title="Gugurkan Ruangan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            // Booking Approval Panel Block
            <motion.div
              key="bookings-tab-layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
              id="admin-bookings-tab-container"
            >
              {/* Statistics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="bookings-metrics-grid">
                <div className="bg-slate-950/60 p-4.5 rounded-3xl border border-slate-800 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">Jumlah Tempahan</span>
                    <p className="text-2xl font-black text-slate-100">{bookingsList.length}</p>
                  </div>
                  <div className="p-2.5 bg-slate-900 text-slate-400 rounded-xl border border-slate-800">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4.5 rounded-3xl border border-slate-800 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-amber-500">Menunggu Kelulusan</span>
                    <p className="text-2xl font-black text-amber-400">{bookingsList.filter(b => b.status === 'pending').length}</p>
                  </div>
                  <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-950">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4.5 rounded-3xl border border-slate-800 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-500">Diluluskan</span>
                    <p className="text-2xl font-black text-emerald-400">{bookingsList.filter(b => b.status === 'approved').length}</p>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-950">
                    <Check className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-955/60 p-4.5 rounded-3xl border border-slate-800 shadow-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-rose-500">Ditolak</span>
                    <p className="text-2xl font-black text-rose-400">{bookingsList.filter(b => b.status === 'rejected').length}</p>
                  </div>
                  <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-950">
                    <X className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {bookingActionError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-2xl flex items-start gap-3" id="booking-action-error">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">Ralat Kelulusan:</p>
                    <p className="text-slate-400 mt-0.5">{bookingActionError}</p>
                  </div>
                </div>
              )}

              {/* Filtering + Searching bar */}
              <div className="bg-slate-955/40 p-4.5 rounded-3xl border border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between" id="bookings-search-filter-row">
                <div className="relative w-full md:w-96">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-505">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required={false}
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Cari bilik, pemohon, emel, tujuan..."
                    className="w-full bg-slate-900/80 pl-10 pr-4 py-2.5 border border-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500"
                    id="booking-panel-search"
                  />
                </div>

                <div className="flex gap-1.5 w-full md:w-auto" id="booking-panel-filters">
                  {([
                    { value: 'all', label: 'Semua' },
                    { value: 'pending', label: 'Menunggu' },
                    { value: 'approved', label: 'Diluluskan' },
                    { value: 'rejected', label: 'Ditolak' }
                  ] as const).map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setBookingFilter(filter.value)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        bookingFilter === filter.value
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-955/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookings Table / Cards matching the Dark aesthetic */}
              <div className="bg-slate-950/20 rounded-3xl border border-slate-800/60 overflow-hidden flex flex-col shadow-inner" id="bookings-ledger-container">
                <div className="p-4.5 bg-slate-955/50 border-b border-slate-800/80 flex items-center gap-2">
                  <Calendar className="w-4.5 h-4.5 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Log Pengurusan dan Kelulusan Tempahan</h3>
                </div>

                {(() => {
                  const filtered = bookingsList.filter(b => {
                    const searchLower = bookingSearch.toLowerCase();
                    const bRoom = b.roomName?.toLowerCase() || '';
                    const bEmail = b.userEmail?.toLowerCase() || '';
                    const bName = b.userName?.toLowerCase() || '';
                    const bPurpose = b.purpose?.toLowerCase() || '';
                    
                    const matchesSearch = 
                      bRoom.includes(searchLower) ||
                      bEmail.includes(searchLower) ||
                      bName.includes(searchLower) ||
                      bPurpose.includes(searchLower);

                    const matchesStatus = bookingFilter === 'all' || b.status === bookingFilter;
                    return matchesSearch && matchesStatus;
                  });

                  // Sort desc by date + start time
                  const sorted = filtered.sort((a, b) => new Date(`${b.date}T${b.startTime}`).getTime() - new Date(`${a.date}T${a.startTime}`).getTime());

                  if (sorted.length === 0) {
                    return (
                      <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3" id="bookings-ledger-empty">
                        <Calendar className="w-10 h-10 text-slate-700 animate-pulse" />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Tiada Tempahan Dijumpai</p>
                        <p className="text-xs text-slate-400 max-w-[285px] leading-relaxed mx-auto mt-1">
                          Tiada rekod tempahan yang sepadan dengan carian atau penapis saat ini.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-800/40" id="bookings-ledger-rows">
                      <AnimatePresence mode="popLayout">
                        {sorted.map((booking) => {
                          let badgeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
                          let badgeLabel = 'Menunggu Kelulusan';
                          if (booking.status === 'approved') {
                            badgeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
                            badgeLabel = 'Diluluskan';
                          } else if (booking.status === 'rejected') {
                            badgeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
                            badgeLabel = 'Ditolak';
                          }

                          return (
                            <motion.div
                              key={booking.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-slate-800/10 transition-colors"
                              id={`booking-review-card-${booking.id}`}
                            >
                              <div className="space-y-2.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs bg-slate-900 border border-slate-800 font-bold text-slate-300 px-2.5 py-0.5 rounded-lg">
                                    {booking.roomName}
                                  </span>
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeBg}`}>
                                    {badgeLabel}
                                  </span>
                                </div>

                                <div className="space-y-0.5 min-w-0">
                                  <p className="text-xs text-slate-300 font-bold bg-slate-950/20 p-2.5 rounded-xl border border-slate-800 break-words leading-relaxed">
                                    "{booking.purpose}"
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 flex-wrap truncate mt-1">
                                    <span>Dipohon oleh:</span>
                                    <strong className="text-slate-300 truncate">{booking.userName}</strong>
                                    <span className="text-slate-500 truncate">({booking.userEmail})</span>
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 font-medium font-sans">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    {booking.date}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    {booking.startTime} - {booking.endTime}
                                  </span>
                                </div>

                                {booking.attachmentUrl && (
                                  <div className="pt-1 flex items-center" id={`booking-review-attachment-${booking.id}`}>
                                    <a
                                      href={booking.attachmentUrl}
                                      target="_blank"
                                      referrerPolicy="no-referrer"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all"
                                    >
                                      <Paperclip className="w-3 h-3 text-indigo-400 shrink-0" />
                                      <span className="max-w-[190px] truncate">{booking.attachmentName || 'Dokumen Sokongan'}</span>
                                      <ArrowUpRight className="w-3 h-3 text-indigo-400" />
                                    </a>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 self-end md:self-center shrink-0" id={`booking-actions-${booking.id}`}>
                                {booking.status === 'pending' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleReviewBooking(booking, 'approved')}
                                      disabled={bookingLoadingId !== null}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold text-xs text-white rounded-xl transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-600/10"
                                      id={`approve-btn-${booking.id}`}
                                    >
                                      {bookingLoadingId === `${booking.id}-approved` ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          Luluskan
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReviewBooking(booking, 'rejected')}
                                      disabled={bookingLoadingId !== null}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 disabled:opacity-50 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
                                      id={`reject-btn-${booking.id}`}
                                    >
                                      {bookingLoadingId === `${booking.id}-rejected` ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <X className="w-3.5 h-3.5" />
                                          Tolak
                                        </>
                                      )}
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-[10px] text-slate-500 bg-slate-950/40 border border-slate-900 px-2 py-1 rounded-lg font-semibold">Tindakan Selesai</span>
                                    <button
                                      type="button"
                                      onClick={() => handleReviewBooking(booking, booking.status === 'approved' ? 'rejected' : 'approved')}
                                      disabled={bookingLoadingId !== null}
                                      className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 border-b border-dashed border-indigo-400/30 hover:border-indigo-400 transition-all cursor-pointer"
                                      id={`override-btn-${booking.id}`}
                                    >
                                      {bookingLoadingId === `${booking.id}-approved` || bookingLoadingId === `${booking.id}-rejected` ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                                      ) : null}
                                      Tukar Status
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Floating Modal for Adding / Editing Room Specs */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4" id="room-customise-modal">
            {/* Dark Blur Overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!savingProgress) setIsRoomModalOpen(false); }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Canvas Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Banner Title */}
              <div className="p-5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl text-white ${editingRoomId ? 'bg-indigo-650' : 'bg-emerald-600'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {editingRoomId ? 'Ubahsuai Spesifikasi Ruang' : 'Pendaftaran Ruangan Mesyuarat Baru'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Setup Ruang Kerja & Kolaborasi</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingProgress}
                  onClick={() => setIsRoomModalOpen(false)}
                  className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-450 hover:text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content Scrolling container */}
              <form onSubmit={handleRoomSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-200" id="room-specs-form">
                
                {formError && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl font-medium" id="form-validation-error">
                    🚨 {formError}
                  </div>
                )}

                {/* Identity and ID settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">ID Bilik Unik (Slug)*</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        disabled={editingRoomId !== null || savingProgress}
                        value={roomForm.id}
                        onChange={(e) => setRoomForm({ ...roomForm, id: e.target.value })}
                        placeholder="contoh: bilik-alpha-1"
                        className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 font-mono text-slate-100 outline-none transition-colors disabled:opacity-60 disabled:bg-slate-950/80"
                        id="form-room-id"
                      />
                      {editingRoomId && (
                        <span className="absolute right-3.5 top-3 text-slate-500" title="Alamat ID unik tidak boleh diubahsuai">
                          🔒
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      {editingRoomId ? 'Pengenal pangkalan data (Slug) selamat dikunci.' : 'Hanya huruf, nombor, tanda sempang (-), dan garis bawah (_). Max: 128 aksara.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Nama Ruangan*</label>
                    <input
                      type="text"
                      required
                      disabled={savingProgress}
                      value={roomForm.name}
                      onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                      placeholder="contoh: Bilik Perbincangan Alpha"
                      className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 outline-none transition-colors disabled:opacity-50"
                      id="form-room-name"
                    />
                    <p className="text-[10px] text-slate-500">Nama mesra pengguna untuk katalog paparan.</p>
                  </div>
                </div>

                {/* Capacity and Layout configurations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Kapasiti Maksimum Personnel*</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000}
                      disabled={savingProgress}
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                      placeholder="contoh: 12"
                      className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 outline-none transition-colors disabled:opacity-50"
                      id="form-room-capacity"
                    />
                    <p className="text-[10px] text-slate-500">Kapasiti maksimum yang dibenarkan dalam satu sesi.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Jenis Susun Atur Kerusi*</label>
                    <select
                      required
                      disabled={savingProgress}
                      value={roomForm.layoutType}
                      onChange={(e) => setRoomForm({ ...roomForm, layoutType: e.target.value as RoomLayoutType })}
                      className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 outline-none transition-colors disabled:opacity-50 appearance-none text-xs"
                      id="form-room-layout"
                    >
                      <option value="Boardroom" className="bg-slate-900 text-slate-200">Boardroom (Meja Bulat Eksekutif)</option>
                      <option value="Conference" className="bg-slate-900 text-slate-200">Conference (Persidangan Umum)</option>
                      <option value="U-Shape" className="bg-slate-900 text-slate-200">U-Shape (Bentuk U Interaktif)</option>
                      <option value="Lecture" className="bg-slate-900 text-slate-200">Lecture (Dewan Syarahan)</option>
                      <option value="Project Room" className="bg-slate-900 text-slate-200">Project Room (Bilik Sprints Projek)</option>
                    </select>
                    <p className="text-[10px] text-slate-500">Gaya konfigurasi susun atur dalam bilik.</p>
                  </div>
                </div>

                {/* Amenities / Kemudahan tags */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Kemudahan Alat & Teknologi (Pisahkan dengan koma)</label>
                  <input
                    type="text"
                    disabled={savingProgress}
                    value={roomForm.amenitiesInput}
                    onChange={(e) => setRoomForm({ ...roomForm, amenitiesInput: e.target.value })}
                    placeholder="contoh: Projektor Laser, Surround Audio, Wi-Fi 6-E, Coffee Station"
                    className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 outline-none transition-colors disabled:opacity-50"
                    id="form-room-amenities"
                  />
                  <p className="text-[10px] text-slate-500">
                    Sistem akan menyusun perkataan ini menjadi tag kecil secara automatik.
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">Keterangan Huraian Ruang*</label>
                  <textarea
                    required
                    rows={3}
                    maxLength={1000}
                    disabled={savingProgress}
                    value={roomForm.description}
                    onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                    placeholder="Huraikan kelebihan, kelengkapan, dan kegunaan ideal ruangan mesyuarat atau persidangan ini..."
                    className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 outline-none transition-colors disabled:opacity-50 resize-y"
                    id="form-room-description"
                  />
                </div>

                {/* Core Image Setup with Presets */}
                <div className="space-y-3.5 pt-2 border-t border-slate-800/60">
                  <div className="space-y-1.5">
                    <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">URL Gambar Ruangan (Alamat Web)*</label>
                    <input
                      type="url"
                      required
                      disabled={savingProgress}
                      value={roomForm.imageUrl}
                      onChange={(e) => setRoomForm({ ...roomForm, imageUrl: e.target.value })}
                      placeholder="Masukkan apa-apa pautan imej web yang sah..."
                      className="w-full bg-slate-950/40 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono outline-none transition-colors disabled:opacity-50"
                      id="form-room-image-url"
                    />
                  </div>

                  {/* Thumbnail choices */}
                  <div className="space-y-2">
                    <span className="block text-slate-500 font-bold uppercase text-[9px] tracking-wider">Cepat Pilih dari Preset Gambar Premium:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" id="image-preset-thumbnails">
                      {ROOM_IMAGE_PRESETS.map((preset, index) => {
                        const isPresetSelected = roomForm.imageUrl === preset.url;
                        return (
                          <button
                            key={index}
                            type="button"
                            disabled={savingProgress}
                            onClick={() => setRoomForm({ ...roomForm, imageUrl: preset.url })}
                            className={`p-1.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                              isPresetSelected
                                ? 'bg-indigo-650/30 border-indigo-500 text-white shadow'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <img
                              src={preset.url}
                              alt={preset.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                            <span className="truncate text-[9px] font-bold uppercase tracking-tight block">
                              {preset.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Layout image aspect review */}
                  <div className="space-y-2">
                    <span className="block text-slate-500 font-bold uppercase text-[9px] tracking-wider">Pratonton Visual Langsung:</span>
                    <div className="h-36 bg-slate-950/40 rounded-2xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
                      {roomForm.imageUrl ? (
                        <img
                          src={roomForm.imageUrl}
                          alt="Live Room Layout Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Suppress broken image error placeholder icon
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="text-slate-600 flex flex-col items-center justify-center gap-1.5">
                          <Image className="w-8 h-8 opacity-40" />
                          <span className="text-[10px]">Tiada URL imej disasarkan</span>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-slate-950/20 pointer-events-none" />
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/90 text-[8px] font-black uppercase tracking-widest text-slate-400 rounded-md border border-slate-800/50">
                        LIVE PREVIEW
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirmation Footer */}
                <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={savingProgress}
                    onClick={() => setIsRoomModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-350 hover:text-white rounded-2xl transition-all disabled:opacity-50 font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingProgress}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 font-bold text-white rounded-2xl transition-all shadow-md shadow-indigo-600/15 disabled:opacity-55 cursor-pointer"
                    id="save-room-submit-btn"
                  >
                    {savingProgress ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sedang Menyimpan...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Simpan Maklumat Ruang
                      </>
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-slate-955/40 border-t border-slate-900 py-6 mt-12 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-widest" id="admin-workspace-footer">
        © 2026 Admin Control Console • SpaceBook Systems Certified
      </footer>

    </div>
  );
}
