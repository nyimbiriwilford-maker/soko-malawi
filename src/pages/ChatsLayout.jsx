import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ChatListPanel from './ChatListPanel'
import Chat from './Chat'
import NavRail from './NavRail'
import '../styles/chats.css'

let S

/**
 * Mount this ONE component at both list and thread routes, e.g. in App.jsx:
 *
 *   <Route path="/chats" element={<ChatsLayout />} />
 *   <Route path="/chat/:userId" element={<ChatsLayout />} />
 *   <Route path="/chat/:userId/:listingId" element={<ChatsLayout />} />
 *
 * Desktop (>=900px): slim NavRail + list + thread (list stays mounted).
 * Mobile (<900px): full-screen list OR full-screen thread.
 * 
 * Mobile behavior is controlled via data attributes + CSS in chats.css
 */
export default function ChatsLayout() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const hasThread = !!userId

  // Pin the list shell to the *visible* viewport on mobile when the soft
  // keyboard / browser chrome resizes it — same visualViewport fix as the
  // chat thread (which uses the separate --chat-vvh / --chat-vv-top vars).
  useEffect(() => {
    const root = document.documentElement
    function apply() {
      const vv = window.visualViewport
      const h = vv ? Math.round(vv.height) : window.innerHeight
      const top = vv ? Math.round(vv.offsetTop) : 0
      root.style.setProperty('--chats-vvh', `${h}px`)
      root.style.setProperty('--chats-vv-top', `${top}px`)
    }
    apply()
    const vv = window.visualViewport
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      root.style.removeProperty('--chats-vvh')
      root.style.removeProperty('--chats-vv-top')
    }
  }, [])

  // When returning to the chat list from a thread, the mobile browser may
  // leave a residual document scroll position (from the on-screen keyboard
  // pushing the page up). The shell is position:fixed + overflow:hidden, so
  // that stale scrollY can't be visually scrolled away — and it makes the
  // inner list scroller's upward overscroll chain to the blocked document,
  // which swallows the scroll-up gesture. Reset it whenever the list shows.
  useEffect(() => {
    if (hasThread) return
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [hasThread])

  return (
    <div 
      className="chats-shell" 
      data-has-thread={hasThread ? 'true' : 'false'}
      data-view={hasThread ? 'thread' : 'list'}
    >
      <style>{`
        .chats-shell { background: #f8f9fa; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
        .chats-thread-col { background: #f8f9fa; }
        .chats-thread-inner { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; }
        .chat-placeholder { background: #f8f9fa; }

        @media (min-width: 769px) {
          .soko-navrail { display: flex !important; }
          .chats-shell .soko-mobile-bottomnav,
          .chats-shell .soko-bottom-nav,
          .chats-shell #bottom-nav { display: none !important; }
          .chats-list-col {
            width: 340px !important;
            flex-shrink: 0;
            background: #fff;
            border-right: 1px solid #e8eaed;
          }
          .chats-thread-col { width: auto !important; max-width: none !important; flex: 1; min-width: 0; }
        }
        @media (min-width: 769px) and (max-width: 899px) {
          .chats-shell[data-has-thread='true'] .chats-list-col { display: flex !important; }
          .chats-shell[data-has-thread='false'] .chats-thread-col { display: flex !important; }
        }
        @media (min-width: 1100px) {
          .chats-list-col { width: 400px !important; }
        }
        @media (min-width: 1600px) {
          .chats-list-col { width: 440px !important; }
          .chats-thread-inner { width: 100%; max-width: 900px; margin: 0 auto; }
        }
        @media (max-width: 768px) {
          .soko-navrail { display: none !important; }
        }
      `}</style>
      <NavRail />

      {/* Chat List Column */}
      <div className="chats-list-col">
        <ChatListPanel />
      </div>

      {/* Chat Thread Column */}
      <div className="chats-thread-col">
        <div className="chats-thread-inner">
          {hasThread ? (
            <Chat />
          ) : (
            <div className="chat-placeholder" style={S.placeholder}>
              <div style={S.placeholderIconCircle}>
                <svg 
                  width="30" 
                  height="30" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#0F9D58" 
                  strokeWidth="1.75" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <p style={S.placeholderTitle}>Select a conversation</p>
              <p style={S.placeholderSub}>
                Choose a chat from the list to start messaging.
              </p>
              <div style={S.placeholderActions}>
                <button 
                  type="button" 
                  style={S.primaryAction} 
                  onClick={() => navigate('/')}
                >
                  Browse Marketplace
                </button>
                <button 
                  type="button" 
                  style={S.secondaryAction} 
                  onClick={() => navigate('/post')}
                >
                  Post a Listing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

S = {
  placeholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 28px',
    textAlign: 'center',
    background: '#f8f9fa',
    minHeight: 0,
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },
  placeholderIconCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: '#e6f6ed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px',
    flexShrink: 0,
  },
  placeholderTitle: {
    fontFamily: "'Sora', 'DM Sans', sans-serif",
    fontSize: '20px',
    fontWeight: '800',
    color: '#202124',
    marginBottom: '6px',
  },
  placeholderSub: {
    fontSize: '13px',
    color: '#5f6368',
    maxWidth: '420px',
    lineHeight: '1.5',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  placeholderActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '22px',
  },
  primaryAction: {
    height: '40px',
    padding: '0 16px',
    background: '#0F9D58',
    color: '#fff',
    border: '1px solid #0F9D58',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },
  secondaryAction: {
    height: '40px',
    padding: '0 16px',
    background: '#fff',
    color: '#0F9D58',
    border: '1px solid #e8eaed',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },
}