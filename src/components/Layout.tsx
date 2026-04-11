import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../lib/store'
import { getLogoutUrl } from '../lib/auth'

const navItems = [
  { to: '/coaching', label: 'Coaching' },
  { to: '/matrix', label: 'Matrix' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history', label: 'History' },
]

export default function Layout() {
  const user = useStore(s => s.user)

  return (
    <div className="flex h-screen bg-gray-50">
      <nav className="w-56 bg-proudfoot-navy text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-lg font-semibold">RSS Coach</h1>
          <p className="text-xs text-white/60">Proudfoot</p>
        </div>
        <div className="flex-1 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? 'bg-white/10 font-medium' : 'text-white/70 hover:bg-white/5'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        {user && (
          <div className="p-4 border-t border-white/10">
            <p className="text-xs text-white/60 truncate">{user.userDetails}</p>
            <a href={getLogoutUrl()} className="text-xs text-white/40 hover:text-white/70">Sign out</a>
          </div>
        )}
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
