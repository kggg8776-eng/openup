const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export interface AuthUser {
  id: string
  displayName: string
  isGuest: boolean
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.toString() ?? `Request failed (${res.status})`)
  }
  return data as T
}

export function guestLogin(displayName?: string) {
  return request<AuthResponse>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  })
}

export function register(email: string, password: string, displayName: string) {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  })
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function reportUser(token: string, reportedUserId: string, reason: string) {
  return request<{ ok: true; reportCount: number }>(
    '/api/report',
    { method: 'POST', body: JSON.stringify({ reportedUserId, reason }) },
    token,
  )
}

export function blockUser(token: string, blockedUserId: string) {
  return request<{ ok: true }>(
    '/api/block',
    { method: 'POST', body: JSON.stringify({ blockedUserId }) },
    token,
  )
}

export interface IceServersResponse {
  iceServers: RTCIceServer[]
}

export function getIceServers() {
  return request<IceServersResponse>('/api/ice-servers')
}
