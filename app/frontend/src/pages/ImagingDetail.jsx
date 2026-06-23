import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'

const DicomViewer = lazy(() => import('../components/DicomViewer'))

const MOD_STYLE = {
  CT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  MR: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  CR: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  DX: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function ImagingDetail() {
  const { folder } = useParams()
  const [study, setStudy]         = useState(null)
  const [activePreview, setActive] = useState(0)
  const [mode, setMode]           = useState('preview') // 'preview' | 'dicom'
  const [activeSeries, setSeries] = useState(0)

  useEffect(() => {
    fetch(`/api/imaging/${folder}`).then(r => r.json()).then(s => {
      setStudy(s); setActive(0); setMode('preview'); setSeries(0)
    })
  }, [folder])

  if (!study) return (
    <div className="flex items-center gap-2 text-slate-600 text-sm mt-12">
      <div className="w-4 h-4 border border-slate-600 border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  )

  const mod   = study.modality?.[0]?.code || ''
  const mstyle = MOD_STYLE[mod] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  const hasDicom = study.dicom_files?.length > 0

  // Group dicom files by series (split by preview index as proxy)
  const seriesFiles = study.series?.map((_, i) => {
    const perSeries = Math.ceil((study.dicom_files?.length || 0) / (study.series?.length || 1))
    return study.dicom_files?.slice(i * perSeries, (i + 1) * perSeries) || []
  }) || []

  return (
    <div>
      <Link to="/imaging" className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground mb-6 transition-colors">
        ← Imaging
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">{study.description || 'Imaging Study'}</h1>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${mstyle}`}>{mod}</span>
            <span>{study.started}</span>
            <span>·</span>
            <span>{study.numberOfSeries} series</span>
            <span>·</span>
            <span>{study.numberOfInstances?.toLocaleString()} images</span>
          </div>
        </div>

        {hasDicom && (
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            {['preview', 'dicom'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize
                  ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                {m === 'dicom' ? '⚡ DICOM Viewer' : '🖼 Previews'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main viewer */}
        <div className="col-span-2">
          <div className="rounded-xl overflow-hidden border border-[#1e2535] bg-black"
               style={{height: 480}}>
            {mode === 'dicom' && hasDicom ? (
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <DicomViewer dicomFiles={seriesFiles[activeSeries] || study.dicom_files} />
              </Suspense>
            ) : (
              study.previews?.length > 0
                ? <img src={study.previews[activePreview]} alt=""
                    className="w-full h-full object-contain" />
                : <div className="flex items-center justify-center h-full text-slate-700 text-sm">No preview</div>
            )}
          </div>

          {/* Thumbnail strip */}
          {mode === 'preview' && study.previews?.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {study.previews.map((p, i) => (
                <button key={i} onClick={() => setActive(i)}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors
                    ${i === activePreview ? 'border-blue-500' : 'border-[#1e2535] hover:border-slate-500'}`}>
                  <img src={p} alt="" className="w-full h-full object-contain bg-black" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Series panel */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Series</div>
          {study.series?.map((s, i) => (
            <button key={i} onClick={() => { setSeries(i); setActive(i); }}
              className={`text-left rounded-lg border p-3 transition-all
                ${activeSeries === i && mode === 'dicom'
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border hover:border-muted-foreground/40'} bg-secondary/30`}>
              <div className="text-foreground text-xs font-medium leading-snug mb-1">
                {s.description || `Series ${s.number || i + 1}`}
              </div>
              <div className="text-muted-foreground text-[11px]">
                {s.modality?.code} · {s.numberOfInstances} img
                {s.bodySite ? ` · ${s.bodySite.text}` : ''}
              </div>
            </button>
          ))}

          {!hasDicom && (
            <div className="mt-2 rounded-lg border border-border p-3 text-muted-foreground text-xs leading-relaxed">
              DICOM files not yet in vault. Mount disc and run:
              <code className="block mt-1 text-muted-foreground/60 font-mono text-[10px]">chartkeep_copy_dicom.py</code>
            </div>
          )}
        </div>
      </div>

      {/* Study UID */}
      <div className="mt-5 rounded-lg border border-border px-4 py-3">
        <span className="text-muted-foreground text-xs mr-3">Study UID</span>
        <code className="text-muted-foreground/70 text-xs">{study.identifier?.[0]?.value}</code>
      </div>
    </div>
  )
}
