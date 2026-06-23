import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Heart, ClipboardList, ImageIcon, Upload, FlaskConical, User, ChevronLeft, ChevronRight, FolderOpen, Sun, Moon } from 'lucide-react'
import ConsentShield from './components/ConsentShield'
import { Separator } from '@/components/ui/separator'
import Logo from './components/Logo'
import { useTheme } from './hooks/useTheme'
import Import from './pages/Import'
import Dashboard from './pages/Dashboard'
import Imaging from './pages/Imaging'
import ImagingDetail from './pages/ImagingDetail'
import Encounters from './pages/Encounters'
import EncounterDetail from './pages/EncounterDetail'
import Labs from './pages/Labs'
import Consent from './pages/Consent'
import Profile from './pages/Profile'
import './index.css'

const NAV = [
  { to: '/',           label: 'My Health', Icon: Heart,         end: true },
  { to: '/labs',       label: 'Labs',      Icon: FlaskConical         },
  { to: '/imaging',    label: 'Imaging',   Icon: ImageIcon            },
  { to: '/encounters', label: 'Visits',    Icon: ClipboardList        },
  { to: '/import',     label: 'Import',    Icon: Upload               },
  { to: '/profile',   label: 'Profile',   Icon: User                 },
  { to: '/consent',    label: 'Consent',   Icon: ConsentShield        },
]

function Sidebar({ collapsed, setCollapsed }) {
  const [vaultPath, setVaultPath] = useState('')
  const { theme, toggle } = useTheme()

  useEffect(() => {
    fetch('/api/vault-path').then(r => r.json()).then(d => setVaultPath(d.path)).catch(() => {})
  }, [])

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 z-40 flex flex-col border-r border-border bg-background transition-all duration-200"
      style={{ width: collapsed ? 64 : 220 }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0">
        <div className="text-primary shrink-0">
          <Logo size={34} />
        </div>
        {!collapsed && (
          <span className="text-foreground font-semibold text-lg tracking-tight">Chartkeep</span>
        )}
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1 mt-2">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors
               ${isActive
                 ? 'bg-accent text-accent-foreground'
                 : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}
               ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? label : undefined}>
            <Icon className="w-5 h-5 shrink-0" size={20} />
            {!collapsed && <span className="text-base">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* Vault info */}
      {!collapsed && vaultPath && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 text-muted-foreground/60 text-xs mb-1.5">
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold uppercase tracking-widest">Vault</span>
          </div>
          <div className="text-muted-foreground text-xs leading-relaxed break-all pl-5">
            {vaultPath}
          </div>
          <div className="flex items-center gap-1.5 mt-2 pl-5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-500 text-xs font-medium">Connected · Private</span>
          </div>
        </div>
      )}

      {collapsed && vaultPath && (
        <div className="flex justify-center py-3" title={`Vault: ${vaultPath}`}>
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      )}

      <Separator />

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`flex items-center gap-3 px-3 h-11 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors
                    ${collapsed ? 'justify-center' : ''}`}>
        {theme === 'dark'
          ? <Sun className="w-4 h-4 shrink-0" />
          : <Moon className="w-4 h-4 shrink-0" />}
        {!collapsed && (
          <span className="text-sm">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        )}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={`flex items-center gap-3 px-3 h-11 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border-t border-border
                    ${collapsed ? 'justify-center' : ''}`}>
        {collapsed
          ? <ChevronRight className="w-4 h-4" />
          : <><ChevronLeft className="w-4 h-4 shrink-0" /><span className="text-sm">Collapse</span></>
        }
      </button>
    </aside>
  )
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main
          className="transition-all duration-200 p-8 pb-16"
          style={{ marginLeft: collapsed ? 64 : 220 }}>
          <div className="max-w-5xl mx-auto">
            <Routes>
              <Route path="/"                   element={<Dashboard />} />
              <Route path="/imaging"            element={<Imaging />} />
              <Route path="/imaging/:folder"    element={<ImagingDetail />} />
              <Route path="/labs"               element={<Labs />} />
              <Route path="/encounters"         element={<Encounters />} />
              <Route path="/encounters/:folder" element={<EncounterDetail />} />
              <Route path="/import"             element={<Import />} />
              <Route path="/profile"            element={<Profile />} />
              <Route path="/consent"           element={<Consent />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
