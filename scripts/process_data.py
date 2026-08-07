import pandas as pd
import json
import random
import os

# Comprehensive coordinates for districts/kecamatan in North Sulawesi
# Organized by Kabupaten/Kota for clarity
DISTRICT_COORDS = {
    # === KOTA MANADO ===
    'MALALAYANG': (1.4500, 124.8211),
    'SARIO': (1.4631, 124.8420),
    'WANEA': (1.4589, 124.8437),
    'WENANG': (1.4931, 124.8409),
    'TIKALA': (1.4858, 124.8491),
    'PAAL DUA': (1.4950, 124.8530),
    'MAPANGET': (1.5230, 124.9126),
    'SINGKIL': (1.5034, 124.8458),
    'TUMINTING': (1.5126, 124.8466),
    'BUNAKEN': (1.5800, 124.7900),
    'BUNAKEN KEPULAUAN': (1.6200, 124.7400),
    'MANADO': (1.4748, 124.8421),

    # === KOTA BITUNG ===
    'BITUNG': (1.4451, 125.1824),
    'MAESA': (1.4480, 125.1920),
    'RANOWULU': (1.4300, 125.2100),
    'AERTEMBAGA': (1.4560, 125.2000),
    'GIRIAN': (1.4520, 125.1750),
    'MADIDIR': (1.4400, 125.1900),
    'MATUARI': (1.4350, 125.1650),
    'LEMBEH SELATAN': (1.4200, 125.2300),
    'LEMBEH UTARA': (1.4500, 125.2400),

    # === KOTA TOMOHON ===
    'TOMOHON': (1.3213, 124.8361),
    'TOMOHON SELATAN': (1.3100, 124.8300),
    'TOMOHON TENGAH': (1.3200, 124.8400),
    'TOMOHON UTARA': (1.3350, 124.8350),
    'TOMOHON TIMUR': (1.3250, 124.8500),
    'TOMOHON BARAT': (1.3150, 124.8200),

    # === KOTA KOTAMOBAGU ===
    'KOTAMOBAGU': (0.7300, 124.3168),
    'KOTAMOBAGU SELATAN': (0.7200, 124.3100),
    'KOTAMOBAGU BARAT': (0.7250, 124.3050),
    'KOTAMOBAGU TIMUR': (0.7350, 124.3250),
    'KOTAMOBAGU UTARA': (0.7400, 124.3200),

    # === KABUPATEN MINAHASA ===
    'MINAHASA': (1.3000, 124.8000),
    'TONDANO': (1.3000, 124.9100),
    'TONDANO BARAT': (1.2950, 124.9000),
    'TONDANO TIMUR': (1.3050, 124.9200),
    'TONDANO SELATAN': (1.2900, 124.9100),
    'TONDANO UTARA': (1.3100, 124.9150),
    'ERIS': (1.3100, 124.8700),
    'KAKAS': (1.2600, 124.9200),
    'KAKAS BARAT': (1.2550, 124.9100),
    'KAWANGKOAN': (1.2400, 124.8600),
    'KAWANGKOAN BARAT': (1.2350, 124.8500),
    'KAWANGKOAN UTARA': (1.2500, 124.8650),
    'LANGOWAN': (1.2200, 124.9000),
    'LANGOWAN BARAT': (1.2150, 124.8900),
    'LANGOWAN SELATAN': (1.2100, 124.9050),
    'LANGOWAN TIMUR': (1.2250, 124.9100),
    'LANGOWAN UTARA': (1.2300, 124.8950),
    'LEMBEAN TIMUR': (1.3400, 124.9000),
    'KOMBI': (1.3300, 124.8800),
    'PINELENG': (1.3900, 124.8300),
    'TOMBULU': (1.3600, 124.8400),
    'SONDER': (1.2800, 124.8400),
    'REMBOKEN': (1.2900, 124.8700),

    # === KABUPATEN MINAHASA UTARA ===
    'AIRMADIDI': (1.4200, 124.9800),
    'KALAWAT': (1.4400, 124.9500),
    'DIMEMBE': (1.4500, 125.0000),
    'KAUDITAN': (1.4100, 125.0200),
    'KEMA': (1.3900, 125.0600),
    'LIKUPANG BARAT': (1.5800, 125.0000),
    'LIKUPANG TIMUR': (1.5900, 125.0500),
    'LIKUPANG SELATAN': (1.5600, 125.0200),
    'TALAWAAN': (1.5161, 124.9525),
    'WORI': (1.5500, 124.8700),

    # === KABUPATEN MINAHASA SELATAN ===
    'AMURANG': (1.1800, 124.5700),
    'AMURANG BARAT': (1.1750, 124.5600),
    'AMURANG TIMUR': (1.1850, 124.5800),
    'TOMPASO BARU': (1.1500, 124.6000),
    'MAESAAN': (1.1300, 124.6200),
    'RANOYAPO': (1.1600, 124.5900),
    'MOTOLING': (1.1400, 124.6100),
    'MOTOLING BARAT': (1.1350, 124.6000),
    'MOTOLING TIMUR': (1.1450, 124.6200),
    'KUMELEMBUAI': (1.1200, 124.6300),
    'SINONSAYANG': (1.2000, 124.5400),
    'TENGA': (1.2200, 124.5200),
    'TATAPAAN': (1.2400, 124.5000),

    # === KABUPATEN MINAHASA TENGGARA ===
    'RATAHAN': (1.1000, 124.7600),
    'BELANG': (1.0800, 124.7800),
    'PUSOMAEN': (1.0600, 124.8000),
    'TOMBATU': (1.0900, 124.7400),
    'TOMBATU TIMUR': (1.0850, 124.7500),
    'TOMBATU UTARA': (1.0950, 124.7450),
    'TOULUAAN': (1.0700, 124.7200),
    'TOULUAAN SELATAN': (1.0650, 124.7150),
    'RATATOTOK': (1.0500, 124.7900),

    # === KABUPATEN BOLAANG MONGONDOW ===
    'LOLAK': (0.8500, 124.1000),
    'BOLAANG': (0.8200, 124.0700),
    'BOLAANG TIMUR': (0.8300, 124.0800),
    'LOLAYAN': (0.7800, 124.2500),
    'PASSI BARAT': (0.7600, 124.2700),
    'PASSI TIMUR': (0.7700, 124.2800),
    'DUMOGA': (0.6800, 124.1500),
    'DUMOGA BARAT': (0.6750, 124.1300),
    'DUMOGA TIMUR': (0.6850, 124.1700),
    'DUMOGA UTARA': (0.6900, 124.1600),
    'DUMOGA TENGGARA': (0.6700, 124.1800),
    'POIGAR': (0.8100, 124.0500),
    'SANG TOMBOLANG': (0.8000, 124.2000),

    # === KABUPATEN BOLAANG MONGONDOW UTARA ===
    'BOROKO': (0.8900, 123.9500),
    'KAIDIPANG': (1.0900, 123.8000),
    'BOLANGITANG BARAT': (1.0500, 123.8500),
    'BOLANGITANG TIMUR': (1.0300, 123.8800),
    'PINOGALUMAN': (1.0000, 123.9200),
    'BINTAUNA': (0.9500, 123.9500),

    # === KABUPATEN BOLAANG MONGONDOW SELATAN ===
    'BOLAANG UKI': (0.5800, 124.0500),
    'POSIGADAN': (0.5500, 124.0200),
    'PINOLOSIAN': (0.5200, 124.0800),
    'PINOLOSIAN TENGAH': (0.5300, 124.0700),
    'PINOLOSIAN TIMUR': (0.5400, 124.0900),

    # === KABUPATEN BOLAANG MONGONDOW TIMUR ===
    'TUTUYAN': (0.7500, 124.4500),
    'NUANGAN': (0.7200, 124.4800),
    'MODAYAG': (0.7000, 124.5000),
    'MODAYAG BARAT': (0.6950, 124.4900),
    'KOTABUNAN': (0.7600, 124.4200),

    # === KABUPATEN KEPULAUAN SANGIHE ===
    'TAHUNA': (3.6000, 125.4900),
    'TAHUNA BARAT': (3.5900, 125.4800),
    'TAHUNA TIMUR': (3.6100, 125.5000),
    'TABUKAN UTARA': (3.6500, 125.5200),
    'TABUKAN SELATAN': (3.5500, 125.4700),
    'TABUKAN TENGAH': (3.6200, 125.5100),
    'MANGANITU': (3.5200, 125.4500),
    'MANGANITU SELATAN': (3.5000, 125.4300),
    'TAMAKO': (3.4800, 125.4100),
    'TATOARENG': (3.4500, 125.3900),
    'KENDAHE': (3.7000, 125.5500),
    'NUSA TABUKAN': (3.6800, 125.4000),

    # === KABUPATEN KEPULAUAN TALAUD ===
    'MELONGUANE': (4.0200, 126.7000),
    'MELONGUANE TIMUR': (4.0300, 126.7200),
    'BEO': (3.9800, 126.6500),
    'BEO UTARA': (3.9900, 126.6600),
    'BEO SELATAN': (3.9700, 126.6400),
    'RAINIS': (4.0500, 126.7500),
    'NANUSA': (4.1500, 126.8000),
    'KABARUAN': (3.9500, 126.6200),
    'DAMAU': (3.9000, 126.6000),
    'LIRUNG': (3.9600, 126.6300),
    'SALIBABU': (4.0000, 126.6800),
    'KALONGAN': (4.0800, 126.7800),
    'MORONGE': (4.1000, 126.7600),
    'GEMEH': (3.8800, 126.5800),
    'ESSANG': (3.8500, 126.5500),
    'ESSANG SELATAN': (3.8400, 126.5400),

    # === KABUPATEN KEP. SIAU TAGULANDANG BIARO ===
    'SIAU': (2.7300, 125.3700),
    'SIAU BARAT': (2.7200, 125.3500),
    'SIAU BARAT SELATAN': (2.7100, 125.3400),
    'SIAU TIMUR': (2.7400, 125.3900),
    'SIAU TIMUR SELATAN': (2.7300, 125.3800),
    'SIAU TENGAH': (2.7250, 125.3700),
    'TAGULANDANG': (2.5000, 125.3500),
    'TAGULANDANG SELATAN': (2.4800, 125.3400),
    'TAGULANDANG UTARA': (2.5200, 125.3600),
    'BIARO': (2.4500, 125.3200),
    
    # === NEWLY ADDED DISTRICTS FOR ACCURACY ===
    'SANGKUB': (0.8580, 123.6286),
    'HELUMO': (0.3933, 123.8578),
    'TOMINI': (0.3233, 123.7275),
    'TUMPAAN': (1.2396, 124.6145),
    'MODOINDING': (0.8022, 124.4572),
    'SULUUN TARERAN': (1.2842, 124.6950),
    'TARERAN': (1.2389, 124.7003),
    'PASAN': (1.0215, 124.7542),
    'RATAHAN TIMUR': (1.0483, 124.8192),
    'SILIAN RAYA': (1.0639, 124.6636),
    'BILALANG': (0.7732, 124.2378),
}

