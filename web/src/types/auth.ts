export type Role = 'admin' | 'lab' | 'service' | 'vendor';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  labId?: string;
};

export type AuthState = {
  token: string | null;
  user: User | null;
};
