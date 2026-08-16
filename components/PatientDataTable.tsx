'use client';

import React, { useState } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { PatientRecord } from '../lib/types';
import { cleanWardName, getZoneForWard } from '../lib/wardMapping';
import { formatDateDisplay, sortPatientRecordsById, formatStatusDisplay, normalizeStatus } from '../lib/supabase';

interface PatientDataTableProps {
  patientData: PatientRecord[];
  isPrivacyMode?: boolean;
}

const PatientDataTable = React.memo(function PatientDataTable({
  patientData,
  isPrivacyMode = false,
}: PatientDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const maskPatientName = (name: string) => {
    if (!name || name === 'N/A') return 'N/A';
    if (!isPrivacyMode) return name;
    return name
      .split(' ')
      .map((word) => (word.length > 1 ? word[0] + '*'.repeat(word.length - 1) : word))
      .join(' ');
  };

  const handleWhatsAppShare = (row: PatientRecord) => {
    const masked = maskPatientName(row.Patient_Name || '');
    const disease = row.Disease || 'Unknown';
    const ward = cleanWardName(row.Ward_Name);
    const status = formatStatusDisplay(row.Status);
    
    let text = `🚨 *NMC Surveillance Alert*\n\n*Patient:* ${masked}\n*Disease:* ${disease}\n*Ward:* ${ward}\n*Status:* ${status}\n`;
    
    if (row.Lat && row.Long) {
      const mapsUrl = `https://www.google.com/maps?q=${row.Lat},${row.Long}`;
      text += `*Location:* ${mapsUrl}\n`;
    }

    text += `\nPlease take necessary action.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Filter by search term
  const filteredData = patientData.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const displayName = maskPatientName(row.Patient_Name || '');
    return (
      String(row.Patient_ID || '').toLowerCase().includes(term) ||
      displayName.toLowerCase().includes(term) ||
      String(row.Disease || '').toLowerCase().includes(term) ||
      String(row.Ward_Name || '').toLowerCase().includes(term) ||
      String(row.Zone || '').toLowerCase().includes(term) ||
      normalizeStatus(row.Status).toLowerCase().includes(term)
    );
  });

  const sortedData = React.useMemo(() => {
    return sortPatientRecordsById(filteredData);
  }, [filteredData]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  // Clamp current page if filtered data shrinks below current page bounds
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // CSV Export handler
  const handleExportCSV = () => {
    if (patientData.length === 0) return;

    const headers = [
      'Patient_ID',
      'Patient_Name',
      'Disease',
      'Ward_Name',
      'Zone',
      'Lat',
      'Long',
      'Status',
      'Age',
      'Gender',
      'Date',
    ];

    const rows = filteredData.map((r) => [
      `"${r.Patient_ID || ''}"`,
      `"${maskPatientName(r.Patient_Name || '')}"`,
      `"${r.Disease || ''}"`,
      `"${cleanWardName(r.Ward_Name)}"`,
      `"${r.Zone || ''}"`,
      `"${r.Lat || ''}"`,
      `"${r.Long || ''}"`,
      `"${r.Status || ''}"`,
      `"${r.Age || ''}"`,
      `"${r.Gender || ''}"`,
      `"${r.Date || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'NMC_Health_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm transition-colors duration-300">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>📋</span> Patient Details Database
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Showing {filteredData.length} records in active filter
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search patients..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium text-xs rounded-lg shadow-sm transition-all active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 Export CSV</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs text-left border-separate border-spacing-0">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 p-3 min-w-[50px] w-[50px] border-b border-slate-200 dark:border-slate-700">
                ID
              </th>
              <th className="sticky left-[50px] z-20 bg-slate-100 dark:bg-slate-800 p-3 min-w-[130px] w-[130px] border-b border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                Patient Name
              </th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[100px]">Disease</th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[90px]">Ward</th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[120px]">Zone</th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[110px]">Age / Gender</th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[120px]">Status</th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[100px]">Date</th>
              <th className="p-3 border-b border-slate-200 dark:border-slate-700 min-w-[60px]">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-6 text-center text-slate-400 dark:text-slate-500 font-medium"
                >
                  No patient records match the search parameters.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={row.Patient_ID || idx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 p-3 font-semibold text-slate-900 dark:text-slate-100 min-w-[50px] w-[50px] border-b border-slate-100 dark:border-slate-800">
                    {row.Patient_ID || `#${idx + 1}`}
                  </td>
                <td className="sticky left-[50px] z-10 bg-white dark:bg-slate-900 p-3 font-medium text-blue-900 dark:text-blue-300 min-w-[130px] w-[130px] border-b border-r border-slate-100 dark:border-slate-800 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                    {maskPatientName(row.Patient_Name || '')}
                  </td>
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800">
                    {row.Disease || 'N/A'}
                  </td>
                  <td className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      Ward {cleanWardName(row.Ward_Name)}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                    {getZoneForWard(row.Ward_Name, row.Zone)}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    {row.Age ?? 'N/A'} / {row.Gender ?? 'N/A'}
                  </td>
                  <td className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full border text-[11px] ${
                        normalizeStatus(row.Status) === 'Recovered'
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
                          : normalizeStatus(row.Status) === 'Active'
                          ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80'
                          : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80'
                      }`}
                    >
                      {formatStatusDisplay(row.Status)}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px] border-b border-slate-100 dark:border-slate-800">
                    {formatDateDisplay(row.Date)}
                  </td>
                  <td className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleWhatsAppShare(row)}
                      className="p-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-lg transition-colors border border-[#25D366]/30"
                      title="Share to WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          {filteredData.length === 0
            ? 'No records found'
            : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(
                currentPage * pageSize,
                filteredData.length
              )} of ${filteredData.length} records`}
        </div>

        <div className="flex items-center gap-3">
          {/* Rows Per Page Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Select rows per page"
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Direct Page Number Select Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Page</span>
            <select
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              aria-label="Select page number"
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
            <span className="text-slate-600 dark:text-slate-400 font-medium">of {totalPages}</span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Previous Page"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              title="Next Page"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PatientDataTable;
