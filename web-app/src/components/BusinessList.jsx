import { MapPin, Share2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import CommunityCollections from './CommunityCollections';

// Jumlah item yang ditampilkan pada setiap batch "Tampilkan lebih banyak".
const PAGE_SIZE = 40;

// Menentukan nama utama UMKM yang ditampilkan di UI.
const businessTitle = (business) =>
  business.brand?.trim() || business.name || 'UMKM tanpa nama';

const BusinessList = ({
  businesses,
  allBusinesses,
  selectedBusiness,
  activeCollectionId,
  onSelectCollection,
  onSelectBusiness,
  onShareBusiness,
  isMobileOpen = false,
  onMobileClose,
}) => {
  // Menyimpan jumlah item yang sedang ditampilkan.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Menyimpan pesan singkat setelah proses berbagi berhasil.
  const [notice, setNotice] = useState('');

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
      className={`business-panel ${isMobileOpen ? 'mobile-open' : ''}`}
      aria-label="Daftar UMKM"
    >
      {/* Header khusus bottom sheet pada perangkat mobile. */}
      <div className="mobile-panel-header">
        <div className="mobile-panel-handle" aria-hidden="true" />

        <button
          className="mobile-panel-close"
          type="button"
          onClick={onMobileClose}
          aria-label="Tutup pencarian dan pilihan komunitas"
        >
          <X size={18} />
        </button>
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
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Tampilkan lebih banyak
          </button>
        )}
      </section>
    </aside>
  );
};

export default BusinessList;
