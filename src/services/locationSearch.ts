/**
 * Location Search & Reverse Geocoding Service for BharatRaide
 * Supports free instant search via Photon (OSM-powered) and Nominatim
 * with proximity bias, debounce handling, and Indian address formatting.
 */

export interface SearchResultItem {
  id: string;
  name: string;
  locality: string;
  lat: number;
  lng: number;
  category?: string;
}

// Common Indian city landmarks for zero-latency fallback / offline resilience
const POPULAR_INDIAN_HUBS: SearchResultItem[] = [
  { id: 'hub_delhi_cp', name: 'Connaught Place (CP)', locality: 'Central Delhi, New Delhi', lat: 28.6315, lng: 77.2167, category: 'Commercial' },
  { id: 'hub_delhi_ndls', name: 'New Delhi Railway Station (NDLS)', locality: 'Ajmeri Gate, Delhi', lat: 28.6431, lng: 77.2197, category: 'Station' },
  { id: 'hub_delhi_igi', name: 'Indira Gandhi International Airport (T3)', locality: 'Palam, New Delhi', lat: 28.5562, lng: 77.1000, category: 'Airport' },
  { id: 'hub_delhi_aiims', name: 'AIIMS Hospital Delhi', locality: 'Ansari Nagar, New Delhi', lat: 28.5672, lng: 77.2100, category: 'Hospital' },
  { id: 'hub_delhi_isbt', name: 'Kashmere Gate ISBT', locality: 'Civil Lines, Delhi', lat: 28.6675, lng: 77.2285, category: 'Bus Terminal' },
  { id: 'hub_noida_sec18', name: 'Sector 18 Atta Market', locality: 'Noida, Uttar Pradesh', lat: 28.5708, lng: 77.3261, category: 'Market' },
  { id: 'hub_ggn_cyber', name: 'DLF Cyber City', locality: 'Gurugram, Haryana', lat: 28.4950, lng: 77.0895, category: 'IT Park' },
  { id: 'hub_lko_charbagh', name: 'Charbagh Railway Station', locality: 'Lucknow, Uttar Pradesh', lat: 26.8322, lng: 80.9189, category: 'Station' },
  { id: 'hub_lko_hazratganj', name: 'Hazratganj Market', locality: 'Lucknow, Uttar Pradesh', lat: 26.8524, lng: 80.9449, category: 'Market' },
  { id: 'hub_blr_mgroad', name: 'MG Road Metro Station', locality: 'Bengaluru, Karnataka', lat: 12.9756, lng: 77.6066, category: 'Station' },
  { id: 'hub_mum_cst', name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)', locality: 'Fort, Mumbai', lat: 18.9398, lng: 72.8355, category: 'Station' },
];

/**
 * Searches places matching user query, prioritizing places near user coords if available.
 */
export async function searchPlaces(
  query: string,
  userLat?: number,
  userLng?: number,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // 1. Try Photon Komoot API (Fastest OSM-based autocomplete service with proximity bias)
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`;
    if (userLat && userLng) {
      url += `&lat=${userLat}&lon=${userLng}`;
    }

    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        return data.features.map((feat: any, idx: number) => {
          const props = feat.properties || {};
          const [lon, lat] = feat.geometry?.coordinates || [0, 0];
          
          const parts: string[] = [];
          if (props.street) parts.push(props.street);
          if (props.district) parts.push(props.district);
          if (props.city && props.city !== props.name) parts.push(props.city);
          if (props.state) parts.push(props.state);

          return {
            id: `photon_${props.osm_id || idx}_${lat.toFixed(4)}`,
            name: props.name || props.street || trimmed,
            locality: parts.join(', ') || props.country || 'India',
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            category: props.type || props.osm_value,
          };
        });
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.warn('Photon autocomplete error, trying Nominatim fallback:', err);
  }

  // 2. Try Nominatim Search API
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&limit=5&countrycodes=in&addressdetails=1`;
    const res = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'hi,en',
      },
    });

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item: any) => {
          const addr = item.address || {};
          const parts: string[] = [];
          if (addr.suburb) parts.push(addr.suburb);
          if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
          if (addr.state) parts.push(addr.state);

          return {
            id: `nom_${item.place_id}`,
            name: item.name || item.display_name.split(',')[0],
            locality: parts.join(', ') || item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            category: item.type,
          };
        });
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.warn('Nominatim search failed:', err);
  }

  // 3. Resilient Local Fuzzy Match fallback
  const qLower = trimmed.toLowerCase();
  const matched = POPULAR_INDIAN_HUBS.filter(
    (h) => h.name.toLowerCase().includes(qLower) || h.locality.toLowerCase().includes(qLower)
  );
  return matched.slice(0, 5);
}

/**
 * Reverse geocodes [lat, lng] into a clean human-readable address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'hi,en',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data) {
        const addr = data.address || {};
        const landmark = data.name || addr.amenity || addr.building || addr.road || addr.suburb || addr.neighbourhood;
        const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town;
        const city = addr.city || addr.town || addr.county || addr.state;

        if (landmark && area && landmark !== area) {
          return `${landmark}, ${area}`;
        }
        if (landmark && city) {
          return `${landmark}, ${city}`;
        }
        if (data.display_name) {
          const tokens = data.display_name.split(',');
          return tokens.slice(0, 2).join(',').trim();
        }
      }
    }
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
  }

  return `स्थान (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}
