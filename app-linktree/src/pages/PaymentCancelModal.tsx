import React from 'react';
import './PaymentCancelModal.css'; // Asegúrate de crear este archivo CSS

interface PaymentCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PaymentCancelModal: React.FC<PaymentCancelModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-cancel-overlay" onClick={onClose}>
      <div className="modal-cancel-content" onClick={(e) => e.stopPropagation()}>
        {/* Icono/Indicador de Cancelación (Placeholder) */}
        <div className="modal-cancel-icon">
          ✕ {/* Puedes reemplazar esto por un icono SVG o de una librería */}
        </div>

        {/* Mensaje Principal */}
        <p className="modal-cancel-message">
          El proceso de pago fue cancelado.
        </p>

        {/* Mensaje Secundario (Opcional) */}
        <p className="modal-cancel-submessage">
          Puedes intentar la compra nuevamente desde el perfil del vendedor.
        </p>

        {/* Botón de cierre */}
        <button className="modal-cancel-close-button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default PaymentCancelModal; 