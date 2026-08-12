import { UserSession } from './types';

export interface CredentialEntry {
  username: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ZONE_OFFICER';
  assignedZone: string | null;
  displayName: string;
}

export const CREDENTIALS_LIST: CredentialEntry[] = [
  {
    username: 'admin',
    password: 'nagpurhealth',
    role: 'SUPER_ADMIN',
    assignedZone: null,
    displayName: 'Super Admin (NMC HQ)',
  },
  {
    username: 'zone1',
    password: 'laxmi123',
    role: 'ZONE_OFFICER',
    assignedZone: '1 Laxmi Nagar',
    displayName: 'Zone 1: Laxmi Nagar Officer',
  },
  {
    username: 'zone2',
    password: 'dharampeth123',
    role: 'ZONE_OFFICER',
    assignedZone: '2 Dharampeth',
    displayName: 'Zone 2: Dharampeth Officer',
  },
  {
    username: 'zone3',
    password: 'hanuman123',
    role: 'ZONE_OFFICER',
    assignedZone: '3 Hanuman Nagar',
    displayName: 'Zone 3: Hanuman Nagar Officer',
  },
  {
    username: 'zone4',
    password: 'dhantoli123',
    role: 'ZONE_OFFICER',
    assignedZone: '4 Dhantoli',
    displayName: 'Zone 4: Dhantoli Officer',
  },
  {
    username: 'zone5',
    password: 'nehru123',
    role: 'ZONE_OFFICER',
    assignedZone: '5 Nehru Nagar',
    displayName: 'Zone 5: Nehru Nagar Officer',
  },
  {
    username: 'zone6',
    password: 'gandhibag123',
    role: 'ZONE_OFFICER',
    assignedZone: '6 Gandhibag',
    displayName: 'Zone 6: Gandhibag Officer',
  },
  {
    username: 'zone7',
    password: 'satranjipura123',
    role: 'ZONE_OFFICER',
    assignedZone: '7 Satranjipura',
    displayName: 'Zone 7: Satranjipura Officer',
  },
  {
    username: 'zone8',
    password: 'lakadganj123',
    role: 'ZONE_OFFICER',
    assignedZone: '8 Lakadganj',
    displayName: 'Zone 8: Lakadganj Officer',
  },
  {
    username: 'zone9',
    password: 'ashinagar123',
    role: 'ZONE_OFFICER',
    assignedZone: '9 AashiNagar',
    displayName: 'Zone 9: Aashi Nagar Officer',
  },
  {
    username: 'zone10',
    password: 'mangalwari123',
    role: 'ZONE_OFFICER',
    assignedZone: '10 Mangalwari',
    displayName: 'Zone 10: Mangalwari Officer',
  },
];

const AUTH_STORAGE_KEY = 'nmc_user_session';

export function authenticateUser(usernameInput: string, passwordInput: string): UserSession | null {
  const uClean = usernameInput.trim().toLowerCase();
  const pClean = passwordInput.trim();

  // 1. Direct username/password match
  const match = CREDENTIALS_LIST.find(
    (c) => c.username.toLowerCase() === uClean && c.password === pClean
  );

  if (match) {
    return {
      username: match.username,
      role: match.role,
      assignedZone: match.assignedZone,
      displayName: match.displayName,
    };
  }

  // 2. Fallback check for legacy single password 'nagpurhealth' -> default to Super Admin
  if (pClean === 'nagpurhealth' && (uClean === '' || uClean === 'admin')) {
    return {
      username: 'admin',
      role: 'SUPER_ADMIN',
      assignedZone: null,
      displayName: 'Super Admin (NMC HQ)',
    };
  }

  return null;
}

export function getUserSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserSession;
    }
    // Backward compatibility: check legacy nagpur_auth flag
    if (sessionStorage.getItem('nagpur_auth') === 'true') {
      return {
        username: 'admin',
        role: 'SUPER_ADMIN',
        assignedZone: null,
        displayName: 'Super Admin (NMC HQ)',
      };
    }
  } catch (err) {
    console.warn('Failed to parse user session:', err);
  }
  return null;
}

export function setUserSession(session: UserSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    sessionStorage.setItem('nagpur_auth', 'true');
  } catch (err) {
    console.warn('Failed to save user session:', err);
  }
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem('nagpur_auth');
  } catch (err) {
    console.warn('Failed to clear user session:', err);
  }
}
