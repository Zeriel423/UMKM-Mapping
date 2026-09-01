import { History, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadAuditLogs } from '../../services/umkmService';

// Mengubah kode audit database menjadi label yang mudah dibaca admin.
const ACTION_LABELS = {
  INSERT: 'Data ditambahkan',
  UPDATE: 'Data diperbarui',
  DELETE: 'Data dihapus',
};

// Menampilkan perubahan data terbaru untuk kebutuhan penelusuran.
const AuditPage = ({ notify }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Memuat audit log dan menyampaikan kegagalan ke toast bersama.
  const load = async () => {
    setLoading(true);
    try {
      setLogs(await loadAuditLogs());
    } catch (error) {
      notify(error.message || 'Riwayat perubahan gagal dimuat.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadAuditLogs()
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch((error) => {
        if (active) notify(error.message || 'Riwayat perubahan gagal dimuat.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [notify]);

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">JEJAK PERUBAHAN</p><h1>Riwayat Aktivitas</h1><p>100 perubahan UMKM terbaru yang tercatat otomatis oleh database.</p></div>
        <button className="admin-secondary-button" type="button" onClick={load} disabled={loading}><RefreshCw size={17} /> Muat ulang</button>
      </div>

      <section className="admin-panel admin-table-panel">
        {loading ? <div className="admin-empty-state">Memuat riwayat aktivitas...</div> : (
          <div className="admin-audit-list">
            {logs.map((log) => {
              const snapshot = log.new_data || log.old_data || {};
              return (
                <article className="admin-audit-item" key={log.id}>
                  <div className="admin-audit-icon"><History size={18} /></div>
                  <div>
                    <strong>{ACTION_LABELS[log.action] || log.action}</strong>
                    <span>{snapshot.brand || snapshot.name || `UMKM #${log.record_id}`}</span>
                    <small>{new Date(log.created_at).toLocaleString('id-ID')} · {log.actor_email || 'Sistem'}</small>
                  </div>
                  <span className="admin-status-badge admin-status-neutral">#{log.record_id}</span>
                </article>
              );
            })}
          </div>
        )}
        {!loading && logs.length === 0 && <div className="admin-empty-state">Belum ada perubahan data yang tercatat.</div>}
      </section>
    </div>
  );
};

export default AuditPage;
