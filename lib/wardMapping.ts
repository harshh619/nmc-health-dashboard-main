export interface RawWardMapping {
  name: string;
  description: string;
}

export const RAW_WARD_MAPPINGS: RawWardMapping[] = [
  { name: 'Prabhag No. 04', description: 'Zone No. 8 Lakadganj' },
  { name: 'Prabhag No. 23', description: 'Zone No. 8 Lakadganj' },
  { name: 'Prabhag No. 24', description: 'Zone No. 8 Lakadganj' },
  { name: 'Prabhag No. 25', description: 'Zone No. 8 Lakadganj' },
  { name: 'Prabhag No. 01', description: 'Zone No.10 Mangalwari' },
  { name: 'Prabhag No. 09', description: 'Zone No.10 Mangalwari' },
  { name: 'Prabhag No. 10', description: 'Zone No.10 Mangalwari' },
  { name: 'Prabhag No. 11', description: 'Zone No.10 Mangalwari' },
  { name: 'Prabhag No. 12', description: 'Zone No. 2 Dharmpeth' },
  { name: 'Prabhag No. 13', description: 'Zone No. 2 Dharmpeth' },
  { name: 'Prabhag No. 14', description: 'Zone No. 2 Dharmpeth' },
  { name: 'Prabhag No. 15', description: 'Zone No. 2 Dharmpeth' },
  { name: 'Prabhag No. 17', description: 'Zone No. 4 Dhantoli' },
  { name: 'Prabhag No. 33', description: 'Zone No. 4 Dhantoli' },
  { name: 'Prabhag No. 35', description: 'Zone No. 4 Dhantoli' },
  { name: 'Prabhag No. 16', description: 'Zone No. 1 Laxmi Nagar' },
  { name: 'Prabhag No. 36', description: 'Zone No. 1 Laxmi Nagar' },
  { name: 'Prabhag No. 37', description: 'Zone No. 1 Laxmi Nagar' },
  { name: 'Prabhag No. 38', description: 'Zone No. 1 Laxmi Nagar' },
  { name: 'Prabhag No. 29', description: 'Zone No. 3 Hanuman Nagar' },
  { name: 'Prabhag No. 31', description: 'Zone No. 3 Hanuman Nagar' },
  { name: 'Prabhag No. 32', description: 'Zone No. 3 Hanuman Nagar' },
  { name: 'Prabhag No. 34', description: 'Zone No. 3 Hanuman Nagar' },
  { name: 'Prabhag No. 28', description: 'Zone No. 5 Nehru Nagar' },
  { name: 'Prabhag No. 30', description: 'Zone No. 5 Nehru Nagar' },
  { name: 'Prabhag No. 27', description: 'Zone No. 5 Nehru Nagar' },
  { name: 'Prabhag No. 18', description: 'Zone No. 6 Gandhibag' },
  { name: 'Prabhag No. 02', description: 'Zone No. 9 AashiNagar' },
  { name: 'Prabhag No. 22', description: 'Zone No. 6 Gandhibag' },
  { name: 'Prabhag No. 19', description: 'Zone No. 6 Gandhibag' },
  { name: 'Prabhag No. 08', description: 'Zone No. 6 Gandhibag' },
  { name: 'Prabhag No. 07', description: 'Zone No. 9 AashiNagar' },
  { name: 'Prabhag No. 26', description: 'Zone No. 5 Nehru Nagar' },
  { name: 'Prabhag No. 20', description: 'Zone No. 7 Satranjipura' },
  { name: 'Prabhag No. 05', description: 'Zone No. 7 Satranjipura' },
  { name: 'Prabhag No. 21', description: 'Zone No. 7 Satranjipura' },
  { name: 'Prabhag No. 06', description: 'Zone No. 9 AashiNagar' },
  { name: 'Prabhag No. 03', description: 'Zone No. 9 AashiNagar' },
];

export function cleanWardName(rawWard?: string): string {
  if (!rawWard) return 'Unknown';
  let v = String(rawWard);
  if (v.endsWith('.0')) v = v.slice(0, -2);
  const prefixes = [
    'Prabhag No. ',
    'Prabhag No.',
    'Prabhag No ',
    'Ward No. ',
    'Ward No.',
    'Ward No ',
  ];
  prefixes.forEach((p) => {
    v = v.replace(p, '');
  });
  v = v.trim().replace(/^0+/, '');
  return v === '' ? '0' : v;
}

export function cleanZoneName(rawZone?: string): string {
  if (!rawZone) return 'Unknown';
  return String(rawZone)
    .replace(/^(Zone No\.?\s*|Zone No\s*)/i, '')
    .trim();
}

export const WARD_MAPPING_LIST = RAW_WARD_MAPPINGS.map((item) => ({
  Ward_Name: item.name,
  Zone: cleanZoneName(item.description),
  Clean_Ward: cleanWardName(item.name),
}));

export const WARD_TO_ZONE_MAP = WARD_MAPPING_LIST.reduce<Record<string, string>>(
  (acc, item) => {
    acc[item.Clean_Ward] = item.Zone;
    acc[item.Ward_Name] = item.Zone;
    return acc;
  },
  {}
);