# Mappings for spelling variations, village-level matching, and common errors to parent districts
SPELLING_ALIASES = {
    'TUMINITING': 'TUMINTING',
    'TUMINITNG': 'TUMINTING',
    'MAUMBI': 'KALAWAT',
    'TINGKULU': 'WANEA',
    'RANOTANA WERU': 'WANEA',
    'BANJER': 'TIKALA',
    'KAROMBASAN': 'WANEA',
    'MAHAWU': 'TUMINTING',
    'SINDULANG': 'TUMINTING',
    'SUMOMPO': 'TUMINTING',
    'TUMUMPA': 'TUMINTING',
    'PANIKI': 'MAPANGET',
    'POBUNDAYAN': 'KOTAMOBAGU SELATAN',
    'BIGA': 'KOTAMOBAGU UTARA',
    'MOLINOW': 'KOTAMOBAGU BARAT',
    'POYOWA': 'KOTAMOBAGU SELATAN',
    'MOTOBOI': 'KOTAMOBAGU SELATAN',
    'GOGAGOMAN': 'KOTAMOBAGU BARAT',
    'KOTOBANGON': 'KOTAMOBAGU TIMUR',
    'DUMINANGA': 'HELUMO',
    'BINIHA': 'HELUMO',
    'SANGKUB': 'SANGKUB',
    'HELUMO': 'HELUMO',
    'TOMINI': 'TOMINI',
    'TUMPAAN': 'TUMPAAN',
    'MODOINDING': 'MODOINDING',
    'SULUUN': 'SULUUN TARERAN',
    'TARERAN': 'TARERAN',
    'PASAN': 'PASAN',
    'SILIAN': 'SILIAN RAYA',
    'BILALANG': 'BILALANG',
    'TUDU AOG': 'BILALANG',
    'TOMBOLANGO': 'SANGKUB',
    'BATUBANTAYO': 'PINOGALUMAN',
    'KAYUOGU': 'PINOGALUMAN',
    'BUKO UTARA': 'PINOGALUMAN',
    'DALAPULI TIMUR': 'PINOGALUMAN',
    'SAPA TIMUR': 'TENGA',
    'TUNTUNG': 'PINOGALUMAN',
    'DUINI': 'PINOGALUMAN',
    'RINONDORAN': 'LIKUPANG TIMUR',
    'TOLONDADU': 'BOLAANG UKI',
    'PINONOBATUAN': 'DUMOGA TIMUR',
}

