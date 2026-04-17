import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { WorkflowPage } from './pages/WorkflowPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { removeSampleProject } from './data/sampleProject'
import './index.css'

removeSampleProject()

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: 14,
      }}>
        로딩 중...
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/new-project" element={<ProtectedRoute><NewProjectPage /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
      <Route path="/workflow" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
