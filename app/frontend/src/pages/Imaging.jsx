import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScanLine } from 'lucide-react'

const MOD = {
  CT: { label: 'CT Scan',      class: 'bg-orange-500/10 text-orange-300 border-orange-500/20 hover:bg-orange-500/10' },
  MR: { label: 'MRI',         class: 'bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/10' },
  CR: { label: 'X-Ray',       class: 'bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/10' },
  DX: { label: 'X-Ray',       class: 'bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/10' },
  US: { label: 'Ultrasound',  class: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/10' },
  RF: { label: 'Fluoroscopy', class: 'bg-pink-500/10 text-pink-300 border-pink-500/20 hover:bg-pink-500/10' },
}

function StudyCard({ study }) {
  const mod   = study.modality?.[0]?.code || ''
  const style = MOD[mod] || { label: mod, class: 'bg-secondary text-muted-foreground border-border hover:bg-secondary' }

  return (
    <Link to={`/imaging/${study.folder}`}>
      <Card className="border-border shadow-none overflow-hidden hover:border-primary/30 transition-all cursor-pointer group h-full">
        <div className="aspect-[4/3] bg-black flex items-center justify-center overflow-hidden relative">
          {study.previews?.[0]
            ? <img src={study.previews[0]} alt="" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
            : <ScanLine className="w-12 h-12 text-muted-foreground/10" />
          }
          <div className="absolute top-3 right-3">
            <Badge className={`text-xs font-semibold border ${style.class}`}>{style.label}</Badge>
          </div>
        </div>
        <CardContent className="p-5">
          <div className="text-foreground text-base font-medium mb-2 group-hover:text-primary transition-colors leading-snug">
            {study.description || 'Imaging Study'}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{study.started}</span>
            <span>·</span>
            <span>{study.numberOfSeries} series</span>
            <span>·</span>
            <span>{study.numberOfInstances?.toLocaleString()} images</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function Imaging() {
  const [studies, setStudies] = useState([])

  useEffect(() => {
    fetch('/api/imaging').then(r => r.json()).then(setStudies)
  }, [])

  const byYear      = studies.reduce((acc, s) => {
    const y = (s.started || '').slice(0, 4) || 'Unknown'
    ;(acc[y] = acc[y] || []).push(s)
    return acc
  }, {})
  const totalImages = studies.reduce((n, s) => n + (s.numberOfInstances || 0), 0)

  return (
    <div>
      <div className="mb-8">
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-2">Radiology</p>
        <h1 className="text-4xl font-bold text-foreground mb-2">Scans & Imaging</h1>
        <p className="text-muted-foreground text-base">
          {studies.length} studies · {totalImages.toLocaleString()} images
        </p>
      </div>

      {Object.keys(byYear).sort((a, b) => b - a).map(year => (
        <div key={year} className="mb-12">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-muted-foreground text-sm font-semibold uppercase tracking-widest">{year}</span>
            <Separator className="flex-1" />
            <span className="text-muted-foreground/50 text-sm">{byYear[year].length} studies</span>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {byYear[year].map(s => <StudyCard key={s.folder} study={s} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
