import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { WorkflowPage } from './pages/WorkflowPage'
import { SettingsPage } from './pages/SettingsPage'
import { TestPage } from './pages/TestPage'
import { removeSampleProject } from './data/sampleProject'
import { clearStaleCollaborationStatuses } from './lib/storage'
import './index.css'

removeSampleProject()
// 페이지 새로고침/탭 닫기로 in-memory 협업 러너가 죽었어도 localStorage 에 active=true 가
// 그대로 남아 "협업 진행중" 카드가 stale 하게 보이는 문제 방지.
clearStaleCollaborationStatuses()

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/new-project" element={<ProtectedRoute><NewProjectPage /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
      <Route path="/workflow" element={<ProtectedRoute><WorkflowPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/test" element={<TestPage />} />
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
