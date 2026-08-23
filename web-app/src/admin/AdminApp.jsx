import {
  ArrowLeftRight,
  BarChart3,
  History,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  ShieldAlert,
  Store,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { loadAdminBusinesses, loadAdminProfile } from '../services/umkmService';
import AdminLogin from './AdminLogin';
import AdminSetup from './AdminSetup';
import AuditPage from './pages/AuditPage';
import BusinessesPage from './pages/BusinessesPage';
import DashboardPage from './pages/DashboardPage';
import ImportExportPage from './pages/ImportExportPage';
import KMeansPage from './pages/KMeansPage';
import VerificationPage from './pages/VerificationPage';
import './admin.css';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/umkm', label: 'Data UMKM', icon: Store },
  { path: '/admin/verifikasi', label: 'Verifikasi Lokasi', icon: MapPinned, access: 'verify' },
  { path: '/admin/kmeans', label: 'Analisis K-Means', icon: BarChart3 },
  { path: '/admin/impor', label: 'Impor & Ekspor', icon: ArrowLeftRight, access: 'manage' },
  { path: '/admin/riwayat', label: 'Riwayat', icon: History },
];

const ROLE_LABELS = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  verifikator: 'Verifikator',
  viewer: 'Pembaca',
};

const normalizedAdminPath = () => {
  const path = window.location.pathname.replace(/\/$/, '') || '/admin';
  return NAV_ITEMS.some((item) => item.path === path) ? path : '/admin';
};

