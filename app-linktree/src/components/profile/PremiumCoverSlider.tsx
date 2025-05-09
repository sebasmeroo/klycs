import React from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';

// Import Swiper styles - RE-AÑADIDOS PORQUE PARECEN NECESARIOS
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import 'swiper/css/autoplay';

// import required modules
import { Navigation, Pagination, Autoplay, EffectFade } from 'swiper/modules';

// Importaremos este CSS más adelante
import './PremiumCoverSlider.css';

// Interfaz para cada item del carrusel (exportada para que UserProfile la use)
export interface CoverMediaItem {
  id: string; 
  url: string;
  type: 'image' | 'video' | 'gif'; 
  altText?: string;
}

interface PremiumCoverSliderProps {
  mediaItems: CoverMediaItem[];
  className?: string; 
  loop?: boolean;
  autoplayDelay?: number; 
  effect?: 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip';
  // Props para manejo de errores (opcional, se puede manejar dentro o fuera)
  fallbackImageUrl?: string;
  onErrorCallback?: (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>, mediaId: string, fallbackUrl: string) => void;
  failedMedia?: Record<string, boolean>; 
}

// Función auxiliar para determinar el tipo de medio desde la URL (puede ser diferente al 'type' provisto si es un fallback)
const getMediaTypeFromUrl = (url: string): 'image' | 'video' | 'unknown' => {
  if (!url) return 'unknown';
  const extension = url.split('.').pop()?.toLowerCase();
  if (!extension) return 'unknown';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return 'image';
  }
  if (['mp4', 'webm', 'ogg'].includes(extension)) {
    return 'video';
  }
  return 'unknown';
};

const PremiumCoverSlider: React.FC<PremiumCoverSliderProps> = ({
  mediaItems,
  className = '',
  loop = true,
  autoplayDelay,
  effect = 'fade',
  fallbackImageUrl = 'https://firebasestorage.googleapis.com/v0/b/klycs-58190.appspot.com/o/defaults%2Fno-image.png?alt=media', // Fallback genérico
  onErrorCallback,
  failedMedia = {},
}) => {

  if (!mediaItems || mediaItems.length === 0) {
    return (
        <div className={`premium-cover-slider-container ${className} fallback-active`}>
            <img src={fallbackImageUrl} alt="Contenido no disponible" className="premium-slide-media fallback-image" />
        </div>
    ); 
  }

  const swiperModules = [Navigation, Pagination, EffectFade];
  if (autoplayDelay) {
    swiperModules.push(Autoplay);
  }

  return (
    // Añadiremos la clase 'premium-cover-slider-container' en el archivo CSS
    <div className={`premium-cover-slider-container ${className}`}> 
      <Swiper
        modules={swiperModules}
        spaceBetween={0}
        slidesPerView={1}
        navigation
        pagination={{ clickable: true }}
        loop={loop}
        effect={effect}
        fadeEffect={effect === 'fade' ? { crossFade: true } : undefined}
        autoplay={autoplayDelay ? { delay: autoplayDelay, disableOnInteraction: false } : undefined}
        className="premium-swiper-instance" // Clase para estilos específicos de Swiper
      >
        {mediaItems.map((item) => {
          const itemId = item.id;
          const hasFailed = failedMedia[itemId] || false;
          const currentMediaUrl = hasFailed ? fallbackImageUrl : item.url;
          // El tipo original del item es item.type. Si falla, el tipo es el del fallbackImageUrl.
          const itemTypeToRender = hasFailed ? getMediaTypeFromUrl(fallbackImageUrl) : (item.type === 'gif' ? 'image' : item.type);
          const itemAltText = item.altText || 'Contenido de portada';

          return (
            <SwiperSlide key={itemId} className={`premium-swiper-slide premium-slide-type-${itemTypeToRender}`}>
              {itemTypeToRender === 'video' ? (
                <video
                  src={currentMediaUrl}
                  className="premium-slide-media premium-slide-video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={(e) => onErrorCallback && onErrorCallback(e, itemId, fallbackImageUrl)}
                />
              ) : ( // 'image' o 'gif' (tratado como image)
                <img
                  src={currentMediaUrl}
                  alt={itemAltText}
                  className="premium-slide-media premium-slide-image" 
                  onError={(e) => onErrorCallback && onErrorCallback(e, itemId, fallbackImageUrl)}
                />
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};

export default PremiumCoverSlider; 