"""Add explicit analysis/display location metadata to the existing JSON dataset."""

import json
from pathlib import Path

from process_data import get_coords_for_address, get_display_coords


DATA_PATH = Path(__file__).resolve().parents[1] / 'web-app' / 'public' / 'data' / 'umkm.json'


def main():
    with DATA_PATH.open(encoding='utf-8') as source:
        businesses = json.load(source)

    matched_count = 0
    for business in businesses:
        address = business.get('address', '')
        analysis_lat, analysis_lng, is_matched, matched_area = get_coords_for_address(address)
        display_lat, display_lng = get_display_coords(
            analysis_lat,
            analysis_lng,
            f"{business.get('id', '')}|{address}",
            is_matched,
        )

        business.update({
            'analysis_lat': analysis_lat,
            'analysis_lng': analysis_lng,
            'display_lat': display_lat,
            'display_lng': display_lng,
            'lat': display_lat,
            'lng': display_lng,
            'location_accuracy': 'perkiraan_kecamatan' if is_matched else 'belum_terverifikasi',
            'location_area': matched_area,
        })
        matched_count += int(is_matched)

    with DATA_PATH.open('w', encoding='utf-8') as destination:
        json.dump(businesses, destination, ensure_ascii=False, indent=2)
        destination.write('\n')

    print(f'Updated {len(businesses)} records: {matched_count} matched, {len(businesses) - matched_count} unverified')


if __name__ == '__main__':
    main()