const AdminWorkspace = ({ profile, onSignOut }) => {
  const [route, setRoute] = useState(normalizedAdminPath);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compactNavigation, setCompactNavigation] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [toast, setToast] = useState(null);
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const sidebarWasOpen = useRef(false);
  const canManage = ['superadmin', 'admin'].includes(profile.role);
  const canVerify = canManage || profile.role === 'verifikator';
  const visibleNavItems = useMemo(() => NAV_ITEMS.filter((item) => (
    !item.access
    || (item.access === 'manage' && canManage)
    || (item.access === 'verify' && canVerify)
  )), [canManage, canVerify]);
  const activeRoute = visibleNavItems.some((item) => item.path === route) ? route : '/admin';

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBusinesses(await loadAdminBusinesses());
      setDataError('');
    } catch (error) {
      const message = error.message || 'Data admin gagal dimuat.';
      setDataError(message);
      notify(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    loadAdminBusinesses()
      .then((data) => {
        if (active) {
          setBusinesses(data);
          setDataError('');
        }
      })
      .catch((error) => {
        if (active) {
          const message = error.message || 'Data admin gagal dimuat.';
          setDataError(message);
          notify(message, 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    const syncRoute = () => setRoute(normalizedAdminPath());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (activeRoute !== route) window.history.replaceState({}, '', '/admin');
  }, [activeRoute, route]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const updateNavigationMode = (event) => setCompactNavigation(event.matches);
    media.addEventListener('change', updateNavigationMode);
    return () => media.removeEventListener('change', updateNavigationMode);
  }, []);

  useEffect(() => {
    const drawerActive = compactNavigation && sidebarOpen;
    document.body.classList.toggle('admin-drawer-open', drawerActive);

    if (drawerActive) {
      window.requestAnimationFrame(() => {
        sidebarRef.current?.querySelector('button')?.focus();
      });
    } else if (compactNavigation && sidebarWasOpen.current) {
      menuButtonRef.current?.focus();
    }
    sidebarWasOpen.current = drawerActive;

    return () => document.body.classList.remove('admin-drawer-open');
  }, [compactNavigation, sidebarOpen]);

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setRoute(path);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const page = useMemo(() => {
    if (dataError && activeRoute !== '/admin/riwayat') {
      return (
        <div className="admin-page-stack">
          <div className="admin-page-heading"><div><p className="admin-eyebrow">KONEKSI DATA</p><h1>Data admin tidak dapat dimuat</h1><p>Operasi pengelolaan dinonaktifkan agar data yang sebenarnya tidak tertimpa.</p></div></div>
          <div className="admin-alert admin-alert-error"><ShieldAlert size={20} /><div><strong>Periksa koneksi atau kebijakan database.</strong><p>{dataError}</p><button className="admin-secondary-button" type="button" onClick={refresh} disabled={loading}>{loading ? 'Mencoba kembali...' : 'Coba muat ulang'}</button></div></div>
        </div>
      );
    }
    if (activeRoute === '/admin/umkm') return <BusinessesPage businesses={businesses} loading={loading} refresh={refresh} notify={notify} canManage={canManage} />;
    if (activeRoute === '/admin/verifikasi' && canVerify) return <VerificationPage businesses={businesses} refresh={refresh} notify={notify} />;
    if (activeRoute === '/admin/kmeans') return <KMeansPage businesses={businesses} notify={notify} canSave={canManage} />;
    if (activeRoute === '/admin/impor' && canManage) return <ImportExportPage businesses={businesses} refresh={refresh} notify={notify} />;
    if (activeRoute === '/admin/riwayat') return <AuditPage notify={notify} />;
    return <DashboardPage businesses={businesses} loading={loading} onNavigate={navigate} canVerify={canVerify} />;
  }, [activeRoute, businesses, canManage, canVerify, dataError, loading, navigate, notify, refresh]);

  return (
    <div className={`admin-shell ${sidebarOpen ? 'admin-sidebar-open' : ''}`}>
      <button ref={menuButtonRef} className="admin-mobile-menu" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-expanded={sidebarOpen} aria-controls="admin-sidebar" aria-label={sidebarOpen ? 'Tutup menu admin' : 'Buka menu admin'}>{sidebarOpen ? <X size={22} /> : <Menu size={22} />}</button>
      <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <aside ref={sidebarRef} className="admin-sidebar" id="admin-sidebar" aria-hidden={compactNavigation && !sidebarOpen} inert={compactNavigation && !sidebarOpen ? '' : undefined}>
        <div className="admin-brand"><span>ZU</span><div><strong>Zonasi UMKM</strong><small>Panel Admin</small></div></div>
        <nav className="admin-nav" aria-label="Navigasi admin">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return <button className={activeRoute === item.path ? 'active' : ''} type="button" key={item.path} onClick={() => navigate(item.path)} aria-current={activeRoute === item.path ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-profile"><span>{(profile.full_name || 'A').slice(0, 1).toUpperCase()}</span><div><strong>{profile.full_name || 'Administrator'}</strong><small>{ROLE_LABELS[profile.role] || profile.role}</small></div></div>
          <button className="admin-signout-button" type="button" onClick={onSignOut}><LogOut size={18} /> Keluar</button>
          <a href="/">Lihat website publik</a>
        </div>
      </aside>

      <main className="admin-main" aria-hidden={compactNavigation && sidebarOpen} inert={compactNavigation && sidebarOpen ? '' : undefined}>{page}</main>

      {toast && <div className={`admin-toast admin-toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>{toast.message}</div>}
    </div>
  );
};

const AdminApp = () => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);

  useEffect(() => {
    document.body.classList.add('admin-page');
    return () => document.body.classList.remove('admin-page');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        if (data.session) setProfile(undefined);
        setAuthLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setProfile(undefined);
        setProfileError('');
        setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return undefined;

    let active = true;
    loadAdminProfile(session.user.id)
      .then((adminProfile) => {
        if (active) {
          setProfile(adminProfile);
          setProfileError('');
        }
      })
      .catch((error) => {
        if (active) {
          setProfile(null);
          setProfileError(error.message || 'Profil admin gagal diperiksa.');
        }
      });

    return () => { active = false; };
  }, [profileRetry, session]);

  const signIn = async (email, password) => {
    setLoginLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError('Email atau kata sandi tidak sesuai.');
    setLoginLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.history.replaceState({}, '', '/admin/login');
  };

  if (!isSupabaseConfigured) return <AdminSetup />;
  if (authLoading || (session && profile === undefined)) return <div className="admin-loading-screen">Memeriksa akses admin...</div>;
  if (!session) return <AdminLogin onSignIn={signIn} error={authError} loading={loginLoading} />;
  if (!profile) {
    return (
      <div className="admin-auth-page">
        <main className="admin-auth-card">
          <div className="admin-auth-mark admin-auth-mark-danger"><ShieldAlert size={28} /></div>
          <h1>{profileError ? 'Profil admin gagal diperiksa' : 'Akun belum memiliki akses'}</h1>
          <p className="admin-muted">{profileError || 'Akun berhasil masuk, tetapi belum terdaftar sebagai admin aktif.'}</p>
          {profileError && <button className="admin-primary-button admin-full-button" type="button" onClick={() => { setProfile(undefined); setProfileRetry((value) => value + 1); }}>Coba lagi</button>}
          <button className="admin-secondary-button admin-full-button" type="button" onClick={signOut}><LogOut size={18} /> Keluar</button>
        </main>
      </div>
    );
  }

  return <AdminWorkspace profile={profile} onSignOut={signOut} />;
};

export default AdminApp;
