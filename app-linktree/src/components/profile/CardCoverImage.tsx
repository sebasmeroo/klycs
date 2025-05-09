import React from 'react';
import './CardCoverImage.css'; // Importar el CSS específico

interface CardCoverImageProps {
  imageUrl?: string | null; // URL de la imagen principal
  altText?: string;         // Texto alternativo para la imagen
  cardId: string;           // ID de la tarjeta (para key en manejo de errores)
  onErrorCallback: (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => void; // Función a llamar si la imagen falla
  fallbackImageUrl: string; // URL de la imagen de respaldo
  failedImages: Record<string, boolean>; // Objeto para rastrear imágenes que ya fallaron
  className?: string;       // Clase CSS adicional para el contenedor
}

const CardCoverImage: React.FC<CardCoverImageProps> = ({
  imageUrl,
  altText = 'Imagen de portada', // Texto alternativo por defecto
  cardId,
  onErrorCallback,
  fallbackImageUrl,
  failedImages,
  className = '' // Clase por defecto vacía
}) => {

  // No renderizar nada si no hay imageUrl
  if (!imageUrl) {
    return null;
  }

  const hasFailed = failedImages[cardId] || false;
  const imageSource = hasFailed ? fallbackImageUrl : imageUrl;

  // Las clases CSS usadas aquí ahora vienen de CardCoverImage.css
  return (
    <div className={`rendered-main-image-container mb-4 ${className}`}> 
      <img
        key={cardId + (hasFailed ? '-failed' : '-ok')} // Key que cambia si falla
        src={imageSource}
        alt={altText}
        className="rendered-main-image-linktree" 
        onError={(e) => onErrorCallback(e, cardId, fallbackImageUrl)}
      />
    </div>
  );
};

export default CardCoverImage; 