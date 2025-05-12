import React, { useState } from 'react';
import { Product as ProductType } from '../../cardeditor/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './ProductInfoDisplay.css'; // Importar el CSS del subcomponente

interface ProductInfoDisplayProps {
  product: ProductType;
  textColor: string;
  sellerName: string;      // Nueva prop
  sellerAvatarUrl?: string; // Nueva prop, opcional
  backgroundColor?: string;
  sellerId: string; // ID del vendedor necesario para el checkout
}

const ProductInfoDisplay: React.FC<ProductInfoDisplayProps> = ({
  product,
  textColor,
  sellerName,
  sellerAvatarUrl,
  backgroundColor = '#ffffff',
  sellerId,
}) => {
  // Estados para manejar el proceso de checkout
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estilo para pasar la variable CSS para el color del texto
  const compStyle = {
    '--pid-text-color': textColor,
    backgroundColor: backgroundColor,
  } as React.CSSProperties;

  // Función para iniciar el proceso de compra
  const handleBuyNow = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Obtener las funciones de Firebase
      const functions = getFunctions();
      // Llamar a la función createCheckoutSession definida en las funciones de Firebase
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

      // Datos requeridos para crear la sesión de checkout
      const sessionData = {
        productId: product.id,
        sellerId: sellerId,
        productName: product.title,
        productDescription: product.description || '',
        productPrice: product.price,
        productType: product.type || 'digital'
      };
      
      // Log para depurar los datos enviados
      console.log("Datos enviados a createCheckoutSession desde ProductInfoDisplay:", sessionData);

      // Llamar a la función y esperar el resultado
      const result = await createCheckoutSession(sessionData);
      const data = result.data as any;

      // Si recibimos la URL de Stripe Checkout, redirigir al usuario
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se pudo crear la sesión de pago.');
      }
    } catch (error: any) {
      console.error('Error al crear sesión de checkout:', error);
      setError(error.message || 'Error al procesar el pago. Inténtalo de nuevo más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="product-info-display-container" style={compStyle}>
      <h3 className="pid-title">{product.title.toUpperCase()}</h3>
      
      <div className="pid-seller-price-row">
        <div className="pid-seller-info">
          {sellerAvatarUrl ? (
            <img src={sellerAvatarUrl} alt={sellerName} className="pid-seller-avatar" />
          ) : (
            <div className="pid-seller-avatar-placeholder"></div>
          )}
          <span className="pid-seller-name">{sellerName}</span>
        </div>
        <h4 className="pid-price">{product.price.toFixed(2)}€</h4>
      </div>

      {/* Reintroducir la descripción desplegable */}
      {product.description && (
        <details className="pid-description-details" style={{ marginTop: '1rem' }}> {/* Añadir margen superior */}
          <summary className="pid-description-summary">
            Descripción del producto
          </summary>
          <div className="pid-description-content">
            {product.description.split('\n').map((paragraph: string, index: number) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </details>
      )}

      {/* Botón de compra */}
      <button 
        className="btn btn-primary mt-3 pid-buy-button"
        onClick={handleBuyNow}
        disabled={isLoading}
      >
        {isLoading ? 'Procesando...' : 'Comprar Ahora'}
      </button>

      {/* Mensaje de error si falla el checkout */}
      {error && (
        <div className="pid-error-message mt-2">
          {error}
        </div>
      )}

      {/* Información sobre procesamiento de pago */}
      <div className="pid-payment-info mt-3">
        <small>Pago seguro procesado por Stripe</small>
      </div>
    </div>
  );
};

export default ProductInfoDisplay; 