import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SlidNotePreview from './pages/SlidNotePreview.jsx'
import { DataProvider } from './context/DataContext'

const previewMatch = window.location.pathname.match(/^\/slidnote\/preview\/([^/]+)\/?$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {previewMatch ? (
      <SlidNotePreview docId={previewMatch[1]} />
    ) : (
      <DataProvider>
        <App />
      </DataProvider>
    )}
  </StrictMode>,
)
