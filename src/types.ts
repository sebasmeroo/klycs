export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Link {
  id: string;
  title: string;
  url: string;
  active: boolean;
  position: number;
}

export interface UserProfile {
  user: User;
  links: Link[];
} 