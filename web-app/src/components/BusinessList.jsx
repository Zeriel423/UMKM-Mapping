import { ExternalLink, MapPin, Share2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import CommunityCollections from './CommunityCollections';

const PAGE_SIZE = 40;

const businessTitle = (business) => business.brand?.trim() || business.name || 'UMKM tanpa nama';

const directionsUrl = (business) => {
  const lat = Number(business.lat);
  const lng = Number(business.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
};

const BusinessDetail = ({ business, onClose, onShare }) => (
  <article className="business-detail" aria-label={`Detail ${businessTitle(business)}`}>
    <div className="business-detail-topline">
      <span>DETAIL UMKM</span>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup detail UMKM">
        <X size={17} />
      </button>
    </div>
    <h2>{businessTitle(business)}</h2>
    {business.brand && business.name !== business.brand && (
      <p className="business-legal-name">{business.name}</p>
    )}
    <span className="business-category">{business.product_label || business.product_type}</span>
    <p className="business-address"><MapPin size={15} />{business.address || 'Alamat belum tersedia'}</p>
    <div className="business-detail-actions">
      {directionsUrl(business) && (
        <a className="action-button primary" href={directionsUrl(business)} target="_blank" rel="noreferrer">
          <ExternalLink size={15} /> Rute
        </a>
      )}
      <button className="action-button secondary" type="button" onClick={() => onShare(business)}>
        <Share2 size={15} /> Bagikan
      </button>
    </div>
  </article>
);

const BusinessList = ({
  businesses,
  allBusinesses,
  selectedBusiness,
  activeCollectionId,
  onSelectCollection,
  onSelectBusiness,
  onClearSelectedBusiness,
  onShareBusiness,
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [notice, setNotice] = useState('');

  const orderedBusinesses = useMemo(() => {
    if (!selectedBusiness) return businesses;

    return [...businesses].sort((a, b) => Number(String(b.id) === String(selectedBusiness.id)) - Number(String(a.id) === String(selectedBusiness.id)));
  }, [businesses, selectedBusiness]);

  const share = async (business) => {
    const message = await onShareBusiness(business);
    if (!message) return;

    setNotice(message);
    window.setTimeout(() => setNotice(''), 2500);
  };

  return (
    <aside className="business-panel" aria-label="Daftar UMKM">
      <CommunityCollections
        data={allBusinesses}
        activeCollectionId={activeCollectionId}
        onSelect={onSelectCollection}
      />

      {selectedBusiness && (
        <BusinessDetail
          business={selectedBusiness}
          onClose={onClearSelectedBusiness}
          onShare={share}
        />
      )}

      <section className="business-results" aria-labelledby="business-results-title">
        <div className="section-heading results-heading">
          <div>
            <span className="eyebrow">HASIL PENCARIAN</span>
            <h2 id="business-results-title">{businesses.length.toLocaleString('id-ID')} UMKM ditemukan</h2>
          </div>
        </div>

        {notice && <p className="share-notice" role="status">{notice}</p>}

        {businesses.length === 0 ? (
          <div className="empty-results">Tidak ada UMKM yang sesuai. Coba ubah pencarian atau filter Anda.</div>
        ) : (
          <div className="business-card-list">
            {orderedBusinesses.slice(0, visibleCount).map((business) => {
              const isSelected = String(business.id) === String(selectedBusiness?.id);

              return (
                <article className={`business-card ${isSelected ? 'selected' : ''}`} key={business.id}>
                  <button className="business-card-main" type="button" onClick={() => onSelectBusiness(business)}>
                    <span className="business-card-title">{businessTitle(business)}</span>
                    <span className="business-card-category">{business.product_label || business.product_type}</span>
                    <span className="business-card-address"><MapPin size={14} />{business.address || 'Alamat belum tersedia'}</span>
                  </button>
                  <button className="business-share-button" type="button" onClick={() => share(business)} aria-label={`Bagikan ${businessTitle(business)}`}>
                    <Share2 size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {visibleCount < orderedBusinesses.length && (
          <button className="load-more-button" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Tampilkan lebih banyak
          </button>
        )}
      </section>
    </aside>
  );
};

export default BusinessList;
