import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';

interface ProductItemProps {
  product: {
    id: string;
    title: string;
    description: string;
    price: number;
    imageUrl?: string;
    type: 'digital' | 'service';
  };
  profileData: any;
}

const ProductItem: React.FC<ProductItemProps> = ({ product, profileData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBuyClick = async () => {
    if (!profileData.stripeConnected) return; // No hacer nada si no está conectado

    try {
      setLoading(true);
      setError('');

      const recordProductView = httpsCallable(functions, 'recordProductView');
      await recordProductView({ productId: product.id, profileId: profileData.uid });

      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const result = await createCheckoutSession({
        productId: product.id,
        sellerId: profileData.uid,
        productName: product.title,
        productDescription: product.description,
        productPrice: product.price,
        productType: product.type
      });

      if (result.data && (result.data as any).url) {
        window.location.href = (result.data as any).url;
      } else {
        throw new Error('No se pudo crear la sesión de pago');
      }
    } catch (error: any) {
      console.error('Error al iniciar el proceso de compra:', error);
      setError(error.message || 'Error al iniciar el proceso de compra');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="product-card">
      {product.imageUrl ? (
        <img 
          src={product.imageUrl} 
          alt={product.title}
          className="product-image"
        />
      ) : (
        <div className="product-image-placeholder">
          <span>Sin imagen</span>
        </div>
      )}
      
      <div className="product-details">
        <span className="product-badge">
          {product.type === 'digital' ? 'Producto Digital' : 'Servicio'}
        </span>
        <h3 className="product-title">{product.title}</h3>
        <p className="product-description">
          {product.description}
        </p>
        
        <div className="product-footer">
          <span className="product-price">
            {formatCurrency(product.price)}
          </span>
          <button
            onClick={handleBuyClick}
            disabled={loading || !profileData.stripeConnected}
            className="product-button"
            title={!profileData.stripeConnected ? "El vendedor no tiene pagos configurados" : "Comprar"}
          >
            {loading ? 'Procesando...' : 'Comprar'}
          </button>
        </div>
        
        {error && (
          <p className="alert alert-error mt-2" style={{ fontSize: '0.75rem' }}>
            {error}
          </p>
        )}
        
        {!profileData.stripeConnected && (
          <p className="mt-2 text-center" style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
            (Pagos no disponibles)
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductItem;