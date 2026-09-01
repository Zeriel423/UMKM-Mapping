import { lazy, Suspense } from 'react';
import App from './App.jsx';

// Panel admin dimuat terpisah agar bundle halaman publik tetap kecil.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

// Menentukan aplikasi publik atau panel admin dari URL aktif.
const RootApp = () => {
  // Semua turunan /admin menggunakan aplikasi admin yang sama.
  const isAdminPath = window.location.pathname === '/admin'
    || window.location.pathname.startsWith('/admin/');
  if (!isAdminPath) return <App />;

  return (
    // Menampilkan status pemuatan saat chunk admin belum selesai diunduh.
    <Suspense fallback={<div className="loading-screen">Memuat panel admin...</div>}>
      <AdminApp />
    </Suspense>
  );
};

export default RootApp;
