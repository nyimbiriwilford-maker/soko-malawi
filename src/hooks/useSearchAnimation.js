import { useEffect, useRef, useState } from 'react'
import { TYPE_SPEED_MIN, TYPE_SPEED_MAX, ERASE_SPEED, PAUSE_AFTER_TYPE, PAUSE_AFTER_ERASE } from '../constants/homeConstants'
import { randBetween } from '../utils/homeUtils'

// ─────────────────────────────────────────────
// useSearchAnimation
// Returns typewriter state for the search bar
// placeholder.  Stops animating when the user
// focuses or types into the input.
// ─────────────────────────────────────────────
export default function useSearchAnimation({ listings, search, isFocused }) {
  const [animKeywords, setAnimKeywords] = useState([])
  const [animIdx, setAnimIdx] = useState(0)
  const [animText, setAnimText] = useState('')
  const [animPhase, setAnimPhase] = useState('typing')
  const [currentKeyword, setCurrentKeyword] = useState('')
  const timerRef = useRef(null)

  // Build keyword list from listing titles
  useEffect(() => {
    if (listings.length === 0) return
    const seen = new Set()
    const keywords = []
    listings
      .filter(l => l.title)
      .sort(() => Math.random() - 0.5)
      .slice(0, 30)
      .forEach(l => {
        const words = l.title.trim().split(/\s+/)
        const kw = words.slice(0, Math.min(3, words.length)).join(' ')
        const norm = kw.toLowerCase()
        if (!seen.has(norm) && kw.length > 2) { seen.add(norm); keywords.push(kw) }
      })
    setAnimKeywords(keywords.length > 0 ? keywords : ['something…'])
    setAnimIdx(0)
    setAnimPhase('typing')
    setAnimText('')
  }, [listings])

  // Typewriter ticker
  useEffect(() => {
    if (animKeywords.length === 0) return
    if (isFocused || search) { clearTimeout(timerRef.current); return }

    const kw = animKeywords[animIdx % animKeywords.length]

    if (animPhase === 'typing') {
      if (animText.length < kw.length) {
        timerRef.current = setTimeout(
          () => setAnimText(prev => prev + kw[animText.length]),
          randBetween(TYPE_SPEED_MIN, TYPE_SPEED_MAX)
        )
      } else {
        timerRef.current = setTimeout(() => setAnimPhase('paused'), PAUSE_AFTER_TYPE)
      }
    } else if (animPhase === 'paused') {
      setCurrentKeyword(kw)
      setAnimPhase('erasing')
    } else if (animPhase === 'erasing') {
      if (animText.length > 0) {
        timerRef.current = setTimeout(() => setAnimText(prev => prev.slice(0, -1)), ERASE_SPEED)
      } else {
        timerRef.current = setTimeout(() => {
          setAnimIdx(i => (i + 1) % animKeywords.length)
          setCurrentKeyword('')
          setAnimPhase('waiting')
        }, PAUSE_AFTER_ERASE)
      }
    } else if (animPhase === 'waiting') {
      setAnimPhase('typing')
    }

    return () => clearTimeout(timerRef.current)
  }, [animPhase, animText, animIdx, animKeywords, isFocused, search])

  return { animKeywords, animIdx, animText, animPhase, currentKeyword }
}