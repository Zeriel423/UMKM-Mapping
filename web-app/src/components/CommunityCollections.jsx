import { COMMUNITY_COLLECTIONS } from '../data/communityCollections';

const CommunityCollections = ({
  data,
  activeCollectionId,
  onSelect,
}) => {
  return (
    <section
      className="community-collections"
      aria-labelledby="community-collections-title"
    >
      {/* Header section untuk fitur pilihan komunitas. */}
      <div className="section-heading">
        <div>
          <span className="eyebrow">PILIHAN KOMUNITAS</span>
          <h2 id="community-collections-title">
            Jelajahi berdasarkan kebutuhan
          </h2>
        </div>

        {/* Tombol ini menghapus komunitas aktif dan kembali ke semua data. */}
        {activeCollectionId && (
          <button
            className="text-button"
            type="button"
            onClick={() => onSelect(null)}
          >
            Semua
          </button>
        )}
      </div>

      {/* Daftar komunitas/kategori yang berasal dari data konfigurasi. */}
      <div className="collection-list">
        {COMMUNITY_COLLECTIONS.map((collection) => {
          // Icon setiap komunitas disimpan langsung pada konfigurasi koleksi.
          const Icon = collection.icon;

          // Hitung jumlah UMKM yang termasuk ke dalam komunitas ini.
          const count = data.filter((business) =>
            collection.productTypes.includes(business.product_type),
          ).length;

          // Tentukan apakah komunitas sedang aktif.
          const isActive = activeCollectionId === collection.id;

          return (
            <button
              className={`collection-card ${isActive ? 'active' : ''}`}
              key={collection.id}
              type="button"
              onClick={() => onSelect(isActive ? null : collection)}
              aria-pressed={isActive}
            >
              {/* Icon visual komunitas. */}
              <span className="collection-icon">
                <Icon size={18} />
              </span>

              {/* Judul dan deskripsi komunitas. */}
              <span className="collection-copy">
                <strong>{collection.title}</strong>
                <span>{collection.description}</span>
              </span>

              {/* Jumlah UMKM pada komunitas tersebut. */}
              <span className="collection-count">
                {count.toLocaleString('id-ID')}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CommunityCollections;
