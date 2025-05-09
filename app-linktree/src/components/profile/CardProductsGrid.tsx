import React from 'react';
import { Product as ProductType } from '../cardeditor/types';
import './CardProductsGrid.css';

interface CardProductsGridProps {
  products: ProductType[];
  textColor?: string;
  failedImages: Record<string, boolean>;
  onErrorCallback: (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => void;
  fallbackImageUrl: string;
  className?: string;
}

const CardProductsGrid: React.FC<CardProductsGridProps> = ({
  products,
  textColor = '#333333',
  failedImages,
  onErrorCallback,
  fallbackImageUrl,
  className = ''
}) => {

  const activeProducts = products.filter(p => p.active !== false);

  if (activeProducts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h5 className="rendered-section-title-linktree" style={{ color: textColor }}>
        Productos Destacados
      </h5> 
      <div className="rendered-featured-products-linktree mb-4"> 
        {activeProducts.map(product => (
          <div key={product.id} className="rendered-product-item-linktree"> 
            <img 
              src={failedImages[product.id] ? fallbackImageUrl : (product.imageURL || fallbackImageUrl)} 
              alt={product.title}
              className="rendered-product-image-linktree"
              onError={(e) => onErrorCallback(e, product.id, fallbackImageUrl)}
            />
            <div className="rendered-product-info"> 
              <h6 className="rendered-product-title">{product.title}</h6>
              <p className="rendered-product-price" style={{ color: textColor, opacity: 0.9 }}>
                {typeof product.price === 'number' ? product.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : 'Consultar'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardProductsGrid; 