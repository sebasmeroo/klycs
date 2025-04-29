// Interfaces comunes para el editor de tarjetas

export type TemplateType = 'basic' | 'link' | 'shop' | 'standard' | 'headerStore' | 'miniShop';

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

// --- AÑADIR INTERFAZ PROFESSIONAL --- 
export interface Professional {
  id: string;
  name: string;
  imageUrl?: string; // Imagen opcional
}
// --- FIN INTERFAZ PROFESSIONAL --- 

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
  template?: TemplateType;
  storeName?: string;
  bookingSettings?: BookingSettings;
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