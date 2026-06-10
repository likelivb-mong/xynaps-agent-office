import { useState, useEffect } from 'react'
import type { GameFlowSheet, GameFlowSection, GameStep } from '../../types'
import { SearchIcon, LockIcon, ZapIcon } from '../ui/Icon'

// ── Design tokens ──────────────────────────────────────────────────────────
export const PALETTES = [
  { accent: '#a78bfa', dim: 'rgba(167,139,250,0.10)', line: 'rgba(167,139,250,0.35)' },
  { accent: '#60a5fa', dim: 'rgba(96,165,250,0.10)',  line: 'rgba(96,165,250,0.35)'  },
  { accent: '#34d399', dim: 'rgba(52,211,153,0.10)',  line: 'rgba(52,211,153,0.35)'  },
  { accent: '#fb923c', dim: 'rgba(251,146,60,0.10)',  line: 'rgba(251,146,60,0.35)'  },
  { accent: '#f472b6', dim: 'rgba(244,114,182,0.10)', line: 'rgba(244,114,182,0.35)' },
]
export const COL = {
  xkit: { fg: 'rgba(74,222,128,0.90)',  bg: 'rgba(74,222,128,0.13)',  glow: 'rgba(74,222,128,0.25)',  icon: <SearchIcon width={13} height={13} />, label: 'Xkit'  },
  key:  { fg: 'rgba(251,191,36,0.90)',  bg: 'rgba(251,191,36,0.12)',  glow: 'rgba(251,191,36,0.22)',  icon: <LockIcon  width={13} height={13} />, label: 'Lock'  },
  dev:  { fg: 'rgba(96,165,250,0.90)',  bg: 'rgba(96,165,250,0.13)',  glow: 'rgba(96,165,250,0.25)',  icon: <ZapIcon   width={13} height={13} />, label: 'Dev'   },
}

export const FLAG_FIELDS = ['xkit', 'key', 'dev'] as const
export type FlagField = typeof FLAG_FIELDS[number]

