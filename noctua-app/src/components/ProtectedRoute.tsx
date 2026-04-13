import { Navigate } from 'react-router-dom'
import { usePermissions } from '../hooks/usePermissions'

interface ProtectedRouteProps {
  page: string
  children: React.ReactNode
}

export default function ProtectedRoute({ page, children }: ProtectedRouteProps) {
  const { can } = usePermissions()

  if (!can(page)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}