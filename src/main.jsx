import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ReactGA from 'react-ga4'
import App from './App.jsx'
import './index.css'
import { ToastProvider } from './components/ToastProvider.jsx'

// Initialize Google Analytics with your Measurement ID
// You can replace 'G-XXXXXXXXXX' with your actual ID or use an environment variable
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-XXXXXXXXXX";
ReactGA.initialize(MEASUREMENT_ID);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
