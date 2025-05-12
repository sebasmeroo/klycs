import React from 'react';
import './PaymentSuccessModal.css'; // Asegúrate de crear este archivo CSS

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Placeholder para el logo */}
        <div className="modal-logo-placeholder">
          Klycs
        </div>

        {/* Eslogan */}
        <p className="modal-slogan">
          Crea, vende, reserva, paga.
        </p>

        {/* Mensaje de agradecimiento */}
        <p className="modal-message">
          ¡Gracias por confiar en Klycs!
        </p>

        {/* Botón de cierre */}
        <button className="modal-close-button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccessModal; 