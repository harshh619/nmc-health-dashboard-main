'use client';

import React, { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { WeatherData } from '../lib/types';

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData>({
    temp: 32.5,
    humidity: 57.0,
    rainfall: 0.0,
  });

  const fetchWeather = async () => {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=21.1458&longitude=79.0882&current=temperature_2m,relative_humidity_2m,precipitation'
      );
      if (res.ok) {
        const data = await res.json();
        const curr = data.current || {};
        setWeather({
          temp: curr.temperature_2m ?? 32.5,
          humidity: curr.relative_humidity_2m ?? 57.0,
          rainfall: curr.precipitation ?? 0.0,
        });
      }
    } catch (err) {
      console.warn('Weather fetch error:', err);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 3600000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Nagpur Temperature */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#93c5fd] hover:bg-white hover:-translate-y-1 group">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] group-hover:text-[#1e3a8a] transition-colors mb-1">
            <span className="flex items-center gap-1.5">
              <span>🌡️</span> Nagpur Temperature
            </span>
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-[#0f172a] mb-1">
            {weather.temp} °C
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            <span>↑ Live Weather</span>
          </div>
        </div>

        {/* Relative Humidity */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#93c5fd] hover:bg-white hover:-translate-y-1 group">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] group-hover:text-[#1e3a8a] transition-colors mb-1">
            <span className="flex items-center gap-1.5">
              <span>💧</span> Relative Humidity
            </span>
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-[#0f172a] mb-1">
            {weather.humidity} %
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            <span>↑ Vector Risk Factor</span>
          </div>
        </div>

        {/* Precipitation / Rainfall */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg shadow-sm transition-all duration-300 hover:shadow-lg hover:border-[#93c5fd] hover:bg-white hover:-translate-y-1 group">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] group-hover:text-[#1e3a8a] transition-colors mb-1">
            <span className="flex items-center gap-1.5">
              <span>🌧️</span> Precipitation / Rainfall
            </span>
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-[#0f172a] mb-1">
            {weather.rainfall} mm
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            <span>↑ Waterlogging Index</span>
          </div>
        </div>
      </div>
    </div>
  );
}
