'use client'

import { useRef, useEffect } from 'react'
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
  const monacoRef = useRef<Monaco | null>(null)
  const originalValueRef = useRef<string>(value)
  const decorationCollectionRef = useRef<any>(null)

  useEditorAnimation(editorRef, animationEvent || null, filePath)

  function handleEditorDidMount(editor: any, monaco: Monaco) {
    editorRef.current = editor
    monacoRef.current = monaco

    monaco.editor.defineTheme('ide-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editorGutter.addedBackground': '#22c55e80',
        'editorGutter.modifiedBackground': '#f59e0b80',
        'editorGutter.deletedBackground': '#ef444480',
      }
    })
    monaco.editor.setTheme('ide-dark')

    if (filePath && onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
        const freshContent = editor.getValue()
        await onSave(freshContent)
        originalValueRef.current = freshContent
        applyGutterDecorations(editor, monaco, freshContent, freshContent)
      })
    }
  }

  function applyGutterDecorations(editor: any, monaco: Monaco, original: string, current: string) {
    const oldLines = original.split('\n')
    const newLines = current.split('\n')
    const maxLen = Math.max(oldLines.length, newLines.length)

    const decorations: any[] = []
    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]
      if (oldLine === undefined) {
        decorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, 1),
          options: { isWholeLine: true, linesDecorationsClassName: 'diff-line-added' }
        })
      } else if (newLine === undefined) {
        decorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, 1),
          options: { isWholeLine: true, linesDecorationsClassName: 'diff-line-deleted' }
        })
      } else if (oldLine !== newLine) {
        decorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, 1),
          options: { isWholeLine: true, linesDecorationsClassName: 'diff-line-modified' }
        })
      }
    }

    if (decorationCollectionRef.current) {
      decorationCollectionRef.current.clear()
    }
    decorationCollectionRef.current = editor.createDecorationsCollection(decorations)
  }

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      originalValueRef.current = value
      applyGutterDecorations(editorRef.current, monacoRef.current, value, value)
    }
  }, [filePath])

  function handleEditorChange(newValue: string | undefined) {
    const content = newValue || ''
    onChange(content)
    if (editorRef.current && monacoRef.current) {
      applyGutterDecorations(editorRef.current, monacoRef.current, originalValueRef.current, content)
    }
  }

  const getLanguageFromPath = (path: string | null | undefined) => {
    if (language) return language
    if (!path) return 'javascript'
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript'
      case 'js': case 'jsx': return 'javascript'
      case 'json': return 'json'
      case 'css': return 'css'
      case 'scss': return 'scss'
      case 'html': case 'htm': return 'html'
      case 'md': return 'markdown'
      case 'py': return 'python'
      case 'rs': return 'rust'
      case 'go': return 'go'
      case 'java': return 'java'
      case 'c': case 'cpp': case 'h': case 'hpp': return 'c'
      case 'sh': case 'bash': return 'shell'
      case 'sql': return 'sql'
      case 'xml': return 'xml'
      case 'yaml': case 'yml': return 'yaml'
      case 'toml': return 'toml'
      default: return 'plaintext'
    }
  }

  return (
    <Editor
      height={height}
      width="100%"
      theme="ide-dark"
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
        glyphMargin: true,
      }}
    />
  )
}
