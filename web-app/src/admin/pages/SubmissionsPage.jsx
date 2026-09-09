import { Check, ClipboardCheck, Image, Loader2, MapPin, Phone, Send, Store, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadUmkmSubmissions, reviewUmkmSubmission } from '../../services/umkmService';

const PAGE_SIZE = 30;

const statusLabel = {
  pending: 'Menunggu tinjauan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

const statusClass = {
  pending: 'admin-status-warning',
  approved: 'admin-status-success',
  rejected: 'admin-status-danger',
};

const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const ReviewDialog = ({ submission, decision, onClose, onReviewed, notify }) => {
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const isApproval = decision === 'approved';

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    document.body.classList.add('admin-dialog-open');
    window.requestAnimationFrame(() => dialogRef.current?.querySelector('textarea, button')?.focus());

    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !savingRef.current) onClose();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('admin-dialog-open');
      window.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await reviewUmkmSubmission(submission.id, decision, reviewNote);
      notify(isApproval ? 'Pengajuan disetujui dan data UMKM telah dibuat.' : 'Pengajuan ditolak.', 'success');
      await onReviewed();
      onClose();
    } catch (error) {
      notify(error.message || 'Pengajuan gagal ditinjau.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={dialogRef} className="admin-dialog admin-review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-submission-title">
        <div className="admin-dialog-header">
          <div><p className="admin-eyebrow">TINJAU PENGAJUAN</p><h2 id="review-submission-title">{isApproval ? 'Setujui pengajuan' : 'Tolak pengajuan'}</h2></div>
          <button className="admin-icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Tutup dialog"><X size={20} /></button>
        </div>

        <div className="admin-review-summary">
          <Store size={19} aria-hidden="true" />
          <div><strong>{submission.business_name}</strong><span>{submission.owner_name} · {submission.category}</span><small>{submission.address}</small></div>
        </div>

        <form className="admin-form" onSubmit={submit}>
          <label className="admin-field"><span>{isApproval ? 'Catatan untuk pengajuan' : 'Alasan penolakan *'}</span><textarea rows="4" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength="1000" placeholder={isApproval ? 'Opsional' : 'Jelaskan perbaikan yang diperlukan'} required={!isApproval} /></label>
          <div className="admin-dialog-actions">
            <button className="admin-secondary-button" type="button" onClick={onClose} disabled={saving}>Batal</button>
            <button className={isApproval ? 'admin-primary-button' : 'admin-danger-button'} type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} {saving ? 'Memproses...' : isApproval ? 'Setujui' : 'Tolak'}</button>
          </div>
        </form>
      </section>
    </div>
  );
};

const SubmissionsPage = ({ notify }) => {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadUmkmSubmissions({ status, page, pageSize: PAGE_SIZE });
      setSubmissions(result.data);
      setTotal(result.count);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Data pengajuan tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return loadUmkmSubmissions({ status, page, pageSize: PAGE_SIZE });
      })
      .then((result) => {
        if (!active) return;
        setSubmissions(result.data);
        setTotal(result.count);
        setError('');
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Data pengajuan tidak dapat dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, status]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pendingCount = status === 'pending' ? total : null;

  const selectStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">PENGAJUAN PUBLIK</p><h1>Pengajuan UMKM</h1><p>{pendingCount === null ? 'Tinjau data usaha yang dikirim dari halaman peta.' : `${pendingCount.toLocaleString('id-ID')} pengajuan menunggu tinjauan.`}</p></div>
      </div>

      <section className="admin-panel admin-submissions-filter">
        <label className="admin-compact-field"><span>Status pengajuan</span><select value={status} onChange={(event) => selectStatus(event.target.value)}><option value="pending">Menunggu tinjauan</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option><option value="all">Semua status</option></select></label>
      </section>

      <section className="admin-panel admin-table-panel">
        <div className="admin-table-summary"><span>{total.toLocaleString('id-ID')} pengajuan</span><span>Halaman {currentPage} dari {pageCount}</span></div>
        {loading ? <div className="admin-empty-state">Memuat pengajuan UMKM...</div> : error ? <div className="admin-empty-state"><p>{error}</p><button className="admin-secondary-button" type="button" onClick={loadSubmissions}>Coba lagi</button></div> : (
          <div className="admin-table-scroll">
            <table className="admin-table admin-submissions-table">
              <thead><tr><th>Usaha</th><th>Kontak</th><th>Lokasi</th><th>Diajukan</th><th>Status</th><th><span className="admin-visually-hidden">Tindakan</span></th></tr></thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td><strong>{submission.business_name}</strong><small>{submission.owner_name}</small><small>{submission.category}</small>{submission.photo_url && <a className="admin-submission-photo" href={submission.photo_url} target="_blank" rel="noreferrer"><Image size={13} aria-hidden="true" /> Foto {submission.photo_kind === 'place' ? 'tempat usaha' : 'produk'}</a>}</td>
                    <td><span className="admin-submission-phone"><Phone size={14} aria-hidden="true" />{submission.phone}</span>{submission.notes && <small>{submission.notes}</small>}</td>
                    <td><span>{submission.address}</span>{submission.latitude !== null && <small className="admin-submission-coordinates"><MapPin size={13} aria-hidden="true" />{Number(submission.latitude).toFixed(5)}, {Number(submission.longitude).toFixed(5)}</small>}</td>
                    <td>{formatDate(submission.created_at)}</td>
                    <td><span className={`admin-status-badge ${statusClass[submission.status]}`}>{statusLabel[submission.status]}</span>{submission.review_note && <small>{submission.review_note}</small>}</td>
                    <td>{submission.status === 'pending' ? <div className="admin-row-actions"><button className="admin-primary-button admin-compact-action" type="button" onClick={() => setReview({ submission, decision: 'approved' })}>Setujui</button><button className="admin-danger-button admin-compact-action" type="button" onClick={() => setReview({ submission, decision: 'rejected' })}>Tolak</button></div> : submission.approved_umkm_id ? <span className="admin-submission-linked"><Send size={14} aria-hidden="true" /> ID {submission.approved_umkm_id}</span> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && submissions.length === 0 && <div className="admin-empty-state"><ClipboardCheck size={28} aria-hidden="true" /><p>Belum ada pengajuan pada status ini.</p></div>}
        <div className="admin-pagination"><button className="admin-secondary-button" type="button" disabled={currentPage <= 1 || loading} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button><button className="admin-secondary-button" type="button" disabled={currentPage >= pageCount || loading} onClick={() => setPage(currentPage + 1)}>Berikutnya</button></div>
      </section>

      {review && <ReviewDialog submission={review.submission} decision={review.decision} onClose={() => setReview(null)} onReviewed={loadSubmissions} notify={notify} />}
    </div>
  );
};

export default SubmissionsPage;
