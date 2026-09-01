import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './public.css'
import './mobile.css'
import RootApp from './RootApp.jsx'

// Merender aplikasi React sekali pada elemen root di index.html.
createRoot(document.getElementById('root')).render(
  // StrictMode membantu menemukan efek samping saat pengembangan.
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
