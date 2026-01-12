import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Servers from './pages/Servers'
import ServerDetail from './pages/ServerDetail'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import Databases from './pages/Databases'
import DatabaseDetail from './pages/DatabaseDetail'
import Sites from './pages/Sites'
import SiteDetail from './pages/SiteDetail'
import Applications from './pages/Applications'
import ApplicationDetail from './pages/ApplicationDetail'
import Credentials from './pages/Credentials'
import BackupRestore from './pages/BackupRestore'
import NetworkConfig from './pages/NetworkConfig'
import Settings from './pages/Settings'
import Users from './pages/Users'
import OperationLogs from './pages/OperationLogs'
import Layout from './components/Layout'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sites" element={<Sites />} />
            <Route path="sites/:id" element={<SiteDetail />} />
            <Route path="servers" element={<Servers />} />
            <Route path="servers/:id" element={<ServerDetail />} />
            <Route path="devices" element={<Devices />} />
            <Route path="devices/:id" element={<DeviceDetail />} />
            <Route path="databases" element={<Databases />} />
            <Route path="databases/:id" element={<DatabaseDetail />} />
            <Route path="applications" element={<Applications />} />
            <Route path="applications/:id" element={<ApplicationDetail />} />
            <Route path="credentials" element={<Credentials />} />
            <Route path="backup" element={<BackupRestore />} />
            <Route path="network" element={<NetworkConfig />} />
            <Route path="settings" element={<Settings />} />
            <Route path="users" element={<Users />} />
            <Route path="logs" element={<OperationLogs />} />
          </Route>
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App

