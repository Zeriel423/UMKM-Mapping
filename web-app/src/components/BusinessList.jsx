import { MapPin, Search, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CommunityCollections from './CommunityCollections';
import { locationAccuracyLabel } from '../utils/location';

// Jumlah item yang ditampilkan pada setiap batch "Tampilkan lebih banyak".
const PAGE_SIZE = 40;

// Menentukan nama utama UMKM yang ditampilkan di UI.
const businessTitle = (business) =>
  business.brand?.trim() || business.name || 'UMKM tanpa nama';

const BusinessList = ({
  businesses,
  allBusinesses,
  resultsKey = '',
  selectedBusiness,
  activeCollectionId,
  onSelectCollection,
  onSelectBusiness,
  onShareBusiness,
  searchQuery = '',
  onSearchChange,
  isMobileOpen = false,
  onMobileClose,
}) => {
  // Menyimpan jumlah item tanpa me-remount input saat kriteria berubah.
  const [pagination, setPagination] = useState({ key: resultsKey, count: PAGE_SIZE });
  const visibleCount = pagination.key === resultsKey ? pagination.count : PAGE_SIZE;
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Menyimpan pesan singkat setelah proses berbagi berhasil.
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [isMobileOpen]);

  const trapMobileFocus = (event) => {
    if (!isMobileOpen || event.key !== 'Tab') return;

    const focusableElements = Array.from(panelRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || []);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  // Menempatkan UMKM yang sedang dipilih di urutan paling atas.
  const orderedBusinesses = useMemo(() => {
    if (!selectedBusiness) return businesses;

    return [...businesses].sort(
      (a, b) =>
        Number(String(b.id) === String(selectedBusiness.id)) -
        Number(String(a.id) === String(selectedBusiness.id)),
    );
  }, [businesses, selectedBusiness]);

  // Menjalankan fungsi share dari parent lalu menampilkan notifikasi singkat.
  const share = async (business) => {
    const message = await onShareBusiness(business);
    if (!message) return;

    setNotice(message);

    // Hapus notifikasi secara otomatis setelah 2,5 detik.
    window.setTimeout(() => setNotice(''), 2500);
  };

  return (
    <aside
      ref={panelRef}
      id="business-panel"
      className={`business-panel ${isMobileOpen ? 'mobile-open' : ''}`}
      aria-label="Daftar UMKM"
      role={isMobileOpen ? 'dialog' : undefined}
      aria-modal={isMobileOpen || undefined}
      onKeyDown={trapMobileFocus}
    >
      {/* Header khusus bottom sheet pada perangkat mobile. */}
      <div className="mobile-panel-header">
        <div className="mobile-panel-handle" aria-hidden="true" />

        <button
          ref={closeButtonRef}
          className="mobile-panel-close"
          type="button"
          onClick={onMobileClose}
          aria-label="Tutup pencarian dan pilihan komunitas"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mobile-panel-search">
        <label htmlFor="mobile-business-search">Cari UMKM</label>
        <div className="mobile-search-box">
          <Search size={17} aria-hidden="true" />
          <input
            id="mobile-business-search"
            type="text"
            placeholder="Nama usaha, merek, atau pemilik"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              aria-label="Hapus pencarian"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Pilihan komunitas/kategori yang tersedia. */}
      <CommunityCollections
        data={allBusinesses}
        activeCollectionId={activeCollectionId}
        onSelect={onSelectCollection}
      />

      {/* Area utama yang menampilkan hasil pencarian. */}
      <section
        className="business-results"
        aria-labelledby="business-results-title"
      >
        <div className="section-heading results-heading">
          <div>
            <span className="eyebrow">HASIL PENCARIAN</span>
            <h2 id="business-results-title">
              {businesses.length.toLocaleString('id-ID')} UMKM ditemukan
            </h2>
          </div>
        </div>

        {/* Pesan hasil share/clipboard. */}
        {notice && (
          <p className="share-notice" role="status">
            {notice}
          </p>
        )}

        {businesses.length === 0 ? (
          // Tampilkan pesan jika filter/pencarian tidak menemukan data.
          <div className="empty-results">
            Tidak ada UMKM yang sesuai. Coba ubah pencarian atau filter Anda.
          </div>
        ) : (
          // Daftar kartu UMKM yang dapat dipilih pengguna.
          <div className="business-card-list">
            {orderedBusinesses.slice(0, visibleCount).map((business) => {
              // Tandai kartu yang sedang aktif agar UI dapat memberi feedback.
              const isSelected =
                String(business.id) === String(selectedBusiness?.id);

              return (
                <article
                  className={`business-card ${isSelected ? 'selected' : ''}`}
                  key={business.id}
                >
                  {/* Klik area utama untuk sinkronisasi daftar dengan peta. */}
                  <button
                    className="business-card-main"
                    type="button"
                    onClick={() => onSelectBusiness(business)}
                  >
                    <span className="business-card-title">
                      {businessTitle(business)}
                    </span>

                    <span className="business-card-category">
                      {business.product_label || business.product_type}
                    </span>

                    <span className="business-card-address">
                      <MapPin size={14} />
                      {business.address || 'Alamat belum tersedia'}
                    </span>

                    <span className="business-card-location">
                      {locationAccuracyLabel(business)}
                    </span>
                  </button>

                  {/* Tombol share dipisahkan agar tidak ikut memilih UMKM. */}
                  <button
                    className="business-share-button"
                    type="button"
                    onClick={() => share(business)}
                    aria-label={`Bagikan ${businessTitle(business)}`}
                  >
                    <Share2 size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {/* Muat batch berikutnya tanpa mengubah data/filter yang aktif. */}
        {visibleCount < orderedBusinesses.length && (
          <button
            className="load-more-button"
            type="button"
            onClick={() => setPagination((current) => ({
              key: resultsKey,
              count: (current.key === resultsKey ? current.count : PAGE_SIZE) + PAGE_SIZE,
            }))}
          >
            Tampilkan lebih banyak
          </button>
        )}
      </section>
    </aside>
  );
};

export default BusinessList;
