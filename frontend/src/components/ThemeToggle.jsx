import { useTheme } from '../contexts/ThemeContext'

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: '2px solid var(--border-light)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        fontSize: '1.25rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 999,
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
    </button>
  )
}
