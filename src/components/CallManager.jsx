/**
 * @deprecated LEGACY — do not mount.
 * Production call path: CallContext + useWebRTC (ChatCallHost) + GlobalCallListener.
 * This file uses the old `call_signals` table and a separate PC stack.
 * Kept only for reference; remove when confirmed unused.
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ICE_SERVERS, generateCallId } from '../lib/webrtc'

export default function CallManager({ currentUser, otherUser, onClose }) {
  useEffect(() => {
    console.warn('[CallManager] DEPRECATED — use ChatCallHost / GlobalCallListener instead')
  }, [])
  const [callState, setCallState] = useState('idle') // idle|calling|receiving|in-call
  const [callType, setCallType] = useState(null)
  const [callId, setCallId] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [duration, setDuration] = useState(0)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const channelRef = useRef(null)
  const timerRef = useRef(null)
  const pendingCandidates = useRef([])
  const incomingOfferRef = useRef(null)

  useEffect(() => {
    subscribeToSignals()
    return () => cleanup()
  }, [])

  function subscribeToSignals() {
    const channel = supabase.channel(`calls_${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `to_user=eq.${currentUser.id}`
      }, ({ new: sig }) => handleSignal(sig))
      .subscribe()
    channelRef.current = channel
  }

  async function handleSignal(sig) {
    if (sig.type === 'ring') {
      setCallId(sig.call_id)
      setCallType(sig.payload.callType)
      incomingOfferRef.current = sig.payload.offer
      setCallState('receiving')
      playRing()
    }
    if (sig.type === 'answer' && pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.payload.answer))
      for (const c of pendingCandidates.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(c))
      }
      pendingCandidates.current = []
      setCallState('in-call')
      startTimer()
    }
    if (sig.type === 'ice' && pcRef.current) {
      try {
        if (pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.payload.candidate))
        } else {
          pendingCandidates.current.push(sig.payload.candidate)
        }
      } catch (e) {}
    }
    if (sig.type === 'hangup') {
      endCallLocally()
    }
    if (sig.type === 'decline') {
      endCallLocally()
    }
  }

  async function sendSignal(type, payload = {}) {
    await supabase.from('call_signals').insert({
      call_id: callId,
      from_user: currentUser.id,
      to_user: otherUser.id,
      type,
      payload
    })
  }

  async function startCall(type) {
    setCallType(type)
    const id = generateCallId(currentUser.id, otherUser.id)
    setCallId(id)
    setCallState('calling')
    playRing()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = e => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }
    pc.onicecandidate = async e => {
      if (e.candidate) {
        await supabase.from('call_signals').insert({
          call_id: id,
          from_user: currentUser.id,
          to_user: otherUser.id,
          type: 'ice',
          payload: { candidate: e.candidate }
        })
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await supabase.from('call_signals').insert({
      call_id: id,
      from_user: currentUser.id,
      to_user: otherUser.id,
      type: 'ring',
      payload: { offer, callType: type }
    })
  }

  async function answerCall() {
    stopRing()
    setCallState('in-call')

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
    })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = e => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }
    pc.onicecandidate = async e => {
      if (e.candidate) {
        await sendSignal('ice', { candidate: e.candidate })
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await sendSignal('answer', { answer })
    startTimer()
  }

  async function declineCall() {
    stopRing()
    await sendSignal('decline')
    endCallLocally()
  }

  async function hangUp() {
    await sendSignal('hangup')
    endCallLocally()
  }

  function endCallLocally() {
    stopRing()
    clearInterval(timerRef.current)
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    setCallState('idle')
    setDuration(0)
    onClose?.()
  }

  function cleanup() {
    endCallLocally()
    if (channelRef.current) supabase.removeChannel(channelRef.current)
  }

  function startTimer() {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOff(c => !c)
  }

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  let ringCtx = null
  function playRing() {
    try {
      ringCtx = new (window.AudioContext || window.webkitAudioContext)()
      let on = true
      const loop = () => {
        if (!on) return
        const osc = ringCtx.createOscillator()
        const g = ringCtx.createGain()
        osc.connect(g); g.connect(ringCtx.destination)
        osc.frequency.value = 440
        g.gain.setValueAtTime(0.3, ringCtx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.01, ringCtx.currentTime + 1)
        osc.start(); osc.stop(ringCtx.currentTime + 1)
        setTimeout(loop, 2000)
      }
      loop()
      ringCtx._stop = () => { on = false; ringCtx.close() }
    } catch (e) {}
  }
  function stopRing() { try { ringCtx?._stop?.() } catch (e) {} }

  if (callState === 'idle') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={S.callBtn} onClick={() => startCall('voice')} title="Voice call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.03 1.19 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" /></svg>
        </button>
        <button style={S.callBtn} onClick={() => startCall('video')} title="Video call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
        </button>
      </div>
    )
  }

  if (callState === 'receiving') {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <div style={S.avatar}>{(otherUser?.name || otherUser?.email || 'U')[0].toUpperCase()}</div>
          <div style={S.callerName}>{otherUser?.name || otherUser?.email}</div>
          <div style={S.callStatus}>{callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}</div>
          <div style={S.btnRow}>
            <button style={S.declineBtn} onClick={declineCall}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" /></svg>
            </button>
            <button style={S.answerBtn} onClick={answerCall}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (callState === 'calling') {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <div style={S.avatar}>{(otherUser?.name || otherUser?.email || 'U')[0].toUpperCase()}</div>
          <div style={S.callerName}>{otherUser?.name || otherUser?.email}</div>
          <div style={S.callStatus}>{callType === 'video' ? '📹 Video calling…' : '📞 Voice calling…'}</div>
          <div style={S.btnRow}>
            <button style={S.declineBtn} onClick={hangUp}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" /></svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (callState === 'in-call') {
    return (
      <div style={S.overlay}>
        {callType === 'video' && (
          <div style={S.videoWrap}>
            <video ref={remoteVideoRef} autoPlay playsInline style={S.remoteVideo} />
            <video ref={localVideoRef} autoPlay playsInline muted style={S.localVideo} />
          </div>
        )}
        {callType === 'voice' && (
          <div style={S.card}>
            <div style={S.avatar}>{(otherUser?.name || otherUser?.email || 'U')[0].toUpperCase()}</div>
            <div style={S.callerName}>{otherUser?.name || otherUser?.email}</div>
            <div style={S.callStatus}>🔊 {formatTime(duration)}</div>
          </div>
        )}
        <div style={S.controls}>
          <button style={{ ...S.ctrlBtn, background: isMuted ? '#e74c3c' : 'rgba(255,255,255,0.2)' }} onClick={toggleMute}>
            {isMuted ? '🔇' : '🎤'}
          </button>
          {callType === 'video' && (
            <button style={{ ...S.ctrlBtn, background: isCamOff ? '#e74c3c' : 'rgba(255,255,255,0.2)' }} onClick={toggleCam}>
              {isCamOff ? '📷' : '📹'}
            </button>
          )}
          <button style={{ ...S.ctrlBtn, background: '#e74c3c', fontSize: 22 }} onClick={hangUp}>📵</button>
          {callType === 'video' && <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{formatTime(duration)}</div>}
        </div>
      </div>
    )
  }
}

const S = {
  callBtn: { background: '#f0f4f1', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0f1410,#1a3a2a)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  card: { textAlign: 'center', padding: 40 },
  avatar: { width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', fontSize: 36, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '3px solid rgba(255,255,255,0.2)' },
  callerName: { fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 },
  callStatus: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 32 },
  btnRow: { display: 'flex', gap: 32, justifyContent: 'center' },
  declineBtn: { width: 64, height: 64, borderRadius: '50%', background: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(231,76,60,0.5)' },
  answerBtn: { width: 64, height: 64, borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(26,122,74,0.5)' },
  videoWrap: { position: 'absolute', inset: 0 },
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover' },
  localVideo: { position: 'absolute', bottom: 100, right: 16, width: 120, height: 160, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)' },
  controls: { position: 'absolute', bottom: 40, display: 'flex', gap: 16, alignItems: 'center' },
  ctrlBtn: { width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}