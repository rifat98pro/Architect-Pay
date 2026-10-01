import Nav from '@/components/nav'
import { AppStateProvider } from '@/context/app-state-context'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <div className="flex min-h-screen" data-scope="dashboard">
        <Nav />
        <main className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: 'var(--ap-main)', transition: 'background-color 0.25s ease' }}>{children}</main>
      </div>
    </AppStateProvider>
  )
}
