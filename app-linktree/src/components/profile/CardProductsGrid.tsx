import React from 'react';
import { Product } from '../cardeditor/types';
import './CardProductsGrid.css';

const FALLBACK_PRODUCT_IMAGE_URL_GRID = 'https://firebasestorage.googleapis.com/v0/b/klycs-58190.appspot.com/o/defaults%2Fproduct-placeholder.png?alt=media';

interface CardProductsGridProps {
  products: Product[];
  textColor?: string;
  failedImages: Record<string, boolean>;
  onErrorCallback: (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => void;
  fallbackImageUrl?: string;
  onProductSelect: (product: Product) => void;
}

const CardProductsGrid: React.FC<CardProductsGridProps> = ({
  products,
  textColor,
  failedImages,
  onErrorCallback,
  fallbackImageUrl = FALLBACK_PRODUCT_IMAGE_URL_GRID,
  onProductSelect,
}) => {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="rendered-featured-products-linktree products-grid-container" style={{ color: textColor || 'inherit' }}>
      <div className="products-grid">
        {products.map((product) => (
          <div 
            key={product.id} 
            className="product-item-linktree" 
            onClick={() => onProductSelect(product)}
            style={{ cursor: 'pointer' }}
          >
            <img 
              src={failedImages[product.id] ? fallbackImageUrl : (product.imageURL || fallbackImageUrl)} 
              alt={product.title} 
              className="product-image-linktree"
              onError={(e) => onErrorCallback(e, product.id, fallbackImageUrl || FALLBACK_PRODUCT_IMAGE_URL_GRID)}
            />
            <div className="product-info-linktree">
              <h6 className="product-title-linktree">{product.title}</h6>
              <p className="product-price-linktree">${product.price.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardProductsGrid; 