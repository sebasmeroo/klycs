import React from 'react';
import '../../css/globalCompression.css';
import { CompressionStatus } from '../../utils/imageCompression';

interface CompressionInfoProps {
  status: CompressionStatus;
  originalSize?: number;
  compressedSize?: number;
  originalFormat?: string;
  compressionRatio?: number;
  message?: string;
  showDetails?: boolean;
}

/**
 * Componente para mostrar información sobre la compresión de imágenes
 */
const CompressionInfo: React.FC<CompressionInfoProps> = ({
  status,
  originalSize,
  compressedSize,
  originalFormat,
  compressionRatio,
  message,
  showDetails = true
}) => {
  if (status === 'idle') return null;

  let statusClass = '';
  let icon = '';
  let displayMessage = message || '';

  switch (status) {
    case 'compressing':
      statusClass = 'compression-info-loading';
      icon = '⏳';
      displayMessage = displayMessage || 'Comprimiendo imagen...';
      break;
    case 'success':
      statusClass = 'compression-info-success';
      icon = '✅';
      if (!displayMessage && showDetails && originalSize && compressedSize && originalFormat) {
        displayMessage = `Original: ${(originalSize / 1024).toFixed(2)} KB (${originalFormat}) → 
                        Comprimido: ${(compressedSize / 1024).toFixed(2)} KB (WEBP) - 
                        Reducción: ${compressionRatio?.toFixed(1) || 0}%`;
      }
      break;
    case 'error':
      statusClass = 'compression-info-error';
      icon = '⚠️';
      displayMessage = displayMessage || 'No se pudo comprimir la imagen. Usando original.';
      break;
  }

  return (
    <div className={`compression-info ${statusClass}`}>
      <span className="compression-icon">{icon}</span>
      <span className="compression-message">{displayMessage}</span>
      {status === 'success' && compressionRatio && compressionRatio > 0 && (
        <span className="compression-counter">-{compressionRatio.toFixed(0)}%</span>
      )}
    </div>
  );
};

export default CompressionInfo; 