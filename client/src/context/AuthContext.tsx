import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '../lib/api'

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEY = 'openup-auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw).token as string) : null
  })
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw).user as AuthUser) : null
  })

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      setAuth: (newToken, newUser) => {
        setToken(newToken)
        setUser(newUser)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }))
      },
      clearAuth: () => {
        setToken(null)
        setUser(null)
        localStorage.removeItem(STORAGE_KEY)
      },
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
