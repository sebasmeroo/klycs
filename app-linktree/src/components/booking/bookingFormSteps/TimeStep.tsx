import React, { useState } from 'react';
import { FiArrowLeft, FiChevronDown, FiClock } from 'react-icons/fi';
import './TimeStep.css';

interface TimeStepProps {
  selectedTime: string;
  onTimeChange: (time: string) => void;
  formError: string | null;
  onNextStep: () => void;
  onPrevStep: () => void;
  currentStep: number;
}

// Horas disponibles para la lista en desktop
const availableTimesDesktop: string[] = [];
for (let i = 9; i <= 18; i++) {
  availableTimesDesktop.push(`${i.toString().padStart(2, '0')}:00`);
  // Si quieres intervalos de 30 minutos, puedes añadir otro push aquí:
  // availableTimesDesktop.push(`${i.toString().padStart(2, '0')}:30`);
}
// Y si el bucle llega hasta 18, quizás quieras 18:30 pero no 19:00, ajusta el bucle o añade condicionalmente.

const TimeStep: React.FC<TimeStepProps> = ({
  selectedTime,
  onTimeChange,
  formError,
  onNextStep,
  onPrevStep,
  currentStep,
}) => {
  const [isTimeListExpanded, setIsTimeListExpanded] = useState(false);

  return (
    <div className="time-step-container">
      {/* --- Título Añadido --- */}
      <h4 className="step-internal-title">Seleccionar Hora</h4>

      {/* ---- Selector de tiempo para MÓVIL ---- */}
      <div className="booking-form-group time-input-mobile-wrapper">
        {/* Eliminamos la label "Hora:" si ya tenemos el título general */}
        {/* <label htmlFor="timeSelectMobile">Hora:</label> */}
        <input
          type="time"
          id="timeSelectMobile"
          value={selectedTime}
          onChange={(e) => {
            onTimeChange(e.target.value);
            if (isTimeListExpanded) setIsTimeListExpanded(false); // Cerrar desplegable desktop si se interactúa con móvil
          }}
          required
          className="booking-form-input"
        />
      </div>

      {/* ---- Selector de tiempo para DESKTOP (desplegable) ---- */}
      <div className={`booking-form-group time-list-desktop-wrapper ${isTimeListExpanded ? 'expanded' : ''}`}>
        <div 
          className="desktop-time-picker-trigger"
          onClick={() => setIsTimeListExpanded(!isTimeListExpanded)}
          role="button"
          tabIndex={0}
          aria-expanded={isTimeListExpanded}
          aria-controls="time-buttons-grid-desktop"
        >
          <span className="selected-time-text">{selectedTime || "Selecciona una hora"}</span>
          {isTimeListExpanded ? (
            <FiChevronDown className="time-picker-icon arrow" />
          ) : (
            <FiClock className="time-picker-icon clock" />
          )}
        </div>

        {isTimeListExpanded && (
          <div className="time-buttons-grid" id="time-buttons-grid-desktop">
            {availableTimesDesktop.map((time) => (
              <button
                key={time}
                type="button"
                className={`time-button ${selectedTime === time ? 'selected' : ''}`}
                onClick={() => {
                  onTimeChange(time);
                  setIsTimeListExpanded(false); // Cerrar al seleccionar
                }}
              >
                {time}
              </button>
            ))}
          </div>
        )}
      </div>

      {formError && <p className="booking-form-error">{formError}</p>}
      
      <div className={`step-actions ${currentStep > 1 ? 'space-between' : 'justify-end'}`}>
        {currentStep > 1 && (
          <button type="button" onClick={onPrevStep} className="prev-button">
            <FiArrowLeft /> Atrás
          </button>
        )}
        <button 
          type="button" 
          onClick={onNextStep} 
          className="next-button" 
          disabled={!selectedTime}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default TimeStep; 