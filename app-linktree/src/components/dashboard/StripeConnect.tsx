import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './StripeConnect.css'; // Asegúrate de crear este archivo CSS

interface StripeConnectProps {
  userData: any;
}

const StripeConnect: React.FC<StripeConnectProps> = ({ userData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [connected, setConnected] = useState(false);
  // Mostramos la tasa de comisión pero no permitimos cambiarla por ahora
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [commissionRate, setCommissionRate] = useState(5); // Porcentaje de comisión predeterminado

  // Estado para rastrear el uso de Stripe Connect (más moderno) vs API Keys (forma básica)
  const [useStripeConnect, setUseStripeConnect] = useState(true);
  const [stripeConnectLoading, setStripeConnectLoading] = useState(false);

  // Cargar el estado de conexión de Stripe cuando se monta el componente
  useEffect(() => {
    if (userData) {
      // Determinar qué tipo de conexión se está utilizando
      if (userData.stripeAccountId) {
        setUseStripeConnect(true);
        setConnected(userData.stripeConnected || false);
      } else if (userData.stripePublicKey) {
        setUseStripeConnect(false);
        setConnected(userData.stripeConnected || false);
        setPublicKey(userData.stripePublicKey);
        
        if (userData.stripeSecretKey) {
          // Por seguridad, no mostramos la clave secreta completa
          setSecretKey('****************************************');
        }
      } else {
        // No hay ninguna conexión establecida aún
        setConnected(false);
      }
    }
  }, [userData]);

  // Guardar claves de Stripe en Firestore (método tradicional)
  const saveStripeKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData || !userData.uid) return;
    
    if (!publicKey.trim()) {
      setError('Debes proporcionar tu clave pública de Stripe.');
      return;
    }
    
    // Validación básica de formato de clave pública de Stripe
    if (!publicKey.startsWith('pk_')) {
      setError('La clave pública debe comenzar con "pk_".');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const userDocRef = doc(db, 'users', userData.uid);
      
      // Actualizar el documento del usuario con las claves de Stripe
      await updateDoc(userDocRef, {
        stripePublicKey: publicKey,
        stripeSecretKey: secretKey === '****************************************' ? userData.stripeSecretKey : secretKey,
        stripeConnected: true,
        stripeConnectedAt: new Date()
      });
      
      setConnected(true);
      setSuccess('Conexión con Stripe configurada correctamente.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      console.error('Error al guardar las claves de Stripe:', error);
      setError('Error al conectar con Stripe. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Iniciar el proceso de Stripe Connect (método moderno y recomendado)
  const initiateStripeConnect = async () => {
    if (!userData?.uid) return;
    
    setStripeConnectLoading(true);
    setError(null);
    
    try {
      const functions = getFunctions();
      const createStripeConnectAccountLink = httpsCallable(functions, 'createStripeConnectAccountLink');
      
      const result = await createStripeConnectAccountLink({});
      const data = result.data as any;
      
      if (data?.url) {
        // Redirigir al usuario a la página de onboarding de Stripe
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió URL de Stripe Connect');
      }
    } catch (error: any) {
      console.error('Error al iniciar Stripe Connect:', error);
      setError('Error al conectar con Stripe: ' + (error.message || 'Intenta de nuevo más tarde'));
    } finally {
      setStripeConnectLoading(false);
    }
  };

  // Desconectar Stripe usando la función Firebase (para Stripe Connect)
  const disconnectStripeConnect = async () => {
    if (!userData?.uid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const functions = getFunctions();
      const disconnectStripeAccount = httpsCallable(functions, 'disconnectStripeAccount');
      
      await disconnectStripeAccount({});
      
      setConnected(false);
      setSuccess('Conexión con Stripe desactivada correctamente.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      console.error('Error al desconectar Stripe Connect:', error);
      setError('Error al desconectar Stripe: ' + (error.message || 'Intenta de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  // Desconectar Stripe (método tradicional con claves API)
  const disconnectStripe = async () => {
    if (!userData || !userData.uid) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const userDocRef = doc(db, 'users', userData.uid);
      
      // Actualizar el documento del usuario para eliminar las claves de Stripe
      await updateDoc(userDocRef, {
        stripePublicKey: null,
        stripeSecretKey: null,
        stripeConnected: false,
        stripeDisconnectedAt: new Date()
      });
      
      setConnected(false);
      setPublicKey('');
      setSecretKey('');
      setSuccess('Conexión con Stripe desactivada correctamente.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      console.error('Error al desconectar Stripe:', error);
      setError('Error al desconectar Stripe. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stripe-connect-container">
      <h2 className="mb-4">Conectar con Stripe</h2>
      
      {/* Mensajes de error y éxito */}
      {error && (
        <div className="alert alert-error mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success mb-4">
          {success}
        </div>
      )}
      
      {/* Estado de conexión */}
      <div className="card mb-4">
        <h3 className="mb-3">Estado de conexión</h3>
        <div className="d-flex align-center gap-2 mb-3">
          <div className={`status-indicator ${connected ? 'status-active' : 'status-inactive'}`}></div>
          <p>{connected ? 'Conectado a Stripe' : 'No conectado a Stripe'}</p>
        </div>
        
        {connected && useStripeConnect && (
          <div>
            <p className="mb-2"><strong>Cuenta Stripe Connect:</strong> Conectada y activa</p>
            <p className="mb-3 text-secondary">Tu cuenta de Stripe está conectada. Puedes recibir pagos y configurar tu dashboard en Stripe.</p>
            
            <button 
              type="button" 
              className="btn btn-danger"
              onClick={disconnectStripeConnect}
              disabled={loading}
            >
              {loading ? 'Desconectando...' : 'Desconectar Stripe'}
            </button>
          </div>
        )}

        {connected && !useStripeConnect && (
          <div>
            <p className="mb-2"><strong>Clave pública:</strong> {publicKey.substring(0, 8)}...{publicKey.substring(publicKey.length - 4)}</p>
            <p className="mb-3 text-secondary">Tus pagos están configurados y listos para usar.</p>
            
            <button 
              type="button" 
              className="btn btn-danger"
              onClick={disconnectStripe}
              disabled={loading}
            >
              {loading ? 'Desconectando...' : 'Desconectar Stripe'}
            </button>
          </div>
        )}
      </div>
      
      {/* Método de conexión recomendado: Stripe Connect */}
      {!connected && (
        <div className="card mb-4">
          <h3 className="mb-3">Configurar Stripe Connect (Recomendado)</h3>
          <p className="mb-3">
            Conecta tu cuenta de Stripe utilizando Stripe Connect para procesar pagos de forma segura y recibir transferencias automáticas.
          </p>
          
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={initiateStripeConnect}
            disabled={stripeConnectLoading}
          >
            {stripeConnectLoading ? 'Iniciando conexión...' : 'Conectar con Stripe'}
          </button>
          
          <p className="mt-3 text-secondary">
            Serás redirigido/a a Stripe para completar la configuración de tu cuenta.
          </p>
        </div>
      )}
      
      {/* Método alternativo: API Keys (menos recomendado) */}
      {!connected && (
        <form onSubmit={saveStripeKeys} className="card mb-4">
          <h3 className="mb-3">Configurar acceso a Stripe con API Keys (Alternativo)</h3>
          
          <div className="form-group">
            <label htmlFor="publicKey">Clave pública de Stripe (pk_...)</label>
            <input
              type="text"
              id="publicKey"
              className="form-control"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="pk_test_..."
              required
            />
            <small className="form-help-text">
              Encuentra tus claves API en el <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">Panel de Stripe</a>
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="secretKey">Clave secreta de Stripe (sk_...)</label>
            <input
              type="password"
              id="secretKey"
              className="form-control"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sk_test_..."
              required
            />
            <small className="form-help-text">
              ¡Nunca compartas tu clave secreta! Se almacenará de forma segura.
            </small>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Conectando...' : 'Conectar con Stripe'}
          </button>
        </form>
      )}
      
      {/* Información sobre comisiones */}
      <div className="card mb-4">
        <h3 className="mb-3">Comisiones y pagos</h3>
        <p className="mb-3">
          Al conectar tu cuenta de Stripe, aceptas que cobremos una comisión del {commissionRate}% por cada transacción procesada a través de tu enlace de Linktree.
        </p>
        
        <div className="alert alert-info">
          <strong>¿Cómo funciona?</strong>
          <ul className="mt-2">
            <li>Tus clientes pagan a través de Stripe cuando compran tus productos</li>
            <li>Nosotros retenemos el {commissionRate}% como comisión por el servicio</li>
            <li>El {100 - commissionRate}% restante se transfiere directamente a tu cuenta Stripe</li>
            <li>Los pagos se procesan automáticamente y puedes realizar seguimiento en tu dashboard de Stripe</li>
          </ul>
        </div>
      </div>
      
      {/* Recursos y ayuda */}
      <div className="card">
        <h3 className="mb-3">Recursos y soporte</h3>
        <ul>
          <li><a href="https://stripe.com/docs" target="_blank" rel="noopener noreferrer">Documentación de Stripe</a></li>
          <li><a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">Panel de control de Stripe</a></li>
          <li><a href="#" target="_blank" rel="noopener noreferrer">Centro de ayuda</a></li>
          <li><a href="#" target="_blank" rel="noopener noreferrer">Contactar con soporte</a></li>
        </ul>
      </div>
    </div>
  );
};

export default StripeConnect; 