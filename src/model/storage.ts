import { createBlankProject, parseProject, type Project } from './project.ts'

const STORAGE_KEY = 'web-daw.project.v1'

export function loadStoredProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createBlankProject()
    return parseProject(JSON.parse(raw)) ?? createBlankProject()
  } catch {
    return createBlankProject()
  }
}

export function saveStoredProject(project: Project): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
}

export function downloadProject(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(project.name)
  link.click()
  URL.revokeObjectURL(url)
}

function fileName(name: string): string {
  const cleaned = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ')
  const base = cleaned || 'Song'
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`
}

export async function readProjectFile(file: File): Promise<Project | null> {
  const text = await file.text()
  return parseProject(JSON.parse(text))
}
