import React, { useState } from 'react';
import { Booking } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Users, Check, X, Search, Filter, ShieldCheck, 
  Calendar, Clock, ShieldAlert, ArrowUpRight, BarChart3, Clock3,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  bookings: Booking[];
  onReviewSuccess: () => void;
}

export default function AdminPanel({ bookings, onReviewSuccess }: AdminPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Compute metric cards
  const totalBookings = bookings.length;
  const pendingApprovals = bookings.filter(b => b.status === 'pending').length;
  const approvedBookings = bookings.filter(b => b.status === 'approved').length;
  const rejectedBookings = bookings.filter(b => b.status === 'rejected').length;

  // Filter bookings based on search & filters
  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (booking: Booking, newStatus: 'approved' | 'rejected') => {
    setActionError(null);
    setLoadingId(`${booking.id}-${newStatus}`);

    try {
      const bookingDocRef = doc(db, 'bookings', booking.id);
      
      // Update payload
      const updatePayload = {
        ...booking,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(bookingDocRef, updatePayload);
      onReviewSuccess();
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
      } catch (formattedErr: any) {
        setActionError(`Failed to update booking status: ${formattedErr.message || "Admin authorization denied."}`);
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6" id="admin-panel-container">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="admin-metrics-grid">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Bookings</span>
            <p className="text-2xl font-black text-slate-800">{totalBookings}</p>
          </div>
          <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500">Pending Review</span>
            <p className="text-2xl font-black text-amber-600">{pendingApprovals}</p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
            <Clock3 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 font-semibold">Approved</span>
            <p className="text-2xl font-black text-emerald-600">{approvedBookings}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500">Rejected / Canceled</span>
            <p className="text-2xl font-black text-rose-600">{rejectedBookings}</p>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
            <X className="w-5 h-5" />
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2" id="admin-panel-error">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Control Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between" id="admin-search-bar">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            required={false}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search email, room, purpose..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs text-slate-800"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full md:w-auto" id="admin-filter-pills">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all ${
                statusFilter === status
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Core Bookings List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md shadow-slate-100/50 overflow-hidden" id="admin-bookings-table">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2" id="table-title">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">Global SpaceBook Reservations Registry</h3>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-3 bg-slate-50" id="table-empty">
            <Calendar className="w-8 h-8 text-slate-300" />
            <p>No reservations matching filters are logged in SpaceBook.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100" id="global-booking-list">
            <AnimatePresence mode="popLayout">
              {filteredBookings
                .sort((a, b) => new Date(`${b.date}T${b.startTime}`).getTime() - new Date(`${a.date}T${a.startTime}`).getTime())
                .map((booking) => {
                  let statusBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-100';
                  let statusTitle = 'Pending Approval';
                  if (booking.status === 'approved') {
                    statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                    statusTitle = 'Approved';
                  } else if (booking.status === 'rejected') {
                    statusBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-100';
                    statusTitle = 'Rejected';
                  }

                  return (
                    <motion.div
                      key={booking.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors"
                    >
                      {/* Booking Spec */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs bg-slate-100 font-bold text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                            {booking.roomName}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeStyle}`}>
                            {statusTitle}
                          </span>
                        </div>

                        {/* Subject info */}
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800 italic">"{booking.purpose}"</p>
                          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                            <span>Reserved by:</span> 
                            <strong className="text-slate-700">{booking.userName}</strong>
                            <span className="text-slate-400">({booking.userEmail})</span>
                          </p>
                        </div>

                        {/* Booking Schedule */}
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {booking.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {booking.startTime} - {booking.endTime}
                          </span>
                        </div>

                        {booking.attachmentUrl && (
                          <div className="mt-2 flex items-center" id={`admin-booking-attachment-${booking.id}`}>
                            <a
                              href={booking.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50/50 hover:bg-indigo-100/60 border border-indigo-100 px-3 py-1 rounded-xl transition-all"
                            >
                              <Paperclip className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="max-w-[180px] truncate">{booking.attachmentName || 'Review Document'}</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Approval Actions */}
                      <div className="flex items-center gap-2 self-end md:self-center" id={`admin-actions-${booking.id}`}>
                        {booking.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(booking, 'approved')}
                              disabled={loadingId !== null}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
                              id={`approve-btn-${booking.id}`}
                            >
                              {loadingId === `${booking.id}-approved` ? (
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Approve
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(booking, 'rejected')}
                              disabled={loadingId !== null}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-200 text-rose-700 text-xs font-bold rounded-lg border border-rose-100 transition-all active:scale-95"
                              id={`reject-btn-${booking.id}`}
                            >
                              {loadingId === `${booking.id}-rejected` ? (
                                <span className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          // If already reviewed, allow changing it or overriding (since they are admin they can correct mistakes!)
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-medium">Overridable acts:</span>
                            <button
                              onClick={() => handleUpdateStatus(booking, booking.status === 'approved' ? 'rejected' : 'approved')}
                              disabled={loadingId !== null}
                              className="text-[10px] uppercase font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                              id={`override-btn-${booking.id}`}
                            >
                              Toggle Status
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
