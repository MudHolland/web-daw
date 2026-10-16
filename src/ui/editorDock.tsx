import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const EditorDockContext = createContext<HTMLElement | null>(null)

export function EditorStage({ children }: { children: ReactNode }) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null)
  return (
    <EditorDockContext.Provider value={dock}>
      <div className="editor-stage">
        {children}
        <div className="editor-dock" ref={setDock} />
      </div>
    </EditorDockContext.Provider>
  )
}

export function DockWhen({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  const dock = useContext(EditorDockContext)
  if (collapsed && dock) return createPortal(children, dock)
  return children
}
