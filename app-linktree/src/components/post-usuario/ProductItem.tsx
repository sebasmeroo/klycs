import React, { useState } from 'react';

interface ProductItemProps {
  product: {
    id: string;
    title: string;
    description?: string;
    price: number | string;
    imageURL?: string;
    imageUrl?: string;
    url?: string;
  };
}

const ProductItem: React.FC<ProductItemProps> = ({ product }) => {
  const { title, description, price, url } = product;
  const imageSource = product.imageURL || product.imageUrl;
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Format price properly
  const formatPrice = (price: number | string): string => {
    if (typeof price === 'number') {
      return price.toFixed(2);
    }
    
    const numericPrice = parseFloat(price);
    if (!isNaN(numericPrice)) {
      return numericPrice.toFixed(2);
    }
    
    return '0.00';
  };

  return (
    <div 
      className={`user-product-item ${isExpanded ? 'expanded' : ''}`}
      onClick={toggleExpand}
    >
      {imageSource && (
        <div className="product-image-container">
          <img 
            src={imageSource} 
            alt={title}
            className="product-image" 
          />
        </div>
      )}
      
      <div className="product-details">
        <h3 className="product-name">{title}</h3>
        
        <div className="product-price">{formatPrice(price)} €</div>
        
        {description && (
          <p className={`product-description ${isExpanded ? 'expanded' : ''}`}>
            {description}
          </p>
        )}
        
        {url && (
          <button 
            className="buy-button"
            onClick={handleBuy}
          >
            Comprar
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductItem; 