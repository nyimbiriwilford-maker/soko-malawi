import { useState } from 'react'

export default function ChatImageBubble({ url, caption, isMine, onOpen }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      className={`media-image-wrap${isMine ? ' is-mine' : ' is-theirs'}`}
      onClick={event => {
        event.stopPropagation()
        onOpen?.()
      }}
      onPointerDown={event => event.stopPropagation()}
      aria-label="View image"
    >
      {failed ? (
        <span className="media-image-fallback">Image unavailable</span>
      ) : (
        <>
          {!loaded && <span className="media-image-placeholder" aria-hidden="true" />}
          <img
            src={url}
            alt={caption || 'Shared image'}
            loading="lazy"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </>
      )}
    </button>
  )
}
