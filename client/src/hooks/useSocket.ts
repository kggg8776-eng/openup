import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createSocket } from '../lib/socket'

export function useSocket(token: string | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setSocket(null)
      return
    }

    const s = createSocket(token)
    socketRef.current = s
    s.connect()
    setSocket(s)

    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [token])

  return socket
}
