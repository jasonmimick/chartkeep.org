import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CalendarDays, ChevronRight } from 'lucide-react'

export default function Encounters() {
  const [encounters, setEncounters] = useState([])

  useEffect(() => {
    fetch('/api/encounters').then(r => r.json()).then(setEncounters)
  }, [])

  const byYear = encounters.reduce((acc, e) => {
    const y = (e.date || '').slice(0, 4) || 'Unknown'
    ;(acc[y] = acc[y] || []).push(e)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-8">
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-2">Medical History</p>
        <h1 className="text-4xl font-bold text-foreground mb-2">Visits & Records</h1>
        <p className="text-muted-foreground text-base">{encounters.length} visits on record</p>
      </div>

      {Object.keys(byYear).sort((a, b) => b - a).map(year => (
        <div key={year} className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-muted-foreground text-sm font-semibold uppercase tracking-widest">{year}</span>
            <Separator className="flex-1" />
            <span className="text-muted-foreground/50 text-sm">{byYear[year].length} visits</span>
          </div>

          <div className="flex flex-col gap-2">
            {byYear[year].map(e => (
              <Link key={e.folder} to={`/encounters/${e.folder}`}>
                <Card className="border-border shadow-none hover:border-primary/30 hover:bg-accent/50 transition-colors cursor-pointer group">
                  <CardContent className="flex items-center gap-4 py-4 px-5">
                    <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground text-base font-medium group-hover:text-primary transition-colors">
                        {e.provider || 'Visit'}
                      </div>
                      <div className="text-muted-foreground text-sm mt-0.5">
                        {e.date}{e.org ? ` · ${e.org}` : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
