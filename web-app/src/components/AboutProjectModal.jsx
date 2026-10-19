import { Briefcase, Building2, CheckCircle2, GraduationCap, Handshake, HeartHandshake, MapPin, Sparkles, Store, Users, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const AboutProjectModal = ({ isOpen, onClose, onOpenSubmission }) => {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="public-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="public-dialog about-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-project-title"
      >
        <header className="public-dialog-header">
          <div className="public-dialog-heading">
            <span>
              <Handshake size={22} aria-hidden="true" />
            </span>
            <div>
              <p>KOLABORASI RISET &amp; PEMBERDAYAAN</p>
              <h2 id="about-project-title">Tentang Projek Web GIS UMKM</h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="public-dialog-close"
            type="button"
            onClick={onClose}
            aria-label="Tutup informasi projek"
          >
            <X size={21} />
          </button>
        </header>

        <div className="about-project-body">
          {/* Banner Kolaborasi dengan Dua Logo */}
          <div className="about-collab-banner">
            <div className="about-logo-wrapper">
              <img
                src="/images/logo-polimdo.png"
                alt="Logo Politeknik Negeri Manado"
                className="about-logo polimdo-logo"
              />
              <span className="about-logo-label">Politeknik Negeri Manado</span>
            </div>

            <div className="about-collab-divider" aria-hidden="true">
              <HeartHandshake size={26} />
              <span>KERJASAMA</span>
            </div>

            <div className="about-logo-wrapper">
              <img
                src="/images/logo-ybli.png"
                alt="Logo Yayasan Bina Lentera Insan"
                className="about-logo ybli-logo"
              />
              <span className="about-logo-label">Yayasan Bina Lentera Insan</span>
            </div>
          </div>

          {/* Pengantar Utama */}
          <div className="about-intro-card">
            <div className="about-intro-badge">
              <Sparkles size={16} aria-hidden="true" />
              <span>Inisiatif Digitalisasi UMKM Sulawesi Utara</span>
            </div>
            <p>
              Aplikasi berbasis website ini merupakan hasil kerja sama strategis antara{' '}
              <strong>Politeknik Negeri Manado</strong> (Program Studi D-IV Teknik Informatika,
              Jurusan Teknik Elektro) dengan <strong>Yayasan Bina Lentera Insan (YBLI)</strong>{' '}
              selaku mitra riset dan pemberdayaan masyarakat.
            </p>
          </div>

          {/* Latar Belakang & Alasan Pembuatan */}
          <section className="about-section">
            <div className="about-section-header">
              <Building2 size={18} className="about-section-icon" aria-hidden="true" />
              <h3>Latar Belakang &amp; Alasan Pembuatan</h3>
            </div>
            <div className="about-section-content">
              <p>
                Sektor Usaha Mikro, Kecil, dan Menengah (UMKM) merupakan tulang punggung ekonomi
                kerakyatan di Sulawesi Utara. Namun di lapangan, banyak pelaku UMKM potensial yang
                masih belum terdata secara spasial dan memiliki keterbatasan akses publikasi
                digital.
              </p>
              <p>
                Kondisi ini mengakibatkan sulitnya masyarakat atau konsumen menemukan lokasi usaha
                lokal secara akurat, serta menjadi tantangan bagi lembaga mitra dalam menyusun program
                pembinaan, pelatihan kewirausahaan, dan penyaluran bantuan yang tepat sasaran. Melalui
                teknologi Sistem Informasi Geografis (GIS), proyek ini hadir menjembatani kebutuhan
                akademik dengan dampak sosial ekonomi nyata, di mana seluruh data yang terkumpul akan
                diverifikasi dan ditindaklanjuti oleh Lentera UMKM Indonesia (unit pendampingan pelaku
                UMKM dari Yayasan Bina Lentera Insan) dalam menyalurkan program pendampingan yang tepat sasaran.
              </p>
            </div>
          </section>

          {/* Tujuan Proyek */}
          <section className="about-section">
            <div className="about-section-header">
              <MapPin size={18} className="about-section-icon" aria-hidden="true" />
              <h3>Tujuan Utama Proyek</h3>
            </div>
            <div className="about-goals-grid">
              <article className="about-goal-card">
                <div className="about-goal-num">1</div>
                <h4>Pemetaan Spasial Komprehensif</h4>
                <p>
                  Menyajikan persebaran geografis dan profil usaha UMKM di berbagai wilayah Sulawesi
                  Utara ke dalam peta digital yang interaktif dan mudah diakses publik.
                </p>
              </article>

              <article className="about-goal-card">
                <div className="about-goal-num">2</div>
                <h4>Meningkatkan Visibilitas &amp; Aksesibilitas</h4>
                <p>
                  Membantu calon pelanggan, wisatawan, dan mitra usaha menemukan produk lokal serta
                  menyediakan navigasi rute langsung ke titik lokasi usaha.
                </p>
              </article>

              <article className="about-goal-card">
                <div className="about-goal-num">3</div>
                <h4>Basis Data Terpadu &amp; Pemberdayaan</h4>
                <p>
                  Menyediakan platform data yang terverifikasi serta membuka ruang pendaftaran
                  mandiri bagi UMKM guna mendukung riset dan program pembinaan ekonomi berkelanjutan.
                </p>
              </article>
            </div>
          </section>

          {/* Profil Mitra Ringkas */}
          <section className="about-partners-grid">
            <div className="about-partner-card">
              <div className="about-partner-title">
                <GraduationCap size={18} aria-hidden="true" />
                <h4>Politeknik Negeri Manado</h4>
              </div>
              <p>
                Institusi pendidikan vokasi negeri yang berkomitmen menghasilkan inovasi teknologi
                terapan dan pengabdian masyarakat untuk kemajuan daerah.
              </p>
            </div>

            <div className="about-partner-card">
              <div className="about-partner-title">
                <HeartHandshake size={18} aria-hidden="true" />
                <h4>Yayasan Bina Lentera Insan (YBLI)</h4>
              </div>
              <p>
                Lembaga nirlaba yang berfokus pada kegiatan sosial, pendidikan, kesehatan, serta
                pendampingan dan pemberdayaan ekonomi masyarakat.
              </p>
            </div>
          </section>

          {/* Mitra Pelaksana */}
          <section className="about-section">
            <div className="about-section-header">
              <Handshake size={18} className="about-section-icon" aria-hidden="true" />
              <h3>Mitra Pelaksana</h3>
            </div>
            <div className="about-partners-grid">
              <div className="about-partner-card">
                <div className="about-partner-title">
                  <Briefcase size={18} aria-hidden="true" />
                  <h4>Asosiasi Pengusaha Industri Kecil (APIK)</h4>
                </div>
                <p>
                  Wadah jejaring dan kolaborasi bagi para pelaku industri kecil dalam meningkatkan
                  kualitas produk, daya saing, serta akses pasar.
                </p>
              </div>

              <div className="about-partner-card">
                <div className="about-partner-title">
                  <Users size={18} aria-hidden="true" />
                  <h4>Tangan Di Atas (TDA) Manado</h4>
                </div>
                <p>
                  Komunitas wirausaha yang berfokus pada edukasi, pendampingan bisnis, serta
                  pembentukan ekosistem kewirausahaan yang saling memberdayakan.
                </p>
              </div>
            </div>
          </section>

          {/* Footer Call to Action */}
          <div className="about-footer-cta">
            <div>
              <strong>Memiliki Usaha UMKM di Sulawesi Utara?</strong>
              <p>Daftarkan usaha Anda agar dapat terpetakan dan ditemukan masyarakat luas.</p>
            </div>
            <div className="about-footer-actions">
              {onOpenSubmission && (
                <button
                  type="button"
                  className="admin-primary-button about-cta-button"
                  onClick={() => {
                    onClose();
                    onOpenSubmission();
                  }}
                >
                  <Store size={17} /> Daftarkan UMKM
                </button>
              )}
              <button
                type="button"
                className="admin-secondary-button about-close-button"
                onClick={onClose}
              >
                <CheckCircle2 size={16} /> Tutup
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutProjectModal;
