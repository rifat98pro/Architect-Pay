import Nav from '@/components/nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">{children}</main>
    </div>
  )
}
