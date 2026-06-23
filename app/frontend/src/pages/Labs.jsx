import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FlaskConical, Search, TrendingUp, CalendarDays, ChevronDown, ChevronRight, Clock, AlertCircle, ExternalLink } from 'lucide-react'

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseNum(str) {
  if (!str) return null
  const m = String(str).match(/^(\d+\.?\d*)/)
  return m ? parseFloat(m[1]) : null
}

function parseRefRange(str) {
  if (!str) return null
  // "13.7 - 17.5 g/dL"
  const m2 = str.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/)
  if (m2) return { low: parseFloat(m2[1]), high: parseFloat(m2[2]) }
  // "<150 mg/dL" or "<=1.0"
  const mLt = str.match(/<=?\s*(\d+\.?\d*)/)
  if (mLt) return { low: 0, high: parseFloat(mLt[1]) }
  // ">=60 ml/min" or ">60"
  const mGt = str.match(/>=?\s*(\d+\.?\d*)/)
  if (mGt) { const v = parseFloat(mGt[1]); return { low: v, high: v * 2 } }
  return null
}

function outOfRangeSeverity(value, low, high) {
  // Returns: 'normal' | 'low-mild' | 'low-severe' | 'high-mild' | 'high-severe'
  if (value >= low && value <= high) return 'normal'
  const span = high - low || 1
  if (value < low) {
    const pct = (low - value) / span
    return pct < 0.25 ? 'low-mild' : 'low-severe'
  }
  const pct = (value - high) / span
  return pct < 0.25 ? 'high-mild' : 'high-severe'
}

// ── Lab info dictionary ───────────────────────────────────────────────────────
// slug: MedlinePlus lab-tests path → https://medlineplus.gov/lab-tests/{slug}/
// Confirmed: cholesterol-levels. Others follow same URL pattern.

const LAB_INFO = {
  'cholesterol':             { text: 'Total cholesterol — LDL + HDL + VLDL. High levels raise the risk of heart attack and stroke.',                                          slug: 'cholesterol-levels' },
  'hdl cholesterol':         { text: '"Good" cholesterol that carries LDL away from the arteries to the liver. Higher is protective.',                                         slug: 'hdl-good-cholesterol' },
  'ldl cholesterol calc':    { text: '"Bad" cholesterol that can accumulate in artery walls as plaque. Lower is better for heart health.',                                     slug: 'ldl-bad-cholesterol' },
  'triglycerides':           { text: 'Fats circulating in the blood after eating. Elevated levels are linked to heart disease; often driven by diet and alcohol.',             slug: 'triglyceride-level' },
  'glucose':                 { text: 'Blood sugar at the time of the draw. Elevated fasting glucose can signal pre-diabetes or diabetes.',                                     slug: 'blood-glucose-test' },
  'hemoglobin a1c':          { text: 'Reflects average blood sugar over the past 2–3 months. The key long-term marker for diabetes screening and management.',                 slug: 'hemoglobin-a1c-hba1c' },
  'hemoglobin':              { text: 'The protein in red blood cells that carries oxygen. Low levels indicate anemia.',                                                        slug: 'hemoglobin-test' },
  'hematocrit':              { text: 'The percentage of blood made up of red blood cells. Low values suggest anemia; high values may indicate dehydration.',                   slug: 'hematocrit-test' },
  'white blood cell count':  { text: 'Counts infection-fighting immune cells. High counts suggest infection or inflammation; low counts can impair immunity.',                 slug: 'white-blood-cell-wbc-count' },
  'wbc':                     { text: 'White blood cells that fight infection. Elevated counts suggest infection or inflammation.',                                              slug: 'white-blood-cell-wbc-count' },
  'rbc':                     { text: 'Red blood cells that carry oxygen throughout the body. Low counts indicate anemia; high counts may suggest dehydration.',                slug: 'red-blood-cell-rbc-count' },
  'platelets':               { text: 'Tiny cells that help blood clot after injury. Too few raises bleeding risk; too many can raise clot risk.',                              slug: 'platelet-count' },
  'creatinine':              { text: 'A waste product filtered by the kidneys. Elevated levels may signal reduced kidney function.',                                           slug: 'creatinine-test' },
  'egfr':                    { text: 'Estimates how well your kidneys filter waste. Below 60 sustained for 3+ months may indicate chronic kidney disease.',                   slug: 'egfr' },
  'bun':                     { text: 'Blood urea nitrogen — a kidney waste marker often read alongside creatinine to assess kidney health.',                                   slug: 'bun-blood-urea-nitrogen' },
  'tsh':                     { text: 'Thyroid-stimulating hormone that prompts the thyroid to produce hormones. Abnormal levels indicate hypo- or hyperthyroidism.',          slug: 'tsh-thyroid-stimulating-hormone' },
  'alt':                     { text: 'Alanine aminotransferase — a liver enzyme released when liver cells are damaged. A key marker of liver health.',                        slug: 'alt-blood-test' },
  'ast':                     { text: 'Aspartate aminotransferase — elevated in both liver and muscle damage. Often interpreted alongside ALT.',                                slug: 'ast-test' },
  'sodium':                  { text: 'Key electrolyte regulating fluid balance and nerve function. Abnormal levels cause fatigue, cramps, and in severe cases, confusion.',    slug: 'sodium-blood-test' },
  'potassium':               { text: 'Electrolyte critical for heart rhythm and muscle function. Both high and low levels can trigger dangerous arrhythmias.',                 slug: 'potassium-blood-test' },
  'uric acid':               { text: 'Breakdown product of purines found in food and cell death. High levels can crystallize in joints, causing gout.',                       slug: 'uric-acid-test' },
  'ferritin':                { text: 'Protein that stores iron. Low levels indicate iron deficiency; elevated levels may reflect chronic inflammation.',                       slug: 'ferritin-blood-test' },
  'vitamin d':               { text: 'Reflects vitamin D stores. Deficiency is linked to bone loss, immune dysfunction, and fatigue.',                                        slug: 'vitamin-d-test' },
  'rdw':                     { text: 'Red cell distribution width — variation in red blood cell size. Elevated values can suggest anemia or nutritional deficiencies.',        slug: 'rdw-red-cell-distribution-width-blood-test' },
  'mch':                     { text: 'Mean corpuscular hemoglobin — average hemoglobin per red blood cell. Low MCH is a classic sign of iron-deficiency anemia.',             slug: 'mch-mean-corpuscular-hemoglobin' },
  'mchc':                    { text: 'Mean corpuscular hemoglobin concentration per red cell. Low values point to iron deficiency.',                                           slug: 'mchc-mean-corpuscular-hemoglobin-concentration' },
  'mcv':                     { text: 'Mean corpuscular volume — average size of red blood cells. Low = iron deficiency; high = B12 or folate deficiency.',                    slug: 'mcv-mean-corpuscular-volume-test' },
}

