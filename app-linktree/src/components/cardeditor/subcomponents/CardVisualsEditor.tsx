import React from 'react';
import CardForm from '../CardForm'; // Asumiendo que CardForm está un nivel arriba
import CompressionInfo from '../../common/CompressionInfo'; // Ajustar ruta si es necesario
import { CardBackground, CardTheme, CompressionStatus } from '../types';
import './CardVisualsEditor.css'; // <-- IMPORTACIÓN CSS ACTUALIZADA

interface CardVisualsEditorProps {
  title: string;
  description: string;
  background: CardBackground;
  theme: CardTheme;
  mainImageCompressionStatus: CompressionStatus;
  mainImageCompressionData: { originalSize?: number; compressedSize?: number; originalFormat?: string; compressionRatio?: number };
  bgImageCompressionStatus: CompressionStatus;
  bgImageCompressionData: { originalSize?: number; compressedSize?: number; originalFormat?: string; compressionRatio?: number };
  handleTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // Para imagen principal
  handleBackgroundTypeChange: (type: 'image' | 'color' | 'gradient') => void;
  handleBackgroundColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBackgroundGradientChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleBackgroundFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // Para imagen de fondo
  handleThemeChange: (newTheme: Partial<CardTheme>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  // handleSubmit podría pasarse si CardForm lo usa directamente, o manejar el guardado en el padre.
  // Por ahora, asumimos que CardForm no llama a handleSubmit directamente, sino que el padre lo hace.
}

const CardVisualsEditor: React.FC<CardVisualsEditorProps> = ({
  title,
  description,
  background,
  theme,
  mainImageCompressionStatus,
  mainImageCompressionData,
  bgImageCompressionStatus,
  bgImageCompressionData,
  handleTitleChange,
  handleDescriptionChange,
  handleFileChange,
  handleBackgroundTypeChange,
  handleBackgroundColorChange,
  handleBackgroundGradientChange,
  handleBackgroundFileChange,
  handleThemeChange,
  handleSubmit,
}) => {
  return (
    <div className="card-visuals-editor">
      {/* CardForm se encarga de los inputs de título, descripción, imagen y fondo */}
      <CardForm 
        title={title}
        description={description}
        // Asegurarse que backgroundType en CardForm espera 'image' | 'color' | 'gradient'
        backgroundType={background.type === 'pattern' ? 'color' : background.type} 
        backgroundColor={background.color || '#ffffff'}
        backgroundGradient={background.gradient || 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)'}
        handleTitleChange={handleTitleChange}
        handleDescriptionChange={handleDescriptionChange}
        handleFileChange={handleFileChange} // Este es para la imagen principal de la tarjeta
        handleSubmit={handleSubmit}
        handleBackgroundTypeChange={handleBackgroundTypeChange}
        handleBackgroundColorChange={handleBackgroundColorChange}
        handleBackgroundGradientChange={handleBackgroundGradientChange}
        handleBackgroundFileChange={handleBackgroundFileChange} // Este es para la imagen de fondo
        theme={theme} // Pasar el tema a CardForm
        handleThemeChange={handleThemeChange} // Pasar el manejador de tema
      />

      {/* Información de compresión para imagen principal */}
      {mainImageCompressionStatus !== 'idle' && (
        <div className="compression-info-container mt-3">
          <CompressionInfo 
            status={mainImageCompressionStatus}
            originalSize={mainImageCompressionData.originalSize}
            compressedSize={mainImageCompressionData.compressedSize}
            originalFormat={mainImageCompressionData.originalFormat}
            compressionRatio={mainImageCompressionData.compressionRatio}
            showDetails={true}
          />
        </div>
      )}
      
      {/* Información de compresión para imagen de fondo */}
      {bgImageCompressionStatus !== 'idle' && background.type === 'image' && (
        <div className="compression-info-container mt-3">
          <CompressionInfo 
            status={bgImageCompressionStatus}
            originalSize={bgImageCompressionData.originalSize}
            compressedSize={bgImageCompressionData.compressedSize}
            originalFormat={bgImageCompressionData.originalFormat}
            compressionRatio={bgImageCompressionData.compressionRatio}
            showDetails={true}
          />
        </div>
      )}
    </div>
  );
};

export default CardVisualsEditor; 