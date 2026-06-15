import React, { useState } from 'react';
import { Booking } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, AlertTriangle, CheckCircle, Trash2, ShieldAlert, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BookingListProps {
  bookings: Booking[];
  currentUser: { uid: string };
  onCancelSuccess: () => void;
}

export default function BookingList({ bookings, currentUser, onCancelSuccess }: BookingListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorChat, setErrorChat] = useState<string | null>(null);

  // Filter only current user's bookings
  const userBookings = bookings.filter(b => b.userId === currentUser.uid);

  // Parse YYYY-MM-DD + HH:MM to determine chronological future boundary
  const isUpcoming = (bookingDate: string, startTime: string): boolean => {
    try {
      const now = new Date();
      const bookingDateTime = new Date(`${bookingDate}T${startTime}`);
      return bookingDateTime > now;
    } catch {
      return true;
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    setErrorChat(null);
    setLoadingId(booking.id);

    try {
      // Securely cancel booking by transitioning status to 'rejected' per the security policy ruleset
      const bookingDocRef = doc(db, 'bookings', booking.id);
      
      const updatePayload = {
        // Keep everything identical in payload except status and updatedAt to pass the strict diff matching
        id: booking.id,
        roomId: booking.roomId,
        roomName: booking.roomName,
        userId: booking.userId,
        userEmail: booking.userEmail,
        userName: booking.userName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        purpose: booking.purpose,
        createdAt: booking.createdAt,
        status: 'rejected' as const, // transitioning to cancel state
        updatedAt: new Date().toISOString()
      };

      await updateDoc(bookingDocRef, updatePayload);
      onCancelSuccess();
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
      } catch (formattedErr: any) {
        setErrorChat(`Failed to cancel booking: ${formattedErr.message || "Permissions denied."}`);
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md shadow-slate-100/50" id="booking-list-container">
      <div className="flex items-center justify-between mb-5" id="booking-header-bar">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <span>My Reservations</span>
        </h3>
        <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
          {userBookings.length} Bookings
        </span>
      </div>

      {errorChat && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2" id="booking-list-error">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorChat}</span>
        </div>
      )}

      {userBookings.length === 0 ? (
        <div className="py-12 text-center text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100" id="booking-list-empty">
          <Calendar className="w-8 h-8 text-slate-300" />
          <p>You have no bookings recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1" id="bookings-scroller">
          <AnimatePresence mode="popLayout">
            {userBookings
              .sort((a, b) => new Date(`${b.date}T${b.startTime}`).getTime() - new Date(`${a.date}T${a.startTime}`).getTime())
              .map((booking) => {
                const upcoming = isUpcoming(booking.date, booking.startTime);
                
                // Status styles
                let statusClasses = 'bg-amber-50 text-amber-700 border-amber-100';
                let statusLabel = 'Awaiting Review';
                if (booking.status === 'approved') {
                  statusClasses = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  statusLabel = 'Approved';
                } else if (booking.status === 'rejected') {
                  statusClasses = 'bg-rose-50 text-rose-700 border-rose-100';
                  statusLabel = 'Cancelled/Rejected';
                }

                return (
                  <motion.div
                    key={booking.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-slate-50/50"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      
                      {/* Booking Summary */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm">{booking.roomName}</h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusClasses}`}>
                            {statusLabel}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-600 font-medium italic">
                          "{booking.purpose}"
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
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
                          <div className="mt-2.5 flex items-center" id={`booking-attachment-link-${booking.id}`}>
                            <a
                              href={booking.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50/50 hover:bg-indigo-100/60 border border-indigo-100 px-3 py-1 rounded-xl transition-all"
                            >
                              <Paperclip className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="max-w-[170px] truncate">{booking.attachmentName || 'Download Attachment'}</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Control Group */}
                      <div className="flex items-center justify-end">
                        {upcoming && booking.status !== 'rejected' ? (
                          <button
                            onClick={() => handleCancelBooking(booking)}
                            disabled={loadingId === booking.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-100 text-rose-700 disabled:text-slate-400 text-xs font-semibold rounded-lg border border-rose-100 transition-colors"
                            id={`cancel-booking-btn-${booking.id}`}
                          >
                            {loadingId === booking.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                Cancel
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {!upcoming ? 'Past Event' : 'Closed'}
                          </span>
                        )}
                      </div>

                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
