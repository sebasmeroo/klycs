import React from 'react';
import { Product as ProductType } from '../cardeditor/types';
import './ProductDetailView.css';
import ProductInfoDisplay from './subcomponentsproductdetailview/ProductInfoDisplay';

interface ProductDetailViewProps {
  product: ProductType;
  textColor: string;
  onClose: () => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement>, imageId: string, fallbackUrl: string) => void;
  fallbackImageUrl: string;
  sellerName: string;
  sellerAvatarUrl?: string;
  sellerId: string;
  backgroundColor?: string;
}

const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  textColor,
  onClose,
  onImageError,
  fallbackImageUrl,
  sellerName,
  sellerAvatarUrl,
  sellerId,
  backgroundColor = '#ffffff',
}) => {
  if (!product) return null;

  return (
    <div className="product-detail-view-container">
      <div className="product-image-container">
        <button
          onClick={onClose}
          className="btn btn-sm btn-light product-back-button"
        >
          ← Volver a la tienda
        </button>
        {product.imageURL && (
          <img
            src={product.imageURL}
            alt={product.title}
            className="product-image"
            onError={(e) => onImageError(e, product.id, fallbackImageUrl)}
          />
        )}
      </div>
      <ProductInfoDisplay 
        product={product} 
        textColor={textColor} 
        sellerName={sellerName} 
        sellerAvatarUrl={sellerAvatarUrl}
        sellerId={sellerId}
        backgroundColor={backgroundColor}
      />
    </div>
  );
};

export default ProductDetailView; 