import { COMMUNITY_COLLECTIONS } from '../data/communityCollections';

const CommunityCollections = ({ data, activeCollectionId, onSelect }) => {
  return (
    <section className="community-collections" aria-labelledby="community-collections-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PILIHAN KOMUNITAS</span>
          <h2 id="community-collections-title">Jelajahi berdasarkan kebutuhan</h2>
        </div>
        {activeCollectionId && (
          <button className="text-button" type="button" onClick={() => onSelect(null)}>
            Semua
          </button>
        )}
      </div>

      <div className="collection-list">
        {COMMUNITY_COLLECTIONS.map((collection) => {
          const Icon = collection.icon;
          const count = data.filter((business) => collection.productTypes.includes(business.product_type)).length;
          const isActive = activeCollectionId === collection.id;

          return (
            <button
              className={`collection-card ${isActive ? 'active' : ''}`}
              key={collection.id}
              type="button"
              onClick={() => onSelect(isActive ? null : collection)}
              aria-pressed={isActive}
            >
              <span className="collection-icon"><Icon size={18} /></span>
              <span className="collection-copy">
                <strong>{collection.title}</strong>
                <span>{collection.description}</span>
              </span>
              <span className="collection-count">{count.toLocaleString('id-ID')}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CommunityCollections;
