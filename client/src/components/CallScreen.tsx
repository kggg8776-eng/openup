import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { useWebRTC } from '../hooks/useWebRTC'
import { blockUser, reportUser } from '../lib/api'

export function CallScreen() {
  const { token, user, clearAuth } = useAuth()
  const socket = useSocket(token)
  const {
    status,
    partner,
    messages,
    micOn,
    cameraOn,
    localVideoRef,
    remoteVideoRef,
    startSearch,
    skip,
    sendMessage,
    toggleMic,
    toggleCamera,
    stopAll,
  } = useWebRTC(socket)

  const [chatInput, setChatInput] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  useEffect(() => {
    if (socket) startSearch()
    return () => stopAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(chatInput)
    setChatInput('')
  }

  const handleReport = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !partner) return
    try {
      await reportUser(token, partner.userId, reportReason || 'Inappropriate behavior')
      setActionMessage('Report submitted. Skipping to next stranger.')
      setReportOpen(false)
      setReportReason('')
      skip()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to report')
    }
  }

  const handleBlock = async () => {
    if (!token || !partner) return
    try {
      await blockUser(token, partner.userId)
      setActionMessage('User blocked. You will not be matched with them again.')
      skip()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to block')
    }
  }

  const statusLabel: Record<string, string> = {
    idle: 'Starting…',
    searching: 'Looking for a stranger…',
    connecting: 'Connecting…',
    in_call: partner ? `Chatting with ${partner.displayName}` : 'Connected',
  }

  return (
    <div className="flex h-full flex-col bg-gray-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-semibold">🎤 OpenUp</span>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>{user?.displayName}</span>
          <button onClick={clearAuth} className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700">
            Leave
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        <div className="relative flex-1 overflow-hidden rounded-xl bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm">
            {statusLabel[status]}
          </div>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-3 right-3 h-32 w-48 rounded-lg border border-white/20 object-cover shadow-lg"
          />

          <div className="absolute bottom-3 left-3 flex gap-2">
            <button
              onClick={toggleMic}
              className={`rounded-full px-3 py-2 text-sm ${micOn ? 'bg-gray-800' : 'bg-red-600'}`}
            >
              {micOn ? '🎙️ Mic' : '🔇 Muted'}
            </button>
            <button
              onClick={toggleCamera}
              className={`rounded-full px-3 py-2 text-sm ${cameraOn ? 'bg-gray-800' : 'bg-red-600'}`}
            >
              {cameraOn ? '📷 Camera' : '🚫 Camera off'}
            </button>
          </div>
        </div>

        <div className="flex w-full flex-col rounded-xl bg-gray-900/60 lg:w-80">
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && <p className="text-gray-500">No messages yet. Say hi!</p>}
            {messages.map((m, i) => (
              <div key={i} className={m.self ? 'text-right' : 'text-left'}>
                <span className="text-xs text-gray-500">{m.from}</span>
                <p
                  className={`inline-block rounded-lg px-3 py-1.5 ${
                    m.self ? 'bg-purple-600' : 'bg-gray-800'
                  }`}
                >
                  {m.message}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-purple-500"
            />
            <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-700">
              Send
            </button>
          </form>
        </div>
      </div>

      {actionMessage && (
        <div className="mx-4 mb-2 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300">{actionMessage}</div>
      )}

      <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 p-4">
        <button
          onClick={skip}
          className="rounded-lg bg-purple-600 px-6 py-2.5 font-semibold hover:bg-purple-700"
        >
          Next ⏭
        </button>
        <button
          disabled={!partner}
          onClick={() => setReportOpen(true)}
          className="rounded-lg bg-gray-800 px-5 py-2.5 font-semibold hover:bg-gray-700 disabled:opacity-40"
        >
          Report 🚩
        </button>
        <button
          disabled={!partner}
          onClick={handleBlock}
          className="rounded-lg bg-gray-800 px-5 py-2.5 font-semibold hover:bg-gray-700 disabled:opacity-40"
        >
          Block 🚫
        </button>
      </footer>

      {reportOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleReport}
            className="w-full max-w-sm rounded-xl bg-gray-900 p-6 ring-1 ring-white/10"
          >
            <h2 className="mb-3 text-lg font-semibold">Report this user</h2>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What happened?"
              className="h-24 w-full rounded-lg bg-gray-800 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-purple-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700">
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
