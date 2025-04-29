import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged,
  signOut,
  getIdTokenResult
} from 'firebase/auth';
// Importar firestore y db
import { doc, onSnapshot, DocumentData, Timestamp, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'; // Importar Timestamp
import { auth, db } from '../firebase/config';

// Definir los posibles planes
export type PlanType = 'FREE' | 'BASIC' | 'PRO' | 'ADMIN';

// Tipo para los datos del perfil de usuario en Firestore
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  username: string;
  bio: string;
  links: any[]; // Ajustar tipo si es necesario
  products: any[]; // Ajustar tipo si es necesario
  stripeConnected: boolean;
  plan: PlanType; // Mantenemos el plan en Firestore por si acaso, pero effectivePlan usará claims
  planExpirationDate: Timestamp | null; // Ya no se usará para effectivePlan
  createdAt: Timestamp; // Usar Timestamp
  // Añadir otros campos si existen
}

// Definición del tipo para el contexto
interface AuthContextType {
  user: User | null; // Usuario de Firebase Auth
  profile: UserProfile | null; // Perfil de Firestore
  loadingAuth: boolean; // Estado de carga de Auth
  loadingProfile: boolean; // Estado de carga del Perfil
  effectivePlan: PlanType; // Plan efectivo actual del usuario
  logout: () => Promise<void>;
}

// Valor por defecto
const defaultContext: AuthContextType = {
  user: null,
  profile: null,
  loadingAuth: true,
  loadingProfile: true,
  effectivePlan: 'FREE',
  logout: async () => {},
};

// Crear el contexto
const AuthContext = createContext<AuthContextType>(defaultContext);

// Hook personalizado para usar el contexto
export const useAuth = () => useContext(AuthContext);

// Proveedor del contexto
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [effectivePlan, setEffectivePlan] = useState<PlanType>('FREE');

  // Efecto para escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      
      if (!currentUser) {
        setProfile(null);
        setLoadingProfile(false); 
        setEffectivePlan('FREE');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Efecto para escuchar cambios en el perfil de Firestore del usuario logueado
  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined = undefined;

    if (user) {
      setLoadingProfile(true); 
      const userDocRef = doc(db, 'users', user.uid);
      
      // Asignar la función de desuscripción devuelta por onSnapshot
      unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          console.warn(`Documento no encontrado para el usuario ${user.uid}`);
          setProfile(null); 
        }
        setLoadingProfile(false);
      }, (error) => {
        console.error("Error al escuchar perfil:", error);
        setProfile(null);
        setLoadingProfile(false);
      });

    } else {
      // Limpiar perfil y estado de carga si no hay usuario
      setProfile(null);
      setLoadingProfile(false);
    }

    // La función de limpieza se ejecuta cuando el componente se desmonta O ANTES de que el efecto se re-ejecute debido a un cambio en `user`
    return () => {
      if (unsubscribeProfile) {
        // Llamar a la función de desuscripción si existe
        unsubscribeProfile(); 
      }
    };
  }, [user]); // Dependencia: user

  // Efecto para calcular el plan efectivo BASADO EN CUSTOM CLAIMS
  useEffect(() => {
    // Si no hay usuario o Auth todavía está cargando, no hacemos nada (o ponemos FREE)
    if (!user || loadingAuth) {
      if (!user) setEffectivePlan('FREE'); 
      return; 
    }

    // Forzar actualización del token para obtener los claims más recientes
    user.getIdTokenResult(true) // true fuerza el refresco
      .then((idTokenResult) => {
        const claims = idTokenResult.claims;
        const stripeRole = claims.stripeRole as string | undefined; // Obtener el claim

        console.log("Custom Claims obtenidos:", claims);
        console.log("Stripe Role Claim:", stripeRole);

        // Determinar plan efectivo basado en el claim
        let calculatedPlan: PlanType = 'FREE'; // Default
        
        // Comprobar roles de Stripe
        if (stripeRole === 'pro') {
          calculatedPlan = 'PRO';
        } else if (stripeRole === 'basic') {
          calculatedPlan = 'BASIC';
        } 
        // Si no es pro ni basic, se queda en FREE (o lo que se haya puesto en chequeo ADMIN)

        console.log("Plan efectivo calculado desde Claims:", calculatedPlan);
        setEffectivePlan(calculatedPlan);
      })
      .catch((error) => {
        console.error("Error al obtener ID token result o claims:", error);
        // Si hay error obteniendo claims, por seguridad poner FREE
        setEffectivePlan('FREE');
      });

  }, [user, loadingAuth]); // Depende del usuario y del estado de carga de Auth

  // Función de cierre de sesión
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Valor proporcionado por el contexto
  const value = {
    user,
    profile,
    loadingAuth,
    loadingProfile,
    effectivePlan,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider; 