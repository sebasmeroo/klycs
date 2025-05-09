import React, { RefObject, MouseEvent } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import './CardPreviewPane.css'; // <-- IMPORTAR CSS

interface CardPreviewPaneProps {
  publicCardUrl: string;
  iframeKey: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isDraggingPreview: boolean;
  onReloadPreview: () => void;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: MouseEvent<HTMLDivElement>) => void;
}

const CardPreviewPane: React.FC<CardPreviewPaneProps> = ({
  publicCardUrl,
  iframeKey,
  iframeRef,
  isDraggingPreview,
  onReloadPreview,
  onMouseDown,
  onMouseLeave,
  onMouseUp,
  onMouseMove,
}) => {
  return (
    <div 
      className="card-preview-container" 
      style={{ cursor: isDraggingPreview ? 'grabbing' : 'grab' }} // Aplicar cursor dinámico
      onMouseDown={onMouseDown} 
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      <button 
        type="button" 
        onClick={onReloadPreview} 
        className="reload-preview-button" 
        title="Recargar previsualización"
        style={{ zIndex: 11 }} // Aumentar z-index por si acaso
      >
        <FiRefreshCw />
      </button>
      {publicCardUrl ? (
        <iframe 
          ref={iframeRef} // Asignar ref
          key={iframeKey} 
          src={publicCardUrl}
          className="card-preview-iframe" 
          title="Previsualización de Tarjeta Pública"
          style={{ pointerEvents: isDraggingPreview ? 'none' : 'auto' }} // Deshabilitar eventos de ratón en iframe mientras se arrastra el contenedor
        ></iframe>
      ) : (
        <div className="card-preview-placeholder">
          <p>No se puede generar la URL de previsualización.</p>
        </div>
      )}
    </div>
  );
};

export default CardPreviewPane; 