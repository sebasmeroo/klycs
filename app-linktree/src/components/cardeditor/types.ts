// Interfaces comunes para el editor de tarjetas

export type TemplateType = 'basic' | 'link' | 'shop' | 'standard' | 'headerStore' | 'miniShop';

// Interfaz para item del carrusel de portada (NUEVO)
export interface CoverMediaItem {
  id: string; 
  url: string;
  type: 'image' | 'video' | 'gif'; 
  altText?: string;
}

export interface CardLink {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageURL?: string;
  type: 'digital' | 'service';
  active?: boolean;
  autoUrl?: string;
  url?: string;
}

// --- AÑADIR INTERFAZ PROFESSIONAL --- 
export interface Professional {
  id: string;
  name: string;
  imageUrl?: string; // Imagen opcional
}
// --- FIN INTERFAZ PROFESSIONAL --- 

export interface CardTheme {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  linkColor: string;
}

export interface Card {
  id: string;
  userId: string;
  title: string;
  description?: string;
  imageURL?: string;
  coverImageUrl?: string;
  avatarUrl?: string;
  displayName?: string;
  bio?: string;
  active: boolean;
  views?: number;
  createdAt?: number;
  lastUpdate?: number;
  template?: TemplateType;
  backgroundType?: 'image' | 'color' | 'gradient' | 'pattern';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageURL?: string;
  theme?: CardTheme;
  storeName?: string;
  sectionOrder?: CardSectionType[];
  bookingEnabled?: boolean;
  linkCount?: number;
  productCount?: number;
  isPremiumUser?: boolean;
  coverMediaItems?: CoverMediaItem[];
}

export interface CardBackground {
  type: 'image' | 'color' | 'gradient' | 'pattern';
  color?: string;
  gradient?: string;
  imageURL?: string;
  pattern?: string;
}

// --- Nuevas Interfaces para Gestión de Reservas ---

// Interfaz para un servicio ofrecido
export interface BookingService {
  id: string;          // Identificador único para el servicio
  name: string;        // Nombre del servicio (ej: "Corte de pelo", "Consulta inicial")
  duration: number;    // Duración en minutos
  price?: number;       // Precio (opcional)
  description?: string; // Descripción (opcional)
  requiresPayment?: boolean; // Si requiere pago online (podría derivarse del precio)
}

// Interfaz para definir la disponibilidad semanal básica
export interface BookingAvailabilitySlot {
  startTime: string; // Hora de inicio (ej: "09:00")
  endTime: string;   // Hora de fin (ej: "13:00")
}

export interface BookingAvailability {
  monday?: BookingAvailabilitySlot[];
  tuesday?: BookingAvailabilitySlot[];
  wednesday?: BookingAvailabilitySlot[];
  thursday?: BookingAvailabilitySlot[];
  friday?: BookingAvailabilitySlot[];
  saturday?: BookingAvailabilitySlot[];
  sunday?: BookingAvailabilitySlot[];
}

// Interfaz principal para la configuración de reservas de una tarjeta
export interface BookingSettings {
  enabled: boolean;            // Si las reservas están activas para esta tarjeta
  allowProfessionalSelection?: boolean;
  serviceTitle?: string;       // Título general que vimos (podemos mantenerlo o quitarlo)
  services: BookingService[]; // Lista de servicios ofrecidos
  availability: BookingAvailability; // Horario semanal disponible
  acceptOnlinePayments: boolean; // Si se aceptan pagos (requerirá integración Stripe después)
  // Campos para futuras mejoras:
  // bufferTime?: number; // Tiempo extra entre citas (en minutos)
  // minNoticeTime?: number; // Tiempo mínimo de antelación para reservar (en horas/días)
  // confirmationMessage?: string; // Mensaje personalizado post-reserva
}

// --- Fin Interfaces de Reservas --- 

// Tipos para las secciones de la tarjeta y su orden
export const CARD_SECTION_TYPES = [
  'userProfileInfo', // NUEVO: Para el bloque de avatar/nombre/bio
  'header',      // Para el título de la tarjeta
  'image',       // Imagen principal de la tarjeta
  'coverSlider', // NUEVO: Para el carrusel de portada premium
  'description', // Descripción de la tarjeta
  'links',       // Sección de enlaces
  'products',    // Sección de productos
  'booking'      // Sección de reservas (BookingForm)
] as const;

export type CardSectionType = typeof CARD_SECTION_TYPES[number];

// Tipo para el estado de compresión de imágenes
export type CompressionStatus = 'idle' | 'compressing' | 'success' | 'error'; 