# Product type code to human-readable label mapping
PRODUCT_TYPE_LABELS = {
    'A0001': 'Daging & Olahannya',
    'A0002': 'Minyak & Lemak',
    'A0003': 'Susu & Olahannya',
    'A0004': 'Makanan Olahan',
    'A0005': 'Buah & Sayur Olahan',
    'A0006': 'Tepung & Olahannya',
    'A0007': 'Roti, Kue & Biskuit',
    'A0008': 'Gula & Kembang Gula',
    'A0009': 'Ikan & Olahan Laut',
    'A0010': 'Telur & Olahannya',
    'A0011': 'Bumbu & Rempah',
    'A0012': 'Kacang & Olahannya',
    'A0013': 'Es & Minuman',
    'A0014': 'Makanan Ringan',
    'A0015': 'Mie & Pasta',
    'A0016': 'Jasa Boga / Katering',
    'B0001': 'Obat Tradisional / Jamu',
    'B0002': 'Kosmetik & Perawatan',
    'C0001': 'Hasil Pertanian',
}


def get_coords_for_address(address):
    """Geocode an address by matching against known district names and spelling aliases.
    Returns: (lat, lng, is_matched)
    """
    address_upper = str(address).upper()
    
    # 1. Try to match direct district names (longest key first to match more specific names before general ones)
    sorted_districts = sorted(DISTRICT_COORDS.keys(), key=len, reverse=True)
    for district in sorted_districts:
        if district in address_upper:
            coords = DISTRICT_COORDS[district]
            # Add a small random offset so points don't overlap perfectly
            # ~500m scatter for realistic visualization
            lat_offset = random.uniform(-0.005, 0.005)
            lng_offset = random.uniform(-0.005, 0.005)
            return coords[0] + lat_offset, coords[1] + lng_offset, True
            
    # 2. Try to match spelling variations and village-level mappings
    sorted_aliases = sorted(SPELLING_ALIASES.keys(), key=len, reverse=True)
    for alias in sorted_aliases:
        if alias in address_upper:
            target_district = SPELLING_ALIASES[alias]
            if target_district in DISTRICT_COORDS:
                coords = DISTRICT_COORDS[target_district]
                lat_offset = random.uniform(-0.005, 0.005)
                lng_offset = random.uniform(-0.005, 0.005)
                return coords[0] + lat_offset, coords[1] + lng_offset, True
    
    # Default to Manado area center if no district matched
    lat_offset = random.uniform(-0.01, 0.01)
    lng_offset = random.uniform(-0.01, 0.01)
    return DISTRICT_COORDS['MANADO'][0] + lat_offset, DISTRICT_COORDS['MANADO'][1] + lng_offset, False


