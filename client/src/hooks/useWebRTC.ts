import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { getIceServers } from '../lib/api'

export interface Partner {
  userId: string
  displayName: string
}

export type CallStatus = 'idle' | 'searching' | 'connecting' | 'in_call'

export interface ChatMessage {
  from: string
  message: string
  self: boolean
}

interface SignalPayload {
  type: 'offer' | 'answer' | 'ice'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export function useWebRTC(socket: Socket | null) {
  const [status, setStatus] = useState<CallStatus>('idle')
  const [partner, setPartner] = useState<Partner | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }])

  useEffect(() => {
    getIceServers()
      .then((res) => {
        iceServersRef.current = res.iceServers
      })
      .catch(() => {
        /* fall back to default STUN already set above */
      })
  }, [])

  const cleanupPeer = useCallback(() => {
    peerRef.current?.close()
    peerRef.current = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
  }, [])

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream
    return stream
  }, [])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', { type: 'ice', candidate: event.candidate })
      }
    }
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('in_call')
    }

    const stream = localStreamRef.current
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream))

    peerRef.current = pc
    return pc
  }, [socket])

  const startSearch = useCallback(async () => {
    if (!socket) return
    await ensureLocalStream()
    setMessages([])
    setPartner(null)
    setStatus('searching')
    socket.emit('find_match')
  }, [socket, ensureLocalStream])

  const skip = useCallback(() => {
    cleanupPeer()
    setPartner(null)
    setMessages([])
    setStatus('searching')
    socket?.emit('skip')
  }, [socket, cleanupPeer])

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !socket) return
      socket.emit('chat_message', text)
      setMessages((prev) => [...prev, { from: 'You', message: text, self: true }])
    },
    [socket],
  )

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicOn(track.enabled)
  }, [])

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraOn(track.enabled)
  }, [])

  useEffect(() => {
    if (!socket) return

    const onWaiting = () => setStatus('searching')

    const onMatched = async ({
      partner: matchedPartner,
      isInitiator,
    }: {
      roomId: string
      partner: Partner
      isInitiator: boolean
    }) => {
      setPartner(matchedPartner)
      setStatus('connecting')
      await ensureLocalStream()
      const pc = createPeerConnection()

      if (isInitiator) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('signal', { type: 'offer', sdp: offer })
      }
    }

    const onSignal = async (data: SignalPayload) => {
      const pc = peerRef.current
      if (!pc) return
      if (data.type === 'offer' && data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('signal', { type: 'answer', sdp: answer })
      } else if (data.type === 'answer' && data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
      } else if (data.type === 'ice' && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch {
          // Late/duplicate ICE candidates can safely be ignored.
        }
      }
    }

    const onPartnerGone = () => {
      cleanupPeer()
      setPartner(null)
      setMessages([])
      setStatus('searching')
      socket.emit('find_match')
    }

    const onChatMessage = ({ from, message }: { from: string; message: string }) => {
      setMessages((prev) => [...prev, { from, message, self: false }])
    }

    socket.on('waiting', onWaiting)
    socket.on('matched', onMatched)
    socket.on('signal', onSignal)
    socket.on('partner_left', onPartnerGone)
    socket.on('partner_skipped', onPartnerGone)
    socket.on('chat_message', onChatMessage)

    return () => {
      socket.off('waiting', onWaiting)
      socket.off('matched', onMatched)
      socket.off('signal', onSignal)
      socket.off('partner_left', onPartnerGone)
      socket.off('partner_skipped', onPartnerGone)
      socket.off('chat_message', onChatMessage)
    }
  }, [socket, ensureLocalStream, createPeerConnection, cleanupPeer])

  const stopAll = useCallback(() => {
    cleanupPeer()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setStatus('idle')
    setPartner(null)
  }, [cleanupPeer])

  return {
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
  }
}
