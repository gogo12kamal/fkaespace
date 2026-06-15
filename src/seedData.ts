import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Room } from './types';

export const PRESET_ROOMS: Room[] = [
  {
    id: 'orion-boardroom',
    name: 'Orion Executive Boardroom',
    capacity: 14,
    layoutType: 'Boardroom',
    amenities: ['8K Smart Display', 'Stereo Video Conference', 'Integrated Power Nodes', 'Espresso Station'],
    description: 'A premium, fully soundproof boardroom designed for executive decisions, key presentations, and high-stakes negotiations.',
    imageUrl: 'https://images.unsplash.com/photo-1517502884422-41eaaced0168?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'horizon-conference',
    name: 'Horizon Conference Hall',
    capacity: 40,
    layoutType: 'Conference',
    amenities: ['Dual Laser Projectors', 'Surround Sound Audio', 'Modular Whiteboards', 'Dimmable Scene Lighting'],
    description: 'A spacious, highly versatile conferencing space suited for department-wide syncs, client workshops, and panel discussions.',
    imageUrl: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'nebula-workshop',
    name: 'Nebula U-Shape Hub',
    capacity: 22,
    layoutType: 'U-Shape',
    amenities: ['Surround Acoustic Panels', 'Interactive Smartboard', 'Mobile Flipcharts', 'High-Speed Wi-Fi 6E'],
    description: 'Collaborative interactive environment featuring a modular U-shape table configuration to foster professional training and group seminars.',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'apollo-hall',
    name: 'Apollo Lecture Theater',
    capacity: 75,
    layoutType: 'Lecture',
    amenities: ['Wireless Lapel Mics', 'Presentation Stage & Podium', 'Dual Screen Projection', 'Lecture Capture System'],
    description: 'Large-capacity lecture hall ideal for guest lecture series, quarterly all-hands meetings, or comprehensive technical seminars.',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'genesis-project',
    name: 'Genesis Project Room',
    capacity: 8,
    layoutType: 'Project Room',
    amenities: ['Wall-to-wall Glass Whiteboards', 'Apple TV AirPlay Sync', 'Adjustable Standing Desks', 'Sprint Kanban Wall'],
    description: 'An intimate, high-energy breakout room packed with rapid collaboration tools for design sprints, focus groups, and agile brainstorming syncs.',
    imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=800'
  }
];

export async function seedRoomsIfEmpty(): Promise<void> {
  try {
    const roomsColRef = collection(db, 'rooms');
    const snap = await getDocs(roomsColRef);
    if (snap.empty) {
      console.log('No rooms defined in firestore. Seeding default SpaceBook rooms catalog...');
      const batch = writeBatch(db);
      PRESET_ROOMS.forEach((room) => {
        const roomDocRef = doc(db, 'rooms', room.id);
        batch.set(roomDocRef, room);
      });
      await batch.commit();
      console.log('Successfully seeded SpaceBook rooms.');
    }
  } catch (error) {
    console.error('Failed to seed default database rooms:', error);
  }
}
