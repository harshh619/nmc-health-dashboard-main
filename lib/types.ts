export interface PatientRecord {
  Patient_ID?: string | number;
  Patient_Name?: string;
  Disease?: string;
  Ward_Name?: string;
  Zone?: string;
  Lat?: number;
  Long?: number;
  Status?: string;
  Age?: number;
  Gender?: string;
  Date?: string; // ISO String or YYYY-MM-DD
  Address?: string;
  Verification_Status?: 'Pending' | 'Verified';
  Location_Photo_Url?: string;
  Verified_By?: string;
  Verified_At?: string;
  Remarks?: string;
}

export interface WeatherData {
  temp: number;
  humidity: number;
  rainfall: number;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  diseases: string[];
  zones: string[];
  wards: string[];
  statuses: string[];
}

export interface WardMapping {
  Ward_Name: string;
  Zone: string;
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    name?: string;
    Clean_Ward?: string;
    Clean_Zone?: string;
    Ward_Cases?: number;
    Zone_Cases?: number;
    fill_color?: string;
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

export interface GeoJsonData {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface UserSession {
  username: string;
  role: 'SUPER_ADMIN' | 'ZONE_OFFICER';
  assignedZone: string | null;
  displayName: string;
}

