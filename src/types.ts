export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
  createdAt?: string;
}

export type RoomLayoutType = 'Boardroom' | 'Conference' | 'U-Shape' | 'Lecture' | 'Project Room';

export interface Room {
  id: string; // Document ID
  name: string;
  capacity: number;
  layoutType: RoomLayoutType;
  amenities: string[];
  description: string;
  imageUrl: string;
}

export type BookingStatus = 'pending' | 'approved' | 'rejected';

export interface Booking {
  id: string; // Document ID
  roomId: string;
  roomName: string;
  userId: string;
  userEmail: string;
  userName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  purpose: string;
  status: BookingStatus;
  createdAt: any; // Timestamp or date ISO string
  updatedAt: any; // Timestamp or date ISO string
  attachmentUrl?: string;
  attachmentName?: string;
}
