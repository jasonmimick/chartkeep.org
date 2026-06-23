import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  User, Phone, Mail, MapPin, Heart, Shield, AlertTriangle,
  Plus, X, Save, Pencil, ChevronDown, ChevronRight, FileText
} from 'lucide-react'

// ── Inline editable field ─────────────────────────────────────────────────────

function EditableField({ label, value, onSave, placeholder = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value || '')

  const save = () => { onSave(draft); setEditing(false) }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      {editing ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            placeholder={placeholder}
            className="h-8 text-sm bg-secondary/50"
            autoFocus
          />
          <Button size="sm" onClick={save} className="h-8 px-3"><Save className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft(value||''); setEditing(false) }} className="h-8 px-2">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <span className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground/40 italic'}`}>
            {value || placeholder || 'Not set'}
          </span>
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── List editor (family history, surgical history) ────────────────────────────

function EditableList({ label, items, onSave, placeholder }) {
  const [expanded, setExpanded] = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [draft,    setDraft]    = useState('')

  const add = () => {
    if (draft.trim()) { onSave([...items, draft.trim()]); setDraft('') }
    setAdding(false)
  }
  const remove = (i) => onSave(items.filter((_, idx) => idx !== i))

  return (
    <div>
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full text-left mb-2">
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Badge variant="secondary" className="text-xs ml-auto">{items.length}</Badge>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1.5 pl-5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 group text-sm">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="text-foreground flex-1">{item}</span>
              <button onClick={() => remove(i)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {adding ? (
            <div className="flex gap-2 mt-1">
              <Input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false) }}
                placeholder={placeholder} className="h-7 text-sm bg-secondary/50" autoFocus />
              <Button size="sm" onClick={add} className="h-7 px-2"><Save className="w-3 h-3" /></Button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
              <Plus className="w-3 h-3" /> Add entry
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Toggle field ──────────────────────────────────────────────────────────────

function ToggleField({ label, value, onSave, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button key={opt.value}
            onClick={() => onSave(opt.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors
              ${value === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Source record card (read-only) ────────────────────────────────────────────

function SourceCard({ source }) {
  const rows = [
    { Icon: User,     label: 'Date of Birth', value: `${source.dob}  ·  Age ${source.age}` },
    { Icon: Heart,    label: 'Marital Status', value: source.marital_status },
    { Icon: MapPin,   label: 'Address',        value: source.address },
    { Icon: Phone,    label: 'Phone',          value: source.phone },
    { Icon: Mail,     label: 'Email',          value: source.email },
  ]
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4 text-muted-foreground" />
          From Your Records
          <Badge variant="secondary" className="ml-auto text-xs font-normal">Read-only · from C-CDA</Badge>
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 flex flex-col gap-4">
        {rows.filter(r => r.value).map(({ Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
              <div className="text-foreground text-sm">{value}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile).catch(() => {})
  }, [])

  const updatePatient = async (patch) => {
    if (!profile) return
    setSaving(true)
    const updated = { ...profile, patient: { ...profile.patient, ...patch } }
    setProfile(updated)
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: patch }),
    })
    setSaving(false)
  }

  if (!profile) return (
    <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
      <User className="w-5 h-5 animate-pulse" /> Loading profile…
    </div>
  )

  const { source, patient } = profile
  const initials = source.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-primary text-3xl font-bold tracking-tight">{initials}</span>
        </div>
        <div>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-1">Patient Profile</p>
          <h1 className="text-4xl font-bold text-foreground">{source.name}</h1>
          <p className="text-muted-foreground mt-1">
            Age {source.age} &nbsp;·&nbsp; {source.dob}
            {source.marital_status && <> &nbsp;·&nbsp; {source.marital_status}</>}
          </p>
        </div>
        {saving && <Badge variant="secondary" className="ml-auto text-xs">Saving…</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source record — left column */}
        <SourceCard source={source} />

        {/* Patient assertions — right column */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4 text-muted-foreground" />
              Your Additions
              <Badge variant="secondary" className="ml-auto text-xs font-normal">Editable · hover to edit</Badge>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 flex flex-col gap-5">
            <ToggleField
              label="Blood Type"
              value={patient.blood_type}
              onSave={v => updatePatient({ blood_type: v })}
              options={['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(v => ({ label: v, value: v }))}
            />
            <ToggleField
              label="Organ Donor"
              value={patient.organ_donor === true ? 'yes' : patient.organ_donor === false ? 'no' : ''}
              onSave={v => updatePatient({ organ_donor: v === 'yes' })}
              options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
            />
            <EditableField
              label="Advance Directive"
              value={patient.advance_directive}
              placeholder="e.g. DNR, Healthcare proxy: Jane Doe"
              onSave={v => updatePatient({ advance_directive: v })}
            />
            <EditableField
              label="Primary Care Provider"
              value={patient.primary_care_provider}
              placeholder="Dr. Name, Practice"
              onSave={v => updatePatient({ primary_care_provider: v })}
            />
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Emergency Contact
              </span>
              <div className="pl-1 flex flex-col gap-3">
                <EditableField label="Name"         value={patient.emergency_contact_name}     placeholder="Full name"     onSave={v => updatePatient({ emergency_contact_name: v })} />
                <EditableField label="Relationship" value={patient.emergency_contact_relation}  placeholder="e.g. Spouse"   onSave={v => updatePatient({ emergency_contact_relation: v })} />
                <EditableField label="Phone"        value={patient.emergency_contact_phone}    placeholder="+1-555-000-0000" onSave={v => updatePatient({ emergency_contact_phone: v })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Family History */}
        <Card className="border-border shadow-none">
          <CardContent className="pt-5 flex flex-col gap-3">
            <EditableList
              label="Family History"
              items={patient.family_history}
              placeholder="e.g. Father — heart disease (age 58)"
              onSave={v => updatePatient({ family_history: v })}
            />
          </CardContent>
        </Card>

        {/* Surgical / Procedure History */}
        <Card className="border-border shadow-none">
          <CardContent className="pt-5 flex flex-col gap-3">
            <EditableList
              label="Surgical & Procedure History"
              items={patient.surgical_history}
              placeholder="e.g. Appendectomy 2005"
              onSave={v => updatePatient({ surgical_history: v })}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="border-border shadow-none md:col-span-2">
          <CardContent className="pt-5">
            <EditableField
              label="Personal Health Notes"
              value={patient.notes}
              placeholder="Any notes about your health history, preferences, or context for providers…"
              onSave={v => updatePatient({ notes: v })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
