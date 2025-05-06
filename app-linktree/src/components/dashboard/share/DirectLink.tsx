import React, { useState } from 'react';
import { FiCheckSquare, FiClipboard, FiAlertTriangle } from 'react-icons/fi'; // Importar iconos

interface DirectLinkProps {
  shareUrl: string;
}

const DirectLink: React.FC<DirectLinkProps> = ({ shareUrl }) => {
  const [copiedStatus, setCopiedStatus] = useState<'Copiar' | '¡Copiado!' | 'Error'>('Copiar');

  const handleCopyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopiedStatus('¡Copiado!');
        setTimeout(() => setCopiedStatus('Copiar'), 2500); // Un poco más de tiempo
      })
      .catch(err => {
        console.error('Error al copiar:', err);
        setCopiedStatus('Error');
        setTimeout(() => setCopiedStatus('Copiar'), 2500);
      });
  };

  if (!shareUrl) {
    return null;
  }

  let buttonIcon;
  let buttonClass = 'copy-button'; // Clase base para estilos generales del botón

  switch (copiedStatus) {
    case '¡Copiado!':
      buttonIcon = <FiCheckSquare size={18} style={{ marginRight: '5px' }} />;
      buttonClass += ' copied'; // Clase específica para estado copiado
      break;
    case 'Error':
      buttonIcon = <FiAlertTriangle size={18} style={{ marginRight: '5px' }} />;
      buttonClass += ' error-copy'; // Clase específica para estado de error
      break;
    default:
      buttonIcon = <FiClipboard size={18} style={{ marginRight: '5px' }} />;
      break;
  }

  return (
    <div className="share-section">
      <h3>Enlace Directo de la Tarjeta</h3>
      <div className="url-copy-container">
        <input 
          type="text" 
          value={shareUrl} 
          readOnly 
          aria-label="Enlace de la tarjeta"
          className="share-url-input" // Clase para estilizar el input
        />
        <button 
          onClick={handleCopyToClipboard}
          className={buttonClass} 
          disabled={!shareUrl || copiedStatus !== 'Copiar'}
        >
          {buttonIcon}
          {copiedStatus}
        </button>
      </div>
    </div>
  );
};

export default DirectLink; 