import { useState, useEffect, useRef } from 'react'

export default function DicomViewer({ dicomFiles }) {
  const [index, setIndex]   = useState(0)
  const [loaded, setLoaded] = useState(false)
  const dragRef = useRef(null)
  const total   = dicomFiles?.length || 0

  useEffect(() => {
    if (!total) return
    setIndex(Math.floor(total / 2))
    setLoaded(false)
  }, [dicomFiles])

  const go = (n) => {
    setLoaded(false)
    setIndex(Math.max(0, Math.min(total - 1, n)))
  }

  const onWheel = (e) => {
    e.preventDefault()
    go(index + (e.deltaY > 0 ? 1 : -1))
  }

  if (!total) return (
    <div className="flex items-center justify-center h-full text-slate-600 text-sm">
      DICOM files not yet in vault
    </div>
  )

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden select-none"
         onWheel={onWheel}>

      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-slate-500 text-xs">Decoding slice {index + 1} of {total}...</div>
        </div>
      )}

      <img
        key={dicomFiles[index]}
        src={dicomFiles[index]}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className="w-full h-full object-contain"
        style={{ opacity: loaded ? 1 : 0 }}
      />

      {loaded && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => go(index - 1)}
              className="w-7 h-7 rounded bg-black/60 text-white hover:bg-white/10 transition-colors text-lg leading-none">
              ‹
            </button>
            <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
              {index + 1} / {total}
            </span>
            <button onClick={() => go(index + 1)}
              className="w-7 h-7 rounded bg-black/60 text-white hover:bg-white/10 transition-colors text-lg leading-none">
              ›
            </button>
          </div>
          <div className="text-slate-600 text-[10px]">Scroll to navigate slices</div>
        </div>
      )}
    </div>
  )
}
