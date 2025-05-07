import React, { useState } from 'react';
import { FiArrowLeft, FiChevronDown, FiUser } from 'react-icons/fi';
import { Professional } from '../../cardeditor/types';
import './ProfessionalStep.css';

interface ProfessionalStepProps {
  professionals: Professional[];
  selectedProfessionalId: string;
  onProfessionalChange: (professionalId: string) => void;
  loadingProfessionals: boolean;
  errorProfessionals: string | null;
  formError: string | null;
  onNextStep: () => void;
  onPrevStep: () => void;
  currentStep: number;
  totalSteps: number;
  inlineMode: boolean;
}

const ProfessionalStep: React.FC<ProfessionalStepProps> = ({
  professionals,
  selectedProfessionalId,
  onProfessionalChange,
  loadingProfessionals,
  errorProfessionals,
  formError,
  onNextStep,
  onPrevStep,
  currentStep,
  totalSteps,
  inlineMode,
}) => {
  const [isListExpanded, setIsListExpanded] = useState(false);

  const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);

  const getTriggerContent = () => {
    if (loadingProfessionals) {
      return <span>Cargando profesionales...</span>;
    }
    if (errorProfessionals) {
      return <span className="error-text">Error al cargar</span>;
    }
    if (selectedProfessional) {
      return (
        <>
          {selectedProfessional.imageUrl ? (
            <img src={selectedProfessional.imageUrl} alt={selectedProfessional.name} className="trigger-professional-photo" />
          ) : (
            <FiUser className="trigger-professional-placeholder-icon" />
          )}
          <span className="trigger-professional-name">{selectedProfessional.name}</span>
        </>
      );
    }
    return <span>Selecciona un profesional</span>;
  };

  return (
    <div className="professional-step-container">
      <h4 className="step-internal-title">Selecciona Profesional</h4>

      <div className={`booking-form-group ${isListExpanded ? 'expanded' : ''}`}>
        <div 
          className={`professional-picker-trigger ${selectedProfessionalId ? 'selected' : ''} ${loadingProfessionals || errorProfessionals ? 'disabled' : ''}`}
          onClick={() => !(loadingProfessionals || errorProfessionals) && setIsListExpanded(!isListExpanded)}
          role="button"
          tabIndex={!(loadingProfessionals || errorProfessionals) ? 0 : -1}
          aria-expanded={isListExpanded}
          aria-controls="professional-list-dropdown"
          aria-disabled={loadingProfessionals || !!errorProfessionals}
        >
          <div className="trigger-content-wrapper">
            {getTriggerContent()}
          </div>
          <FiChevronDown 
            className={`picker-arrow ${isListExpanded ? 'expanded' : ''}`}
          />
        </div>

        {isListExpanded && (
          <div className="professional-list" id="professional-list-dropdown">
            {professionals.length > 0 ? professionals.map(prof => (
              <button
                key={prof.id}
                type="button"
                className={`professional-list-item ${selectedProfessionalId === prof.id ? 'selected' : ''}`}
                onClick={() => {
                  onProfessionalChange(prof.id);
                  setIsListExpanded(false);
                }}
              >
                {prof.imageUrl ? (
                  <img src={prof.imageUrl} alt={prof.name} className="list-professional-photo" />
                ) : (
                  <FiUser className="list-professional-placeholder-icon" />
                )}
                <span className="list-professional-name">{prof.name}</span>
              </button>
            )) : (
              <div className="no-professionals-message">No hay profesionales disponibles</div>
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
          disabled={!selectedProfessionalId || loadingProfessionals || !!errorProfessionals}
        >
          {(inlineMode && currentStep === totalSteps) ? 'Verificar y Continuar' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
};

export default ProfessionalStep;