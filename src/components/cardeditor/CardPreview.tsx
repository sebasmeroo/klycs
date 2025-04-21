import React from 'react';
import './CardEditor.css';

interface CardPreviewProps {
  title: string;
  description: string;
  imagePreview: string | null;
  backgroundType: 'image' | 'color' | 'gradient';
  backgroundColor: string;
  backgroundGradient: string;
  backgroundImageURL: string | null;
}

const CardPreview: React.FC<CardPreviewProps> = ({
  title,
  description,
  imagePreview,
  backgroundType,
  backgroundColor,
  backgroundGradient,
  backgroundImageURL
}) => {
  // Determinar el estilo de fondo
  const getBackgroundStyle = () => {
    if (backgroundType === 'color') {
      return { backgroundColor };
    } else if (backgroundType === 'gradient') {
      return { background: backgroundGradient };
    } else if (backgroundType === 'image' && backgroundImageURL) {
      return {
        backgroundImage: `url(${backgroundImageURL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };
    }
    return {};
  };

  // Determinar si el fondo es oscuro para el color del texto
  const isDarkBackground = (): boolean => {
    if (backgroundType === 'gradient') return true;
    if (backgroundType === 'image') return true;
    if (backgroundType === 'color') {
      // Heurística simple para determinar si un color es oscuro
      const hex = backgroundColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 186;
    }
    return false;
  };

  const textColor = isDarkBackground() ? '#ffffff' : '#333333';

  return (
    <div className="card-preview-container">
      <div 
        className="card-preview"
        style={{
          ...getBackgroundStyle(),
          color: textColor
        }}
      >
        {imagePreview ? (
          <div className="preview-with-image">
            <div className="preview-image-container">
              <img 
                src={imagePreview} 
                alt={title} 
                className="preview-image"
              />
            </div>
            <div className="preview-content" style={{ color: textColor }}>
              <h3 className="preview-title">{title || 'Título de la tarjeta'}</h3>
              <p className="preview-description">
                {description || 'Descripción de la tarjeta (opcional)'}
              </p>
            </div>
          </div>
        ) : (
          <div className="preview-content" style={{ color: textColor }}>
            <h3 className="preview-title">{title || 'Título de la tarjeta'}</h3>
            <p className="preview-description">
              {description || 'Descripción de la tarjeta (opcional)'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardPreview; 