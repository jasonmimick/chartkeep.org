import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  FilePen, Share2, Tag, History,
  CheckCircle2, AlertCircle, EyeOff, Undo2, ChevronRight,
  Brain, Baby, Pill, HeartPulse,
  User, Building2, Smartphone, ShieldOff, Plus, X, Clock
} from 'lucide-react'
import ConsentShield from '@/components/ConsentShield'

// ── Shared helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL = { resolve: 'Resolved', resolved: 'Resolved', dispute: 'Disputed', disputed: 'Disputed', suppress: 'Suppressed' }
const STATUS_ICON  = { resolve: CheckCircle2, resolved: CheckCircle2, dispute: AlertCircle, disputed: AlertCircle, suppress: EyeOff }
const STATUS_COLOR = {
  resolve:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  dispute:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  disputed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  suppress: 'bg-secondary text-muted-foreground border-border',
}

function SectionHeader({ Icon, title, description }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ── Record Corrections ─────────────────────────────────────────────────────────

function RecordCorrections() {
  const [annotations, setAnnotations] = useState({})
  const [history,     setHistory]     = useState([])
  const [showHistory, setShowHistory] = useState(false)

  const load = () =>
    fetch('/api/annotations').then(r => r.json()).then(setAnnotations).catch(() => {})

  const loadHistory = () =>
    fetch('/api/annotations/history').then(r => r.json()).then(setHistory).catch(() => {})

  useEffect(() => { load() }, [])

  const undo = async (ann) => {
    await fetch(`/api/annotations/${ann.target_type}/${encodeURIComponent(ann.target_ref.display)}`,
      { method: 'DELETE' })
    load()
  }

  const active = Object.values(annotations).filter(a => a.action !== 'restore')

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        Icon={FilePen}
        title="Record Corrections"
        description="Conditions, medications, or entries you've marked as resolved, disputed, or suppressed. Your provider's original record is never changed — these are your annotations on top of it."
      />

      {active.length === 0 ? (
        <Card className="border-border shadow-none">
          <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <FilePen className="w-8 h-8 opacity-20" />
            <div className="text-center">
              <div className="font-medium text-foreground mb-1">No corrections yet</div>
              <div className="text-sm">Hover over any condition on your dashboard to mark it resolved, disputed, or suppressed.</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map(ann => {
            const s = ann.patient_status || ann.action
            const Icon = STATUS_ICON[s] || FilePen
            return (
              <Card key={ann.id} className="border-border shadow-none">
                <CardContent className="flex items-start gap-4 py-4 px-5">
                  <div className="mt-0.5 shrink-0">
                    <Icon className={`w-4 h-4 ${
                      s.includes('resolv') ? 'text-emerald-400' :
                      s.includes('disput') ? 'text-amber-400' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground font-medium">{ann.target_ref.display}</span>
                      <Badge className={`text-xs capitalize ${STATUS_COLOR[s] || 'bg-secondary text-muted-foreground'}`}>
                        {STATUS_LABEL[s] || s}
                      </Badge>
                      <span className="text-muted-foreground/50 text-xs capitalize">{ann.target_type}</span>
                    </div>
                    {ann.reason && (
                      <p className="text-muted-foreground text-sm mt-1 italic">"{ann.reason}"</p>
                    )}
                    <p className="text-muted-foreground/40 text-xs mt-1">
                      Corrected {new Date(ann.created_at).toLocaleDateString('en-US',
                        { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => undo(ann)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground
                               border border-border hover:border-foreground/30 rounded-lg px-3 py-1.5
                               transition-colors shrink-0">
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Audit history */}
      <button
        onClick={() => { setShowHistory(h => !h); if (!showHistory) loadHistory() }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
        <History className="w-4 h-4" />
        {showHistory ? 'Hide' : 'Show'} full correction history
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
      </button>

      {showHistory && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4" /> All annotation events (newest first)
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 pb-4">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">No history yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((ann, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="text-muted-foreground/40 text-xs w-24 shrink-0 pt-0.5">
                      {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1">
                      <span className="text-foreground">{ann.target_ref.display}</span>
                      <span className="text-muted-foreground ml-2 capitalize">→ {STATUS_LABEL[ann.action] || ann.action}</span>
                      {ann.supersedes_id && (
                        <span className="text-muted-foreground/50 ml-2 text-xs">(supersedes prior)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Sharing Rules ─────────────────────────────────────────────────────────────

const RECIPIENT_META = {
  provider:    { Icon: User,       label: 'Provider',     color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  institution: { Icon: Building2,  label: 'Institution',  color: 'text-purple-400',  bg: 'bg-purple-500/10'  },
  person:      { Icon: User,       label: 'Person',       color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  application: { Icon: Smartphone, label: 'Application',  color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  insurance:   { Icon: ShieldOff,  label: 'Insurance',    color: 'text-red-400',     bg: 'bg-red-500/10'     },
}

const INCLUDE_LABELS = {
  all: 'All records', problems: 'Conditions', medications: 'Medications',
  allergies: 'Allergies', labs: 'Lab results', vitals: 'Vitals',
  imaging: 'Imaging', encounters: 'Visit notes',
}

function ShareCard({ share, onRevoke }) {
  const meta    = RECIPIENT_META[share.recipient_type] || RECIPIENT_META.person
  const Icon    = meta.Icon
  const expired = share.status === 'expired'
  const revoked = share.status === 'revoked'
  const inactive = expired || revoked

  return (
    <Card className={`border-border shadow-none transition-opacity ${inactive ? 'opacity-50' : ''}`}>
      <CardContent className="flex items-start gap-4 py-4 px-5">
        <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-5 h-5 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground font-medium">{share.recipient_name}</span>
            <Badge className={`text-xs ${meta.bg} ${meta.color} border-0`}>{meta.label}</Badge>
            {share.recipient_org && (
              <span className="text-muted-foreground text-xs">{share.recipient_org}</span>
            )}
          </div>
          {share.notes && (
            <p className="text-muted-foreground text-sm mt-0.5 italic">"{share.notes}"</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(share.includes || []).map(inc => (
              <span key={inc} className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                {INCLUDE_LABELS[inc] || inc}
              </span>
            ))}
            {share.excludes_sensitive && (
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                Sensitive excluded
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
            <span>Created {new Date(share.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {share.expiry && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires {new Date(share.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {expired  && <Badge className="bg-secondary text-muted-foreground border-0 text-xs">Expired</Badge>}
          {revoked  && <Badge className="bg-secondary text-muted-foreground border-0 text-xs">Revoked</Badge>}
          {!inactive && <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-xs">Active</Badge>}
          {!inactive && (
            <button onClick={() => onRevoke(share.id)}
              className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1">
              <X className="w-3 h-3" /> Revoke
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function NewShareModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    recipient_type: 'provider', recipient_name: '', recipient_org: '',
    includes: ['problems', 'medications', 'allergies'],
    excludes_sensitive: true, expiry: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const toggleInclude = (key) => {
    setForm(f => ({
      ...f,
      includes: f.includes.includes(key)
        ? f.includes.filter(k => k !== key)
        : [...f.includes, key],
    }))
  }

  const submit = async () => {
    if (!form.recipient_name.trim()) return
    setSaving(true)
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const created = await res.json()
    onCreated(created)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Create Share</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {/* Recipient type */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Recipient type</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(RECIPIENT_META).map(([key, { label }]) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, recipient_type: key }))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                    ${form.recipient_type === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Name *</label>
            <input value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
              placeholder="Dr. Jane Smith"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          {/* Org */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Organization</label>
            <input value={form.recipient_org} onChange={e => setForm(f => ({ ...f, recipient_org: e.target.value }))}
              placeholder="Hospital or practice name"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          {/* What to include */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Include</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(INCLUDE_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => key !== 'all' && toggleInclude(key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                    ${form.includes.includes(key)
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Context or purpose of this share"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 text-sm text-muted-foreground border border-border rounded-lg py-2 hover:text-foreground transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || !form.recipient_name.trim()}
            className="flex-1 text-sm bg-primary text-primary-foreground rounded-lg py-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Share'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SharingRules() {
  const [shares,  setShares]  = useState([])
  const [modal,   setModal]   = useState(false)

  const load = () =>
    fetch('/api/shares').then(r => r.json()).then(setShares).catch(() => {})

  useEffect(() => { load() }, [])

  const revoke = async (id) => {
    await fetch(`/api/shares/${id}`, { method: 'DELETE' })
    load()
  }

  const active   = shares.filter(s => s.status === 'active')
  const inactive = shares.filter(s => s.status !== 'active')

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        Icon={Share2}
        title="Sharing Rules"
        description="Control what gets included when you share your record with a provider, institution, family member, or application."
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{active.length} active share{active.length !== 1 ? 's' : ''}</span>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Share
        </button>
      </div>

      {shares.length === 0 ? (
        <Card className="border-border shadow-none">
          <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Share2 className="w-8 h-8 opacity-20" />
            <div className="text-center">
              <div className="font-medium text-foreground mb-1">No shares yet</div>
              <div className="text-sm">Create a share to send a consent-filtered copy of your record to a provider, person, or app.</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {active.map(s => <ShareCard key={s.id} share={s} onRevoke={revoke} />)}
          </div>
          {inactive.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">Inactive</p>
              <div className="flex flex-col gap-2">
                {inactive.map(s => <ShareCard key={s.id} share={s} onRevoke={revoke} />)}
              </div>
            </>
          )}
        </>
      )}

      {modal && (
        <NewShareModal
          onClose={() => setModal(false)}
          onCreated={() => load()}
        />
      )}
    </div>
  )
}

// ── Sensitive Categories (stub) ────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'mental_health',   Icon: Brain,     label: 'Mental Health',    desc: 'Diagnoses, medications, and visit notes related to mental health and behavioral health' },
  { id: 'substance_use',   Icon: Pill,      label: 'Substance Use',    desc: 'Records related to substance use disorders (42 CFR Part 2 protected)' },
  { id: 'reproductive',    Icon: Baby,      label: 'Reproductive Health', desc: 'Reproductive health, family planning, and related records' },
  { id: 'hiv',             Icon: HeartPulse,label: 'HIV Status',       desc: 'HIV testing and treatment records' },
]

function SensitiveCategories() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        Icon={Tag}
        title="Sensitive Categories"
        description="Records in these categories are hidden from shares by default. You can always include them explicitly when sharing."
      />
      <div className="flex flex-col gap-3">
        {CATEGORIES.map(({ id, Icon, label, desc }) => (
          <Card key={id} className="border-border shadow-none opacity-60">
            <CardContent className="flex items-center gap-4 py-4 px-5">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-medium text-sm">{label}</div>
                <div className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{desc}</div>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">Coming soon</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground/50 text-xs">
        Sensitive category protections align with HIPAA special category rules and 42 CFR Part 2
        (substance use disorder records).
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'corrections', label: 'Record Corrections', Icon: FilePen },
  { id: 'sharing',     label: 'Sharing Rules',      Icon: Share2  },
  { id: 'sensitive',   label: 'Sensitive Categories', Icon: Tag   },
]

export default function Consent() {
  const [active, setActive] = useState('corrections')

  return (
    <div>
      <div className="mb-8 flex items-start gap-6">
        <div className="text-primary shrink-0 mt-1">
          <ConsentShield size={56} />
        </div>
        <div>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-2">Privacy & Control</p>
          <h1 className="text-4xl font-bold text-foreground mb-2">Consent</h1>
          <p className="text-muted-foreground text-base">
            Your health data, your rules. Correct your record, control what gets shared, and protect sensitive information.
          </p>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sub-nav */}
        <nav className="flex flex-col gap-1 w-48 shrink-0">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors
                ${active === id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {active === 'corrections' && <RecordCorrections />}
          {active === 'sharing'     && <SharingRules />}
          {active === 'sensitive'   && <SensitiveCategories />}
        </div>
      </div>
    </div>
  )
}
