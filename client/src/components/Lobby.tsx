import { useState } from 'react'
import { guestLogin, login, register } from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Mode = 'guest' | 'login' | 'register'

export function Lobby() {
  const { setAuth } = useAuth()
  const [mode, setMode] = useState<Mode>('guest')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGuest = async () => {
    setLoading(true)
    setError(null)
    try {
      const { token, user } = await guestLogin(displayName || undefined)
      setAuth(token, user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async () => {
    setLoading(true)
    setError(null)
    try {
      const { token, user } =
        mode === 'login' ? await login(email, password) : await register(email, password, displayName)
      setAuth(token, user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900/60 p-8 shadow-xl ring-1 ring-white/10">
        <h1 className="mb-1 text-center text-3xl font-bold text-white">🎤 OpenUp</h1>
        <p className="mb-6 text-center text-sm text-gray-400">
          Talk to random strangers over video, instantly.
        </p>

        <div className="mb-4 flex rounded-lg bg-gray-800 p-1 text-sm">
          {(['guest', 'login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 capitalize transition ${
                mode === m ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode !== 'login' && (
            <input
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-purple-500"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          {mode !== 'guest' && (
            <>
              <input
                className="w-full rounded-lg bg-gray-800 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-purple-500"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full rounded-lg bg-gray-800 px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-purple-500"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          disabled={loading}
          onClick={mode === 'guest' ? handleGuest : handleAuth}
          className="mt-5 w-full rounded-lg bg-purple-600 py-2.5 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Please wait…' : mode === 'guest' ? 'Start Chatting' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>

        <p className="mt-4 text-center text-xs text-gray-500">
          By continuing you agree this is a demo app — be respectful to others.
        </p>
      </div>
    </div>
  )
}