function getLabInfo(name) {
  return LAB_INFO[name.toLowerCase().trim()] ?? null
}

function getMedplusUrl(name) {
  const info = LAB_INFO[name.toLowerCase().trim()]
  if (info?.slug) return `https://medlineplus.gov/lab-tests/${info.slug}/`
  return `https://medlineplus.gov/lab-tests/`
}

function labSlug(name) {
  return 'lab-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeAge(dateStr) {
  // dateStr is "MM/DD/YYYY" or "YYYY-MM-DD"
  let d
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    d = new Date(dateStr)
  } else {
    const [m, day, y] = dateStr.split('/')
    d = new Date(+y, +m - 1, +day)
  }
  if (isNaN(d)) return null
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days < 1)  return 'today'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.round(days / 7)}w ago`
  if (days < 365) return `${Math.round(days / 30)}mo ago`
  return `${Math.round(days / 365)}yr ago`
}

function formatDisplayDate(dateStr) {
  let d
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    d = new Date(dateStr + 'T12:00:00')
  } else {
    const [m, day, y] = dateStr.split('/')
    d = new Date(+y, +m - 1, +day)
  }
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function staleness(dateStr) {
  let d
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    d = new Date(dateStr)
  } else {
    const [m, day, y] = dateStr.split('/')
    d = new Date(+y, +m - 1, +day)
  }
  if (isNaN(d)) return 'unknown'
  const months = (Date.now() - d) / (86400000 * 30)
  if (months < 3)  return 'current'
  if (months < 12) return 'aging'
  return 'old'
}

// ── Latest labs panel ─────────────────────────────────────────────────────────

function LatestLabsPanel({ labs, onTestClick }) {
  const [open, setOpen] = useState(true)

  // Find the most recent date, then include all labs within 3 days of it
  // (lab results from a single draw often span adjacent dates as they process)
  const latestDate = useMemo(() => {
    if (!labs.length) return null
    return [...labs].sort((a, b) => b.date.localeCompare(a.date))[0].date
  }, [labs])

  const latestResults = useMemo(() => {
    if (!latestDate) return []
    const anchor = new Date(latestDate + 'T12:00:00')
    return labs.filter(l => {
      if (!l.date) return false
      const d = new Date(l.date + 'T12:00:00')
      const daysDiff = (anchor - d) / 86400000
      return daysDiff >= 0 && daysDiff <= 3
    })
  }, [labs, latestDate])

  if (!latestDate) return null

  const age       = relativeAge(latestDate)
  const freshness = staleness(latestDate)
  const abnormal  = latestResults.filter(r => {
    const rng = parseRefRange(r.range)
    const val = parseNum(r.value)
    return rng && val !== null && outOfRangeSeverity(val, rng.low, rng.high) !== 'normal'
  }).length

  return (
    <Card className={`shadow-none mb-6 ${
      freshness === 'old'    ? 'border-amber-500/30' :
      freshness === 'aging'  ? 'border-border' :
                               'border-emerald-500/20'
    }`}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {open
                ? <ChevronDown  className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground font-semibold">Latest Labs</span>
                  <span className="text-muted-foreground text-sm">
                    {(() => {
                      const earliestInWindow = latestResults.length
                        ? [...latestResults].sort((a,b) => a.date.localeCompare(b.date))[0].date
                        : latestDate
                      return earliestInWindow !== latestDate
                        ? `${formatDisplayDate(earliestInWindow)} – ${formatDisplayDate(latestDate)}`
                        : formatDisplayDate(latestDate)
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs flex items-center gap-1
                    ${freshness === 'old'   ? 'text-amber-400' :
                      freshness === 'aging' ? 'text-muted-foreground' :
                                             'text-emerald-400'}`}>
                    <Clock className="w-3 h-3" />
                    {age}
                  </span>
                  {freshness === 'old' && (
                    <span className="text-xs flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-3 h-3" /> Vault may be outdated — consider importing a newer export
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {abnormal > 0 && (
                <Badge className="bg-red-500/10 text-red-300 border-red-500/20 text-xs">
                  {abnormal} out of range
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">{latestResults.length} results</Badge>
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 pb-4">
          {/* Group into pairs so divide-y draws one border per row */}
          <div className="divide-y divide-border/50">
            {Array.from({ length: Math.ceil(latestResults.length / 2) }, (_, row) => {
              const pair = latestResults.slice(row * 2, row * 2 + 2)
              return (
                <div key={row} className="grid grid-cols-2 gap-x-6 py-2.5">
                  {pair.map((r, col) => {
                    const rng = parseRefRange(r.range)
                    const val = parseNum(r.value)
                    const sev = rng && val !== null ? outOfRangeSeverity(val, rng.low, rng.high) : 'normal'
                    return (
                      <button key={col} onClick={() => onTestClick?.(r.name)}
                        className="flex flex-col text-left group hover:opacity-75 transition-opacity min-w-0">
                        <div className="flex items-center justify-between gap-2 w-full text-sm">
                          <span className="text-muted-foreground truncate group-hover:text-foreground transition-colors">
                            {r.name}
                          </span>
                          <span className={`font-semibold tabular-nums shrink-0 ${valueColor(r.flag, sev)}`}>
                            {r.value}<FlagBadge flag={r.flag} />
                          </span>
                        </div>
                        {r.range && <RangeBar value={r.value} range={r.range} />}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ── Trend sparkline ───────────────────────────────────────────────────────────

function fmtAxisDate(str) {
  let d
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) d = new Date(str + 'T12:00:00')
  else { const [m, day, y] = str.split('/'); d = new Date(+y, +m - 1, +day) }
  const mon = d.toLocaleDateString('en-US', { month: 'short' })
  const yr  = String(d.getFullYear()).slice(2)
  return `${mon} '${yr}`
}

function TrendChart({ results }) {
  const sorted = [...results]
    .map(r => ({ ...r, num: parseNum(r.value) }))
    .filter(r => r.num !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length < 2) return null

  const rangeStr = sorted.find(r => r.range)?.range
  const range    = parseRefRange(rangeStr)
  const refLow   = range?.low  ?? null
  const refHigh  = range?.high ?? null

  const vals    = sorted.map(s => s.num)
  const dataMin = Math.min(...vals)
  const dataMax = Math.max(...vals)
  const refMin  = refLow  !== null ? refLow  : dataMin
  const refMax  = refHigh !== null ? refHigh : dataMax

  const yPad = Math.max((dataMax - dataMin) * 0.3, (refMax - refMin) * 0.25, 8)
  const yMin  = Math.max(0, Math.min(dataMin, refMin) - yPad)
  const yMax  =              Math.max(dataMax, refMax) + yPad
  const ySpan = yMax - yMin

  const W = 400, H = 140
  const ML = 42, MR = 52, MT = 14, MB = 22
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const xOf = i => ML + (sorted.length < 2 ? plotW / 2 : (i / (sorted.length - 1)) * plotW)
  const yOf = v => MT + plotH - ((v - yMin) / ySpan) * plotH

  const bandTop    = refHigh !== null ? Math.max(MT,          yOf(refHigh)) : MT
  const bandBottom = refLow  !== null ? Math.min(MT + plotH,  yOf(refLow))  : MT + plotH

  const linePts = sorted.map((s, i) => `${xOf(i)},${yOf(s.num)}`).join(' ')

  // Y-axis ticks: ref boundaries + data min/max, de-duped and sorted descending
  const rawTicks = new Set()
  if (refHigh !== null) rawTicks.add(refHigh)
  if (refLow  !== null) rawTicks.add(refLow)
  rawTicks.add(Math.min(...vals))
  rawTicks.add(Math.max(...vals))
  const yTicks = [...rawTicks]
    .filter(v => v >= yMin && v <= yMax)
    .sort((a, b) => b - a)

  const fmtTick = v => v % 1 === 0 ? String(v) : v.toFixed(1)

  // Decide which X labels to show (all if ≤6, else thin out)
  const showLabel = i => sorted.length <= 6 || i === 0 || i === sorted.length - 1 || i % Math.ceil(sorted.length / 5) === 0

  const DOT_R = 5
  const rightEdge = ML + plotW

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Normal range band */}
      <rect x={ML} y={bandTop} width={plotW} height={Math.max(0, bandBottom - bandTop)}
        fill="rgba(52,211,153,0.10)" />

      {/* Band boundary lines + right-side labels */}
      {refHigh !== null && (() => {
        const y = bandTop
        return (
          <g key="high">
            <line x1={ML} y1={y} x2={rightEdge} y2={y}
              stroke="rgba(52,211,153,0.5)" strokeWidth="1" strokeDasharray="4,3" />
            <text x={rightEdge + 5} y={y + 3.5} fontSize="9" fill="rgba(52,211,153,0.85)" fontWeight="600">
              {fmtTick(refHigh)}
            </text>
            <text x={rightEdge + 5} y={y + 12} fontSize="8" fill="rgba(52,211,153,0.55)">hi</text>
          </g>
        )
      })()}
      {refLow !== null && refLow > yMin && (() => {
        const y = bandBottom
        return (
          <g key="low">
            <line x1={ML} y1={y} x2={rightEdge} y2={y}
              stroke="rgba(52,211,153,0.5)" strokeWidth="1" strokeDasharray="4,3" />
            <text x={rightEdge + 5} y={y + 3.5} fontSize="9" fill="rgba(52,211,153,0.85)" fontWeight="600">
              {fmtTick(refLow)}
            </text>
            <text x={rightEdge + 5} y={y + 12} fontSize="8" fill="rgba(52,211,153,0.55)">lo</text>
          </g>
        )
      })()}

      {/* Y-axis ticks */}
      {yTicks.map(v => (
        <text key={v} x={ML - 5} y={yOf(v) + 3.5}
          textAnchor="end" fontSize="9" fill="rgba(130,130,150,0.65)">{fmtTick(v)}</text>
      ))}

      {/* Y-axis gridlines (faint) */}
      {yTicks.map(v => (
        <line key={`g${v}`} x1={ML} y1={yOf(v)} x2={rightEdge} y2={yOf(v)}
          stroke="rgba(130,130,150,0.08)" strokeWidth="1" />
      ))}

      {/* Trend line */}
      <polyline points={linePts} fill="none"
        stroke="rgba(130,130,150,0.35)" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + value labels */}
      {sorted.map((s, i) => {
        const sev   = range ? outOfRangeSeverity(s.num, refLow ?? -Infinity, refHigh ?? Infinity) : 'normal'
        const color = sev === 'normal'             ? '#34d399'
          : sev.includes('severe')                 ? '#f87171' : '#fbbf24'
        const cx    = xOf(i)
        const cy    = yOf(s.num)
        const labelY = cy - DOT_R - 4 < MT + 4 ? cy + DOT_R + 11 : cy - DOT_R - 4
        const label  = s.num % 1 === 0 ? String(s.num) : s.num.toFixed(1)
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={DOT_R}
              fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
            <text x={cx} y={labelY} textAnchor="middle"
              fontSize="9.5" fill={color} fontWeight="600">{label}</text>
          </g>
        )
      })}

      {/* X-axis date labels */}
      {sorted.map((s, i) => showLabel(i) && (
        <text key={i} x={xOf(i)} y={H - 4}
          textAnchor={i === 0 ? 'start' : i === sorted.length - 1 ? 'end' : 'middle'}
          fontSize="9" fill="rgba(130,130,150,0.7)">
          {fmtAxisDate(s.date)}
        </text>
      ))}
    </svg>
  )
}

// ── Range bar ─────────────────────────────────────────────────────────────────

function useRangeBarCalc(rawValue, rawRange) {
  const value = parseNum(rawValue)
  const range = parseRefRange(rawRange)
  if (value === null || !range) return null
  const { low, high } = range
  const span = high - low
  if (span <= 0 || isNaN(span)) return null

  const severity = outOfRangeSeverity(value, low, high)
  const pad      = span * 0.5
  const ctxLow   = Math.max(0, low - pad)
  const ctxHigh  = high + pad
  const ctxSpan  = ctxHigh - ctxLow
  const toPct    = v => Math.max(0, Math.min(100, ((v - ctxLow) / ctxSpan) * 100))
  const lowPct   = toPct(low)
  const highPct  = toPct(high)
  const rawValPct = toPct(value)
  const valPct   = Math.max(2, Math.min(98, rawValPct))
  const clamped  = rawValPct < 2 || rawValPct > 98
  const fmtN     = v => v % 1 === 0 ? String(v) : v.toFixed(1)

  const color = severity === 'normal'       ? '#22c55e'
    : severity.includes('severe')           ? '#ef4444'
    :                                         '#f59e0b'
  const severityLabel = severity === 'normal'    ? null
    : severity === 'low-mild'                    ? 'Slightly low'
    : severity === 'low-severe'                  ? 'Low'
    : severity === 'high-mild'                   ? 'Slightly high'
    :                                              'High'

  return { low, high, lowPct, highPct, valPct, rawValPct, clamped, fmtN, color, severityLabel, severity }
}

function RangeBar({ value: rawValue, range: rawRange }) {
  const calc = useRangeBarCalc(rawValue, rawRange)
  if (!calc) return null

  // Inline the actual value into the bubble - fix the render bug
  const fmtN = v => v % 1 === 0 ? String(v) : v.toFixed(1)
  const numVal = parseNum(rawValue)

  return (
    <>
      {/* Desktop: slim bubble — total height ~34px (16 top padding + 10 bar + 8 number below) */}
      <div className="hidden sm:block w-full select-none" style={{ paddingTop: 16, paddingBottom: calc.severityLabel ? 2 : 8 }}>
        <div className="relative" style={{ height: 10 }}>
          {/* Colored zone bar */}
          <div className="absolute left-0 right-0 rounded-full overflow-hidden flex" style={{ top:'20%', height:'60%' }}>
            <div style={{ width:`${calc.lowPct}%`,                background:'rgba(239,68,68,0.22)' }} />
            <div style={{ width:`${calc.highPct - calc.lowPct}%`, background:'rgba(34,197,94,0.32)' }} />
            <div style={{ flex:1,                                   background:'rgba(245,158,11,0.22)' }} />
          </div>

          {/* Boundary ticks + numbers */}
          {calc.low > 0 && (
            <div className="absolute" style={{ left:`${calc.lowPct}%`, top:0, bottom:0 }}>
              <div style={{ position:'absolute', top:0, bottom:0, width:1, background:'rgba(34,197,94,0.45)' }} />
              <span style={{ position:'absolute', bottom:-11, left:'50%', transform:'translateX(-50%)',
                fontSize:8, color:'rgba(120,130,150,0.8)', whiteSpace:'nowrap', fontWeight:500 }}>
                {fmtN(calc.low)}
              </span>
            </div>
          )}
          <div className="absolute" style={{ left:`${calc.highPct}%`, top:0, bottom:0 }}>
            <div style={{ position:'absolute', top:0, bottom:0, width:1, background:'rgba(34,197,94,0.45)' }} />
            <span style={{ position:'absolute', bottom:-11, left:'50%', transform:'translateX(-50%)',
              fontSize:8, color:'rgba(120,130,150,0.8)', whiteSpace:'nowrap', fontWeight:500 }}>
              {fmtN(calc.high)}
            </span>
          </div>

          {/* Value bubble + pointer */}
          <div style={{ position:'absolute', left:`${calc.valPct}%`, top:0, transform:'translateX(-50%)', zIndex:10 }}>
            <div style={{
              position:'absolute', bottom:7, left:'50%', transform:'translateX(-50%)',
              background: calc.color, color:'#fff', fontSize:9, fontWeight:700,
              padding:'0px 5px', borderRadius:8, whiteSpace:'nowrap',
              boxShadow:'0 1px 3px rgba(0,0,0,0.25)', lineHeight:1.6,
            }}>
              {calc.clamped ? (calc.rawValPct < 2 ? '◀ ' : '▶ ') : ''}{fmtN(numVal)}
            </div>
            <div style={{
              position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)',
              width:0, height:0,
              borderLeft:'3px solid transparent', borderRight:'3px solid transparent',
              borderTop:`3px solid ${calc.color}`,
            }} />
          </div>
        </div>

        {calc.severityLabel && (
          <div style={{ fontSize:9, marginTop:12, color:calc.color, fontWeight:600 }}>
            {calc.severityLabel}
          </div>
        )}
      </div>

      {/* Mobile: dot only */}
      <div className="block sm:hidden w-full select-none mt-1.5" style={{ height:8 }}>
        <div className="relative w-full h-full">
          <div className="absolute left-0 right-0 rounded-full overflow-hidden flex" style={{ top:'20%', height:'60%' }}>
            <div style={{ width:`${calc.lowPct}%`,                  background:'rgba(239,68,68,0.2)'  }} />
            <div style={{ width:`${calc.highPct - calc.lowPct}%`,   background:'rgba(34,197,94,0.3)'  }} />
            <div style={{ flex:1,                                     background:'rgba(245,158,11,0.2)' }} />
          </div>
          <div style={{
            position:'absolute', left:`${calc.valPct}%`, top:'50%',
            transform:'translate(-50%,-50%)',
            width:8, height:8, borderRadius:'50%',
            background: calc.color, boxShadow:'0 0 0 1.5px rgba(0,0,0,0.3)',
            zIndex:2,
          }} />
        </div>
      </div>
    </>
  )
}

// ── Flag badge ────────────────────────────────────────────────────────────────

function FlagBadge({ flag }) {
  if (!flag) return null
  const f = flag.toUpperCase()
  const cls = f.includes('H')
    ? 'bg-red-500/10 text-red-300 border-red-500/20'
    : f.includes('L')
    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    : 'bg-muted text-muted-foreground border-0'
  return <Badge className={`text-xs px-1.5 py-0 ml-1 ${cls}`}>{flag}</Badge>
}

function valueColor(flag, severity) {
  if (severity === 'normal') return 'text-foreground'
  if (flag) {
    const f = flag.toUpperCase()
    if (f.includes('H')) return 'text-red-400'
    if (f.includes('L')) return 'text-amber-400'
  }
  return 'text-foreground'
}

// ── By-test view ──────────────────────────────────────────────────────────────

function TestCard({ name, results, id }) {
  const [open, setOpen] = useState(false)
  const sorted   = [...results].sort((a, b) => a.date.localeCompare(b.date))
  const latest   = sorted[sorted.length - 1]
  const prev     = sorted[sorted.length - 2]

  const latestNum = parseNum(latest.value)
  const prevNum   = prev ? parseNum(prev.value) : null
  const trending  = latestNum !== null && prevNum !== null
    ? latestNum > prevNum ? 'up' : latestNum < prevNum ? 'down' : 'flat'
    : null

  const range    = parseRefRange(latest.range)
  const severity = range && latestNum !== null
    ? outOfRangeSeverity(latestNum, range.low, range.high)
    : 'normal'
  const isAbnormal = severity !== 'normal'

  const labInfo = getLabInfo(name)

  return (
    <Card id={id} className={`border shadow-none transition-colors
      ${isAbnormal ? 'border-amber-500/20' : 'border-border'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            {/* Name + chevron */}
            <div className="flex items-center gap-2 min-w-0">
              {open
                ? <ChevronDown  className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              <CardTitle className="text-sm font-medium leading-snug truncate text-foreground">
                {name}
              </CardTitle>
            </div>

            {/* Value + date */}
            <div className="text-right shrink-0">
              <div className={`text-base font-semibold tabular-nums ${valueColor(latest.flag, severity)}`}>
                {latest.value}
                <FlagBadge flag={latest.flag} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 justify-end">
                {latest.date}
                {trending && sorted.length > 1 && (
                  <span className={
                    trending === 'up'   ? (severity.includes('high') ? 'text-red-400' : 'text-emerald-400') :
                    trending === 'down' ? (severity.includes('low')  ? 'text-red-400' : 'text-emerald-400') :
                    'text-muted-foreground'}>
                    {trending === 'up' ? '↑' : trending === 'down' ? '↓' : '→'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Range bar */}
          <div className="ml-6 pr-0">
            <RangeBar value={latest.value} range={latest.range} />
            {latest.range && (
              <div className="text-xs text-muted-foreground/50 mt-1">
                Normal range: {latest.range}
              </div>
            )}
          </div>
        </CardHeader>
      </button>

      {/* History: sparkline when multiple readings, single reading otherwise */}
      {open && (
        <CardContent className="pt-0 pb-4">
          {/* Info strip */}
          <div className="ml-6 mb-3 flex items-start justify-between gap-4">
            <p className="text-xs text-muted-foreground/80 leading-relaxed flex-1">
              {labInfo?.text || <span className="italic text-muted-foreground/40">No description available.</span>}
            </p>
            <a href={getMedplusUrl(name)} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary/60 hover:text-primary flex items-center gap-1 shrink-0 transition-colors">
              MedlinePlus <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {sorted.length >= 2 ? (
            <div className="ml-6 pr-1">
              <TrendChart results={sorted} />
            </div>
          ) : (
            <div className="ml-6 border-l border-border pl-4">
              {sorted.map((r, i) => {
                const rNum = parseNum(r.value)
                const rRange = parseRefRange(r.range)
                const rSev = rRange && rNum !== null
                  ? outOfRangeSeverity(rNum, rRange.low, rRange.high) : 'normal'
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground text-xs">{r.date}</span>
                    <span className={`font-medium tabular-nums ${valueColor(r.flag, rSev)}`}>
                      {r.value}<FlagBadge flag={r.flag} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── By-visit view ─────────────────────────────────────────────────────────────

function VisitGroup({ date, provider, results }) {
  const [open, setOpen] = useState(false)
  const abnormal = results.filter(r => {
    const rng = parseRefRange(r.range)
    const val = parseNum(r.value)
    return rng && val !== null && outOfRangeSeverity(val, rng.low, rng.high) !== 'normal'
  }).length

  return (
    <Card className="border-border shadow-none">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <div>
                <div className="font-medium text-foreground">{date}</div>
                {provider && <div className="text-sm text-muted-foreground">{provider}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {abnormal > 0 && (
                <Badge className="bg-red-500/10 text-red-300 border-red-500/20 text-xs">
                  {abnormal} out of range
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">{results.length} results</Badge>
            </div>
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0 pb-4">
          <div className="flex flex-col gap-3">
            {results.map((r, i) => {
              const rng = parseRefRange(r.range)
              const val = parseNum(r.value)
              const sev = rng && val !== null ? outOfRangeSeverity(val, rng.low, rng.high) : 'normal'
              return (
                <div key={i} className={`px-3 py-2.5 rounded-xl ${sev !== 'normal' ? 'bg-secondary/60' : 'hover:bg-secondary/40'}`}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground truncate max-w-[55%]">{r.name}</span>
                    <span className={`font-medium tabular-nums shrink-0 ${valueColor(r.flag, sev)}`}>
                      {r.value}<FlagBadge flag={r.flag} />
                    </span>
                  </div>
                  {r.range && <RangeBar value={r.value} range={r.range} />}
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Labs() {
  const [labs,    setLabs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState('')
  const [view,    setView]    = useState('test')

  useEffect(() => {
    fetch('/api/labs')
      .then(r => r.json())
      .then(data => { setLabs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!query) return labs
    const q = query.toLowerCase()
    return labs.filter(l => l.name.toLowerCase().includes(q))
  }, [labs, query])

  const byTest = useMemo(() => {
    const map = {}
    filtered.forEach(l => {
      if (!map[l.name]) map[l.name] = []
      map[l.name].push(l)
    })
    // Sort: abnormal first (severe > mild > normal), then alpha
    return Object.entries(map).sort(([, a], [, b]) => {
      const sev = (results) => {
        const latest = [...results].sort((x,y) => x.date.localeCompare(y.date)).at(-1)
        const rng = parseRefRange(latest?.range)
        const val = parseNum(latest?.value)
        if (!rng || val === null) return 0
        const s = outOfRangeSeverity(val, rng.low, rng.high)
        return s.includes('severe') ? 3 : s !== 'normal' ? 2 : 0
      }
      const diff = sev(b) - sev(a)
      if (diff !== 0) return diff
      return a[0].name.localeCompare(b[0].name)
    })
  }, [filtered])

  const byVisit = useMemo(() => {
    const map = {}
    filtered.forEach(l => {
      const key = `${l.date}::${l.folder}`
      if (!map[key]) map[key] = { date: l.date, provider: l.provider, folder: l.folder, results: [] }
      map[key].results.push(l)
    })
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [filtered])

  const latestDate = useMemo(() => {
    if (!labs.length) return null
    return [...labs].sort((a, b) => b.date.localeCompare(a.date))[0].date
  }, [labs])

  const handleTestClick = (name) => {
    setView('test')
    setTimeout(() => {
      const el = document.getElementById(labSlug(name))
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('ring-2', 'ring-primary/40', 'rounded-xl')
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40', 'rounded-xl'), 1400)
    }, 50)
  }

  const totalTests  = Object.keys(byTest).length
  const totalVisits = byVisit.length
  const totalAbnormal = useMemo(() => {
    return byTest.filter(([, results]) => {
      const latest = [...results].sort((a,b) => a.date.localeCompare(b.date)).at(-1)
      const rng = parseRefRange(latest?.range)
      const val = parseNum(latest?.value)
      return rng && val !== null && outOfRangeSeverity(val, rng.low, rng.high) !== 'normal'
    }).length
  }, [byTest])

  return (
    <div>
      <div className="mb-8">
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-2">Health Records</p>
        <h1 className="text-4xl font-bold text-foreground mb-2">Lab Results</h1>
        <p className="text-muted-foreground text-base">
          All bloodwork and lab results across every visit.
          {latestDate && (
            <span className="ml-2 text-muted-foreground/60">
              · Last updated {formatDisplayDate(latestDate)}
            </span>
          )}
        </p>
      </div>

      {!loading && labs.length > 0 && <LatestLabsPanel labs={labs} onTestClick={handleTestClick} />}

      {!loading && labs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="border-border shadow-none">
            <CardContent className="pt-5 pb-5">
              <div className="text-2xl font-bold">{totalTests}</div>
              <div className="text-sm text-muted-foreground">Unique tests</div>
            </CardContent>
          </Card>
          <Card className={`shadow-none ${totalAbnormal > 0 ? 'border-amber-500/30' : 'border-border'}`}>
            <CardContent className="pt-5 pb-5">
              <div className={`text-2xl font-bold ${totalAbnormal > 0 ? 'text-amber-400' : ''}`}>{totalAbnormal}</div>
              <div className="text-sm text-muted-foreground">Out of range</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-none">
            <CardContent className="pt-5 pb-5">
              <div className="text-2xl font-bold">{totalVisits}</div>
              <div className="text-sm text-muted-foreground">Visits with labs</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search labs…" value={query} onChange={e => setQuery(e.target.value)}
            className="pl-9 bg-secondary/50 border-border" />
        </div>
        <div className="flex rounded-xl border border-border overflow-hidden shrink-0">
          <button onClick={() => setView('test')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors
              ${view === 'test' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
            <TrendingUp className="w-3.5 h-3.5" /> By Test
          </button>
          <button onClick={() => setView('visit')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors
              ${view === 'visit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
            <CalendarDays className="w-3.5 h-3.5" /> By Visit
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-muted-foreground py-16 justify-center">
          <FlaskConical className="w-5 h-5 animate-pulse" /> Loading lab results…
        </div>
      )}

      {!loading && labs.length === 0 && (
        <Card className="border-border shadow-none">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <FlaskConical className="w-10 h-10 opacity-20" />
            <div className="text-center">
              <div className="font-medium text-foreground mb-1">No lab results yet</div>
              <div className="text-sm">Import your health records to see your bloodwork here.</div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && view === 'test' && (
        <div className="flex flex-col gap-2">
          {byTest.map(([name, results]) => (
            <TestCard key={name} id={labSlug(name)} name={name} results={results} />
          ))}
        </div>
      )}

      {!loading && view === 'visit' && (
        <div className="flex flex-col gap-3">
          {byVisit.map(g => (
            <VisitGroup key={`${g.date}-${g.folder}`} {...g} />
          ))}
        </div>
      )}
    </div>
  )
}
