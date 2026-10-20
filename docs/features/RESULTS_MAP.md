# Feature Specification: ResultsMap

## Overview

Interactive map for the campaign workspace showing the campaign location, candidate venues from OSM, venue verification status, marker clustering, and optional evidence-based reach overlay. Includes required text alternative (venue list).

**Current State**: Basic `MapView` exists for evidence phase. No dedicated results map with campaign pin, clustering, or verification badges.

**Target**: Production-ready ResultsMap component for analytics/results phase with full feature set.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RM-001 | Campaign location pin (distinct marker) | P0 |
| FR-RM-002 | Candidate venue markers from OSM evidence | P0 |
| FR-RM-003 | Marker clustering for > 10 venues | P0 |
| FR-RM-004 | Venue verification status badges on markers/popups | P0 |
| FR-RM-005 | Optional reach overlay (toggleable, off by default) | P1 |
| FR-RM-006 | Venue list below map (required text alternative) | P0 |
| FR-RM-007 | OSM attribution always visible | P0 |
| FR-RM-008 | Campaign pin distinct from venue markers | P0 |
| FR-RM-009 | Popup on marker click: name, category, distance, verification status | P0 |
| FR-RM-010 | Responsive: works at 360px and 1200px widths | P0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-RM-001 | Map tiles | OSM Standard + CARTO Light |
| NFR-RM-002 | Attribution | "© OpenStreetMap contributors (ODbL)" always visible |
| NFR-RM-003 | Clustering | Leaflet.markercluster |
| NFR-RM-004 | Reach overlay | Methodology documented, toggleable, off by default |
| NFR-RM-005 | Accessibility | Map decorative, venue list accessible alternative |
| NFR-RM-005 | Responsive | 360px - 1200px widths |

---

## Component Specification

### Props Interface

```typescript
interface ResultsMapProps {
  campaignLocation: GeoPoint;           // Campaign center
  venues: GeoVenue[];                   // From evidence snapshot
  selectedVenue?: GeoVenue;             // For highlight
  onVenueSelect: (venue: GeoVenue) => void;
  showReachOverlay?: boolean;           // Default: false
  readOnly?: boolean;
  className?: string;
}

interface GeoPoint {
  lat: number;
  lon: number;
}

interface GeoVenue {
  name: string;
  category: string;
  address?: string;
  lat: number;
  lon: number;
  distance_m: number;
  distance_mi?: number;
  needs_verification: boolean;
  verification_status: 'worth-evaluating' | 'verified' | 'rejected';
  provenance: 'geo';
}
```

### Component Structure

