import { useState } from 'react'

export default function ChatImageBubble({ url, caption, isMine, onOpen }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [ratio, setRatio] = useState('4 / 3')

  function handleLoad(event) {
    const image = event.currentTarget
    if (image.naturalWidth && image.naturalHeight) {
      setRatio(`${image.naturalWidth} / ${image.naturalHeight}`)
    }
    setLoaded(true)
  }

  return (
    <button
      type="button"
      className={`media-image-wrap${isMine ? ' is-mine' : ' is-theirs'}`}
      style={{ aspectRatio: ratio }}
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
            onLoad={handleLoad}
            onError={() => setFailed(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        </>
      )}
    </button>
  )
}
