import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow]     = useState(false)

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    })
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show) return null

  return (
    <div style={S.wrap}>
      <div style={S.left}>
        <span style={{ fontSize: 26 }}>📲</span>
        <div>
          <div style={S.title}>Install SokoMw</div>
          <div style={S.sub}>Add to home screen for quick access</div>
        </div>
      </div>
      <div style={S.btns}>
        <button style={S.dismiss} onClick={() => setShow(false)}>Not now</button>
        <button style={S.install} onClick={install}>Install</button>
      </div>
    </div>
  )
}

const S = {
  wrap:    { position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 999, background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #e0ebe3', display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.3s ease' },
  left:    { display: 'flex', alignItems: 'center', gap: 12 },
  title:   { fontSize: 14, fontWeight: 800, color: '#0a1a0f' },
  sub:     { fontSize: 12, color: '#637068', marginTop: 2 },
  btns:    { display: 'flex', gap: 8 },
  dismiss: { flex: 1, background: '#f4f8f5', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, color: '#637068', cursor: 'pointer' },
  install: { flex: 2, background: '#1a7a4a', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' },
}