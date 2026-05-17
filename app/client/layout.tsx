import { ClientTopbar } from "@/components/client/Topbar"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <ClientTopbar />
      <main className="flex-1">
        <div className="p-6 max-w-3xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
