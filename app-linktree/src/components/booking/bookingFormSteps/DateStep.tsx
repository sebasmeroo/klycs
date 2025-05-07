// DateStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FiArrowLeft, FiCalendar, FiChevronLeft, FiChevronRight, FiChevronUp } from 'react-icons/fi';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Estilos base de react-calendar
import './DateStep.css'; // Tus estilos personalizados
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';

interface DateStepProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  formError: string | null;
  onNextStep: () => void;
  onPrevStep: () => void;
  currentStep: number;
}

type ValuePiece = Date | null;
type CalendarValue = ValuePiece | [ValuePiece, ValuePiece];

const DateStep: React.FC<DateStepProps> = ({
  selectedDate,
  onDateChange,
  formError,
  onNextStep,
  onPrevStep,
  currentStep,
}) => {
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(new Date());
  const [animateWeekStrip, setAnimateWeekStrip] = useState<'next' | 'prev' | null>(null);
  const weekStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate) {
      try {
        const parsed = parseISO(selectedDate + 'T00:00:00');
        setCurrentWeekStartDate(startOfWeek(parsed, { weekStartsOn: 1 }));
      } catch {
        setCurrentWeekStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
      }
    } else {
      setCurrentWeekStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
    }
  }, [selectedDate]);

  const selectedDayObj = selectedDate ? parseISO(selectedDate + 'T00:00:00') : null;

  const handleDaySelectInCalendar = (value: CalendarValue) => {
    let date: Date | null = null;
    if (Array.isArray(value)) {
      date = value[0] || null;
    } else {
      date = value;
    }
    if (date) {
      onDateChange(format(date, 'yyyy-MM-dd'));
      // ya no cerramos el calendario aquí
    }
  };

  const handleDaySelectInStrip = (day: Date) => {
    onDateChange(format(day, 'yyyy-MM-dd'));
  };

  const weekDaysForStrip = eachDayOfInterval({
    start: currentWeekStartDate,
    end: endOfWeek(currentWeekStartDate, { weekStartsOn: 1 }),
  });

  const triggerWeekAnimation = (direction: 'next' | 'prev') => {
    setAnimateWeekStrip(direction);
    setTimeout(() => {
      setCurrentWeekStartDate(
        direction === 'next'
          ? addDays(currentWeekStartDate, 7)
          : subDays(currentWeekStartDate, 7)
      );
      setTimeout(() => setAnimateWeekStrip(null), 50);
    }, 150);
  };

  const goToPreviousWeek = () => {
    if (!canGoToPreviousWeek) return;
    triggerWeekAnimation('prev');
  };

  const goToNextWeek = () => {
    triggerWeekAnimation('next');
  };

  const today = new Date();
  const minCalendarDate = startOfWeek(today, { weekStartsOn: 1 });
  const canGoToPreviousWeek =
    weekDaysForStrip.some(day => day >= minCalendarDate) &&
    !isSameDay(currentWeekStartDate, minCalendarDate);

  return (
    <div className={`booking-form-group calendar-container compact-calendar-container ${isCalendarExpanded ? 'expanded-view' : 'compact-view'}`}>
      
      {/* VISTA DE TIRA DE SEMANA */}
      <div className="week-strip-view">
        <div className="week-strip-header">
          <button
            onClick={goToPreviousWeek}
            disabled={!canGoToPreviousWeek}
            className="week-strip-nav-button"
            aria-label="Semana anterior"
          >
            <FiChevronLeft />
          </button>
          <span className="week-strip-month-year">
            {format(currentWeekStartDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            onClick={goToNextWeek}
            className="week-strip-nav-button"
            aria-label="Siguiente semana"
          >
            <FiChevronRight />
          </button>
          <button
            onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
            className="week-strip-expand-button"
            aria-label={isCalendarExpanded ? "Contraer calendario" : "Expandir calendario"}
          >
            {isCalendarExpanded ? <FiChevronUp /> : <FiCalendar />}
          </button>
        </div>
        <div
          ref={weekStripRef}
          className={`week-strip-days ${animateWeekStrip ? 'animate-' + animateWeekStrip : ''}`}
        >
          {weekDaysForStrip.map(day => {
            const isDisabled = day < today && !isSameDay(day, today);
            const isSelected = selectedDayObj && isSameDay(day, selectedDayObj);
            return (
              <div
                key={day.toISOString()}
                className={`week-strip-day-item ${
                  isSelected ? 'selected' : ''
                } ${isSameDay(day, today) ? 'today' : ''} ${
                  isDisabled ? 'disabled' : ''
                }`}
                onClick={() => !isDisabled && handleDaySelectInStrip(day)}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : 0}
              >
                <span className="week-strip-day-name">
                  {format(day, 'EEE', { locale: es }).substring(0, 3)}
                </span>
                <span className="week-strip-day-number">
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CALENDARIO COMPACTO Y EXPANDIBLE */}
      <div className={`full-calendar-view-wrapper ${isCalendarExpanded ? 'visible' : ''}`}>
        <div className="full-calendar-view">
          <Calendar
            onChange={handleDaySelectInCalendar}
            value={selectedDayObj}
            minDate={new Date()}
            locale="es-ES"
            formatShortWeekday={(locale, date) =>
              new Intl.DateTimeFormat(locale, { weekday: 'short' })
                .format(date)
                .substring(0, 1)
                .toUpperCase()
            }
            prevLabel={<FiChevronLeft />}
            nextLabel={<FiChevronRight />}
            next2Label={null}
            prev2Label={null}
          />
        </div>
      </div>

      {formError && <p className="booking-form-error internal-error">{formError}</p>}

      <div
        className={`step-actions internal-actions ${
          currentStep > 1 ? 'space-between' : 'justify-end'
        }`}
      >
        {currentStep > 1 && (
          <button type="button" onClick={onPrevStep} className="prev-button">
            <FiArrowLeft /> Atrás
          </button>
        )}
        <button
          type="button"
          onClick={onNextStep}
          className="next-button"
          disabled={!selectedDate}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default DateStep;
