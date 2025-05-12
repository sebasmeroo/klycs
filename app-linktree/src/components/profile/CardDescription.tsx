import React, { useState, useRef, useEffect } from 'react';
import './CardDescription.css';

interface CardDescriptionProps {
  description?: string | null;
  textColor?: string;
  className?: string;
  title?: string; // Usado para el displayName/nombre del negocio
  avatarForSummary?: string | null; // Nueva prop para la URL del avatar
}

const CardDescription: React.FC<CardDescriptionProps> = ({
  description,
  textColor = '#333333',
  className = '',
  title = 'Detalles',
  avatarForSummary,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setIsOpen(detailsRef.current?.open || false);
  };

  if (!description && !title) { // Si no hay ni título (nombre) ni descripción, no renderizar nada
    return null;
  }

  const summaryStyle = {
    // Aquí podríamos poner estilos dinámicos para el summary si fuera necesario
  };

  const detailsContainerStyle = {
    '--card-desc-text-color': textColor,
    // Otros estilos para el contenedor principal del neumorfismo irán en CSS
  } as React.CSSProperties;

  return (
    <div className={`card-description-wrapper ${className}`} style={detailsContainerStyle}>
      <details 
        ref={detailsRef} 
        className={`card-description-details neumorphic-container ${isOpen ? 'is-open' : 'is-closed'}`}
        onToggle={handleToggle}
      >
        <summary className="card-description-summary">
          <div className="summary-content-collapsed">
            {avatarForSummary && (
              <img src={avatarForSummary} alt={title || 'Avatar'} className="summary-avatar" />
            )}
            {!avatarForSummary && (
              <div className="summary-avatar-placeholder"></div>
            )}
            <span className="summary-title-text">{title}</span>
          </div>
          {/* La flecha de despliegue se maneja con CSS en ::after */}
        </summary>
        
        <div 
          ref={contentRef} 
          className={`card-description-content-animated ${isOpen ? 'content-visible' : 'content-hidden'}`}
        >
          {description && description.split('\n').map((paragraph: string, index: number) => (
            <p key={index}>{paragraph}</p>
          ))}
          {!description && isOpen && (
            <p>No hay descripción disponible.</p> // Mostrar si está abierto pero no hay descripción
          )}
        </div>
      </details>
    </div>
  );
};

export default CardDescription; 