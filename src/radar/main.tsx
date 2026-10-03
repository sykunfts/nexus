import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RadarApp } from './RadarApp'
import '../styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RadarApp />
  </StrictMode>,
)
