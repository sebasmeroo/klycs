import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AnalyticsExportService } from '../../services/AnalyticsExportService';
import { DatePicker } from '../ui/DatePicker';
import styles from './AnalyticsExport.module.css';

interface AnalyticsExportProps {
  cards: { id: string; title: string }[];
}

const AnalyticsExport: React.FC<AnalyticsExportProps> = ({ cards }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [dataType, setDataType] = useState<'views' | 'clicks' | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    if (!user) {
      setError('Debes iniciar sesión para exportar datos');
      return;
    }

    // Validar fechas
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setError('Debes seleccionar ambas fechas o ninguna');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError('La fecha de inicio debe ser anterior a la fecha final');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const exportOptions = {
        userId: user.uid,
        cardId: selectedCardId === 'all' ? null : selectedCardId,
        startDate: startDate,
        endDate: endDate,
        format: exportFormat,
        dataType: dataType
      };

      const exportedData = await AnalyticsExportService.exportData(exportOptions);

      if (!exportedData) {
        setError('No hay datos para exportar con los filtros seleccionados');
        setIsLoading(false);
        return;
      }

      // Generar nombre de archivo con fecha actual
      const now = new Date();
      const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const timeStr = `${now.getHours()}-${now.getMinutes()}`;
      const dataTypeStr = dataType === 'all' ? 'completo' : (dataType === 'views' ? 'vistas' : 'clics');
      const filename = `analiticas-${dataTypeStr}-${dateStr}-${timeStr}.${exportFormat}`;

      // Descargar archivo
      AnalyticsExportService.downloadFile(exportedData, filename, exportFormat);

      setSuccess(`Datos exportados correctamente. Se ha descargado ${filename}`);
    } catch (err) {
      console.error('Error al exportar datos:', err);
      setError('Ocurrió un error al exportar los datos. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedCardId('all');
    setExportFormat('csv');
    setDataType('all');
    setError(null);
    setSuccess(null);
  };

  return (
    <div className={styles.exportContainer}>
      <h3 className={styles.exportTitle}>Exportar datos de analíticas</h3>
      
      <div className={styles.formGroup}>
        <label htmlFor="dataType">Tipo de datos:</label>
        <select 
          id="dataType"
          value={dataType}
          onChange={(e) => setDataType(e.target.value as 'views' | 'clicks' | 'all')}
          className={styles.select}
          disabled={isLoading}
        >
          <option value="all">Todos los datos</option>
          <option value="views">Solo vistas de perfil</option>
          <option value="clicks">Solo clics en enlaces</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="cardSelect">Tarjeta:</label>
        <select 
          id="cardSelect"
          value={selectedCardId}
          onChange={(e) => setSelectedCardId(e.target.value)}
          className={styles.select}
          disabled={isLoading}
        >
          <option value="all">Todas las tarjetas</option>
          {cards.map(card => (
            <option key={card.id} value={card.id}>{card.title || `Tarjeta ${card.id.substring(0, 5)}...`}</option>
          ))}
        </select>
      </div>

      <div className={styles.dateRangeContainer}>
        <div className={styles.formGroup}>
          <label>Fecha de inicio:</label>
          <DatePicker 
            selected={startDate} 
            onChange={setStartDate} 
            placeholderText="DD/MM/AAAA"
            disabled={isLoading}
            maxDate={new Date()}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Fecha final:</label>
          <DatePicker 
            selected={endDate} 
            onChange={setEndDate} 
            placeholderText="DD/MM/AAAA"
            disabled={isLoading}
            maxDate={new Date()}
            minDate={startDate || undefined}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Formato de exportación:</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input 
              type="radio" 
              value="csv" 
              checked={exportFormat === 'csv'} 
              onChange={() => setExportFormat('csv')}
              disabled={isLoading}
            />
            CSV (Excel)
          </label>
          <label className={styles.radioLabel}>
            <input 
              type="radio" 
              value="json" 
              checked={exportFormat === 'json'} 
              onChange={() => setExportFormat('json')}
              disabled={isLoading}
            />
            JSON
          </label>
        </div>
      </div>

      {error && <p className={styles.errorMessage}>{error}</p>}
      {success && <p className={styles.successMessage}>{success}</p>}

      <div className={styles.buttonContainer}>
        <button 
          className={styles.resetButton} 
          onClick={resetFilters}
          disabled={isLoading}
        >
          Limpiar filtros
        </button>
        <button 
          className={styles.exportButton} 
          onClick={handleExport}
          disabled={isLoading}
        >
          {isLoading ? 'Exportando...' : 'Exportar datos'}
        </button>
      </div>
    </div>
  );
};

export default AnalyticsExport; 