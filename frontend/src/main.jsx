import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, createConfig, WagmiProvider } from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import App from './App.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Verify from './pages/Verify.jsx'
import Portfolio from './pages/Portfolio.jsx'
import './index.css'

// 1. Set up Wagmi config targeting Polygon Amoy
const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: http(),
  },
})

// 2. Set up Query Client for TanStack Query
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/verify/:id" element={<Verify />} />
            <Route path="/portfolio/:slug" element={<Portfolio />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
