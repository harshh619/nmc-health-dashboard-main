'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Play, Pause, RotateCcw, FastForward, Film } from 'lucide-react';

import { PatientRecord, GeoJsonData } from '../lib/types';
import { cleanWardName, WARD_TO_ZONE_MAP } from '../lib/wardMapping';
import { formatDateDisplay, formatStatusDisplay, normalizeStatus } from '../lib/supabase';

interface SurveillanceMapProps {
  patientData: PatientRecord[];
  diseaseColorMap: Record<string, string>;
  selectedWards: string[];
}

export default function SurveillanceMap({
  patientData,
  diseaseColorMap,
  selectedWards,
}: SurveillanceMapProps) {
  const [mapMode, setMapMode] = useState<
    'Patient Cluster View' | 'Ward-wise Exact Count View' | 'All Cases Points View'
  >('Patient Cluster View');
  const [geoData, setGeoData] = useState<GeoJsonData | null>(null);
  const [showMobileLegend, setShowMobileLegend] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const geoJsonLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const dataLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const prevFilterStateRef = useRef<string>('');

  // Time-Series Playback States
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1000 | 500 | 250>(1000);

  // Extract and sort unique dates
  const uniqueDates = useMemo(() => {
    const set = new Set<string>();
    patientData.forEach((d) => {
      if (d.Date) set.add(d.Date);
    });
    return Array.from(set).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [patientData]);

  // Handle Playback Interval Timer with Auto-Hide on Completion!
  useEffect(() => {
    let timer: any = null;
    if (playbackEnabled && isPlaying && uniqueDates.length > 0) {
      timer = setInterval(() => {
        setCurrentDateIndex((prev) => {
          if (prev >= uniqueDates.length - 1) {
            setIsPlaying(false);
            // Autohide playback bar 1.5 seconds after animation completes
            setTimeout(() => {
              setPlaybackEnabled(false);
            }, 1500);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [playbackEnabled, isPlaying, uniqueDates, playbackSpeed]);

  // Filter patient data based on playback date
  const filteredPatientData = useMemo(() => {
    if (!playbackEnabled || uniqueDates.length === 0) return patientData;
    const cutoffDate = uniqueDates[currentDateIndex];
    return patientData.filter((d) => d.Date && d.Date <= cutoffDate);
  }, [patientData, playbackEnabled, uniqueDates, currentDateIndex]);

  // Active Outbreak Wards for Playback Header Info
  const activePlaybackHotspots = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPatientData.forEach((d) => {
      const w = cleanWardName(d.Ward_Name);
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([ward, count]) => `Prabhag ${ward} (${count})`);
  }, [filteredPatientData]);

  // Load geojson data safely
  useEffect(() => {
    async function loadGeoJson() {
      try {
        let res = await fetch('/wards_simplified.geojson');
        if (!res.ok) {
          res = await fetch('/wards.geojson');
        }
        if (!res.ok) {
          throw new Error(`GeoJSON HTTP error ${res.status}`);
        }
        const data = await res.json();
        if (data && data.features) {
          setGeoData(data);
        }
      } catch (err) {
        console.warn('GeoJSON load error:', err);
      }
    }
    loadGeoJson();
  }, []);

  // Initialize Leaflet map ONCE when DOM container & GeoJSON are ready
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || !geoData || leafletMapRef.current) return;

    // Ensure L is on window before importing markercluster
    (window as any).L = L;
    if (typeof (L as any).markerClusterGroup === 'undefined') {
      try {
        require('leaflet.markercluster');
      } catch (e) {
        console.warn('leaflet.markercluster load error:', e);
      }
    }

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const getResponsiveInitialZoom = (): number => {
      if (typeof window === 'undefined') return 11.7;
      const w = window.innerWidth;
      if (w < 480) return 11.2;  // Mobile portrait (fills 100% of card like Image 2)
      if (w < 768) return 11.4;  // Small tablet / large phone
      if (w < 1024) return 11.5; // Tablet
      return 11.7;               // Desktop
    };

    const getResponsiveInitialCenter = (): [number, number] => {
      return [21.1458, 79.0882]; // Exact center of Nagpur city
    };

    const savedLat = sessionStorage.getItem('mapLat');
    const savedLng = sessionStorage.getItem('mapLng');
    const savedZoom = sessionStorage.getItem('mapZoom');

    const defaultCenter = getResponsiveInitialCenter();
    const defaultZoom = getResponsiveInitialZoom();

    const initialLat = savedLat ? parseFloat(savedLat) : defaultCenter[0];
    const initialLng = savedLng ? parseFloat(savedLng) : defaultCenter[1];
    const initialZoom = savedZoom ? parseFloat(savedZoom) : defaultZoom;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    leafletMapRef.current = map;

    const osm = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19 }
    );
    
    // Free Esri Canvas Map (Great replacement for Carto light)
    const esriGray = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16 }
    );
    
    // Satellite map
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    );
    
    // Topographic map
    const topo = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      { maxZoom: 17 }
    );

    osm.addTo(map);

    // Standard Leaflet Layer Control (Positioned Top Right)
    const baseMaps = {
      'Default Map (OSM)': osm,
      'Clean Gray Map (Free)': esriGray,
      'Satellite View (Free)': satellite,
      'Topographic Map (Free)': topo,
    };
    L.control.layers(baseMaps, undefined, { position: 'topright', collapsed: true }).addTo(map);

    // Custom Center Control
    const CenterControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        const container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control bg-white shadow-md rounded-md overflow-hidden cursor-pointer'
        );
        container.innerHTML = `<a title="Center Map" class="flex items-center justify-center w-8 h-8 text-base hover:bg-slate-100">🎯</a>`;
        L.DomEvent.on(container, 'click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          sessionStorage.removeItem('mapLat');
          sessionStorage.removeItem('mapLng');
          sessionStorage.removeItem('mapZoom');

          const rCenter = getResponsiveInitialCenter();
          const rZoom = getResponsiveInitialZoom();
          map.setView(rCenter, rZoom, { animate: true, duration: 1.0 });
        });
        return container;
      },
    });

    map.addControl(new CenterControl());
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Persistent Layer Groups for zero-flicker updates
    geoJsonLayerGroupRef.current = L.featureGroup().addTo(map);
    dataLayersGroupRef.current = L.featureGroup().addTo(map);

    if (typeof (L as any).markerClusterGroup === 'function') {
      clusterGroupRef.current = (L as any).markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 45,
      });
      map.addLayer(clusterGroupRef.current);
    }

    setTimeout(() => map.invalidateSize(), 200);

    let resizeTimer: any = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (leafletMapRef.current) {
          leafletMapRef.current.invalidateSize();
        }
      }, 200);
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    map.on('moveend zoomend', () => {
      const center = map.getCenter();
      sessionStorage.setItem('mapLat', center.lat.toString());
      sessionStorage.setItem('mapLng', center.lng.toString());
      sessionStorage.setItem('mapZoom', map.getZoom().toString());
    });

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [geoData]);

  // Silent In-Place Layer Rendering
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !geoData) return;

    const geoGroup = geoJsonLayerGroupRef.current;
    const dataGroup = dataLayersGroupRef.current;
    const clusterGroup = clusterGroupRef.current;

    if (geoGroup) geoGroup.clearLayers();
    if (dataGroup) dataGroup.clearLayers();
    if (clusterGroup) clusterGroup.clearLayers();

    // Ward Case Counts
    const cleanWardCounts: Record<string, number> = {};
    const cleanZoneCounts: Record<string, number> = {};

    filteredPatientData.forEach((row) => {
      const cWard = cleanWardName(row.Ward_Name);
      cleanWardCounts[cWard] = (cleanWardCounts[cWard] || 0) + 1;

      if (row.Zone) {
        cleanZoneCounts[row.Zone] = (cleanZoneCounts[row.Zone] || 0) + 1;
      }
    });

    const maxCases = Object.values(cleanWardCounts).reduce((max, c) => (c > max ? c : max), 1);

    const getDensityColor = (cases: number) => {
      if (cases === 0) return '#ebedef';
      if (cases < maxCases * 0.2) return '#ffeda0';
      if (cases < maxCases * 0.4) return '#feb24c';
      if (cases < maxCases * 0.7) return '#fc4e2a';
      return '#bd0026';
    };

    const activeZonesCount = Object.keys(cleanZoneCounts).filter(z => z && z.toLowerCase() !== 'unassigned' && z.toLowerCase() !== 'unknown zone').length;
    const isSingleZoneView = activeZonesCount === 1;

    // GeoJSON Choropleth Layer
    const geoJsonLayer = L.geoJSON(geoData as any, {
      style: (feature: any) => {
        const rawName = feature.properties?.name || 'Unknown';
        const cleanW = cleanWardName(rawName);
        const count = cleanWardCounts[cleanW] || 0;
        const isCriticalHotspot = count >= maxCases * 0.7 && count > 0;
        const hasCases = count > 0;

        return {
          color: (isSingleZoneView && hasCases) ? '#ffffff' : '#1d4ed8',
          weight: isCriticalHotspot ? 2.5 : hasCases ? 1.5 : 1.2,
          fillColor: getDensityColor(count),
          fillOpacity: hasCases ? 0.85 : 0.05,
          className: isCriticalHotspot ? 'hotspot-ward-glow' : '',
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const rawName = feature.properties?.name || 'Unknown';
        const cleanW = cleanWardName(rawName);
        const wardCases = cleanWardCounts[cleanW] || 0;
        const zoneName = WARD_TO_ZONE_MAP[cleanW] || 'Unknown Zone';
        const zoneCases = cleanZoneCounts[zoneName] || 0;

        layer.bindTooltip(
          `<div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; line-height: 1.5; padding: 2px 4px; color: #0f172a;">
            <div style="font-weight: 800; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin-bottom: 4px;">📍 Prabhag / Ward No: ${cleanW}</div>
            <div style="display: flex; justify-content: space-between; gap: 8px;"><span>Total Cases:</span> <b style="color: #dc2626;">${wardCases}</b></div>
            <div style="display: flex; justify-content: space-between; gap: 8px;"><span>Zone:</span> <b>${zoneName}</b></div>
            <div style="display: flex; justify-content: space-between; gap: 8px;"><span>Zone Total:</span> <b>${zoneCases}</b></div>
          </div>`,
          { sticky: true }
        );
      },
    });

    if (geoGroup) geoGroup.addLayer(geoJsonLayer);

    // High-Contrast Sleek Prabhag Name Pill Badges
    if (playbackEnabled && geoData && Array.isArray(geoData.features) && dataGroup) {
      geoData.features.forEach((feature) => {
        const cleanW = cleanWardName(feature.properties?.name);
        const count = cleanWardCounts[cleanW] || 0;
        if (count > 0 && feature.geometry) {
          let coords: any[] = [];
          if (feature.geometry.type === 'Polygon') {
            coords = feature.geometry.coordinates[0];
          } else if (feature.geometry.type === 'MultiPolygon') {
            coords = feature.geometry.coordinates[0][0];
          }
          if (coords.length > 0) {
            const lats = coords.map((c: any) => c[1]);
            const lons = coords.map((c: any) => c[0]);
            const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
            const cLon = lons.reduce((a, b) => a + b, 0) / lons.length;

            const isHotspot = count >= maxCases * 0.7;

            const wardLabelIcon = L.divIcon({
              className: 'ward-name-label-icon',
              html: `<div style="background-color: #0f172a; border: 1.5px solid ${
                isHotspot ? '#ef4444' : '#3b82f6'
              }; color: #ffffff; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 20px; text-align: center; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); transform: translate(-50%, -120%); pointer-events: none; display: inline-flex; align-items: center; gap: 4px;">
                <span style="font-size: 10px;">📍</span> Prabhag ${cleanW}
                <span style="background-color: ${
                  isHotspot ? '#dc2626' : '#2563eb'
                }; color: #ffffff; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 800;">${count}</span>
              </div>`,
            });

            const marker = L.marker([cLat, cLon], { icon: wardLabelIcon, interactive: false });
            dataGroup.addLayer(marker);
          }
        }
      });
    }

    // Helper to generate compact popup
    const createPatientPopupContent = (row: PatientRecord) => {
      const disease = row.Disease || 'Unknown';
      const color = diseaseColorMap[disease] || '#2563eb';
      const gMapsUrl = `https://www.google.com/maps?q=${row.Lat},${row.Long}`;
      const waText = encodeURIComponent(
        `🏥 NMC Alert:\nPatient: ${row.Patient_Name || 'N/A'}\nDisease: ${disease}\nWard: ${cleanWardName(row.Ward_Name)}\nLocation: ${gMapsUrl}`
      );
      const waUrl = `https://api.whatsapp.com/send?text=${waText}`;

      return `
        <div style="font-family: Inter, sans-serif; font-size: 11px; width: 170px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
            <span style="font-weight: 800; font-size: 12px; color: #0f172a;">${row.Patient_Name || 'Patient'}</span>
            <span style="background: ${color}; color: #fff; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 700;">${disease}</span>
          </div>
          <div style="color: #475569; font-size: 10px; margin-bottom: 4px;">
            <div>Ward: <b>Prabhag ${cleanWardName(row.Ward_Name)}</b></div>
            <div>Zone: <b>${row.Zone || 'Unknown Zone'}</b></div>
            <div>Date: <b>${formatDateDisplay(row.Date)}</b></div>
            <div>Status: <b style="color: ${normalizeStatus(row.Status) === 'Recovered' ? '#059669' : normalizeStatus(row.Status) === 'Suspected Death' ? '#dc2626' : '#d97706'}">${formatStatusDisplay(row.Status)}</b></div>
          </div>
          <div style="display: flex; gap: 4px; margin-top: 4px;">
            <a href="${gMapsUrl}" target="_blank" style="flex: 1; text-align: center; background: #2563eb; color: #fff; padding: 3px 0; border-radius: 4px; font-size: 9px; font-weight: 700; text-decoration: none;">📍 Google Maps</a>
            <a href="${waUrl}" target="_blank" style="flex: 1; text-align: center; background: #16a34a; color: #fff; padding: 3px 0; border-radius: 4px; font-size: 9px; font-weight: 700; text-decoration: none;">💬 WhatsApp</a>
          </div>
        </div>
      `;
    };

    // Render View Modes
    if (mapMode === 'Patient Cluster View') {
      if (clusterGroup) {
        filteredPatientData.slice(0, 15000).forEach((row) => {
          if (row.Lat && row.Long) {
            const disease = row.Disease || 'Unknown';
            const color = diseaseColorMap[disease] || '#2563eb';
            const popupHtml = createPatientPopupContent(row);

            const marker = L.circleMarker([row.Lat, row.Long], {
              radius: 6,
              fillColor: color,
              color: '#ffffff',
              weight: 1,
              fillOpacity: 0.9,
            }).bindPopup(popupHtml);

            clusterGroup.addLayer(marker);
          }
        });
      }
    } else if (mapMode === 'Ward-wise Exact Count View') {
      if (geoData && Array.isArray(geoData.features) && dataGroup) {
        geoData.features.forEach((feature) => {
          const cleanW = cleanWardName(feature.properties?.name);
          const count = cleanWardCounts[cleanW] || 0;
          if (count > 0 && feature.geometry) {
            let coords: any[] = [];
            if (feature.geometry.type === 'Polygon') {
              coords = feature.geometry.coordinates[0];
            } else if (feature.geometry.type === 'MultiPolygon') {
              coords = feature.geometry.coordinates[0][0];
            }
            if (coords.length > 0) {
              const lats = coords.map((c: any) => c[1]);
              const lons = coords.map((c: any) => c[0]);
              const cLat = lats.reduce((a, b) => a + b, 0) / lats.length;
              const cLon = lons.reduce((a, b) => a + b, 0) / lons.length;

              const ratio = Math.min(1, Math.max(0, count / maxCases));
              const size = Math.round(32 + ratio * 28);
              const fontSize = count >= 10000 ? 10 : count >= 1000 ? 11 : 12;
              const isHotspot = count >= maxCases * 0.7;

              const badgeIcon = L.divIcon({
                className: 'dynamic-ward-badge-icon',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
                html: `<div style="background:${
                  isHotspot
                    ? 'linear-gradient(135deg, #b91c1c, #7f1d1d)'
                    : 'linear-gradient(135deg, #ef4444, #b91c1c)'
                }; border:2.5px solid #ffffff; color:#ffffff; font-weight:800; font-size:${fontSize}px; width:${size}px; height:${size}px; min-width:${size}px; min-height:${size}px; border-radius:9999px; display:flex; align-items:center; justify-content:center; text-align:center; box-shadow:0 4px 12px rgba(0,0,0,0.5); white-space:nowrap; padding:0 3px; box-sizing:border-box;">${count.toLocaleString()}</div>`,
              });

              const badgeMarker = L.marker([cLat, cLon], { icon: badgeIcon })
                .bindTooltip(
                  `<div style="font-family: Inter, sans-serif;"><b>Prabhag / Ward ${cleanW}</b>: ${count} Cases</div>`
                );

              dataGroup.addLayer(badgeMarker);
            }
          }
        });
      }
    } else if (mapMode === 'All Cases Points View') {
      if (dataGroup) {
        filteredPatientData.slice(0, 15000).forEach((row) => {
          if (row.Lat && row.Long) {
            const disease = row.Disease || 'Unknown';
            const color = diseaseColorMap[disease] || '#2563eb';
            const popupHtml = createPatientPopupContent(row);

            const ptMarker = L.circleMarker([row.Lat, row.Long], {
              radius: 6,
              fillColor: color,
              color: '#ffffff',
              weight: 1,
              fillOpacity: 0.9,
            }).bindPopup(popupHtml);

            dataGroup.addLayer(ptMarker);
          }
        });
      }
    }

    // Auto-fit bounds ONLY when specific ward filter is selected
    const currentFilterKey = `${selectedWards.join(',')}_${mapMode}_${playbackEnabled}`;
    if (prevFilterStateRef.current !== currentFilterKey) {
      prevFilterStateRef.current = currentFilterKey;

      if (selectedWards.length > 0) {
        const activeBounds = L.latLngBounds([]);
        filteredPatientData.forEach((row) => {
          if (row.Lat && row.Long && !isNaN(Number(row.Lat)) && !isNaN(Number(row.Long))) {
            activeBounds.extend([Number(row.Lat), Number(row.Long)]);
          }
        });

        if (activeBounds.isValid()) {
          map.fitBounds(activeBounds, { padding: [30, 30], maxZoom: 14, animate: true });
        }
      }
    }
  }, [geoData, filteredPatientData, mapMode, diseaseColorMap, playbackEnabled, selectedWards]);

  // Disease Counts for Legend
  const diseaseLegendList = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPatientData.forEach((d) => {
      if (d.Disease) counts[d.Disease] = (counts[d.Disease] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([disease, count]) => ({
        disease,
        count,
        color: diseaseColorMap[disease] || '#3b82f6',
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredPatientData, diseaseColorMap]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
      {/* Map Header, View Mode Radio Buttons & Epidemic Playback Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>📍</span> Patients Map View
        </h3>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
          {/* Epidemic Playback Toggle Button */}
          <button
            onClick={() => {
              if (playbackEnabled) {
                setPlaybackEnabled(false);
                setIsPlaying(false);
              } else {
                setPlaybackEnabled(true);
                setCurrentDateIndex(0);
                setIsPlaying(true);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
              playbackEnabled
                ? 'bg-rose-900 text-white border-rose-900 shadow-sm'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Epidemic Outbreak Playback</span>
          </button>

          {(
            [
              'Patient Cluster View',
              'Ward-wise Exact Count View',
              'All Cases Points View',
            ] as const
          ).map((mode) => (
            <label
              key={mode}
              onClick={() => setMapMode(mode)}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <input
                type="radio"
                name="mapMode"
                checked={mapMode === mode}
                onChange={() => setMapMode(mode)}
                className="text-blue-900 focus:ring-blue-600 accent-blue-900 w-3.5 h-3.5"
              />
              <span className={mapMode === mode ? 'text-blue-900 font-bold' : 'text-slate-600'}>
                {mode}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Epidemic Outbreak Time-Series Control Bar */}
      {playbackEnabled && uniqueDates.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-3.5 rounded-xl mb-3 shadow-md flex flex-col space-y-2.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow transition-transform active:scale-95"
                title={isPlaying ? 'Pause' : 'Play Outbreak Animation'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentDateIndex(0);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Reset to Day 1"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setPlaybackSpeed((prev) => (prev === 1000 ? 500 : prev === 500 ? 250 : 1000));
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono font-bold text-blue-300 transition-colors flex items-center gap-1"
                title="Change Speed"
              >
                <FastForward className="w-3 h-3" />
                <span>{playbackSpeed === 1000 ? '1x' : playbackSpeed === 500 ? '2x' : '4x'}</span>
              </button>
            </div>

            {/* Current Outbreak Hotspots Header */}
            <div className="text-xs text-right font-medium flex items-center gap-1.5">
              <span className="text-slate-400">Outbreak Focus:</span>
              <span className="text-amber-300 font-bold bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded text-[11px]">
                🔥 {activePlaybackHotspots.join(' • ') || 'No active cases'}
              </span>
            </div>
          </div>

          {/* Time Slider */}
          <div className="w-full space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">
                Outbreak Day {currentDateIndex + 1} of {uniqueDates.length}
              </span>
              <span className="text-rose-400 font-bold bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded text-[11px]">
                📅 {formatDateDisplay(uniqueDates[currentDateIndex])} ({filteredPatientData.length} Cases)
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={uniqueDates.length - 1}
              value={currentDateIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentDateIndex(parseInt(e.target.value, 10));
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full h-[420px] sm:h-[580px] md:h-[640px] rounded-xl overflow-hidden border border-slate-200">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Mobile Legend Toggle Pill Button */}
        <div className="sm:hidden absolute bottom-3 left-3 z-[9999] pointer-events-auto">
          <button
            onClick={() => setShowMobileLegend(!showMobileLegend)}
            className="bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <span>📊 Map Legend</span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.2 rounded-full">
              {showMobileLegend ? '✕ Close' : '▲ Open'}
            </span>
          </button>
        </div>

        {/* Floating Legends */}
        <div
          className={`absolute bottom-12 left-2 sm:bottom-4 sm:left-4 z-[9999] ${
            showMobileLegend ? 'flex' : 'hidden sm:flex'
          } flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3 pointer-events-none scale-90 sm:scale-100 origin-bottom-left max-w-[calc(100vw-2rem)]`}
        >
          {/* Disease Types Box */}
          <div className="bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-2.5 sm:p-3 shadow-xl pointer-events-auto w-44 sm:w-52 max-h-[220px] sm:max-h-[360px] flex flex-col justify-end">
            <div className="text-xs font-bold text-blue-900 mb-1.5 pb-1 border-b border-slate-200 flex items-center gap-1 flex-shrink-0">
              <span>🦠</span> Disease Types
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[300px] pr-1">
              {diseaseLegendList.length === 0 ? (
                <div className="text-[11px] text-slate-400 text-center py-2">
                  No cases found
                </div>
              ) : (
                diseaseLegendList.map(({ disease, count, color }) => (
                  <div
                    key={disease}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-slate-300"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-slate-700 font-medium truncate">
                        {disease}
                      </span>
                    </div>
                    <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Case Density Box */}
          <div className="bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-3 shadow-xl pointer-events-auto w-44 flex-shrink-0">
            <div className="text-xs font-bold text-blue-900 mb-1.5 pb-1 border-b border-slate-200 flex items-center gap-1">
              <span>📊</span> Case Density
            </div>
            <div className="space-y-1 text-[11px] font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#bd0026] inline-block border border-slate-400" />
                Critical / High
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#fc4e2a] inline-block border border-slate-400" />
                Moderate-High
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#feb24c] inline-block border border-slate-400" />
                Moderate
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#ffeda0] inline-block border border-slate-400" />
                Low Cases
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-[#ebedef] inline-block border border-slate-400" />
                Zero Cases
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
