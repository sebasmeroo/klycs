import { Routes, Route, Navigate } from 'react-router-dom'
// Quitar imports y estado local que manejará AuthProvider
// import { useEffect, useState } from 'react'
// import { onAuthStateChanged } from 'firebase/auth'
// import { auth, db } from './firebase/config'
// import { doc, getDoc } from 'firebase/firestore'

// Importar AuthProvider
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
// import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import LinkManagerPage from './pages/LinkManager'
import UserProfile from './pages/UserProfile'
import CardEditor from './pages/CardEditor'

// Components
import ProtectedRoute from './components/routes/ProtectedRoute'
import Header from './components/header'

// Componente Loader separado para claridad
const AppLoader = () => (
  <div className="loader-container">
    <div className="loader"></div>
    <p className="mt-3 text-center">Cargando aplicación...</p>
  </div>
)

// Componente principal de la aplicación con rutas
function AppContent() {
  const { loadingAuth, loadingProfile, user, profile } = useAuth(); // Obtener profile también si Header lo necesita

  if (loadingAuth || loadingProfile) {
    return <AppLoader />;
  }
  
  return (
    <>
      {/* Pasar user (o profile) a Header */}
      {/* Si Header solo necesita el objeto User de Auth, pasar user */}
      {/* Si Header necesita displayName u otros datos del perfil, pasar profile */}
      {/* Asumiremos que necesita profile por ahora */}
      <Header user={profile} /> 
      <Routes>
        {/* Pasar user a ProtectedRoute */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute user={user}>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/links" 
          element={
            <ProtectedRoute user={user}>
              <LinkManagerPage />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/card/edit/:cardId"
          element={
            <ProtectedRoute user={user}>
              <CardEditor />
            </ProtectedRoute>
          }
        />
        {/* Rutas públicas no necesitan ProtectedRoute */}
        <Route path="/:username" element={<UserProfile />} />
        <Route path="/:username/card/:cardId" element={<UserProfile />} />
        <Route path="/:username/product/:productId" element={<UserProfile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

// Componente App raíz que incluye el AuthProvider
function App() {
  return (
    // Envolvemos toda la app con AuthProvider
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
