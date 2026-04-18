import './AppShell.css'

export default function AppShell({ header, dailySummary, children, bottomNav }) {
  return (
    <div className="shell">
      <div className="shell-top">
        {header}
        {dailySummary}
      </div>
      <main className="shell-main">
        {children}
      </main>
      {bottomNav}
    </div>
  )
}
