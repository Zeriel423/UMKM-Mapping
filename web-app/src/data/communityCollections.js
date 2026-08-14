import { CakeSlice, HeartPulse, UtensilsCrossed } from 'lucide-react';

export const COMMUNITY_COLLECTIONS = [
  {
    id: 'oleh-oleh',
    title: 'Oleh-oleh & Jajanan',
    description: 'Camilan dan hidangan khas untuk dibawa pulang.',
    productTypes: ['A0014', 'A0007', 'A0012', 'A0009'],
    icon: CakeSlice,
  },
  {
    id: 'pesan-untuk-acara',
    title: 'Pesan untuk Acara',
    description: 'Katering dan makanan untuk kebutuhan bersama.',
    productTypes: ['A0016', 'A0004', 'A0001', 'A0009'],
    icon: UtensilsCrossed,
  },
  {
    id: 'alami-dan-sehat',
    title: 'Alami & Sehat',
    description: 'Jamu, olahan buah, dan pilihan bahan alami.',
    productTypes: ['B0001', 'A0005', 'A0003', 'A0011'],
    icon: HeartPulse,
  },
];
