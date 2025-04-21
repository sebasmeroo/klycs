import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './firebase/config'
import { doc, getDoc } from 'firebase/firestore'

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

function App() {
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      
      if (currentUser) {
        try {
          // Obtener datos adicionales del usuario desde Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error('Error al cargar datos del usuario:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p className="mt-3 text-center">Cargando aplicación...</p>
      </div>
    )
  }

  return (
    <>
      {/* No mostrar el header en la página de perfil */}
      <Routes>
        <Route path="/" element={
          <>
            <Header user={userData} />
            <Home user={userData} />
          </>
        } />
        <Route path="/login" element={
          <>
            <Header user={userData} />
            <Login />
          </>
        } />
        <Route path="/register" element={
          <>
            <Header user={userData} />
            <Register />
          </>
        } />
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
        <Route path="/:username" element={<UserProfile />} />
        <Route path="/:username/card/:cardId" element={<UserProfile />} />
        <Route path="/:username/product/:productId" element={<UserProfile />} />
        <Route path="*" element={
          <>
            <Header user={userData} />
            <NotFound />
          </>
        } />
      </Routes>
    </>
  )
}

export default App
