'use client'

import { useEffect } from 'react'
import { animate } from 'animejs'

export interface FileModificationEvent {
  path: string
  insertions: number
  deletions: number
}

export function useEditorAnimation(
  editorRef: React.MutableRefObject<any>,
  animationEvent: FileModificationEvent | null,
  currentPath: string | null | undefined
) {
  useEffect(() => {
    if (!animationEvent || !editorRef.current || !currentPath) return
    if (animationEvent.path !== currentPath) return

    const editor = editorRef.current
    const domNode = editor.getDomNode?.() || editor._domElement
    if (!domNode) return

    const viewLines = domNode.querySelectorAll('.view-line')
    if (!viewLines.length) return

    const targets: HTMLElement[] = []
    viewLines.forEach((el: Element) => {
      targets.push(el as HTMLElement)
    })

    const animation = animate(targets, {
      opacity: [0.3, 0],
      scaleX: [0.995, 1],
      translateX: ['-2px', '0px'],
      duration: 1400,
      easing: 'easeOutExpo',
      delay: ((_el: any, i: number) => i * 8) as any,
    })

    return () => {
      if (animation) animation.revert()
    }
  }, [animationEvent, editorRef, currentPath])
}
