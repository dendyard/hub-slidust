import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SlidNotePreview from './pages/SlidNotePreview.jsx'
import FlowPreview from './pages/FlowPreview.jsx'
import { DataProvider } from './context/DataContext'

const notePreviewMatch = window.location.pathname.match(/^\/slidnote\/preview\/([^/]+)\/?$/)
const flowPreviewMatch = window.location.pathname.match(/^\/flow\/preview\/([^/]+)\/?$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {notePreviewMatch ? (
      <SlidNotePreview docId={notePreviewMatch[1]} />
    ) : flowPreviewMatch ? (
      <FlowPreview flowId={flowPreviewMatch[1]} />
    ) : (
      <DataProvider>
        <App />
      </DataProvider>
    )}
  </StrictMode>,
)
