import React, { useState } from 'react';
import { Room, Booking } from '../types';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Calendar, Clock, Edit3, CheckCircle2, ShieldAlert, UploadCloud, Paperclip, X, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface BookingFormProps {
  selectedRoom: Room | null;
  currentUser: { uid: string; email: string; displayName: string };
  onBookingSuccess: () => void;
  // A helper list of existing bookings passed down to check for conflicts in real-time
  existingBookings: Booking[];
}

export default function BookingForm({ selectedRoom, currentUser, onBookingSuccess, existingBookings }: BookingFormProps) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Floating Toast Notifications System State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Storage Attachment States
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      const errorMsg = "File is too large. Maximum size allowed is 10MB.";
      setError(errorMsg);
      addToast('error', errorMsg);
      return;
    }

    setFile(selectedFile);
    setUploadLoading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const uniqueFileName = `${currentUser.uid}_${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, `bookings_attachments/${uniqueFileName}`);

      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (err) => {
          console.error("Storage upload error:", err);
          const errorMsg = "Storage upload restricted. Please ensure your bucket is fully provisioned.";
          setError(errorMsg);
          addToast('error', errorMsg);
          setUploadProgress(null);
          setFile(null);
          setUploadLoading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadedUrl(downloadUrl);
          setUploadedName(selectedFile.name);
          setUploadProgress(null);
          setUploadLoading(false);
          addToast('success', `Attachment "${selectedFile.name}" successfully uploaded.`);
        }
      );
    } catch (err: any) {
      console.error(err);
      const errorMsg = "Initialization of file upload failed: " + err.message;
      setError(errorMsg);
      addToast('error', errorMsg);
      setUploadLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const removeAttachment = () => {
    setFile(null);
    setUploadedUrl(null);
    setUploadedName(null);
    setUploadProgress(null);
  };

  // Helper: converts "HH:MM" to numerical minutes for interval overlapping operations
  const timeToMinutes = (timeStr: string): number => {
    const [hrs, mins] = timeStr.split(':').map(Number);
    return hrs * 60 + mins;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedRoom || !selectedRoom.id) {
      const msg = "Please select a valid meeting room first.";
      setError(msg);
      addToast('error', msg);
      return;
    }

    if (!date) {
      const msg = "Please select a reservation date.";
      setError(msg);
      addToast('error', msg);
      return;
    }

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (startMin >= endMin) {
      const msg = "End time must be after start time.";
      setError(msg);
      addToast('error', msg);
      return;
    }

    // Minimum 15-minute booking constraint
    if (endMin - startMin < 15) {
      const msg = "Bookings must be at least 15 minutes long.";
      setError(msg);
      addToast('error', msg);
      return;
    }

    setLoading(true);

    try {
      // 1. Double-booking conflict check:
      // Filter existing active bookings for this room on the selected date
      const activeConflicts = existingBookings.filter(booking => {
        if (booking.roomId !== selectedRoom.id) return false;
        if (booking.date !== date) return false;
        if (booking.status === 'rejected') return false; // Rejected/cancelled bookings don't block slots
        
        // Check for time overlap
        const bStart = timeToMinutes(booking.startTime);
        const bEnd = timeToMinutes(booking.endTime);
        
        // Classic interval overlap rule: startA < endB AND startB < endA
        return startMin < bEnd && bStart < endMin;
      });

      if (activeConflicts.length > 0) {
        const conflict = activeConflicts[0];
        const errorMsg = `Time Conflict: This room is already booked from ${conflict.startTime} to ${conflict.endTime} for "${conflict.purpose}" (by ${conflict.userName}).`;
        setError(errorMsg);
        addToast('error', errorMsg);
        setLoading(false);
        return;
      }

      // 2. Insert the booking into firestore
      const bookingCollection = collection(db, 'bookings');
      const newDocRef = doc(bookingCollection);
      const bookingId = newDocRef.id;
      
      const newBookingPayload = {
        id: bookingId, // REQUIRED: Required by security rules constraint (request.resource.data.id == bookingId)
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || 'SpaceBook User',
        date,
        startTime,
        endTime,
        purpose: purpose.trim() || 'General Business Sync',
        status: 'pending', // Default is pending, awaiting simple administrator review
        createdAt: new Date().toISOString(), // rules accept standard timestamp ISO or server dates
        updatedAt: new Date().toISOString(),
        ...(uploadedUrl ? { attachmentUrl: uploadedUrl, attachmentName: uploadedName } : {})
      };

      // Since the actual firebase write might run, let's catch standard errors using handleFirestoreError
      await setDoc(newDocRef, newBookingPayload);
      
      // Update with generated ID to lock resource
      const successMsg = `Success! Your booking for ${selectedRoom.name} has been submitted for approval.`;
      setSuccess(successMsg);
      addToast('success', successMsg);
      setPurpose('');
      removeAttachment();
      onBookingSuccess();
      
    } catch (err: any) {
      console.error(err);
      // Ensure we format the error as a JSON string to comply with Firebase requirements
      try {
        handleFirestoreError(err, OperationType.CREATE, 'bookings');
      } catch (formattedErr: any) {
        let displayError = "An error occurred while making the booking.";
        try {
          const parsed = JSON.parse(formattedErr.message);
          if (parsed && parsed.error) {
            displayError = parsed.error;
          }
        } catch {
          displayError = formattedErr.message || "An error occurred while making the booking.";
        }
        setError(displayError);
        addToast('error', displayError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-6 border border-slate-100 shadow-md shadow-slate-100/50"
      id="booking-form-wrapper"
    >
      <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-5 flex items-center gap-2" id="booking-form-title">
        <Edit3 className="w-5 h-5 text-indigo-600" />
        <span>Reservation Panel</span>
      </h3>

      {!selectedRoom ? (
        <div className="py-12 text-center text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100" id="no-room-alert">
          <Clock className="w-8 h-8 text-slate-300" />
          <p>Choose a meeting room first from the catalog to book your slot.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" id="room-reservation-form">
          {/* Target Spec Indicator */}
          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/40" id="booking-room-spec">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Selected Space</span>
            <p className="font-bold text-slate-800 text-sm">{selectedRoom.name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{selectedRoom.capacity} People • {selectedRoom.layoutType} Seating</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-2" id="booking-error">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-100 flex items-start gap-2" id="booking-success">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="booking-date">
              Reservation Date
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                id="booking-date"
                required
                value={date}
                min={new Date().toISOString().split('T')[0]} // prevent booking past dates
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4" id="booking-time-grid">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="booking-start">
                Start Time
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </span>
                <select
                  id="booking-start"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800 bg-white"
                >
                  <option value="07:00">07:00 AM</option>
                  <option value="07:30">07:30 AM</option>
                  <option value="08:00">08:00 AM</option>
                  <option value="08:30">08:30 AM</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:00">01:00 PM</option>
                  <option value="13:30">01:30 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="15:30">03:30 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="16:30">04:30 PM</option>
                  <option value="17:00">05:00 PM</option>
                  <option value="17:30">05:30 PM</option>
                  <option value="18:00">06:00 PM</option>
                  <option value="18:30">06:30 PM</option>
                  <option value="19:00">07:00 PM</option>
                  <option value="19:30">07:30 PM</option>
                  <option value="20:00">08:00 PM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="booking-end">
                End Time
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Clock className="w-4 h-4" />
                </span>
                <select
                  id="booking-end"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800 bg-white"
                >
                  <option value="07:30">07:30 AM</option>
                  <option value="08:00">08:00 AM</option>
                  <option value="08:30">08:30 AM</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:00">01:00 PM</option>
                  <option value="13:30">01:30 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="15:30">03:30 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="16:30">04:30 PM</option>
                  <option value="17:00">05:00 PM</option>
                  <option value="17:30">05:30 PM</option>
                  <option value="18:00">06:00 PM</option>
                  <option value="18:30">06:30 PM</option>
                  <option value="19:00">07:00 PM</option>
                  <option value="19:30">07:30 PM</option>
                  <option value="20:00">08:00 PM</option>
                  <option value="20:30">08:30 PM</option>
                  <option value="21:00">09:00 PM</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="booking-purpose">
              Meeting Purpose / Subject
            </label>
            <input
              type="text"
              id="booking-purpose"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value.slice(0, 100))}
              placeholder="e.g., Weekly Team Sprint Planning"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm text-slate-800"
            />
            <span className="text-[10px] text-slate-400 text-right block mt-1">{purpose.length}/100 chars</span>
          </div>

          {/* File Upload Attachment Segment with Drag-and-Drop / Custom Trigger */}
          <div className="space-y-1.5" id="attachments-dropzone-sec">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reference Attachments (Optional)
            </label>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-4.5 text-center transition-all ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/30' 
                  : uploadedUrl 
                    ? 'border-emerald-200 bg-emerald-50/10' 
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
              }`}
              id="dropzone-area"
            >
              <input
                type="file"
                id="booking-attachment-input"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {!uploadedUrl && !uploadLoading && (
                <label 
                  htmlFor="booking-attachment-input" 
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-2"
                >
                  <UploadCloud className="w-8 h-8 text-slate-400" />
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-indigo-600">Click to upload</span> or drag document here
                  </div>
                  <p className="text-[10px] text-slate-400">PDF, PNG, JPG, or DOCX (Max 10MB)</p>
                </label>
              )}

              {uploadLoading && (
                <div className="flex flex-col items-center justify-center py-3 gap-2">
                  <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-700">Uploading: {uploadProgress}%</span>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[200px] mx-auto">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadedUrl && (
                <div className="flex items-center justify-between bg-emerald-50/45 p-3 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-800 truncate" title={uploadedName || ''}>
                      {uploadedName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 hover:text-emerald-800 transition-colors"
                    id="remove-attachment-btn"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all outline-none"
            id="book-room-btn"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Book Reservation"
            )}
          </button>
        </form>
      )}

      {/* Floating Toast Notification Container */}
      <div 
        className="fixed bottom-5 right-5 flex flex-col gap-3 max-w-sm w-full pointer-events-none" 
        style={{ zIndex: 9999 }}
        id="toast-notifications-portal"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className={`p-4 rounded-2xl shadow-xl flex items-start gap-3 border pointer-events-auto backdrop-blur-md ${
                toast.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-100/30'
                  : 'bg-red-50/95 border-red-200 text-red-950 shadow-red-100/30'
              }`}
              id={`toast-body-${toast.id}`}
            >
              <div className="shrink-0 mt-0.5" id={`toast-icon-${toast.id}`}>
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 text-xs leading-relaxed" id={`toast-content-${toast.id}`}>
                <p className="font-extrabold text-[11px] uppercase tracking-wider mb-0.5 text-slate-800">
                  {toast.type === 'success' ? 'Reservation Processed' : 'Alert Triggered'}
                </p>
                <p className="text-slate-600 font-medium">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-700"
                id={`toast-close-${toast.id}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
