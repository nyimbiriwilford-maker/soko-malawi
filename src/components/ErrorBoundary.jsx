import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.back = this.back.bind(this)
    this.reload = this.reload.bind(this)
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }
  back() {
    this.setState({ error: null })
    window.history.back()
  }
  reload() {
    this.setState({ error: null })
    window.location.reload()
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh',
          background: '#f8f9fa',
          fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
          padding: 24,
        }}>
          <div style={{
            width: '100%', maxWidth: 380,
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.11), 0 8px 28px rgba(0,0,0,0.08)',
            padding: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: '#e8f5ee',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Sora', 'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: 20, color: '#0F9D58', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 12 }}>
              Soko<span style={{ color: '#F9AB00' }}>Mw</span>
            </div>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#202124', letterSpacing: '-0.2px' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '6px 0 0', color: '#5f6368', fontSize: 14, lineHeight: 1.5, maxWidth: 280 }}>
              This page hit an unexpected error. Please try again.
            </p>
            <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={this.reload}
                style={{
                  minHeight: 44,
                  background: 'linear-gradient(135deg, #0a7a44, #0F9D58)',
                  border: 'none', borderRadius: 12, color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
                  padding: '11px 0', width: '100%',
                  boxShadow: '0 3px 12px rgba(15,157,88,0.28)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #0d8f4e, #0F9D58)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #0a7a44, #0F9D58)'; e.currentTarget.style.transform = 'none' }}
              >Try again</button>
              <button onClick={this.back}
                style={{
                  minHeight: 40,
                  background: '#ffffff', border: '1px solid #e8eaed',
                  borderRadius: 12, color: '#5f6368', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 500, fontSize: 14,
                  padding: '9px 0', width: '100%', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.color = '#202124' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#5f6368' }}
              >Go back</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
