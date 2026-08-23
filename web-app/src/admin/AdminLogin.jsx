import { AlertCircle, ArrowLeft, Database, LockKeyhole, LogIn } from 'lucide-react';
import { useState } from 'react';

const AdminLogin = ({ onSignIn, error, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    await onSignIn(email, password);
  };

  return (
    <div className="admin-auth-page">
      <a className="admin-back-link" href="/">
        <ArrowLeft size={17} /> Kembali ke peta publik
      </a>

      <main className="admin-auth-card" aria-labelledby="admin-login-title">
        <div className="admin-auth-mark" aria-hidden="true">
          <LockKeyhole size={28} />
        </div>
        <p className="admin-eyebrow">PANEL PENGELOLA</p>
        <h1 id="admin-login-title">Masuk sebagai admin</h1>
        <p className="admin-muted">
          Kelola data, verifikasi koordinat, dan simpan hasil analisis K-Means.
        </p>

        {error && (
          <div className="admin-alert admin-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form className="admin-form" onSubmit={submit}>
          <label className="admin-field">
            <span>Email admin</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="admin@contoh.go.id"
              required
            />
          </label>

          <label className="admin-field">
            <span>Kata sandi</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          <button className="admin-primary-button admin-full-button" type="submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Memeriksa akun...' : 'Masuk ke dashboard'}
          </button>
        </form>

        <div className="admin-auth-security">
          <Database size={18} />
          <span>Akses data dilindungi autentikasi dan Row Level Security.</span>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;
