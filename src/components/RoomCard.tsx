import React from 'react';
import { Room } from '../types';
import { Users, Grid, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface RoomCardProps {
  room: Room;
  onBook: (room: Room) => void;
  isSelected?: boolean;
  key?: string | number;
}

export default function RoomCard({ room, onBook, isSelected = false }: RoomCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col justify-between ${
        isSelected 
          ? 'ring-2 ring-indigo-600 border-indigo-200 shadow-xl shadow-indigo-50' 
          : 'border-slate-100 shadow-md shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-200/50'
      }`}
      id={`room-card-${room.id}`}
    >
      <div id={`room-info-group-${room.id}`}>
        {/* Room Illustration */}
        <div className="relative h-48 w-full bg-slate-100 overflow-hidden" id={`room-image-container-${room.id}`}>
          <img
            src={room.imageUrl}
            alt={room.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            onError={(e) => {
              // fallback if unsplash fails
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800';
            }}
          />
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-slate-800 flex items-center gap-1.5 shadow-sm" id={`room-capacity-${room.id}`}>
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Seats {room.capacity}</span>
          </div>

          <div className="absolute bottom-3 left-3 bg-indigo-600 px-3 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 shadow" id={`room-layout-${room.id}`}>
            <Grid className="w-3.5 h-3.5" />
            <span>{room.layoutType}</span>
          </div>
        </div>

        {/* Room Info */}
        <div className="p-6 space-y-3" id={`room-context-${room.id}`}>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight" id={`room-name-${room.id}`}>
            {room.name}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2" id={`room-description-${room.id}`}>
            {room.description}
          </p>

          {/* Amenities Badges Grid */}
          <div id={`room-amenities-${room.id}`}>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Amenities</h4>
            <div className="flex flex-wrap gap-1.5">
              {room.amenities.map((amenity, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-600 rounded-lg"
                  id={`amenity-badge-${room.id}-${idx}`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 pt-0 mt-auto" id={`room-action-wrap-${room.id}`}>
        <button
          onClick={() => onBook(room)}
          className={`w-full py-2.5 px-4 font-semibold text-xs rounded-xl transition-all duration-200 outline-none flex items-center justify-center gap-2 ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100 active:scale-98'
          }`}
          id={`room-select-btn-${room.id}`}
        >
          {isSelected ? 'Room Selected' : 'Select for Booking'}
        </button>
      </div>
    </motion.div>
  );
}
