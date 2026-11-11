import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased bg-[#050b05] text-gray-200 min-h-screen">
        {children}
      </body>
    </html>
  )
}