import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import './DetailsStep.css'; // Crearemos este archivo a continuación

interface DetailsStepProps {
  customerName: string;
  customerEmail: string;
  onCustomerNameChange: (name: string) => void;
  onCustomerEmailChange: (email: string) => void;
  formError: string | null;
  onPrevStep: () => void;
  onSubmit: () => void; // Para el envío final
  isSubmitting: boolean;
  currentStep: number; // Podría usarse para mostrar el número de paso si se desea
}

const DetailsStep: React.FC<DetailsStepProps> = ({
  customerName,
  customerEmail,
  onCustomerNameChange,
  onCustomerEmailChange,
  formError,
  onPrevStep,
  onSubmit,
  isSubmitting,
  currentStep,
}) => {

  const validateEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  return (
    <div className="details-step-container">
      {/* No incluimos un título aquí, ya que BookingForm lo maneja globalmente */}
      {/* Opcionalmente, si se quisiera un subtítulo específico: <h4>{currentStep}. Tus Datos</h4> */}
      
      <div className="booking-form-group">
        <label htmlFor="customerNameInput">Nombre:</label>
        <input
          type="text"
          id="customerNameInput"
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="Nombre completo"
          required
          className="booking-form-input"
        />
      </div>

      <div className="booking-form-group">
        <label htmlFor="customerEmailInput">Email:</label>
        <input
          type="email"
          id="customerEmailInput"
          value={customerEmail}
          onChange={(e) => onCustomerEmailChange(e.target.value)}
          placeholder="tu@email.com"
          required
          className="booking-form-input"
        />
      </div>

      {formError && <p className="booking-form-error internal-error">{formError}</p>}

      <div className="step-actions space-between">
        <button type="button" onClick={onPrevStep} className="prev-button">
          <FiArrowLeft /> Atrás
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="submit-booking-button next-button" // Reutiliza clase 'next-button' para consistencia o usa 'submit-button' si se define diferente
          disabled={isSubmitting || !customerName || !customerEmail || !validateEmail(customerEmail)}
        >
          {isSubmitting ? 'Confirmando...' : 'Confirmar Reserva'}
        </button>
      </div>
    </div>
  );
};

export default DetailsStep; 