import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('ck-theme') || 'dark'
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('ck-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle }
}
