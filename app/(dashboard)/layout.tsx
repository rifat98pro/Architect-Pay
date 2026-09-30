import Nav from '@/components/nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: 'var(--ap-main)', transition: 'background-color 0.25s ease' }}>{children}</main>
    </div>
  )
}
