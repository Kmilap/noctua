import { useAuth } from './useAuth'

type Role = 'admin' | 'operator' | 'viewer'

const permissions: Record<Role, string[]> = {
  admin:    ['dashboard', 'services', 'alert-rules', 'incidents', 'channels', 'team'],
  operator: ['dashboard', 'services', 'alert-rules', 'incidents'],
  viewer:   ['dashboard', 'services', 'incidents'],
}

export function usePermissions() {
  const { user } = useAuth()

  const role: Role = (user?.roles?.[0]?.name as Role) ?? 'viewer'

  const allowedPages = permissions[role] ?? permissions.viewer

  const can = (page: string): boolean => allowedPages.includes(page)

  return { role, allowedPages, can }
}