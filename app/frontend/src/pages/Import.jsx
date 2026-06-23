import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, Disc3, CheckCircle2, AlertCircle, Loader2, FolderOpen, RefreshCw } from 'lucide-react'

function LogOutput({ text }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [text])
  if (!text) return null
  return (
    <pre ref={ref}
      className="mt-4 bg-black/40 rounded-xl border border-border text-xs text-emerald-300
                 font-mono p-4 max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
      {text}
    </pre>
  )
}

function StatusBadge({ status }) {
  if (status === 'running') return <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Working…</Badge>
  if (status === 'done')    return <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>
  if (status === 'error')   return <Badge className="bg-red-500/10 text-red-300 border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>
  return null
}

// ── Epic / MyChart import ──────────────────────────────────────────────────────

function RecordsImport({ vaultPath }) {
  const [status, setStatus]   = useState(null)   // null | running | done | error
  const [output, setOutput]   = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const run = async (file) => {
    setStatus('running')
    setOutput('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/import/records', { method: 'POST', body: form })
      const data = await res.json()
      setOutput(data.output || data.detail || '')
      setStatus(res.ok ? 'done' : 'error')
    } catch (e) {
      setOutput(String(e)); setStatus('error')
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) run(file)
  }

  return (
    <Card className="border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-400" />
          </div>
          Import from Your Health Portal
          {status && <StatusBadge status={status} />}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6 flex flex-col gap-5">
        <div className="text-muted-foreground text-base leading-relaxed">
          Works with any US patient portal — Epic, Cerner, athenahealth, Kaiser, VA, and more.
          Download your records and drop the <code className="text-foreground bg-secondary px-1.5 py-0.5 rounded text-sm">.zip</code> file here.
        </div>

        {/* Portal chips */}
        <div className="flex flex-wrap gap-2">
          {['Epic / MyChart', 'Cerner', 'athenahealth', 'Kaiser', 'VA / Blue Button', 'Any USCDI portal'].map(p => (
            <span key={p} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground bg-secondary/50">{p}</span>
          ))}
        </div>

        {/* Step guide */}
        <div className="flex flex-col gap-2">
          {[
            'Log in to your provider\'s patient portal',
            'Find "Download My Record", "Export", or "Blue Button"',
            'Download the zip file to your computer',
            'Drop it below',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-secondary text-foreground flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
                      py-10 cursor-pointer transition-all
                      ${dragging
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-secondary/40'}`}>
          <Upload className={`w-8 h-8 ${dragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-center">
            <div className="text-foreground font-medium">Drop your zip file here</div>
            <div className="text-muted-foreground text-sm mt-1">or click to browse</div>
          </div>
          <input ref={inputRef} type="file" accept=".zip" className="hidden"
            onChange={e => e.target.files[0] && run(e.target.files[0])} />
        </div>

        <LogOutput text={output} />

        {status === 'done' && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Records imported — <a href="/" className="underline hover:text-emerald-300">View your dashboard</a>
          </div>
        )}

        {vaultPath && (
          <div className="flex items-center gap-2 text-muted-foreground/50 text-xs">
            <FolderOpen className="w-3.5 h-3.5" />
            Saved to {vaultPath}/records/encounters/
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── DICOM disc import ──────────────────────────────────────────────────────────

function DicomImport({ vaultPath }) {
  const [discs, setDiscs]     = useState(null)
  const [status, setStatus]   = useState(null)
  const [output, setOutput]   = useState('')
  const [selected, setSelected] = useState(null)

  const scan = async () => {
    setDiscs(null)
    const res = await fetch('/api/import/discs')
    setDiscs(await res.json())
  }
  useEffect(() => { scan() }, [])

  const run = async (disc) => {
    setSelected(disc.path)
    setStatus('running')
    setOutput('')
    try {
      const res = await fetch('/api/import/dicom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: disc.path }),
      })
      const data = await res.json()
      setOutput(data.output || data.detail || '')
      setStatus(res.ok ? 'done' : 'error')
    } catch (e) {
      setOutput(String(e)); setStatus('error')
    }
  }

  return (
    <Card className="border-border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-purple-400" />
          </div>
          Import from Imaging CD
          {status && <StatusBadge status={status} />}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6 flex flex-col gap-5">
        <div className="text-muted-foreground text-base leading-relaxed">
          Insert your imaging CD (CT scan, MRI, X-Ray) and click Import.
          We'll read the disc and copy your scans into your vault.
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Detected discs</span>
          <Button variant="ghost" size="sm" onClick={scan} className="gap-2 text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {discs === null && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Scanning for discs…
          </div>
        )}

        {discs?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-8 flex flex-col items-center gap-3 text-muted-foreground">
            <Disc3 className="w-8 h-8 opacity-30" />
            <div className="text-sm text-center">
              No imaging discs detected.<br />
              Insert your CD and click Refresh.
            </div>
          </div>
        )}

        {discs?.map(d => (
          <div key={d.path}
            className="flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-5 py-4">
            <Disc3 className="w-8 h-8 text-purple-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-foreground font-medium">{d.name}</div>
              <div className="text-muted-foreground text-sm">{d.path}</div>
              {d.has_dicomdir && <Badge className="mt-1.5 bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">DICOMDIR found</Badge>}
            </div>
            <Button onClick={() => run(d)}
              disabled={status === 'running'}
              className="shrink-0">
              {status === 'running' && selected === d.path
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing…</>
                : 'Import'
              }
            </Button>
          </div>
        ))}

        <LogOutput text={output} />

        {status === 'done' && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Scans imported — <a href="/imaging" className="underline hover:text-emerald-300">View imaging</a>
          </div>
        )}

        {vaultPath && (
          <div className="flex items-center gap-2 text-muted-foreground/50 text-xs">
            <FolderOpen className="w-3.5 h-3.5" />
            Saved to {vaultPath}/records/imaging/
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Import() {
  const [vaultPath, setVaultPath] = useState('')

  useEffect(() => {
    fetch('/api/vault-path').then(r => r.json()).then(d => setVaultPath(d.path)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="mb-8">
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-2">Data Management</p>
        <h1 className="text-4xl font-bold text-foreground mb-2">Import Records</h1>
        <p className="text-muted-foreground text-base">
          Add your health records from your doctor's portal or an imaging CD.
          Everything stays on your computer.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RecordsImport vaultPath={vaultPath} />
        <DicomImport   vaultPath={vaultPath} />
      </div>
    </div>
  )
}
