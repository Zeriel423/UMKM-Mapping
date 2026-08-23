import { lazy, Suspense } from 'react';
import App from './App.jsx';

const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const RootApp = () => {
  const isAdminPath = window.location.pathname === '/admin'
    || window.location.pathname.startsWith('/admin/');
  if (!isAdminPath) return <App />;

  return (
    <Suspense fallback={<div className="loading-screen">Memuat panel admin...</div>}>
      <AdminApp />
    </Suspense>
  );
};

export default RootApp;
