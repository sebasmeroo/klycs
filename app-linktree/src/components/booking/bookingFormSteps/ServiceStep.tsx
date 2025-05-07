import React, { useState } from 'react';
import { FiArrowLeft, FiChevronDown } from 'react-icons/fi';
import { BookingSettings, BookingService } from '../../cardeditor/types';
import './ServiceStep.css';

interface ServiceStepProps {
  settings: BookingSettings | null;
  selectedServiceId: string;
  onServiceChange: (serviceId: string) => void;
  formError: string | null;
  onNextStep: () => void;
  onPrevStep: () => void;
  currentStep: number;
  totalSteps: number;
  inlineMode: boolean;
  professionalStepAvailable: boolean;
}

const ServiceStep: React.FC<ServiceStepProps> = ({
  settings,
  selectedServiceId,
  onServiceChange,
  formError,
  onNextStep,
  onPrevStep,
  currentStep,
  totalSteps,
  inlineMode,
  professionalStepAvailable
}) => {
  
  const [isListExpanded, setIsListExpanded] = useState(false);

  const services = settings?.services || [];
  const selectedService = services.find(s => s.id === selectedServiceId);

  const getTriggerContent = () => {
    if (!settings) {
      return <span className="placeholder-text">Cargando servicios...</span>; 
    }
    if (services.length === 0) {
      return <span className="placeholder-text">No hay servicios disponibles</span>;
    }
    if (selectedService) {
      return (
        <div className="trigger-content-wrapper">
          <span className="trigger-service-name">{selectedService.name}</span>
          <span className="trigger-service-details">
            {selectedService.duration} min{selectedService.price ? ` - ${selectedService.price}€` : ''}
          </span>
        </div>
      );
    }
    return <span className="placeholder-text">Selecciona un servicio</span>;
  };

  const isDisabled = !settings || services.length === 0;

  return (
    <div className="service-step-container">
      <h4 className="step-internal-title">Selecciona Servicio</h4>

      <div className={`booking-form-group ${isListExpanded ? 'expanded' : ''}`}>
        <div 
          className={`service-picker-trigger ${selectedServiceId ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
          onClick={() => !isDisabled && setIsListExpanded(!isListExpanded)}
          role="button"
          tabIndex={!isDisabled ? 0 : -1}
          aria-expanded={isListExpanded}
          aria-controls="service-list-dropdown"
          aria-disabled={isDisabled}
        >
          {getTriggerContent()}
          <FiChevronDown 
            className={`picker-arrow ${isListExpanded ? 'expanded' : ''}`}
          />
        </div>

        {isListExpanded && (
          <div className="service-list" id="service-list-dropdown">
            {services.length > 0 ? services.map(service => (
              <button
                key={service.id}
                type="button"
                className={`service-list-item ${selectedServiceId === service.id ? 'selected' : ''}`}
                onClick={() => {
                  onServiceChange(service.id);
                  setIsListExpanded(false);
                }}
              >
                <span className="list-service-name">{service.name}</span>
                <span className="list-service-details">
                  {service.duration} min{service.price ? ` - ${service.price}€` : ''}
                </span>
              </button>
            )) : (
              <div className="no-services-message">No hay servicios disponibles</div>
            )}
          </div>
        )}
      </div>

      {formError && <p className="booking-form-error">{formError}</p>}
      
      <div className={`step-actions ${currentStep > 1 || inlineMode ? 'space-between' : 'justify-end'}`}>
        {(currentStep > 1 || inlineMode) && (
          <button type="button" onClick={onPrevStep} className="prev-button">
            <FiArrowLeft /> Atrás
          </button>
        )}
        <button
          type="button"
          onClick={onNextStep}
          className="next-button"
          disabled={!selectedServiceId || isDisabled}
        >
          {(inlineMode && currentStep === totalSteps) ? 'Continuar' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
};

export default ServiceStep;