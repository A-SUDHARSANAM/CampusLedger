export type Role = 'admin' | 'lab' | 'service' | 'purchase_dept';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  labId?: string;
};

export type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
};
