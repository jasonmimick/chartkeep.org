import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Activity, Pill, AlertTriangle, CalendarDays, ChevronRight, ScanLine, Lock, X, Send, Sparkles, CheckCircle2, AlertCircle, EyeOff, MoreHorizontal, Undo2, MessageCircle } from 'lucide-react'
import ConsentShield from '@/components/ConsentShield'
import Logo from '@/components/Logo'

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ value, label, Icon, color }) {
  const colors = {
    blue:    'text-primary border-primary/20 bg-primary/10',
    amber:   'text-amber-400 border-amber-400/20 bg-amber-400/10',
    red:     'text-red-400 border-red-400/20 bg-red-400/10',
    emerald: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  }
  return (
    <Card className={`border ${colors[color]} shadow-none`}>
      <CardContent className="flex flex-col items-center justify-center py-6 gap-1">
        <Icon className="w-5 h-5 mb-1 opacity-70" />
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-xs font-medium uppercase tracking-widest opacity-60">{label}</span>
      </CardContent>
    </Card>
  )
}

// ── Health section card ────────────────────────────────────────────────────────

function HealthSection({ title, Icon, items, emptyText, renderItem, color }) {
  const accent = {
    blue:  'border-primary/20',
    amber: 'border-amber-400/20',
    red:   'border-red-400/20',
  }
  return (
    <Card className={`border ${accent[color]} shadow-none`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="w-4 h-4 text-muted-foreground" />
          {title}
          <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <Separator className="mb-4" />
      <CardContent className="flex flex-col gap-3">
        {items.length === 0
          ? <p className="text-muted-foreground text-sm italic">{emptyText}</p>
          : items.map((item, i) => renderItem(item, i))
        }
      </CardContent>
    </Card>
  )
}

// ── Chat stub ──────────────────────────────────────────────────────────────────

const EXAMPLE_QUESTIONS = [
  'What medications am I currently taking?',
  'When was my last CT scan?',
  'Do I have any drug allergies?',
  'Summarize my last visit',
]

function ChatPanel({ onClose }) {
  const [input, setInput] = useState('')

  return (
    <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
         style={{ height: 420 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-foreground font-semibold text-sm">Ask Chartkeep</div>
          <div className="text-muted-foreground text-xs">Your health records assistant</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Assistant greeting */}
        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <div className="bg-secondary rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-foreground max-w-[85%]">
            Hi Jason! I can answer questions about your health records, medications, visits, and scans. What would you like to know?
          </div>
        </div>

        {/* Example questions */}
        <div className="pl-8 flex flex-col gap-1.5 mt-1">
          {EXAMPLE_QUESTIONS.map((q, i) => (
            <button key={i}
              className="text-left text-xs text-primary border border-primary/20 bg-primary/5
                         hover:bg-primary/10 rounded-xl px-3 py-1.5 transition-colors">
              {q}
            </button>
          ))}
        </div>

        {/* Coming soon badge */}
        <div className="mt-auto pt-2 flex justify-center">
          <Badge variant="secondary" className="text-xs gap-1.5">
            <Sparkles className="w-3 h-3" />
            AI assistant coming soon
          </Badge>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your health records…"
          disabled
          className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50
                     border border-transparent focus:outline-none focus:border-primary/30 disabled:opacity-50"
        />
        <Button size="icon" disabled className="rounded-xl shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// ── Annotation menu for a single problem ──────────────────────────────────────

function AnnotateMenu({ display, annotation, onDone }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const act = async (action, extra = {}) => {
    setSaving(true)
    setOpen(false)
    const isRestore = action === 'restore'
    const url = isRestore
      ? `/api/annotations/problem/${encodeURIComponent(display)}`
      : '/api/annotations'
    const opts = isRestore
      ? { method: 'DELETE' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_type: 'problem', display, action, ...extra }) }
    await fetch(url, opts)
    setSaving(false)
    onDone()
  }

  const hasAnn = !!annotation && annotation.action !== 'restore'
  const status = annotation?.patient_status || annotation?.action

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-52 rounded-xl border border-border bg-background shadow-lg py-1 text-sm">
          {hasAnn ? (
            <>
              <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase tracking-wider">Current status</div>
              <div className="px-3 py-1.5 text-foreground font-medium capitalize">{status}</div>
              <Separator className="my-1" />
              <button onClick={() => act('restore')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary text-muted-foreground hover:text-foreground">
                <Undo2 className="w-3.5 h-3.5" /> Restore to active
              </button>
            </>
          ) : (
            <>
              <button onClick={() => act('resolve', { patient_status: 'resolved' })}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary text-emerald-500">
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark as resolved
              </button>
              <button onClick={() => act('dispute', { patient_status: 'disputed' })}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary text-amber-500">
                <AlertCircle className="w-3.5 h-3.5" /> Dispute this entry
              </button>
              <button onClick={() => act('suppress', { suppressed: true })}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary text-muted-foreground">
                <EyeOff className="w-3.5 h-3.5" /> Suppress from record
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [summary,     setSummary]     = useState(null)
  const [annotations, setAnnotations] = useState({})
  const [visits,      setVisits]      = useState([])
  const [imaging,     setImaging]     = useState([])
  const [chatOpen,    setChatOpen]    = useState(false)

  const reload = () => {
    fetch('/api/summary').then(r => r.json()).then(setSummary).catch(() => {})
    fetch('/api/annotations').then(r => r.json()).then(setAnnotations).catch(() => {})
  }

  useEffect(() => {
    reload()
    fetch('/api/encounters').then(r => r.json()).then(setVisits).catch(() => {})
    fetch('/api/imaging').then(r => r.json()).then(setImaging).catch(() => {})
  }, [])

  // Parse "last updated" into something meaningful
  const lastVisitDate  = summary?.as_of
  const lastProvider   = summary?.provider
  const daysSince = lastVisitDate
    ? Math.floor((Date.now() - new Date(lastVisitDate)) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="flex flex-col gap-10">

      {/* Hero — greeting left, logo right */}
      <div className="flex items-start justify-between gap-8">
        <div className="flex-1">
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-2">Health Dashboard</p>
          <h1 className="text-4xl font-bold text-foreground mb-3">Good morning, Jason.</h1>

          {summary ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground text-base">
                Your records are current as of{' '}
                <span className="text-foreground font-medium">{lastVisitDate}</span>
                {daysSince !== null && daysSince > 0 && (
                  <span className="text-muted-foreground"> · {daysSince} days ago</span>
                )}
              </p>
              {lastProvider && (
                <p className="text-muted-foreground text-sm">
                  Last imported from{' '}
                  <span className="text-foreground">{lastProvider}</span>
                </p>
              )}
              {daysSince !== null && daysSince > 180 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-500 text-sm">Records may be out of date — consider importing your latest visit</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-base">Loading your records…</p>
          )}
        </div>

        {/* Logo branding */}
        <div className="flex flex-col items-center gap-3 shrink-0 select-none">
          <div className="text-primary opacity-90">
            <Logo size={72} />
          </div>
          <div className="text-center">
            <div className="text-foreground font-semibold text-base tracking-tight">Chartkeep</div>
            <div className="text-muted-foreground text-xs">Your health record vault</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard value={summary.problems.length}    label="Conditions"   Icon={Activity}      color="blue"    />
          <StatCard value={summary.medications.length} label="Medications"  Icon={Pill}          color="amber"   />
          <StatCard value={summary.allergies.length}   label="Allergies"    Icon={AlertTriangle} color="red"     />
          <StatCard value={visits.length}              label="Total Visits" Icon={CalendarDays}  color="emerald" />
        </div>
      )}

      {/* Health cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <HealthSection
            title="Active Conditions" Icon={Activity} color="blue"
            items={summary.problems} emptyText="No active conditions."
            renderItem={(p, i) => {
              const ann = Object.values(annotations).find(
                a => a.target_ref?.display?.toLowerCase() === p.toLowerCase()
              )
              return (
                <div key={i} className="group flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span className="text-foreground text-base leading-snug flex-1">{p}</span>
                  <AnnotateMenu display={p} annotation={ann} onDone={reload} />
                </div>
              )
            }}
          />
          <HealthSection
            title="Medications" Icon={Pill} color="amber"
            items={summary.medications} emptyText="No medications."
            renderItem={(m, i) => {
              const [name, ...rest] = m.split(' — ')
              return (
                <div key={i} className="pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="text-foreground text-base font-medium">{name}</div>
                  {rest.length > 0 && <div className="text-muted-foreground text-sm mt-0.5">{rest.join(' — ')}</div>}
                </div>
              )
            }}
          />
          <HealthSection
            title="Allergies" Icon={AlertTriangle} color="red"
            items={summary.allergies} emptyText="No allergies on record."
            renderItem={(a, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                <span className="text-foreground text-base">{a}</span>
              </div>
            )}
          />
        </div>
      )}

      {/* Corrections nudge */}
      {Object.values(annotations).filter(a => a.action !== 'restore').length > 0 && (
        <Link to="/consent" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group">
          <ConsentShield size={18} className="text-primary shrink-0" />
          <span>
            You have{' '}
            <span className="text-foreground font-medium">
              {Object.values(annotations).filter(a => a.action !== 'restore').length} record correction{Object.values(annotations).filter(a => a.action !== 'restore').length !== 1 ? 's' : ''}
            </span>
            {' '}active —{' '}
            <span className="text-primary group-hover:underline">manage in Consent →</span>
          </span>
        </Link>
      )}

      {/* Recent visits */}
      {visits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Visits</h2>
            <Link to="/encounters" className="text-primary text-sm hover:underline">
              See all {visits.length} →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {visits.slice(0, 3).map(v => (
              <Link key={v.folder} to={`/encounters/${v.folder}`}>
                <Card className="border-border shadow-none hover:border-primary/30 hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-4 px-5">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground text-base font-medium">{v.provider || 'Visit'}</div>
                      <div className="text-muted-foreground text-sm">{v.date}{v.org ? ` · ${v.org}` : ''}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent scans */}
      {imaging.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Imaging</h2>
            <Link to="/imaging" className="text-primary text-sm hover:underline">
              See all {imaging.length} →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {imaging.slice(0, 3).map(s => (
              <Link key={s.folder} to={`/imaging/${s.folder}`}>
                <Card className="border-border shadow-none overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group">
                  <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {s.previews?.[0]
                      ? <img src={s.previews[0]} alt="" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                      : <ScanLine className="w-10 h-10 text-muted-foreground/20" />
                    }
                  </div>
                  <CardContent className="py-3 px-4">
                    <div className="text-foreground text-sm font-medium truncate">{s.description || 'Imaging Study'}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{s.started}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Privacy banner */}
      <Card className="border-border shadow-none bg-secondary/40">
        <CardContent className="flex items-center gap-5 py-5 px-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-foreground font-semibold text-base mb-1">Your data stays on your computer</div>
            <div className="text-muted-foreground text-sm leading-relaxed">
              Chartkeep stores all your health records privately and locally. Nothing is uploaded anywhere.
              Import records from your doctor's portal and view them here anytime.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat panel */}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground
                   shadow-lg hover:shadow-primary/30 hover:scale-105 transition-all flex items-center justify-center">
        {chatOpen
          ? <X className="w-5 h-5" />
          : <MessageCircle className="w-6 h-6" />
        }
      </button>

    </div>
  )
}
