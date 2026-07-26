import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import type { Role } from '../api/types'
import { LABELS } from '../lib/format'

interface NavItem {
  to: string
  label: string
  icon: string
  roles?: Role[]
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Pilotage',
    items: [{ to: '/', label: 'Tableau de bord', icon: '📊' }],
  },
  {
    section: 'Exploitation',
    items: [
      { to: '/trips', label: 'Voyages', icon: '🗺️' },
      { to: '/bookings', label: 'Réservations', icon: '🎟️' },
      { to: '/shipments', label: 'Colis & fret', icon: '📦' },
      { to: '/routes', label: 'Lignes', icon: '🛣️' },
    ],
  },
  {
    section: 'Ressources',
    items: [
      { to: '/vehicles', label: 'Véhicules', icon: '🚌' },
      { to: '/maintenances', label: 'Maintenance', icon: '🔧' },
      { to: '/drivers', label: 'Chauffeurs', icon: '🧑‍✈️' },
      { to: '/customers', label: 'Clients', icon: '🤝' },
    ],
  },
  {
    section: 'Administration',
    items: [{ to: '/users', label: 'Utilisateurs', icon: '🔐', roles: ['admin'] }],
  },
]

export default function Layout() {
  const { user, logout, hasRole } = useAuth()
  const [open, setOpen] = useState(false)

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
      isActive ? 'bg-brand-600 font-medium text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`

  return (
    <div className="flex min-h-full">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto bg-slate-900 px-4 py-5 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 px-2">
          <p className="text-lg font-semibold text-white">TransGestion</p>
          <p className="text-xs text-slate-400">Voyageurs &amp; fret</p>
        </div>
        <nav className="space-y-6">
          {NAV.map((group) => {
            const items = group.items.filter((item) => !item.roles || hasRole(...item.roles))
            if (items.length === 0) return null
            return (
              <div key={group.section}>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.section}
                </p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClasses} onClick={() => setOpen(false)}>
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <button type="button" className="btn-ghost lg:hidden" onClick={() => setOpen((value) => !value)}>
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{user ? LABELS.role[user.role] : ''}</p>
            </div>
            <button type="button" onClick={logout} className="btn-ghost">
              Déconnexion
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
