import { createClient } from '@supabase/supabase-js';

// Membaca konfigurasi publik dari environment Vite.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Menjadi penanda bahwa aplikasi dapat memakai database Supabase.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

// Membuat klien hanya ketika kedua environment variable tersedia.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        // Memperbarui token pengguna sebelum masa berlakunya habis.
        autoRefreshToken: true,
        // Membaca token login dari URL setelah proses autentikasi.
        detectSessionInUrl: true,
        // Menyimpan sesi agar pengguna tidak perlu login pada setiap refresh.
        persistSession: true,
      },
    })
  : null;
