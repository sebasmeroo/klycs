import React from 'react';
import { FiLayers } from 'react-icons/fi';
import { TemplateType } from '../types';
import './TemplateSelector.css'; // Importar CSS

interface TemplateSelectorProps {
  availableTemplates: TemplateType[];
  currentTemplate: TemplateType;
  onTemplateChange: (newTemplate: TemplateType) => void;
  storeName: string;
  onStoreNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Podríamos añadir más props si se necesita más personalización
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  availableTemplates,
  currentTemplate,
  onTemplateChange,
  storeName,
  onStoreNameChange,
}) => {
  return (
    <div className="form-section template-selector-section"> 
      <h4 className="section-title"><FiLayers /> Plantilla</h4>
      <div className="template-selector">
        {availableTemplates.map(t => (
          <button 
            key={t} 
            type="button"
            className={`template-btn ${currentTemplate === t ? 'active' : ''}`}
            onClick={() => onTemplateChange(t)}
          >
            {/* Capitalizar nombre - podría hacerse una función helper si se vuelve complejo */}
            {t.charAt(0).toUpperCase() + t.slice(1).replace(/([A-Z])/g, ' $1').trim()} 
          </button>
        ))}
      </div>
      {/* Campo Store Name (solo visible si template es 'shop', 'miniShop' o 'headerStore') */}
      {(currentTemplate === 'shop' || currentTemplate === 'miniShop' || currentTemplate === 'headerStore') && (
        <div className="form-group mt-3"> 
          <label htmlFor="storeName" className="form-label">Nombre de la Tienda/Encabezado</label>
          <input 
            type="text" 
            id="storeName"
            className="form-control" 
            value={storeName} 
            onChange={onStoreNameChange} 
          />
        </div>
      )}
    </div>
  );
};

export default TemplateSelector; 