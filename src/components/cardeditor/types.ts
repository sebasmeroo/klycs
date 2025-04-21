// Interfaces comunes para el editor de tarjetas

export interface CardLink {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  imageURL: string;
  url?: string;
  autoUrl?: string;
  active: boolean;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  imageURL?: string;
  links: CardLink[];
  products: Product[];
  autoUrl?: string;
  active: boolean;
  views: number;
  createdAt: number;
  backgroundType?: 'image' | 'color' | 'gradient' | 'pattern';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string;
  userId: string;
}

export interface CardBackground {
  type: 'image' | 'color' | 'gradient' | 'pattern';
  color?: string;
  gradient?: string;
  imageURL?: string;
  pattern?: string;
}

export interface CardTheme {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  linkColor: string;
} 