```tsx
function ResultsMap({ 
  campaignLocation, 
  venues, 
  selectedVenue, 
  onVenueSelect,
  showReachOverlay = false 
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [clusters, setClusters] = useState<L.MarkerClusterGroup | null>(null);
  const [reachOverlay, setReachOverlay] = useState<L.ImageOverlay | null>(null);

  // Initialize map on mount
  useEffect(() => {
    const m = L.map(mapRef.current, {
      center: [campaignLocation.lat, campaignLocation.lon],
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    });

    // Base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors (ODbL)',
      maxZoom: 19
    }).addTo(m);

    // Alternative layer
    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors, © CARTO',
      maxZoom: 19
    });

    // Layer control
    L.control.layers({
      'OpenStreetMap': L.tileLayer(...),
      'CARTO Light': cartoLight
    }, null, { position: 'topright' }).addTo(m);

    setMap(m);

    // Campaign pin
    const campaignIcon = L.divIcon({
      className: 'campaign-pin',
      html: '<div class="pin campaign" aria-hidden="true">★</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
    L.marker([campaignLocation.lat, campaignLocation.lon], { 
      icon: campaignIcon,
      title: 'Campaign location'
    }).addTo(m);

    // Venue markers with clustering
    const clusterGroup = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 80,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-marker"><span>${count}</span></div>`,
          className: 'marker-cluster',
          iconSize: [40, 40]
        });
      }
    });

    venues.forEach(venue => {
      const marker = createVenueMarker(venue, m);
      clusterGroup.addLayer(marker);
    });

    m.addLayer(clusterGroup);
    setClusters(clusterGroup);

    // Fit bounds to show all venues + campaign
    const bounds = L.latLngBounds([
      [campaignLocation.lat, campaignLocation.lon],
      ...venues.map(v => [v.lat, v.lon])
    ]);
    m.fitBounds(bounds, { padding: [50, 50] });

    return () => {
      m.remove();
      clusterGroup.clearLayers();
    };
  }, [campaignLocation, venues]);

  // Reach overlay toggle
  useEffect(() => {
    if (!map || !showReachOverlay) {
      if (reachOverlay) {
        map.removeLayer(reachOverlay);
        setReachOverlay(null);
      }
      return;
    }
    // Add reach overlay (methodology must be documented)
    const overlay = createReachOverlay(map);
    overlay.addTo(map);
    setReachOverlay(overlay);
  }, [map, showReachOverlay]);

  return (
    <div className="results-map-container">
      <div 
        ref={mapRef} 
        className="results-map" 
        aria-hidden="true"
        role="img"
        aria-label="Map showing campaign location and candidate venues"
      />
      
      {/* Attribution always visible */}
      <div className="map-attribution" aria-hidden="true">
        © OpenStreetMap contributors (ODbL)
      </div>

      {/* Reach overlay toggle */}
      <label className="reach-toggle">
        <input 
          type="checkbox" 
          checked={showReachOverlay} 
          onChange={e => onReachToggle?.(e.target.checked)} 
        />
        <span>Show reach estimate overlay (methodology: {reachMethodology})</span>
      </label>

      {/* Required text alternative */}
      <VenueList 
        venues={venues} 
        selectedVenue={selectedVenue}
        onSelect={onVenueSelect}
      />
    </div>
  );
}
```

### Venue Marker Creation

```typescript
function createVenueMarker(venue: GeoVenue, map: L.Map): L.Marker {
  const statusColors = {
    'worth-evaluating': '#f59e0b',  // amber
    'verified': '#10b981',           // green
    'rejected': '#ef4444'            // red
  };

  const icon = L.divIcon({
    className: 'venue-marker',
    html: `
      <div class="venue-marker-inner" style="background: ${statusColors[venue.verification_status]}">
        <span class="venue-icon">${getCategoryIcon(venue.category)}</span>
        ${venue.needs_verification ? '<span class="verification-badge">⚠</span>' : ''}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });

  const marker = L.marker([venue.lat, venue.lon], { icon });

  // Popup content
  const popupContent = `
    <div class="venue-popup">
      <h4>${escapeHtml(venue.name)}</h4>
      <p class="category">${escapeHtml(venue.category)}</p>
      ${venue.address ? `<p class="address">${escapeHtml(venue.address)}</p>` : ''}
      <p class="distance">
        ${venue.distance_mi ? `${venue.distance_mi} mi` : `${venue.distance_m} m`} from campaign
      </p>
      <p class="verification-status ${venue.verification_status}">
        ${venue.needs_verification ? '⚠ Visit and verify before use' : '✓ Verified'}
      </p>
      <button class="select-venue-btn" data-venue-id="${venue.name}">View details</button>
    </div>
  `;

  marker.bindPopup(popupContent, {
    maxWidth: 300,
    className: 'venue-popup-container'
  });

  marker.on('click', () => {
    // Could emit event for venue selection
  });

  return marker;
}
```

---

## Venue List (Required Text Alternative)

```tsx
function VenueList({ venues, selectedVenue, onSelect }) {
  return (
    <section className="venue-list" aria-label="Candidate venues">
      <h3>Venues to Evaluate ({venues.length})</h3>
      <ul role="list" className="venue-list-items">
        {venues.map((venue, index) => (
          <li 
            key={`${venue.lat}-${venue.lon}`}
            className={venue === selectedVenue ? 'selected' : ''}
            onClick={() => onSelect(venue)}
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onSelect(venue)}
          >
            <div className="venue-info">
              <span className="venue-name">{escapeHtml(venue.name)}</span>
              <span className="venue-category">{escapeHtml(venue.category)}</span>
            </div>
            <div className="venue-meta">
              {venue.address && <span className="venue-address">{escapeHtml(venue.address)}</span>}
              <span className="venue-distance">
                {venue.distance_mi ? `${venue.distance_mi} mi` : `${venue.distance_m} m`}
              </span>
              <span className={`verification-badge ${venue.verification_status}`}>
                {venue.needs_verification ? 'Visit and verify' : 'Verified'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

---

## Reach Overlay (Optional, Off by Default)

### Methodology Requirements

**Must be documented before implementation:**

1. **Data Source**: Qloo affinity signals + venue capacity estimates
2. **Calculation**: 
   - Base reach = venue capacity × activity frequency × duration factor
   - Cultural multiplier = 1.0 + (avg Qloo affinity × 0.3)
   - Reach estimate = base reach × cultural multiplier
3. **Visualization**: Heatmap or choropleth overlay
4. **Limitations**: 
   - Not actual attendance
   - Based on estimates only
   - Cultural affinity ≠ attendance prediction

### Toggle Implementation

```tsx
// In ResultsMap
const [showReachOverlay, setShowReachOverlay] = useState(false);

// Toggle UI
<label className="reach-overlay-toggle">
  <input
    type="checkbox"
    checked={showReachOverlay}
    onChange={e => setShowReachOverlay(e.target.checked)}
  />
  <span>
    Show reach estimate overlay
    <span className="methodology-note">
      (Methodology: Qloo affinity × venue capacity estimates. 
       <a href="#reach-methodology">View methodology</a>.
       Not actual attendance.)
    </span>
  </span>
</label>
```

### Overlay Creation

```typescript
function createReachOverlay(map: L.Map): L.ImageOverlay | L.TileLayer {
  // Option A: Pre-rendered heatmap image
  // const bounds = map.getBounds();
  // return L.imageOverlay('/api/campaigns/{id}/reach-heatmap', bounds);

  // Option B: Dynamic heatmap (Leaflet.heat)
  // return L.heatLayer(reachDataPoints, { radius: 25, blur: 15 });

  // For MVP: placeholder
  return L.rectangle(map.getBounds(), { 
    color: '#d1ffca', 
    weight: 2, 
    fill: true, 
    fillOpacity: 0.1 
  });
}
```

---

## Accessibility

### Map as Decorative
```tsx
<div 
  ref={mapRef} 
  className="results-map" 
  aria-hidden="true"
  role="img"
  aria-label="Map showing campaign location and candidate venues"
/>
```

### Required Text Alternative
- Venue list below map (semantic `<ul>` with `<li>`)
- Each venue: name, category, address, distance, verification status
- Keyboard navigable, screen reader friendly

### Attribution
```tsx
<div className="map-attribution" aria-hidden="true">
  © OpenStreetMap contributors (ODbL)
</div>
```

### Screen Reader Support
- Map container: `aria-hidden="true"` + `role="img"` with descriptive label
- Venue list: Semantic `<ul>` with proper labels
- Reach overlay toggle: Proper label association

---

## Responsive Design

| Breakpoint | Map Height | Venue List |
|------------|------------|------------|
| < 640px (mobile) | 300px | Below map, full width |
| 640px - 1023px (tablet) | 400px | Below map |
| ≥ 1024px (desktop) | 500px | Side-by-side or below |

```css
.results-map-container {
  display: flex;
  flex-direction: column;
  gap: var(--hr-space-4);
}

@media (min-width: 1024px) {
  .results-map-container {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .results-map {
    flex: 1;
    min-width: 0;
  }
  
  .venue-list {
    width: 320px;
    flex-shrink: 0;
    max-height: 500px;
    overflow-y: auto;
  }
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Map initializes with campaign pin + venue markers
- [ ] Clustering activates at > 10 venues
- [ ] Venue popups show correct data
- [ ] Reach overlay toggles on/off
- [ ] Venue list mirrors map data
- [ ] Selected venue highlights on both map + list

### Integration Tests
- [ ] Map loads in analytics phase
- [ ] Venue selection syncs map ↔ list
- [ ] Clustering works at zoom levels
- [ ] Reach overlay toggles correctly

### Accessibility Tests
- [ ] Map has `aria-hidden="true"`
- [ ] Venue list is semantic `<ul>`
- [ ] OSM attribution visible
- [ ] Color contrast for status colors
- [ ] Keyboard navigation in venue list

### Visual Tests
- [ ] Renders at 360px width (mobile)
- [ ] Renders at 1200px width (desktop)
- [ ] Clustering visible at different zooms
- [ ] Popups readable at all sizes

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-RM-001 | Campaign pin displayed with distinct icon | Visual test |
| AC-RM-002 | Venue markers from evidence snapshot | Integration test |
| AC-RM-003 | Clustering activates at > 10 venues | Visual test |
| AC-RM-004 | Verification badges on markers + popups | Visual test |
| AC-RM-005 | Reach overlay toggleable, off by default | E2E test |
| AC-RM-006 | Venue list below map (text alternative) | axe-core |
| AC-RM-007 | OSM attribution always visible | Visual test |
| AC-RM-008 | Campaign pin distinct from venue markers | Visual test |
| AC-RM-009 | Popup shows name, category, distance, verification | Visual test |
| AC-RM-010 | Responsive at 360px and 1200px | Visual test |

---

## Implementation Notes

### Files to Create/Modify
- `apps/web/components/ResultsMap.tsx` — New component
- `apps/web/components/VenueList.tsx` — New component (or extend existing)
- `apps/web/app/campaigns/[id]/page.tsx` — Integrate in analytics phase
- `packages/ui/src/tokens.css` — Add map/cluster styles

### Dependencies
- `leaflet.markercluster` (add to package.json)
- `leaflet` (already present)

### CSS Classes Needed
```css
.campaign-pin { /* distinct star icon */ }
.venue-marker { /* category icon + status color */ }
.venue-marker-inner { /* circular background */ }
.verification-badge { /* ⚠ or ✓ */ }
.marker-cluster { /* cluster count circle */ }
.venue-popup { /* styled popup content */ }
.reach-toggle { /* checkbox + label */ }
.venue-list { /* semantic ul */ }
.venue-list-items li { /* clickable items */ }
```

---

## Rollout Plan

1. **Branch**: `feat/results-map`
2. **Implement** ResultsMap + VenueList components
3. **Integrate** in analytics phase of workspace
4. **Test** unit + integration + accessibility + visual
5. **Merge** to `integration/healthreach-redesign`

---

*Related: [Evidence Gathering](../integrations/QLOO_INTEGRATION.md) · [OSM Integration](../integrations/OSM_INTEGRATION.md) · [Visualization Guidelines](../frontend/VISUALIZATION_GUIDELINES.md)*