export function getSectionAlphaLabel(index: number): string {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

export function stepGroupId(step: GameStep): string {
  return step.stepGroup ?? step.id
}

export function renumberSteps(steps: GameStep[]): GameStep[] {
  return steps.map((step, index) => ({ ...step, step: index + 1 }))
}

export function computeStepLabels(steps: GameStep[]): Record<string, string> {
  const labels: Record<string, string> = {}
  let i = 0
  let main = 0
  while (i < steps.length) {
    const group = stepGroupId(steps[i])
    let j = i + 1
    while (j < steps.length && stepGroupId(steps[j]) === group) j += 1
    main += 1
    const size = j - i
    for (let k = i; k < j; k += 1) {
      labels[steps[k].id] = size === 1 ? `${main}` : `${main}-${k - i + 1}`
    }
    i = j
  }
  return labels
}

// ── Shared editing hook ──────────────────────────────────────────────────────
// 테이블 뷰와 카드 뷰가 동일한 편집 동작(추가/삭제/플래그/드래그앤드롭)을 공유한다.
export function useGameFlowEditing(sheet: GameFlowSheet, onChange: (sheet: GameFlowSheet) => void) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  // 드래그 앤 드롭 상태
  const [armedDragId, setArmedDragId] = useState<string | null>(null)
  const [draggingStep, setDraggingStep] = useState<{ secId: string; stepId: string } | null>(null)
  const [dragOver, setDragOver] = useState<{ stepId: string; pos: 'before' | 'after' } | null>(null)

  // 핸들에서 마우스 떼면 armed 해제 (드래그 시작 안 하고 그냥 클릭한 경우)
  useEffect(() => {
    if (!armedDragId) return
    const onUp = () => setArmedDragId(null)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [armedDragId])

  function updateSection(id: string, patch: Partial<GameFlowSection>) {
    onChange({ ...sheet, sections: sheet.sections.map(s => s.id === id ? { ...s, ...patch } : s) })
  }
  function updateStep(secId: string, stepId: string, patch: Partial<GameStep>) {
    onChange({
      ...sheet,
      sections: sheet.sections.map(s =>
        s.id === secId
          ? { ...s, steps: s.steps.map(st => st.id === stepId ? { ...st, ...patch } : st) }
          : s
      ),
    })
  }
  function addStep(secId: string) {
    const sec = sheet.sections.find(s => s.id === secId)!
    const newStep: GameStep = {
      id: crypto.randomUUID(), step: sec.steps.length + 1,
      clue: '', story: '', input: '', xkit: false, key: false, dev: false,
      output: '', auto: false, problemType: '',
    }
    updateSection(secId, { steps: [...sec.steps, newStep] })
  }
  function deleteStep(secId: string, stepId: string) {
    const sec = sheet.sections.find(s => s.id === secId)!
    updateSection(secId, { steps: renumberSteps(sec.steps.filter(st => st.id !== stepId)) })
  }
  // ── 드래그 앤 드롭 ─────────────────────────────────────────────────────────
  function handleRowDragStart(e: React.DragEvent, secId: string, stepId: string) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${secId}:${stepId}`)
    setDraggingStep({ secId, stepId })
  }
  function handleRowDragOver(e: React.DragEvent, _secId: string, stepId: string) {
    if (!draggingStep) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    if (dragOver?.stepId !== stepId || dragOver.pos !== pos) {
      setDragOver({ stepId, pos })
    }
  }
  function handleRowDrop(e: React.DragEvent, targetSecId: string, targetStepId: string) {
    if (!draggingStep) return
    e.preventDefault()
    const srcSec = sheet.sections.find(s => s.id === draggingStep.secId)
    const tgtSec = sheet.sections.find(s => s.id === targetSecId)
    if (!srcSec || !tgtSec) { clearDrag(); return }
    const fromIdx = srcSec.steps.findIndex(st => st.id === draggingStep.stepId)
    if (fromIdx < 0) { clearDrag(); return }
    const sameSection = draggingStep.secId === targetSecId

    if (sameSection) {
      let toIdx = tgtSec.steps.findIndex(st => st.id === targetStepId)
      if (toIdx < 0 || fromIdx === toIdx) { clearDrag(); return }
      if (dragOver?.pos === 'after') toIdx++
      const steps = [...tgtSec.steps]
      const [moved] = steps.splice(fromIdx, 1)
      if (fromIdx < toIdx) toIdx--
      steps.splice(toIdx, 0, moved)
      updateSection(targetSecId, { steps: renumberSteps(steps) })
    } else {
      // 섹션 간 이동: 한 번의 onChange로 두 섹션 모두 업데이트
      const moved = srcSec.steps[fromIdx]
      const srcSteps = srcSec.steps.filter(st => st.id !== draggingStep.stepId)
      let toIdx = tgtSec.steps.findIndex(st => st.id === targetStepId)
      if (toIdx < 0) toIdx = tgtSec.steps.length
      else if (dragOver?.pos === 'after') toIdx++
      const tgtSteps = [...tgtSec.steps]
      tgtSteps.splice(toIdx, 0, moved)
      onChange({
        ...sheet,
        sections: sheet.sections.map(s => {
          if (s.id === draggingStep.secId) return { ...s, steps: renumberSteps(srcSteps) }
          if (s.id === targetSecId) return { ...s, steps: renumberSteps(tgtSteps) }
          return s
        }),
      })
    }
    clearDrag()
  }
  // 빈 섹션이나 섹션 헤더로 드래그된 경우의 드롭 처리 — 섹션 끝에 붙임
  function handleSectionDragOver(e: React.DragEvent) {
    if (!draggingStep) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function handleSectionDrop(e: React.DragEvent, targetSecId: string) {
    if (!draggingStep) return
    e.preventDefault()
    e.stopPropagation()
    const srcSec = sheet.sections.find(s => s.id === draggingStep.secId)
    const tgtSec = sheet.sections.find(s => s.id === targetSecId)
    if (!srcSec || !tgtSec) { clearDrag(); return }
    const moved = srcSec.steps.find(st => st.id === draggingStep.stepId)
    if (!moved) { clearDrag(); return }
    if (draggingStep.secId === targetSecId) { clearDrag(); return }
    const srcSteps = srcSec.steps.filter(st => st.id !== draggingStep.stepId)
    const tgtSteps = [...tgtSec.steps, moved]
    onChange({
      ...sheet,
      sections: sheet.sections.map(s => {
        if (s.id === draggingStep.secId) return { ...s, steps: renumberSteps(srcSteps) }
        if (s.id === targetSecId) return { ...s, steps: renumberSteps(tgtSteps) }
        return s
      }),
    })
    clearDrag()
  }
  function clearDrag() {
    setDraggingStep(null)
    setDragOver(null)
    setArmedDragId(null)
  }
  function toggleStepFlag(secId: string, stepId: string, field: FlagField, nextValue: boolean) {
    const sec = sheet.sections.find(s => s.id === secId)
    if (!sec) return
    const idx = sec.steps.findIndex(st => st.id === stepId)
    if (idx < 0) return
    const step = sec.steps[idx]

    if (!nextValue) {
      updateStep(secId, stepId, { [field]: false } as Partial<GameStep>)
      return
    }

    const selected = FLAG_FIELDS.filter(flag => step[flag])
    if (selected.length === 0) {
      updateStep(secId, stepId, { [field]: true } as Partial<GameStep>)
      return
    }
    if (selected.length === 1 && selected[0] === field) return

    const groupId = step.stepGroup ?? crypto.randomUUID()
    const mergedFlags = FLAG_FIELDS.filter(flag => selected.includes(flag) || flag === field)
    const replacement = mergedFlags.map((flag, rowIndex) => ({
      ...step,
      id: rowIndex === 0 ? step.id : crypto.randomUUID(),
      stepGroup: groupId,
      xkit: false,
      key: false,
      dev: false,
      [flag]: true,
    }))

    const nextSteps = [
      ...sec.steps.slice(0, idx),
      ...replacement,
      ...sec.steps.slice(idx + 1),
    ]
    updateSection(secId, { steps: renumberSteps(nextSteps) })
  }
  function addSection() {
    onChange({ ...sheet, sections: [...sheet.sections, { id: crypto.randomUUID(), title: '새 섹션', steps: [] }] })
  }
  function deleteSection(id: string) {
    if (!confirm('이 섹션을 삭제하시겠어요?')) return
    onChange({ ...sheet, sections: sheet.sections.filter(s => s.id !== id) })
  }
  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function exportCSV() {
    const rows = ['섹션,Step,Clue,Story,IN PUT,Xkit,Lock,Dev,OUT PUT,메모']
    sheet.sections.forEach(sec => {
      const labels = computeStepLabels(sec.steps)
      sec.steps.forEach(st => {
        rows.push([sec.title, labels[st.id] ?? st.step, st.clue, st.story || '', st.input, st.xkit ? '✓' : '', st.key ? '✓' : '', st.dev ? '✓' : '', st.output, st.note || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      })
    })
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: '게임플로우시트.csv' })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return {
    collapsed, toggleCollapse,
    hoveredRow, setHoveredRow,
    armedDragId, setArmedDragId, draggingStep, dragOver,
    updateSection, updateStep, addStep, deleteStep, toggleStepFlag,
    addSection, deleteSection, exportCSV,
    handleRowDragStart, handleRowDragOver, handleRowDrop,
    handleSectionDragOver, handleSectionDrop, clearDrag,
  }
}
