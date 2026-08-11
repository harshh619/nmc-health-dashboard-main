'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Play, Pause, RotateCcw, FastForward, Film } from 'lucide-react';

import { PatientRecord, GeoJsonData } from '../lib/types';
import { cleanWardName, WARD_TO_ZONE_MAP } from '../lib/wardMapping';
import { formatDateDisplay } from '../lib/supabase';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

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

  // Initialize Leaflet map & MarkerCluster client-side
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || !geoData) return;

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

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const savedLat = sessionStorage.getItem('mapLat');
    const savedLng = sessionStorage.getItem('mapLng');
    const savedZoom = sessionStorage.getItem('mapZoom');

    const initialLat = savedLat ? parseFloat(savedLat) : 21.142;
    const initialLng = savedLng ? parseFloat(savedLng) : 79.082;
    const initialZoom = savedZoom ? parseFloat(savedZoom) : 11.7;

    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    leafletMapRef.current = map;

    // Invalidate map size on initial load and resize to ensure 100% full-width tile coverage
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
    setTimeout(() => {
      map.invalidateSize();
    }, 600);

    // Debounced ResizeObserver to automatically trigger invalidateSize when container resizes
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

    // Anti-reset memory listener
    map.on('moveend zoomend', () => {
      const center = map.getCenter();
      sessionStorage.setItem('mapLat', center.lat.toString());
      sessionStorage.setItem('mapLng', center.lng.toString());
      sessionStorage.setItem('mapZoom', map.getZoom().toString());
    });

    // Tile Layers
    const cartoDb = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    );
    const cartoNoLabels = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      { maxZoom: 19 }
    );
    const osm = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19 }
    );

    cartoDb.addTo(map);

    // Standard Leaflet Layer Control (Positioned Top Right)
    const baseMaps = {
      'Clean B&W Map': cartoDb,
      'Clean No-Labels Map': cartoNoLabels,
      'Default Map': osm,
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
          map.setView([21.142, 79.082], 11.7, { animate: true, duration: 1.0 });
          sessionStorage.removeItem('mapLat');
          sessionStorage.removeItem('mapLng');
          sessionStorage.removeItem('mapZoom');
        });
        return container;
      },
    });

    map.addControl(new CenterControl());
    L.control.zoom({ position: 'topright' }).addTo(map);

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

    // GeoJSON Choropleth Layer
    L.geoJSON(geoData as any, {
      style: (feature: any) => {
        const rawName = feature.properties?.name || 'Unknown';
        const cleanW = cleanWardName(rawName);
        const count = cleanWardCounts[cleanW] || 0;
        const isCriticalHotspot = count >= maxCases * 0.7 && count > 0;

        return {
          color: isCriticalHotspot ? '#991b1b' : '#444444',
          weight: isCriticalHotspot ? 2 : 1,
          fillColor: getDensityColor(count),
          fillOpacity: isCriticalHotspot ? 0.8 : 0.65,
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
    }).addTo(map);

    // High-Contrast Sleek Prabhag Name Pill Badges (Rendered ONLY during Epidemic Outbreak Playback!)
    if (playbackEnabled && geoData && Array.isArray(geoData.features)) {
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

            L.marker([cLat, cLon], { icon: wardLabelIcon, interactive: false }).addTo(map);
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
            <span style="font-weight: 700; color: ${color}; font-size: 12px;">${disease}</span>
            <span style="background: #f1f5f9; color: #475569; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 600;">${row.Status || 'Active'}</span>
          </div>
          <div style="color: #334155; font-size: 11px; font-weight: 600; margin-bottom: 1px;">${row.Patient_Name || 'N/A'}</div>
          <div style="color: #64748b; font-size: 10px; margin-bottom: 5px;">Prabhag / Ward ${cleanWardName(row.Ward_Name)}</div>
          
          <div style="display: flex; items-center; gap: 3px; border-top: 1px solid #f1f5f9; padding-top: 5px;">
            <a href="${gMapsUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; background: #2563eb; color: white; text-decoration: none; padding: 3px 0; border-radius: 4px; font-size: 10px; font-weight: 600; text-align: center; display: flex; align-items: center; justify-content: center; gap: 2px;">
              📍 Maps
            </a>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; background: #16a34a; color: white; text-decoration: none; padding: 3px 0; border-radius: 4px; font-size: 10px; font-weight: 600; text-align: center; display: flex; align-items: center; justify-content: center; gap: 2px;">
              💬 Share
            </a>
            <button onclick="navigator.clipboard.writeText('${gMapsUrl}'); this.innerText='✓';" title="Copy Link" style="width: 24px; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; border-radius: 4px; font-size: 10px; cursor: pointer; text-align: center;">
              📋
            </button>
          </div>
        </div>
      `;
    };

    // Render View Modes
    if (mapMode === 'Patient Cluster View') {
      if (typeof (L as any).markerClusterGroup === 'function') {
        const markerClusterGroup = (L as any).markerClusterGroup({
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          spiderfyOnMaxZoom: true,
          polygonOptions: {
            stroke: false,
            fill: false,
            opacity: 0,
            fillOpacity: 0,
          },
        });

        // Slice to top 15,000 point markers for Leaflet canvas performance
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

            markerClusterGroup.addLayer(marker);
          }
        });
        map.addLayer(markerClusterGroup);
      } else {
        // Fallback to direct circle markers if markercluster is unavailable
        filteredPatientData.slice(0, 5000).forEach((row) => {
          if (row.Lat && row.Long) {
            const disease = row.Disease || 'Unknown';
            const color = diseaseColorMap[disease] || '#2563eb';
            const popupHtml = createPatientPopupContent(row);

            L.circleMarker([row.Lat, row.Long], {
              radius: 6,
              fillColor: color,
              color: '#ffffff',
              weight: 1,
              fillOpacity: 0.9,
            })
              .bindPopup(popupHtml)
              .addTo(map);
          }
        });
      }
    } else if (mapMode === 'Ward-wise Exact Count View') {
      if (geoData && Array.isArray(geoData.features)) {
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

              L.marker([cLat, cLon], { icon: badgeIcon })
                .bindTooltip(
                  `<div style="font-family: Inter, sans-serif;"><b>Prabhag / Ward ${cleanW}</b>: ${count} Cases</div>`
                )
                .addTo(map);
            }
          }
        });
      }
    } else if (mapMode === 'All Cases Points View') {
      // Slice to top 15,000 point markers for Leaflet canvas performance
      filteredPatientData.slice(0, 15000).forEach((row) => {
        if (row.Lat && row.Long) {
          const disease = row.Disease || 'Unknown';
          const color = diseaseColorMap[disease] || '#2563eb';
          const popupHtml = createPatientPopupContent(row);

          L.circleMarker([row.Lat, row.Long], {
            radius: 6,
            fillColor: color,
            color: '#ffffff',
            weight: 1,
            fillOpacity: 0.9,
          })
            .bindPopup(popupHtml)
            .addTo(map);
        }
      });
    }

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [geoData, filteredPatientData, mapMode, diseaseColorMap, playbackEnabled]);

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
      <div className="relative w-full h-[640px] rounded-xl overflow-hidden border border-slate-200">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Legends */}
        <div className="absolute bottom-4 left-4 z-[9999] flex flex-row items-end gap-3 pointer-events-none">
          {/* Disease Types Box */}
          <div className="bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl p-3 shadow-xl pointer-events-auto w-52 max-h-[360px] flex flex-col justify-end">
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
