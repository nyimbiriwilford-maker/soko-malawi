import { useParams, useNavigate } from 'react-router-dom'
import ChatListPanel from './ChatListPanel'
import Chat from './Chat'
import NavRail from './NavRail'
import '../styles/chats.css'

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

  return (
    <div 
      className="chats-shell" 
      data-has-thread={hasThread ? 'true' : 'false'}
      data-view={hasThread ? 'thread' : 'list'}
    >
      <NavRail />

      {/* Chat List Column */}
      <div className="chats-list-col">
        <ChatListPanel />
      </div>

      {/* Chat Thread Column */}
      <div className="chats-thread-col">
        {hasThread ? (
          <Chat />
        ) : (
          <div style={S.placeholder}>
            <div style={S.placeholderIconCircle}>
              <svg 
                width="34" 
                height="34" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#1a7a4a" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <p style={S.placeholderTitle}>Select a conversation</p>
            <p style={S.placeholderSub}>
              Choose a chat from the list to start messaging, or jump back into browsing.
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
  )
}

// Inline styles for placeholder (you can move these to chats.css later if preferred)
const S = {
  placeholder: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center',
    background: '#f8faf8',
    minHeight: 0,
  },
  placeholderIconCircle: {
    width: '84px',
    height: '84px',
    borderRadius: '50%',
    background: '#e6f7ee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  placeholderTitle: { 
    fontSize: '19px', 
    fontWeight: '800', 
    color: '#0f1410', 
    marginBottom: '8px' 
  },
  placeholderSub: { 
    fontSize: '13.5px', 
    color: '#888', 
    maxWidth: '300px', 
    lineHeight: '1.6', 
    marginBottom: '24px' 
  },
  placeholderActions: { 
    display: 'flex', 
    gap: '10px', 
    flexWrap: 'wrap', 
    justifyContent: 'center' 
  },
  primaryAction: {
    background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '11px 20px',
    fontSize: '13.5px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(26,122,74,0.35)',
  },
  secondaryAction: {
    background: '#fff',
    color: '#1a7a4a',
    border: '1.5px solid #cfe6d8',
    borderRadius: '12px',
    padding: '11px 20px',
    fontSize: '13.5px',
    fontWeight: '700',
    cursor: 'pointer',
  },
}