def get_product_label(code):
    """Map product type code to a human-readable label."""
    code_str = str(code).strip().upper()
    return PRODUCT_TYPE_LABELS.get(code_str, code_str)


def main():
    file_path = '../Database UMKM.xlsx'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
        
    df = pd.read_excel(file_path)
    
    # Select relevant columns and drop rows with missing essential data
    relevant_columns = ['FAC NAME', 'JENIS PRODUK', 'MEREK DAGANG', 'NAMA PU', 'ALAMAT PU']
    df = df[relevant_columns].dropna(subset=['ALAMAT PU']).copy()
    
    # Set random seed for reproducibility
    random.seed(42)
    
    data = []
    matched_count = 0
    for idx, row in df.iterrows():
        lat, lng, is_matched = get_coords_for_address(row['ALAMAT PU'])
        if is_matched:
            matched_count += 1
        product_code = str(row['JENIS PRODUK']).strip()
        item = {
            'id': idx,
            'name': str(row['FAC NAME']),
            'product_type': product_code,
            'product_label': get_product_label(product_code),
            'brand': str(row['MEREK DAGANG']),
            'owner': str(row['NAMA PU']),
            'address': str(row['ALAMAT PU']),
            'lat': lat,
            'lng': lng
        }
        data.append(item)
    
    # Output path
    output_dir = '../web-app/public/data'
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'umkm.json')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully geocoded and exported {len(data)} UMKMs to {output_path}")
    print(f"  - {matched_count}/{len(data)} addresses matched to specific districts")
    print(f"  - {len(data) - matched_count}/{len(data)} defaulted to Manado area")

if __name__ == '__main__':
    main()
