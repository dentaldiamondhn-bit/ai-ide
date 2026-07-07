'use client'

import { useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Monaco } from '@monaco-editor/react'
import { useEditorAnimation, FileModificationEvent } from '@/hooks/useEditorAnimation'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  filePath?: string | null
  height?: string
  onSave?: (content: string) => void
  animationEvent?: FileModificationEvent | null
}

export default function CodeEditor({ value, onChange, language, filePath, height = '100%', onSave, animationEvent }: CodeEditorProps) {
  const editorRef = useRef<any>(null)

  useEditorAnimation(editorRef, animationEvent || null, filePath)

  function handleEditorDidMount(editor: any, monaco: Monaco) {
    editorRef.current = editor

    if (filePath && onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
        const freshContent = editor.getValue()
        await onSave(freshContent)
      })
    }
  }

  function handleEditorChange(value: string | undefined) {
    onChange(value || '')
  }

  const getLanguageFromPath = (path: string | null | undefined) => {
    if (language) return language
    if (!path) return 'javascript'
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx': return 'typescript'
      case 'js':
      case 'jsx': return 'javascript'
      case 'json': return 'json'
      case 'css': return 'css'
      case 'scss': return 'scss'
      case 'html':
      case 'htm': return 'html'
      case 'md': return 'markdown'
      case 'py': return 'python'
      case 'rs': return 'rust'
      case 'go': return 'go'
      case 'java': return 'java'
      case 'c':
      case 'cpp':
      case 'h':
      case 'hpp': return 'c'
      case 'sh':
      case 'bash': return 'shell'
      case 'sql': return 'sql'
      case 'xml': return 'xml'
      case 'yaml':
      case 'yml': return 'yaml'
      case 'toml': return 'toml'
      default: return 'plaintext'
    }
  }

  return (
    <Editor
      height={height}
      width="100%"
      theme="vs-dark"
      language={getLanguageFromPath(filePath)}
      value={value}
      onMount={handleEditorDidMount}
      onChange={handleEditorChange}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
        minimap: { enabled: true },
        wordWrap: 'on',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderWhitespace: 'selection',
        renderLineHighlight: 'all',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
          useShadows: false,
        },
      }}
    />
  )
}