import React from 'react';
import './CardEditor.css';
import { FiInfo, FiEdit, FiImage, FiType, FiLayers, FiSliders, FiSave, FiDroplet } from 'react-icons/fi';
import { CardTheme } from './types';

interface CardFormProps {
  title: string;
  description: string;
  backgroundType: 'image' | 'color' | 'gradient';
  backgroundColor: string;
  backgroundGradient: string;
  handleTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleBackgroundTypeChange: (type: 'image' | 'color' | 'gradient') => void;
  handleBackgroundColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBackgroundGradientChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleBackgroundFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  theme: CardTheme;
  handleThemeChange: (newTheme: Partial<CardTheme>) => void;
}

const CardForm: React.FC<CardFormProps> = ({
  title,
  description,
  backgroundType,
  backgroundColor,
  backgroundGradient,
  handleTitleChange,
  handleDescriptionChange,
  handleFileChange,
  handleSubmit,
  handleBackgroundTypeChange,
  handleBackgroundColorChange,
  handleBackgroundGradientChange,
  handleBackgroundFileChange,
  theme,
  handleThemeChange
}) => {
  return (
    <form id="cardForm" className="card-editor-form" onSubmit={handleSubmit}>
      <div id="basic-info" className="form-section basic-info-section">
        <h3 className="section-title">
          <FiInfo />
          Información básica
        </h3>
        <div className="form-group">
          <label htmlFor="title" className="form-label">
            <FiEdit size={14} />
            Título de la tarjeta
          </label>
          <input
            type="text"
            id="title"
            className="form-control"
            value={title}
            onChange={handleTitleChange}
            placeholder="Introduce un título atractivo"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="description" className="form-label">
            <FiType size={14} />
            Descripción
          </label>
          <textarea
            id="description"
            className="form-control"
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Describe brevemente de qué trata esta tarjeta"
            rows={4}
          />
        </div>
        <div className="form-group">
          <label htmlFor="image" className="form-label">
            <FiImage size={14} />
            Imagen de la tarjeta
          </label>
          <div className="file-input-container">
            <input
              type="file"
              id="image"
              className="form-control file-input"
              onChange={handleFileChange}
              accept="image/*"
            />
            <div className="file-input-button">
              <FiImage size={18} />
              <span>Seleccionar imagen</span>
            </div>
          </div>
          <small className="form-text">
            Se recomienda una imagen de alta calidad (Recomendado: 1080×1920px). 
            La imagen será comprimida automáticamente para un rendimiento óptimo.
          </small>
        </div>
      </div>

      <div id="background-style" className="form-section bg-style-section">
        <h3 className="section-title">
          <FiLayers />
          Estilo de fondo
        </h3>
        <div className="form-group">
          <label className="form-label">
            <FiSliders size={14} />
            Tipo de fondo
          </label>
          <div className="background-type-selector">
            <button
              type="button"
              className={`bg-type-btn ${backgroundType === 'color' ? 'active' : ''}`}
              onClick={() => handleBackgroundTypeChange('color')}
            >
              Color sólido
            </button>
            <button
              type="button"
              className={`bg-type-btn ${backgroundType === 'gradient' ? 'active' : ''}`}
              onClick={() => handleBackgroundTypeChange('gradient')}
            >
              Gradiente
            </button>
            <button
              type="button"
              className={`bg-type-btn ${backgroundType === 'image' ? 'active' : ''}`}
              onClick={() => handleBackgroundTypeChange('image')}
            >
              Imagen
            </button>
          </div>
        </div>

        {backgroundType === 'color' && (
          <div className="form-group">
            <label htmlFor="backgroundColor" className="form-label">Color de fondo</label>
            <div className="color-picker-container">
              <input
                type="color"
                id="backgroundColor"
                className="form-control color-picker"
                value={backgroundColor}
                onChange={handleBackgroundColorChange}
              />
              <input
                type="text"
                value={backgroundColor}
                className="form-control color-text"
                onChange={(e) => handleBackgroundColorChange({ target: { value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
              />
            </div>
          </div>
        )}

        {backgroundType === 'gradient' && (
          <div className="form-group">
            <label htmlFor="backgroundGradient" className="form-label">Estilo de gradiente</label>
            <select
              id="backgroundGradient"
              className="form-control"
              value={backgroundGradient}
              onChange={handleBackgroundGradientChange}
            >
              <option value="linear-gradient(135deg, #4b6cb7 0%, #182848 100%)">Azul Profundo</option>
              <option value="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">Rosa cálido</option>
              <option value="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">Verde menta</option>
              <option value="linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)">Melocotón</option>
              <option value="linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)">Lavanda</option>
              <option value="linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)">Amanecer</option>
              <option value="linear-gradient(135deg, #2980b9 0%, #6dd5fa 100%, #ffffff 100%)">Cielo claro</option>
              <option value="linear-gradient(135deg, #f6d365 0%, #fda085 100%)">Sol dorado</option>
              <option value="linear-gradient(to right, #434343 0%, black 100%)">Oscuro elegante</option>
              <option value="linear-gradient(to top, #09203f 0%, #537895 100%)">Azul noche</option>
              <option value="linear-gradient(to top, #e6b980 0%, #eacda3 100%)">Oro suave</option>
              <option value="linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)">Agua fresca</option>
            </select>
          </div>
        )}

        {backgroundType === 'image' && (
          <div className="form-group">
            <label htmlFor="backgroundImage" className="form-label">
              <FiImage size={14} />
              Imagen de fondo
            </label>
            <div className="file-input-container">
              <input
                type="file"
                id="backgroundImage"
                className="form-control file-input"
                onChange={handleBackgroundFileChange}
                accept="image/*"
              />
              <div className="file-input-button">
                <FiImage size={18} />
                <span>Seleccionar imagen de fondo</span>
              </div>
            </div>
            <small className="form-text">
              Se recomienda una imagen de alta calidad que no distraiga del contenido.
              La imagen será comprimida automáticamente para optimizar el rendimiento.
            </small>
          </div>
        )}
      </div>

      <div className="form-group theme-colors-group">
        <label htmlFor="primaryColor" className="form-label">
          <FiDroplet size={14} />
          Color de Acento Principal
        </label>
        <div className="color-picker-container">
          <input
            type="color"
            id="primaryColor"
            className="form-control color-picker"
            value={theme.primaryColor || '#6366f1'}
            onChange={(e) => handleThemeChange({ primaryColor: e.target.value })}
          />
          <input
            type="text"
            value={theme.primaryColor || '#6366f1'}
            className="form-control color-text"
            onChange={(e) => handleThemeChange({ primaryColor: e.target.value })}
          />
        </div>
        <small className="form-text">
          Este color se usará para botones, enlaces activos y otros elementos destacados.
        </small>
      </div>

      <div className="card-editor-footer">
        {/* Botón movido arriba en el header */}
      </div>
    </form>
  );
};

export default CardForm; 