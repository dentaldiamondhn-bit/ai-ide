'use client'

export default function VSCodePanel() {
  return (
    <iframe 
      src="http://localhost:8080" 
      className="w-full h-full border-none" 
      title="VS Code Embedded Instance"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
    />
  )
}
