import React from 'react';
import { FiShoppingBag, FiPlus, FiTrash2 } from 'react-icons/fi';
import { Product } from '../types'; // Importar tipo Product
import './CardProductsEditor.css'; // <-- IMPORTACIÓN CSS ACTUALIZADA

interface CardProductsEditorProps {
  cardProducts: Product[];
  toggleProductSelectorVisibility: () => void;
  handleRemoveProductFromCard: (productId: string) => void;
}

const CardProductsEditor: React.FC<CardProductsEditorProps> = ({
  cardProducts,
  toggleProductSelectorVisibility,
  handleRemoveProductFromCard,
}) => {
  return (
    <div className="products-section"> {/* Mantener clase para estilos de CardEditor.css si aplica */}
      <div className="section-header">
        <h3 className="section-title">
          <FiShoppingBag /> 
          Productos
        </h3>
        <button
          type="button"
          className="add-button"
          onClick={toggleProductSelectorVisibility}
        >
          <FiPlus /> Añadir productos
        </button>
      </div>
      
      {cardProducts.length > 0 ? (
        <div className="selected-products">
          <div className="selected-products-grid">
            {cardProducts.map(product => (
              <div key={product.id} className="selected-product-card">
                {product.imageURL && (
                  <div className="selected-product-image">
                    <img 
                      src={product.imageURL} 
                      alt={product.title} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Sin+imagen';
                      }}
                    />
                  </div>
                )}
                <div className="selected-product-info">
                  <h4 className="selected-product-title">{product.title}</h4>
                  {/* Formatear precio si es necesario, ej: product.price.toLocaleString(...) */}
                  <p className="selected-product-price">
                    {typeof product.price === 'number' ? product.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : product.price}
                  </p>
                </div>
                <div className="selected-product-actions">
                  <button
                    type="button"
                    className="remove-selected-product"
                    onClick={() => handleRemoveProductFromCard(product.id)}
                    title="Eliminar producto"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-selected-products">
          <p>No has seleccionado ningún producto para esta tarjeta.</p>
        </div>
      )}
    </div>
  );
};

export default CardProductsEditor; 