import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Timestamp } from 'firebase/firestore';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Actualizar perfil con displayName
      await updateProfile(user, {
        displayName
      });

      // Crear documento del usuario en Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName,
        photoURL: '',
        username: '',
        bio: '',
        links: [],
        products: [],
        stripeConnected: false,
        plan: 'FREE',
        planExpirationDate: null,
        createdAt: Timestamp.now()
      });

      // Redirigir al dashboard
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error en registro:', error);
      
      // Manejar errores comunes con mensajes amigables
      if (error.code === 'auth/email-already-in-use') {
        setError('Este correo electrónico ya está en uso');
      } else if (error.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil. Debe tener al menos 6 caracteres');
      } else {
        setError(error.message || 'Ha ocurrido un error durante el registro');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-container">
      <div className="card">
        <h2 className="mb-4 text-center">Crear una cuenta</h2>
        
        {error && (
          <div className="alert alert-error mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Nombre</label>
            <input
              type="text"
              id="displayName"
              className="form-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <small className="form-help-text">
              La contraseña debe tener al menos 6 caracteres
            </small>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary w-full mt-4"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>
        
        <div className="text-center mt-4">
          ¿Ya tienes una cuenta? <Link to="/login">Iniciar sesión</Link>
        </div>
      </div>
    </div>
  );
};

export default Register; 