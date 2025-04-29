import React, { useState } from 'react';
import './CardEditor.css';
import './ProductSelector.css';
import { FiShoppingBag, FiDollarSign, FiPlus, FiX, FiSearch, FiFilter, FiTag, FiEye } from 'react-icons/fi';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  imageURL: string;
  url?: string;
  autoUrl?: string;
  active: boolean;
}

interface ProductSelectorProps {
  userProducts: Product[];
  cardProducts: Product[];
  handleAddProductToCard: (product: Product) => void;
  handleRemoveProductFromCard: (productId: string) => void;
  toggleProductSelector: () => void;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  userProducts,
  cardProducts,
  handleAddProductToCard,
  handleRemoveProductFromCard,
  toggleProductSelector
}) => {
  // Estado para búsqueda y filtrado
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [sortOrder, setSortOrder] = useState<'default' | 'priceAsc' | 'priceDesc' | 'nameAsc'>('default');

  // Función para verificar si un producto ya está en la tarjeta
  const isProductInCard = (productId: string): boolean => {
    return cardProducts.some(p => p.id === productId);
  };

  // Función para formatear el precio
  const formatPrice = (price: number): string => {
    return price.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    });
  };

  // Filtrar y ordenar productos
  const filteredProducts = userProducts
    .filter(product => {
      // Proteger contra valores undefined o null
      const productTitle = (product && product.title) ? product.title : '';
      const productDescription = (product && product.description) ? product.description : '';
      const searchTermLower = searchTerm.toLowerCase();
      
      // Filtro por texto
      const matchesSearch = productTitle.toLowerCase().includes(searchTermLower) ||
                           productDescription.toLowerCase().includes(searchTermLower);
      
      // Filtro por estado (activo/inactivo)
      const matchesActive = filterActive === null || product.active === filterActive;
      
      return matchesSearch && matchesActive;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case 'priceAsc':
          return a.price - b.price;
        case 'priceDesc':
          return b.price - a.price;
        case 'nameAsc':
          // Proteger contra valores undefined o null
          const titleA = (a && a.title) ? a.title : '';
          const titleB = (b && b.title) ? b.title : '';
          return titleA.localeCompare(titleB);
        default:
          return 0; // Mantener orden original
      }
    });

  return (
    <div className="product-selector-overlay">
      <div className="product-selector-modal">
        <div className="product-selector-header">
          <h3>
            <FiShoppingBag />
            Seleccionar productos
          </h3>
          <button 
            type="button" 
            className="close-modal-button"
            onClick={toggleProductSelector}
          >
            <FiX />
          </button>
        </div>
        
        <div className="product-selector-filters">
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                className="clear-search" 
                onClick={() => setSearchTerm('')}
              >
                <FiX size={16} />
              </button>
            )}
          </div>
          
          <div className="filters-dropdown">
            <div className="dropdown-trigger">
              <button className="filter-button">
                <FiFilter />
                Filtrar
              </button>
            </div>
            <div className="filter-options">
              <div className="filter-option">
                <label className="filter-label">Estado:</label>
                <div className="filter-buttons">
                  <button 
                    className={`filter-state-btn ${filterActive === null ? 'active' : ''}`} 
                    onClick={() => setFilterActive(null)}
                  >
                    Todos
                  </button>
                  <button 
                    className={`filter-state-btn ${filterActive === true ? 'active' : ''}`}
                    onClick={() => setFilterActive(true)}
                  >
                    Activos
                  </button>
                  <button 
                    className={`filter-state-btn ${filterActive === false ? 'active' : ''}`}
                    onClick={() => setFilterActive(false)}
                  >
                    Inactivos
                  </button>
                </div>
              </div>
              
              <div className="filter-option">
                <label className="filter-label">Ordenar por:</label>
                <select 
                  className="sort-select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                >
                  <option value="default">Predeterminado</option>
                  <option value="priceAsc">Precio: Menor a mayor</option>
                  <option value="priceDesc">Precio: Mayor a menor</option>
                  <option value="nameAsc">Nombre: A-Z</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="product-selector-content">
          {userProducts.length > 0 ? (
            <>
              <div className="products-count">
                Mostrando {filteredProducts.length} de {userProducts.length} productos
              </div>
              <div className="products-grid">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className={`product-card ${!product.active ? 'product-inactive' : ''} ${isProductInCard(product.id) ? 'product-selected' : ''}`}
                    onClick={() => {
                      if (!product.active) return;
                      if (isProductInCard(product.id)) {
                        handleRemoveProductFromCard(product.id);
                      } else {
                        handleAddProductToCard(product);
                      }
                    }}
                  >
                    {product.imageURL ? (
                      <div className="product-image">
                        <img 
                          src={product.imageURL} 
                          alt={product.title} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Sin+imagen';
                          }}
                        />
                        {!product.active && (
                          <div className="product-inactive-badge">Inactivo</div>
                        )}
                      </div>
                    ) : (
                      <div className="product-image product-image-placeholder">
                        <FiShoppingBag size={32} />
                        {!product.active && (
                          <div className="product-inactive-badge">Inactivo</div>
                        )}
                      </div>
                    )}
                    <div className="product-info">
                      <h4 className="product-title">{product.title}</h4>
                      <p className="product-price">
                        <FiDollarSign size={14} />
                        {formatPrice(product.price)}
                      </p>
                      <p className="product-description">
                        {product.description && product.description.length > 50
                          ? `${product.description.substring(0, 50)}...`
                          : product.description || "Sin descripción"}
                      </p>
                      
                      <div className="product-buttons">
                        {isProductInCard(product.id) ? (
                          <button
                            type="button"
                            className="remove-product-button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveProductFromCard(product.id); }}
                          >
                            <FiX size={14} />
                            Quitar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="add-product-button"
                            onClick={(e) => { e.stopPropagation(); handleAddProductToCard(product); }}
                            disabled={!product.active}
                          >
                            <FiPlus size={14} />
                            Añadir
                          </button>
                        )}
                        
                        {product.url && (
                          <a 
                            href={product.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-product-button"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FiEye size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-products-message">
              <FiShoppingBag size={48} style={{opacity: 0.4}} />
              <p>No tienes productos disponibles para añadir.</p>
              <p>Crea productos en la sección de Productos para poder añadirlos a tus tarjetas.</p>
            </div>
          )}
        </div>
        
        <div className="product-selector-footer">
          <div className="selected-products-count">
            <FiTag />
            <span>{cardProducts.length} productos seleccionados</span>
          </div>
          <button 
            type="button" 
            className="close-selector-button"
            onClick={toggleProductSelector}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSelector; 