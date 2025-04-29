import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
// import './components/userlink/UserLinks.css' // Eliminado - Ya no existe
import App from './App.tsx'
import 'bootstrap/dist/css/bootstrap.min.css'; // Mantener CSS de Bootstrap si se usa
// Quitar import de JS de bootstrap si no se necesita explícitamente aquí

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
