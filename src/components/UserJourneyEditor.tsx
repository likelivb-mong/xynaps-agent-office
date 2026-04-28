import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  UserFlowConfig,
  UserJourneyDevTriggerType,
  UserJourneyEdge,
  UserJourneyFileType,
  UserJourneyGraph,
  UserJourneyNode,
  UserJourneyNodeType,
  UserJourneyStepChildType,
  UserJourneyViewport,
} from '../types'
import { PlusIcon, TrashIcon, RefreshIcon, SunIcon, MoonIcon, DownloadIcon, SearchIcon, LockIcon, ZapIcon } from './ui/Icon'

interface SectionLite {
  id: string
  title: string
}

interface StepLite {
  id: string
  sectionId: string
  sectionTitle: string
  clue: string
  story?: string
  input?: string
  xkit?: boolean
  key?: boolean
  dev?: boolean
  output?: string
  globalIndex: number
  displayIndex?: string
}

interface Props {
  userFlow: UserFlowConfig
  projectName?: string
  sections: SectionLite[]
  steps: StepLite[]
  onChangeUserFlow: (next: UserFlowConfig) => void
}

const CANVAS_WIDTH = 2800
const CANVAS_HEIGHT = 1800

const NODE_TYPE_OPTIONS: Array<{ value: UserJourneyNodeType; label: string }> = [
  { value: 'theme', label: 'Theme' },
  { value: 'room', label: 'Room' },
  { value: 'step', label: 'Step' },
  { value: 'file', label: 'File' },
  { value: 'xkit', label: 'Xkit' },
  { value: 'dev', label: 'Dev' },
]

const FILE_TYPE_OPTIONS: UserJourneyFileType[] = ['Clues', 'Audio', 'Video']
const DEV_TRIGGER_OPTIONS: Array<{ value: UserJourneyDevTriggerType; label: string; short: string }> = [
  { value: 'button', label: '버튼', short: 'BUTTON' },
  { value: 'open', label: '열림', short: 'OPEN' },
  { value: 'close', label: '닫힘', short: 'CLOSE' },
  { value: 'puton', label: '올리기', short: 'PUTON' },
  { value: 'remove', label: '제거', short: 'REMOVE' },
  { value: 'key', label: '키', short: 'KEY' },
]

const TYPE_COLOR: Record<UserJourneyNodeType, string> = {
  theme: '#ffffff',
  room: '#84cc16',
  step: '#a78bfa',
  file: '#f59e0b',
  xkit: '#b6ff61',
  dev: '#4da6ff',
}

const FILE_TYPE_META: Record<UserJourneyFileType, { label: string; short: string; color: string; bg: string }> = {
  Clues: { label: 'Clues', short: 'CLUE', color: '#f59e0b', bg: '#f59e0b22' },
  Audio: { label: 'Audio', short: 'AUDIO', color: '#22d3ee', bg: '#22d3ee22' },
  Video: { label: 'Video', short: 'VIDEO', color: '#f472b6', bg: '#f472b622' },
}

const DEFAULT_VIEWPORT: UserJourneyViewport = { x: 280, y: 260, zoom: 1 }

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function getSectionAlphaLabel(index: number): string {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

function stripSectionPrefix(title: string): string {
  return title.replace(/^\s*[A-Z]{1,3}\s*[.)\-:]\s*/i, '').trim()
}

function getSectionPlainTitle(title: string): string {
  return stripSectionPrefix(title) || title.trim()
}

function normalizeNodeType(type: string | undefined): UserJourneyNodeType {
  if (type === 'theme' || type === 'room' || type === 'step' || type === 'file' || type === 'xkit' || type === 'dev') return type
  if (type === 'choice') return 'room'
  if (type === 'stage') return 'step'
  return 'file'
}

function normalizeFileType(type: string | undefined): UserJourneyFileType {
  if (type === 'Clues' || type === 'Audio' || type === 'Video') return type
  return 'Clues'
}

function normalizePageUrl(value: string | undefined): string | undefined {
  const text = value?.trim()
  if (!text) return undefined
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(text)) return text
  return `https://${text}`
}

function normalizeStepColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  const c = color.trim().toLowerCase()
  if (c === '#60a5fa' || c === '#3b82f6' || c === '#38bdf8' || c === '#818cf8') return TYPE_COLOR.step
  return color
}

function normalizeDevTriggerType(type: string | undefined): UserJourneyDevTriggerType {
  if (type === 'button' || type === 'open' || type === 'close' || type === 'puton' || type === 'remove' || type === 'key') return type
  return 'button'
}

function normalizeRoomStepDescription(value: string | undefined): string {
  if (!value) return 'STEP 0개'
  const direct = value.match(/^STEP\s*(\d+)\s*개$/i)
  if (direct) return `STEP ${direct[1]}개`
  const legacy = value.match(/(\d+)\s*개\s*단계/)
  if (legacy) return `STEP ${legacy[1]}개`
  return value
}

function getNodeDefaultColor(node: Pick<UserJourneyNode, 'type' | 'fileType'>): string {
  if (node.type === 'file' || node.type === 'xkit') {
    return FILE_TYPE_META[normalizeFileType(node.fileType)].color
  }
  return TYPE_COLOR[node.type]
}

function isWhiteColor(color: string): boolean {
  const c = color.trim().toLowerCase()
  return c === '#fff' || c === '#ffffff' || c === 'white' || c === 'rgb(255,255,255)' || c === 'rgb(255, 255, 255)'
}

function upsertEdge(edges: UserJourneyEdge[], source: string, target: string, label?: string): UserJourneyEdge[] {
  const exists = edges.find(e => e.source === source && e.target === target)
  if (exists) {
    if (label !== undefined && label !== exists.label) {
      return edges.map(e => (e.id === exists.id ? { ...e, label } : e))
    }
    return edges
  }
  return [...edges, { id: makeId('edge'), source, target, label, type: 'flow' }]
}

function summarizeStory(story: string | undefined): string {
  const text = (story ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 64 ? `${text.slice(0, 64)}…` : text
}

function onOff(value: boolean | undefined): string {
  return value ? 'ON' : 'OFF'
}

function normalizeIoText(value: string | undefined): string {
  const text = (value ?? '').trim()
  return text || '—'
}

function buildStepAutoDescription(step: StepLite | undefined): string {
  if (!step) return ''
  const story = summarizeStory(step.story)
  const clue = (step.clue ?? '').trim()
  const input = (step.input ?? '').trim()
  const answer = (step.output ?? '').trim()
  return [
    `CLUE: ${clue || '—'}`,
    `STORY: ${story || '—'}`,
    `IN PUT: ${input || '—'}`,
    `Xkit: ${onOff(step.xkit)}`,
    `Lock: ${onOff(step.key)}`,
    `Dev: ${onOff(step.dev)}`,
    `OUT PUT: ${answer || '—'}`,
  ].join(' · ')
}

function isAutoStepDescription(desc: string | undefined, step: StepLite | undefined): boolean {
  if (!desc) return true
  if (!step) return false
  const d = desc.trim()
  if (!d) return true
  if (d === `${step.sectionTitle} #${step.globalIndex}`) return true
  if (d === step.sectionTitle) return true
  if (d === buildStepAutoDescription(step)) return true
  if (d.includes('CLUE:') && d.includes('IN PUT:') && d.includes('OUT PUT:')) return true
  if (d.startsWith('Story 요약:') || d.startsWith('정답:')) return true
  return false
}

function getStepChildTypeFromTable(step: StepLite | undefined): UserJourneyStepChildType {
  if (step?.key) return 'file'
  if (step?.dev) return 'dev'
  if (step?.xkit) return 'xkit'
  return 'file'
}

function buildTableSyncKey(sections: SectionLite[], steps: StepLite[]): string {
  return JSON.stringify({
    sections: sections.map(section => ({ id: section.id, title: section.title })),
    steps: steps.map(step => ({
      id: step.id,
      sectionId: step.sectionId,
      sectionTitle: step.sectionTitle,
      clue: step.clue,
      story: step.story ?? '',
      input: step.input ?? '',
      xkit: Boolean(step.xkit),
      key: Boolean(step.key),
      dev: Boolean(step.dev),
      output: step.output ?? '',
      globalIndex: step.globalIndex,
      displayIndex: step.displayIndex ?? String(step.globalIndex),
    })),
  })
}

function buildBaseGraph(userFlow: UserFlowConfig, sections: SectionLite[], steps: StepLite[], projectName?: string): UserJourneyGraph {
  const existing = userFlow.graph
  const stepById = new Map(steps.map(step => [step.id, step]))
  const sectionIndexById = new Map(sections.map((section, index) => [section.id, index]))
  const sectionById = new Map(sections.map(section => [section.id, section]))
  if (existing) {
    const validStepIds = new Set(steps.map(s => s.id))
    const nodes = existing.nodes.filter(n => !n.sourceStepId || validStepIds.has(n.sourceStepId))
    const nodeIds = new Set(nodes.map(n => n.id))
    const edges = existing.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    return {
      ...existing,
      nodes: nodes.map(node => {
        const normalizedType = node.id === 'journey-root' ? 'theme' : normalizeNodeType(node.type)
        const migratedType = normalizedType === 'file' && (node.fileType as string | undefined) === 'Xkit'
          ? 'xkit'
          : normalizedType
        const linkedStep = node.sourceStepId ? stepById.get(node.sourceStepId) : undefined
        const autoDesc = buildStepAutoDescription(linkedStep)
        const normalizedDescription = migratedType === 'step'
          ? (isAutoStepDescription(node.description, linkedStep) ? (autoDesc || node.description) : node.description)
          : node.description
        return {
          ...node,
          type: migratedType,
          style: migratedType === 'step' ? { ...node.style, color: normalizeStepColor(node.style?.color) } : node.style,
          stepChildType: migratedType === 'step'
            ? (linkedStep
              ? getStepChildTypeFromTable(linkedStep)
              : ((node.stepChildType === 'xkit' || node.stepChildType === 'file' || node.stepChildType === 'dev') ? node.stepChildType : 'file'))
            : undefined,
          fileType: migratedType === 'file' || migratedType === 'xkit' ? normalizeFileType(node.fileType) : undefined,
          devTriggerType: migratedType === 'dev' ? normalizeDevTriggerType(node.devTriggerType) : undefined,
          stepLabel: migratedType === 'step' ? (linkedStep?.displayIndex ?? node.stepLabel) : undefined,
          title: (() => {
            if (node.id === 'journey-root') return projectName?.trim() || userFlow.title?.trim() || node.title
            if (migratedType === 'room' && node.id.startsWith('section-')) {
              const sectionId = node.id.slice('section-'.length)
              const sectionIndex = sectionIndexById.get(sectionId)
              if (sectionIndex !== undefined) {
                const section = sectionById.get(sectionId)
                const rawTitle = userFlow.branchTitles?.[sectionId] || section?.title || node.title
                return getSectionPlainTitle(rawTitle)
              }
            }
            return node.title
          })(),
          description: node.id === 'journey-root' ? (node.description?.trim() || 'User Flow') : normalizedDescription,
        }
      }),
      edges,
      viewport: existing.viewport ?? DEFAULT_VIEWPORT,
      theme: existing.theme ?? userFlow.theme ?? 'dark',
    }
  }

  const nodes: UserJourneyNode[] = []
  const edges: UserJourneyEdge[] = []

  const rootId = 'journey-root'
  nodes.push({
    id: rootId,
      title: projectName?.trim() || userFlow.title?.trim() || '게임플로우 프로젝트',
      description: 'User Flow',
      type: 'theme',
      x: 180,
      y: 540,
      style: { color: TYPE_COLOR.theme, status: 'active' },
  })

  sections.forEach((section, sectionIndex) => {
    const sectionNodeId = `section-${section.id}`
    const branchTitle = getSectionPlainTitle(userFlow.branchTitles?.[section.id] || section.title)
    const sectionSteps = steps.filter(step => step.sectionId === section.id)

    nodes.push({
      id: sectionNodeId,
      title: branchTitle,
      description: `STEP ${sectionSteps.length}개`,
      type: 'room',
      roomName: section.title,
      x: 520,
      y: 240 + sectionIndex * 280,
      style: { color: '#84cc16', status: 'default' },
    })

    edges.push({ id: makeId('edge'), source: rootId, target: sectionNodeId, type: 'branch' })

    sectionSteps.forEach((step, stepIndex) => {
      const stepNodeId = `step-${step.id}`
      const stepTitle = userFlow.stepTitles?.[step.id] || step.clue
      nodes.push({
        id: stepNodeId,
        title: stepTitle,
        description: buildStepAutoDescription(step),
        type: 'step',
        stepChildType: getStepChildTypeFromTable(step),
        roomName: step.sectionTitle,
        stepOrder: step.globalIndex,
        stepLabel: step.displayIndex ?? String(step.globalIndex),
        x: 860 + Math.floor(stepIndex / 3) * 320,
        y: 170 + sectionIndex * 280 + (stepIndex % 3) * 86,
        sourceStepId: step.id,
        style: { color: TYPE_COLOR.step, status: 'default' },
      })
      edges.push({ id: makeId('edge'), source: sectionNodeId, target: stepNodeId, type: 'flow' })

      const derivedChildren: Array<{ id: string; type: UserJourneyNodeType }> = []
      if (step.key) derivedChildren.push({ id: `step-file-${step.id}`, type: 'file' })
      if (step.xkit) derivedChildren.push({ id: `step-xkit-${step.id}`, type: 'xkit' })
      if (step.dev) derivedChildren.push({ id: `step-dev-${step.id}`, type: 'dev' })

      derivedChildren.forEach((child, childIndex) => {
        nodes.push({
          id: child.id,
          title: normalizeIoText(step.input),
          description: normalizeIoText(step.output),
          type: child.type,
          fileType: child.type === 'file' || child.type === 'xkit' ? 'Clues' : undefined,
          devTriggerType: child.type === 'dev' ? 'button' : undefined,
          sourceStepId: step.id,
          x: 1240 + Math.floor(childIndex / 3) * 280,
          y: 170 + sectionIndex * 280 + (childIndex % 3) * 84,
          style: { color: TYPE_COLOR[child.type], status: 'default' },
        })
        edges.push({ id: makeId('edge'), source: stepNodeId, target: child.id, type: 'result' })
      })

      const linked = userFlow.stepLinks?.[step.id] ?? []
      linked.forEach((link, linkIndex) => {
        const linkNodeId = `step-link-${step.id}-${link.id}`
        const offset = derivedChildren.length
        nodes.push({
          id: linkNodeId,
          title: link.title,
          type: 'file',
          fileType: 'Clues',
          description: '연결 결과',
          x: 1240 + Math.floor((offset + linkIndex) / 3) * 280,
          y: 170 + sectionIndex * 280 + ((offset + linkIndex) % 3) * 84,
          style: { color: '#111827', status: 'default' },
        })
        edges.push({ id: makeId('edge'), source: stepNodeId, target: linkNodeId, type: 'result' })
      })
    })
  })

  return {
    nodes,
    edges,
    viewport: DEFAULT_VIEWPORT,
    theme: userFlow.theme ?? 'dark',
    layoutDirection: 'vertical',
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pathForEdge(source: UserJourneyNode, target: UserJourneyNode) {
  const sx = source.x + 164
  const sy = source.y + 26
  const tx = target.x
  const ty = target.y + 26
  const bend = Math.max(60, Math.abs(tx - sx) * 0.28)
  return `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`
}

function pathForEdgeVertical(source: UserJourneyNode, target: UserJourneyNode) {
  const NODE_H = 52
  const sx = source.x + 82
  const sy = source.y + NODE_H
  const tx = target.x + 82
  const ty = target.y
  const mid = sy + (ty - sy) * 0.5
  // 수직 → 수평 → 수직 꺾임 (엘보우): 곡선 없이 직선만 사용해 선 겹침 최소화
  return `M ${sx} ${sy} L ${sx} ${mid} L ${tx} ${mid} L ${tx} ${ty}`
}

function midpoint(source: UserJourneyNode, target: UserJourneyNode) {
  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  }
}

function layoutGraphLinear(graph: UserJourneyGraph): UserJourneyGraph {
  if (graph.nodes.length === 0) return graph

  const byId = new Map(graph.nodes.map(n => [n.id, n]))
  const outgoing = new Map<string, string[]>()
  const incomingCount = new Map<string, number>()

  graph.nodes.forEach(n => {
    outgoing.set(n.id, [])
    incomingCount.set(n.id, 0)
  })

  graph.edges.forEach(edge => {
    if (!byId.has(edge.source) || !byId.has(edge.target)) return
    outgoing.get(edge.source)!.push(edge.target)
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1)
  })

  const rootIds = graph.nodes
    .filter(n => (incomingCount.get(n.id) || 0) === 0 || n.id === 'journey-root')
    .sort((a, b) => (a.id === 'journey-root' ? -1 : b.id === 'journey-root' ? 1 : a.y - b.y))
    .map(n => n.id)

  const depth = new Map<string, number>()
  const queue: string[] = [...rootIds]
  rootIds.forEach(id => depth.set(id, 0))

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depth.get(current) || 0
    const children = outgoing.get(current) || []
    children.forEach(childId => {
      const prev = depth.get(childId)
      const nextDepth = currentDepth + 1
      if (prev === undefined || nextDepth < prev) {
        depth.set(childId, nextDepth)
        queue.push(childId)
      }
    })
  }

  graph.nodes.forEach(n => {
    if (!depth.has(n.id)) depth.set(n.id, 0)
  })

  const visitOrder = new Map<string, number>()
  let orderIdx = 0
  const seen = new Set<string>()

  function dfs(nodeId: string) {
    if (seen.has(nodeId)) return
    seen.add(nodeId)
    visitOrder.set(nodeId, orderIdx++)
    const children = (outgoing.get(nodeId) || []).slice().sort((a, b) => {
      const na = byId.get(a)
      const nb = byId.get(b)
      if (!na || !nb) return 0
      return na.y - nb.y || na.x - nb.x
    })
    children.forEach(dfs)
  }

  rootIds.forEach(dfs)
  graph.nodes.forEach(n => {
    if (!visitOrder.has(n.id)) visitOrder.set(n.id, orderIdx++)
  })

  const levels = new Map<number, UserJourneyNode[]>()
  const levelById = new Map<string, number>()
  graph.nodes.forEach(node => {
    const d = depth.get(node.id) || 0
    levelById.set(node.id, d)
    if (!levels.has(d)) levels.set(d, [])
    levels.get(d)!.push(node)
  })

  const xStart = 140
  const xGap = 300
  const yGap = 94
  const topPad = 100

  const positioned = graph.nodes.map(n => ({ ...n }))
  const posById = new Map(positioned.map(n => [n.id, n]))

  Array.from(levels.keys()).sort((a, b) => a - b).forEach(level => {
    const nodes = levels.get(level)!.slice().sort((a, b) => {
      return (visitOrder.get(a.id) || 0) - (visitOrder.get(b.id) || 0)
    })

    const totalH = (nodes.length - 1) * yGap
    const centeredTop = Math.max(topPad, Math.floor((CANVAS_HEIGHT - totalH) / 2))

    nodes.forEach((node, i) => {
      const target = posById.get(node.id)
      if (!target) return
      target.x = xStart + level * xGap
      target.y = clamp(centeredTop + i * yGap, topPad, CANVAS_HEIGHT - 120)
    })
  })

  // Keep parent-child vertical alignment when branch is a single chain.
  // This makes "add child" feel anchored to the source node while preserving auto layout.
  const parentsByNode = new Map<string, string[]>()
  graph.edges.forEach(edge => {
    if (!posById.has(edge.source) || !posById.has(edge.target)) return
    if (!parentsByNode.has(edge.target)) parentsByNode.set(edge.target, [])
    parentsByNode.get(edge.target)!.push(edge.source)
  })

  Array.from(levels.keys()).sort((a, b) => a - b).forEach(level => {
    if (level === 0) return
    const levelNodes = (levels.get(level) || [])
      .map(node => posById.get(node.id))
      .filter((node): node is UserJourneyNode => Boolean(node))
      .sort((a, b) => a.y - b.y)

    const placedY: number[] = []
    levelNodes.forEach(node => {
      const parents = parentsByNode.get(node.id) || []
      let desiredY = node.y
      if (parents.length === 1) {
        const parentId = parents[0]
        const parent = posById.get(parentId)
        const siblings = outgoing.get(parentId) || []
        if (parent && siblings.length <= 1) {
          desiredY = parent.y
        }
      }

      let nextY = clamp(desiredY, topPad, CANVAS_HEIGHT - 120)
      while (placedY.some(y => Math.abs(y - nextY) < yGap * 0.78)) {
        nextY += yGap
      }
      node.y = clamp(nextY, topPad, CANVAS_HEIGHT - 120)
      placedY.push(node.y)
    })
  })

  return {
    ...graph,
    nodes: positioned,
  }
}

function layoutGraphVertical(graph: UserJourneyGraph): UserJourneyGraph {
  if (graph.nodes.length === 0) return graph

  const byId = new Map(graph.nodes.map(n => [n.id, n]))
  const outgoing = new Map<string, string[]>()
  const incomingCount = new Map<string, number>()

  graph.nodes.forEach(n => {
    outgoing.set(n.id, [])
    incomingCount.set(n.id, 0)
  })

  graph.edges.forEach(edge => {
    if (!byId.has(edge.source) || !byId.has(edge.target)) return
    outgoing.get(edge.source)!.push(edge.target)
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1)
  })

  const rootIds = graph.nodes
    .filter(n => (incomingCount.get(n.id) || 0) === 0 || n.id === 'journey-root')
    .sort((a, b) => (a.id === 'journey-root' ? -1 : b.id === 'journey-root' ? 1 : a.x - b.x))
    .map(n => n.id)

  const depth = new Map<string, number>()
  const queue: string[] = [...rootIds]
  rootIds.forEach(id => depth.set(id, 0))

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depth.get(current) || 0
    ;(outgoing.get(current) || []).forEach(childId => {
      const prev = depth.get(childId)
      const nextDepth = currentDepth + 1
      if (prev === undefined || nextDepth < prev) {
        depth.set(childId, nextDepth)
        queue.push(childId)
      }
    })
  }

  graph.nodes.forEach(n => {
    if (!depth.has(n.id)) depth.set(n.id, 0)
  })

  const visitOrder = new Map<string, number>()
  let orderIdx = 0
  const seen = new Set<string>()

  function dfs(nodeId: string) {
    if (seen.has(nodeId)) return
    seen.add(nodeId)
    visitOrder.set(nodeId, orderIdx++)
    const children = (outgoing.get(nodeId) || []).slice().sort((a, b) => {
      const na = byId.get(a)
      const nb = byId.get(b)
      if (!na || !nb) return 0
      return na.x - nb.x || na.y - nb.y
    })
    children.forEach(dfs)
  }

  rootIds.forEach(dfs)
  graph.nodes.forEach(n => {
    if (!visitOrder.has(n.id)) visitOrder.set(n.id, orderIdx++)
  })

  const levels = new Map<number, UserJourneyNode[]>()
  graph.nodes.forEach(node => {
    const d = depth.get(node.id) || 0
    if (!levels.has(d)) levels.set(d, [])
    levels.get(d)!.push(node)
  })

  const yStart = 80
  const yGap = 180
  const xGap = 210
  const leftPad = 100

  const positioned = graph.nodes.map(n => ({ ...n }))
  const posById = new Map(positioned.map(n => [n.id, n]))

  Array.from(levels.keys()).sort((a, b) => a - b).forEach(level => {
    const nodes = levels.get(level)!.slice().sort((a, b) =>
      (visitOrder.get(a.id) || 0) - (visitOrder.get(b.id) || 0)
    )
    const totalW = (nodes.length - 1) * xGap
    const centeredLeft = Math.max(leftPad, Math.floor((CANVAS_WIDTH - totalW) / 2))

    nodes.forEach((node, i) => {
      const target = posById.get(node.id)
      if (!target) return
      target.y = yStart + level * yGap
      target.x = clamp(centeredLeft + i * xGap, leftPad, CANVAS_WIDTH - 200)
    })
  })

  const parentsByNode = new Map<string, string[]>()
  graph.edges.forEach(edge => {
    if (!posById.has(edge.source) || !posById.has(edge.target)) return
    if (!parentsByNode.has(edge.target)) parentsByNode.set(edge.target, [])
    parentsByNode.get(edge.target)!.push(edge.source)
  })

  Array.from(levels.keys()).sort((a, b) => a - b).forEach(level => {
    if (level === 0) return
    const levelNodes = (levels.get(level) || [])
      .map(n => posById.get(n.id))
      .filter((n): n is UserJourneyNode => Boolean(n))
      .sort((a, b) => a.x - b.x)

    const placedX: number[] = []
    levelNodes.forEach(node => {
      const parents = parentsByNode.get(node.id) || []
      let desiredX = node.x
      if (parents.length === 1) {
        const parent = posById.get(parents[0])
        const siblings = outgoing.get(parents[0]) || []
        if (parent && siblings.length <= 1) desiredX = parent.x
      }
      let nextX = clamp(desiredX, leftPad, CANVAS_WIDTH - 200)
      while (placedX.some(x => Math.abs(x - nextX) < xGap * 0.78)) nextX += xGap
      node.x = clamp(nextX, leftPad, CANVAS_WIDTH - 200)
      placedX.push(node.x)
    })
  })

  return { ...graph, nodes: positioned }
}

function layoutGraph(graph: UserJourneyGraph): UserJourneyGraph {
  return (graph.layoutDirection ?? 'vertical') === 'vertical'
    ? layoutGraphVertical(graph)
    : layoutGraphLinear(graph)
}

export function UserJourneyEditor({ userFlow, projectName, sections, steps, onChangeUserFlow }: Props) {
  const initializedRef = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const initialCenterAppliedRef = useRef(false)

  const graph = useMemo(() => buildBaseGraph(userFlow, sections, steps, projectName), [projectName, userFlow, sections, steps])
  const stepByIdLookup = useMemo(() => new Map(steps.map(step => [step.id, step])), [steps])
  const sectionAlphaById = useMemo(() => new Map(sections.map((section, index) => [section.id, getSectionAlphaLabel(index)])), [sections])
  const tableSyncKey = useMemo(() => buildTableSyncKey(sections, steps), [sections, steps])
  const isSyncedWithTable = userFlow.tableSyncKey === tableSyncKey

  const [viewport, setViewport] = useState<UserJourneyViewport>(graph.viewport)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [deleteMode, setDeleteMode] = useState<'cascade' | 'reconnect'>('cascade')
  const [connectFromNodeId, setConnectFromNodeId] = useState<string | null>(null)
  const [panState, setPanState] = useState<null | { startX: number; startY: number; startViewport: UserJourneyViewport }>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [inlineEdit, setInlineEdit] = useState<null | { nodeId: string; field: 'title' | 'description'; value: string }>(null)
  const [pendingColor, setPendingColor] = useState<string>('#ffffff')

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (!userFlow.graph) {
      onChangeUserFlow({ ...userFlow, graph, theme: graph.theme, tableSyncKey })
    }
  }, [graph, onChangeUserFlow, tableSyncKey, userFlow])

  useEffect(() => {
    setViewport(graph.viewport)
  }, [graph.viewport.x, graph.viewport.y, graph.viewport.zoom])

  useEffect(() => {
    if (initialCenterAppliedRef.current) return
    if (!boardRef.current) return
    const root = graph.nodes.find(node => node.id === 'journey-root')
    if (!root) return

    const apply = () => {
      if (!boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const zoom = graph.viewport.zoom || 1
      const nextViewport = {
        x: rect.width / 2 - root.x * zoom,
        y: rect.height / 2 - root.y * zoom,
        zoom,
      }
      setViewport(nextViewport)
      initialCenterAppliedRef.current = true
    }

    const raf = window.requestAnimationFrame(apply)
    return () => window.cancelAnimationFrame(raf)
  }, [graph.nodes, graph.viewport.zoom])

  function commitGraph(next: UserJourneyGraph, options?: { markTableSynced?: boolean }) {
    const aligned = layoutGraph(next)
    onChangeUserFlow({
      ...userFlow,
      graph: aligned,
      theme: aligned.theme,
      // Any manual edit inside user flow makes table reflection stale again.
      tableSyncKey: options?.markTableSynced ? tableSyncKey : undefined,
    })
  }

  function patchGraph(mutator: (draft: UserJourneyGraph) => UserJourneyGraph) {
    commitGraph(mutator(graph))
  }

  function getNode(id: string) {
    return graph.nodes.find(n => n.id === id)
  }

  function syncFromTable() {
    const next = buildBaseGraph({ ...userFlow, graph: undefined }, sections, steps, projectName)
    const nextById = new Map(next.nodes.map(node => [node.id, node]))
    const oldById = new Map(graph.nodes.map(node => [node.id, node]))

    const mergedNodes: UserJourneyNode[] = []

    // 1) Keep existing nodes, but refresh table-derived nodes from latest table snapshot.
    graph.nodes.forEach(old => {
      const tableNode = nextById.get(old.id)
      if (!tableNode) {
        mergedNodes.push(old)
        return
      }

      const isTableLinked = Boolean(tableNode.sourceStepId) || old.id === 'journey-root' || old.id.startsWith('section-')
      if (!isTableLinked) {
        mergedNodes.push({ ...old, ...tableNode })
        return
      }

      mergedNodes.push({
        ...tableNode,
        x: old.x,
        y: old.y,
        // Keep user-defined visual/editor choices.
        pageUrl: old.pageUrl,
        type: old.type,
        style: old.style,
        stepChildType: tableNode.type === 'step' ? tableNode.stepChildType : (old.stepChildType ?? tableNode.stepChildType),
        fileType: old.fileType ?? tableNode.fileType,
        devTriggerType: old.devTriggerType ?? tableNode.devTriggerType,
      })
    })

    // 2) Add new table nodes that did not exist before.
    next.nodes.forEach(node => {
      if (!oldById.has(node.id)) mergedNodes.push(node)
    })

    const nodeIds = new Set(mergedNodes.map(node => node.id))
    const mergedEdges = next.edges
      .reduce((acc, edge) => upsertEdge(acc, edge.source, edge.target, edge.label), graph.edges)
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))

    const merged: UserJourneyGraph = {
      ...next,
      viewport,
      theme: graph.theme ?? userFlow.theme ?? 'dark',
      nodes: mergedNodes,
      edges: mergedEdges,
    }
    commitGraph(merged, { markTableSynced: true })
  }

  function addChildNode(parentId: string) {
    const parent = getNode(parentId)
    if (!parent) return
    const nextType: UserJourneyNodeType =
      parent.type === 'theme'
        ? 'room'
        : parent.type === 'room'
          ? 'step'
          : parent.type === 'step'
            ? (parent.stepChildType ?? 'file')
            : 'step'
    const node: UserJourneyNode = {
      id: makeId('node'),
      title: '새 노드',
      description: '',
      type: nextType,
      stepChildType: nextType === 'step' ? 'file' : undefined,
      roomName: parent.roomName,
      stepOrder: nextType === 'step' ? graph.nodes.filter(n => n.type === 'step').length + 1 : undefined,
      fileType: nextType === 'file' || nextType === 'xkit' ? 'Clues' : undefined,
      x: parent.x + 300,
      y: parent.y,
      style: { color: TYPE_COLOR[nextType], status: 'default' },
    }
    patchGraph(prev => ({
      ...prev,
      nodes: [...prev.nodes, node],
      edges: upsertEdge(prev.edges, parentId, node.id),
      viewport,
    }))
    setSelectedNodeIds([node.id])
  }

  function addSiblingNode(nodeId: string) {
    const incoming = graph.edges.find(e => e.target === nodeId)
    const base = getNode(nodeId)
    if (!base) return
    const node: UserJourneyNode = {
      id: makeId('node'),
      title: '형제 노드',
      description: '',
      type: base.type,
      stepChildType: base.type === 'step' ? (base.stepChildType ?? 'file') : undefined,
      roomName: base.roomName,
      stepOrder: base.type === 'step' ? graph.nodes.filter(n => n.type === 'step').length + 1 : undefined,
      fileType: base.type === 'file' || base.type === 'xkit' ? (base.fileType ?? 'Clues') : undefined,
      devTriggerType: base.type === 'dev' ? (base.devTriggerType ?? 'button') : undefined,
      x: base.x,
      y: base.y + 96,
      style: base.style,
    }
    patchGraph(prev => ({
      ...prev,
      nodes: [...prev.nodes, node],
      edges: incoming ? upsertEdge(prev.edges, incoming.source, node.id) : prev.edges,
      viewport,
    }))
    setSelectedNodeIds([node.id])
  }

  function removeNode(nodeId: string) {
    const nodesById = new Map(graph.nodes.map(n => [n.id, n]))
    const childrenMap = new Map<string, string[]>()
    graph.edges.forEach(e => {
      if (!childrenMap.has(e.source)) childrenMap.set(e.source, [])
      childrenMap.get(e.source)!.push(e.target)
    })

    let removeSet = new Set<string>([nodeId])
    if (deleteMode === 'cascade') {
      const queue = [nodeId]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const child of childrenMap.get(current) ?? []) {
          if (!removeSet.has(child)) {
            removeSet.add(child)
            queue.push(child)
          }
        }
      }
    }

    patchGraph(prev => {
      const nodeKeep = prev.nodes.filter(n => !removeSet.has(n.id))
      let edgeKeep = prev.edges.filter(e => !removeSet.has(e.source) && !removeSet.has(e.target))

      if (deleteMode === 'reconnect') {
        const parents = prev.edges.filter(e => e.target === nodeId && !removeSet.has(e.source)).map(e => e.source)
        const children = prev.edges.filter(e => e.source === nodeId && !removeSet.has(e.target)).map(e => e.target)
        for (const p of parents) {
          for (const c of children) {
            edgeKeep = upsertEdge(edgeKeep, p, c)
          }
        }
      }

      return { ...prev, nodes: nodeKeep, edges: edgeKeep, viewport }
    })

    setSelectedNodeIds(prev => prev.filter(id => id !== nodeId))
    if (selectedEdgeId && !nodesById.has(nodeId)) setSelectedEdgeId(null)
  }

  function onNodeClick(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation()

    if (connectFromNodeId && connectFromNodeId !== nodeId) {
      patchGraph(prev => ({
        ...prev,
        edges: upsertEdge(prev.edges, connectFromNodeId, nodeId),
        viewport,
      }))
      setConnectFromNodeId(null)
      return
    }

    const multi = e.metaKey || e.ctrlKey
    setSelectedEdgeId(null)
    if (multi) {
      setSelectedNodeIds(prev => (prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]))
    } else {
      setSelectedNodeIds([nodeId])
    }
  }

  function onEdgeClick(e: React.MouseEvent, edgeId: string) {
    e.stopPropagation()
    setSelectedNodeIds([])
    setSelectedEdgeId(edgeId)
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-node-id]') || target.closest('[data-edge-id]') || target.closest('[data-ui-control]')) return
    setSelectedNodeIds([])
    setSelectedEdgeId(null)
    setConnectFromNodeId(null)

    setPanState({ startX: e.clientX, startY: e.clientY, startViewport: viewport })
  }

  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (panState) {
        const dx = ev.clientX - panState.startX
        const dy = ev.clientY - panState.startY
        setViewport({ ...panState.startViewport, x: panState.startViewport.x + dx, y: panState.startViewport.y + dy })
      }
    }

    function onUp() {
      if (panState) {
        patchGraph(prev => ({ ...prev, viewport }))
        setPanState(null)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panState, viewport])

  function onWheel(e: React.WheelEvent) {
    if (!boardRef.current) return
    e.preventDefault()

    const rect = boardRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const nextZoom = clamp(viewport.zoom + (e.deltaY < 0 ? 0.08 : -0.08), 0.4, 2.2)
    const scale = nextZoom / viewport.zoom
    const nx = mouseX - (mouseX - viewport.x) * scale
    const ny = mouseY - (mouseY - viewport.y) * scale
    const nextViewport = { x: nx, y: ny, zoom: nextZoom }
    setViewport(nextViewport)
    patchGraph(prev => ({ ...prev, viewport: nextViewport }))
  }

  const selectedNode = selectedNodeIds.length === 1 ? getNode(selectedNodeIds[0]) ?? null : null
  const selectedEdge = selectedEdgeId ? graph.edges.find(e => e.id === selectedEdgeId) ?? null : null
  const rootBranchSourceId = selectedNodeIds[0] ?? 'journey-root'
  const highlightFlowNodeId = selectedNode && (selectedNode.type === 'theme' || selectedNode.type === 'room' || selectedNode.type === 'step')
    ? selectedNode.id
    : null
  const highlightFlowColor = selectedNode && (selectedNode.type === 'theme' || selectedNode.type === 'room' || selectedNode.type === 'step')
    ? (selectedNode.style?.color ?? getNodeDefaultColor(selectedNode))
    : null
  const highlightedFlowEdgeIds = useMemo(() => {
    if (!highlightFlowNodeId) return new Set<string>()
    const ids = new Set<string>()

    // 1) 루트 -> 선택 노드 경로 강조
    const stack = [highlightFlowNodeId]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) continue
      visited.add(current)
      graph.edges.forEach(edge => {
        if (edge.target === current) {
          ids.add(edge.id)
          stack.push(edge.source)
        }
      })
    }

    // 2) 선택 노드 -> 하위(정방향) 경로 강조
    const downStack = [highlightFlowNodeId]
    const downVisited = new Set<string>()
    while (downStack.length > 0) {
      const current = downStack.pop()!
      if (downVisited.has(current)) continue
      downVisited.add(current)
      graph.edges.forEach(edge => {
        if (edge.source === current) {
          ids.add(edge.id)
          downStack.push(edge.target)
        }
      })
    }
    return ids
  }, [graph.edges, highlightFlowNodeId])
  const highlightedFlowNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (!highlightFlowNodeId) return ids
    ids.add(highlightFlowNodeId)
    graph.edges.forEach(edge => {
      if (highlightedFlowEdgeIds.has(edge.id)) {
        ids.add(edge.source)
        ids.add(edge.target)
      }
    })
    return ids
  }, [graph.edges, highlightFlowNodeId, highlightedFlowEdgeIds])

  useEffect(() => {
    if (!selectedNode) return
    const current = selectedNode.style?.color ?? getNodeDefaultColor(selectedNode)
    setPendingColor(current)
  }, [selectedNode?.id, selectedNode?.type, selectedNode?.style?.color])

  function updateNode(nodeId: string, patch: Partial<UserJourneyNode>) {
    patchGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => (node.id === nodeId ? { ...node, ...patch } : node)),
      viewport,
    }))
  }

  function startInlineEdit(node: UserJourneyNode, field: 'title' | 'description') {
    setSelectedNodeIds([node.id])
    setSelectedEdgeId(null)
    setInlineEdit({
      nodeId: node.id,
      field,
      value: field === 'title' ? node.title : (node.description ?? ''),
    })
  }

  function commitInlineEdit() {
    if (!inlineEdit) return
    const nextValue = inlineEdit.value.trim()
    if (inlineEdit.field === 'title') {
      updateNode(inlineEdit.nodeId, { title: nextValue || '새 노드' })
    } else {
      updateNode(inlineEdit.nodeId, { description: nextValue })
    }
    setInlineEdit(null)
  }

  function updateEdge(edgeId: string, patch: Partial<UserJourneyEdge>) {
    patchGraph(prev => ({
      ...prev,
      edges: prev.edges.map(edge => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
      viewport,
    }))
  }

  function removeEdge(edgeId: string) {
    patchGraph(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== edgeId), viewport }))
    setSelectedEdgeId(null)
  }

  function reverseEdge(edge: UserJourneyEdge) {
    patchGraph(prev => ({
      ...prev,
      edges: prev.edges.map(e => (e.id === edge.id ? { ...e, source: edge.target, target: edge.source } : e)),
      viewport,
    }))
  }

  function insertNodeOnEdge(edge: UserJourneyEdge) {
    const source = getNode(edge.source)
    const target = getNode(edge.target)
    if (!source || !target) return
    const mid = midpoint(source, target)
    const node: UserJourneyNode = {
      id: makeId('node'),
      title: '중간 노드',
      description: '',
      type: 'step',
      x: mid.x,
      y: mid.y,
      style: { color: TYPE_COLOR.step, status: 'default' },
    }

    patchGraph(prev => ({
      ...prev,
      nodes: [...prev.nodes, node],
      edges: [
        ...prev.edges.filter(e => e.id !== edge.id),
        { id: makeId('edge'), source: edge.source, target: node.id, label: edge.label, type: edge.type },
        { id: makeId('edge'), source: node.id, target: edge.target, type: edge.type },
      ],
      viewport,
    }))

    setSelectedNodeIds([node.id])
    setSelectedEdgeId(null)
  }

  const theme = (graph.theme ?? userFlow.theme ?? 'dark') === 'light' ? 'light' : 'dark'
  const layoutDir = (graph.layoutDirection ?? 'vertical') as 'horizontal' | 'vertical'
  const boardBg = theme === 'dark'
    ? 'radial-gradient(circle at 20% 0%, #0f1832 0%, #0b0f1b 55%, #090c15 100%)'
    : 'radial-gradient(circle at 20% 0%, #f9fafb 0%, #eef2f7 55%, #e6ecf4 100%)'

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 20,
      overflow: 'hidden',
      background: 'var(--bg-card)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => addChildNode(rootBranchSourceId)}
            style={{ ...toolbarBtn, color: 'var(--accent)' }}
            title={selectedNodeIds.length > 0 ? '선택 노드 기준으로 가지 추가' : '루트 기준으로 가지 추가'}
          >
            <PlusIcon width={13} height={13} /> 루트 가지 추가
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setViewport(v => ({ ...v, zoom: clamp(v.zoom - 0.1, 0.4, 2.2) }))} style={toolbarBtn}>-</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 52, textAlign: 'center' }}>{Math.round(viewport.zoom * 100)}%</span>
          <button onClick={() => setViewport(v => ({ ...v, zoom: clamp(v.zoom + 0.1, 0.4, 2.2) }))} style={toolbarBtn}>+</button>
          <button
            onClick={() => {
              const nextDir: 'horizontal' | 'vertical' = layoutDir === 'vertical' ? 'horizontal' : 'vertical'
              patchGraph(prev => ({ ...prev, layoutDirection: nextDir, viewport }))
            }}
            style={toolbarBtn}
            title={layoutDir === 'vertical' ? '가로 정렬로 전환' : '세로 정렬로 전환'}
          >
            {layoutDir === 'vertical' ? '↔ 가로' : '↕ 세로'}
          </button>
          <button
            onClick={() => patchGraph(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light', viewport }))}
            style={toolbarBtn}
            title="테마 전환"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button
            type="button"
            onClick={syncFromTable}
            disabled={isSyncedWithTable}
            title={isSyncedWithTable ? '테이블 반영 최신 상태' : '테이블 기준으로 유저 여정을 반영합니다'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--accent)55',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              cursor: isSyncedWithTable ? 'default' : 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
              fontSize: 12,
              fontWeight: 700,
              opacity: isSyncedWithTable ? 0.7 : 1,
            }}
          >
            <DownloadIcon width={14} height={14} />
            <span>테이블 반영</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 220px)' }}>
        <div
          style={{
            width: panelOpen ? 308 : 0,
            borderRight: panelOpen ? '1px solid var(--border)' : 'none',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
            transition: 'width 0.22s ease, border-color 0.22s ease',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 308,
            opacity: panelOpen ? 1 : 0,
            transition: 'opacity 0.15s ease',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            pointerEvents: panelOpen ? 'auto' : 'none',
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>속성 패널</div>

            {selectedNode ? (
              <>
                <div style={panelTitle}>노드</div>
                <label style={panelLabel}>제목</label>
                <input value={selectedNode.title} onChange={e => updateNode(selectedNode.id, { title: e.target.value })} style={panelInput} />

                <label style={panelLabel}>설명</label>
                <textarea value={selectedNode.description ?? ''} onChange={e => updateNode(selectedNode.id, { description: e.target.value })} rows={3} style={panelTextarea} />

                <label style={panelLabel}>URL 페이지 링크</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={selectedNode.pageUrl ?? ''}
                    onChange={e => updateNode(selectedNode.id, { pageUrl: e.target.value })}
                    style={{ ...panelInput, flex: 1 }}
                    placeholder="https://example.com"
                  />
                  <button
                    title="새 창으로 열기"
                    disabled={!selectedNode.pageUrl?.trim()}
                    onClick={() => {
                      const url = selectedNode.pageUrl?.trim()
                      if (!url) return
                      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer')
                    }}
                    style={{
                      flexShrink: 0,
                      width: 32, height: 32,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: selectedNode.pageUrl?.trim() ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: selectedNode.pageUrl?.trim() ? 'pointer' : 'default',
                      opacity: selectedNode.pageUrl?.trim() ? 1 : 0.4,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <path d="M10 2h4v4M14 2 8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                <label style={panelLabel}>타입</label>
                <select
                  value={selectedNode.type}
                  onChange={e => {
                    const nextType = e.target.value as UserJourneyNodeType
                    updateNode(selectedNode.id, {
                      type: nextType,
                      stepChildType: nextType === 'step' ? (selectedNode.stepChildType ?? 'file') : undefined,
                      fileType: nextType === 'file' || nextType === 'xkit' ? (selectedNode.fileType ?? 'Clues') : undefined,
                      devTriggerType: nextType === 'dev' ? (selectedNode.devTriggerType ?? 'button') : undefined,
                    })
                  }}
                  style={panelInput}
                >
                  {NODE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>

                {selectedNode.type === 'step' && (
                  <>
                    <label style={panelLabel}>Step 하위 타입</label>
                    <select
                      value={selectedNode.stepChildType ?? 'file'}
                      onChange={e => updateNode(selectedNode.id, { stepChildType: e.target.value as UserJourneyStepChildType })}
                      style={panelInput}
                    >
                      <option value="file">File</option>
                      <option value="xkit">Xkit</option>
                      <option value="dev">Dev</option>
                    </select>
                  </>
                )}

                {(selectedNode.type === 'file' || selectedNode.type === 'xkit') && (
                  <>
                    <label style={panelLabel}>{selectedNode.type === 'xkit' ? 'Xkit 세부 타입' : 'File 세부 타입'}</label>
                    <select
                      value={selectedNode.fileType ?? 'Clues'}
                      onChange={e => updateNode(selectedNode.id, { fileType: e.target.value as UserJourneyFileType })}
                      style={panelInput}
                    >
                      {FILE_TYPE_OPTIONS.map(ft => (
                        <option key={ft} value={ft}>
                          {FILE_TYPE_META[ft].short}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {selectedNode.type === 'dev' && (
                  <>
                    <label style={panelLabel}>Dev 트리거 옵션</label>
                    <select
                      value={selectedNode.devTriggerType ?? 'button'}
                      onChange={e => updateNode(selectedNode.id, { devTriggerType: e.target.value as UserJourneyDevTriggerType })}
                      style={panelInput}
                    >
                      {DEV_TRIGGER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {`DEV ${opt.short} · ${opt.label}`}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <label style={panelLabel}>타입 색상 규칙</label>
                <div style={{ display: 'grid', gridTemplateColumns: '42px auto', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={pendingColor}
                    onChange={e => setPendingColor(e.target.value)}
                    style={{
                      width: 42,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      padding: 3,
                      cursor: 'pointer',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => updateNode(selectedNode.id, { style: { ...selectedNode.style, color: pendingColor } })}
                    style={{ ...panelBtn, padding: '7px 10px' }}
                  >
                    적용
                  </button>
                </div>

                <label style={panelLabel}>상태</label>
                <select value={selectedNode.style?.status ?? 'default'} onChange={e => updateNode(selectedNode.id, { style: { ...selectedNode.style, status: e.target.value as any } })} style={panelInput}>
                  <option value="default">default</option>
                  <option value="active">active</option>
                  <option value="warning">warning</option>
                  <option value="done">done</option>
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                  <button onClick={() => addChildNode(selectedNode.id)} style={panelBtn}>하위 추가</button>
                  <button onClick={() => addSiblingNode(selectedNode.id)} style={panelBtn}>형제 추가</button>
                  <button onClick={() => setConnectFromNodeId(selectedNode.id)} style={panelBtn}>연결 시작</button>
                  <button onClick={() => removeNode(selectedNode.id)} style={{ ...panelBtn, color: '#ef4444' }}><TrashIcon width={12} height={12} /> 삭제</button>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                  <div style={panelLabel}>삭제 모드</div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    <label><input type="radio" checked={deleteMode === 'cascade'} onChange={() => setDeleteMode('cascade')} /> 같이 삭제</label>
                    <label><input type="radio" checked={deleteMode === 'reconnect'} onChange={() => setDeleteMode('reconnect')} /> 재연결</label>
                  </div>
                </div>
              </>
            ) : selectedEdge ? (
              <>
                <div style={panelTitle}>연결선</div>
                <label style={panelLabel}>라벨</label>
                <input value={selectedEdge.label ?? ''} onChange={e => updateEdge(selectedEdge.id, { label: e.target.value })} style={panelInput} placeholder="성공 / 실패 / 선택 A" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                  <button onClick={() => reverseEdge(selectedEdge)} style={panelBtn}><RefreshIcon width={12} height={12} /> 방향</button>
                  <button onClick={() => insertNodeOnEdge(selectedEdge)} style={panelBtn}><PlusIcon width={12} height={12} /> 중간삽입</button>
                  <button onClick={() => removeEdge(selectedEdge.id)} style={{ ...panelBtn, color: '#ef4444', gridColumn: '1 / span 2' }}><TrashIcon width={12} height={12} /> 연결 삭제</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                노드나 연결선을 클릭하면 상세 편집이 열립니다. 레이아웃은 자동 직선 정렬되며, 마우스 휠로 확대/축소할 수 있습니다.
              </div>
            )}

            {selectedNodeIds.length > 1 && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedNodeIds.length}개 선택됨 (멀티 선택)
              </div>
            )}
          </div>
        </div>

        <div
          ref={boardRef}
          onMouseDown={onCanvasMouseDown}
          onWheel={onWheel}
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            background: boardBg,
            cursor: panState ? 'grabbing' : connectFromNodeId ? 'crosshair' : 'default',
          }}
        >
          <button
            onClick={() => setPanelOpen(v => !v)}
            onMouseDown={e => e.stopPropagation()}
            data-ui-control="panel-toggle"
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              zIndex: 40,
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
            }}
            title={panelOpen ? '패널 닫기' : '패널 열기'}
          >
            {panelOpen ? '‹' : '›'}
          </button>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}>
            <svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ position: 'absolute', inset: 0 }}>
              {Array.from({ length: 120 }).map((_, i) => (
                <line key={`v-${i}`} x1={i * 24} y1={0} x2={i * 24} y2={CANVAS_HEIGHT} stroke={theme === 'dark' ? '#ffffff08' : '#00000008'} strokeWidth={1} />
              ))}
              {Array.from({ length: 80 }).map((_, i) => (
                <line key={`h-${i}`} x1={0} y1={i * 24} x2={CANVAS_WIDTH} y2={i * 24} stroke={theme === 'dark' ? '#ffffff08' : '#00000008'} strokeWidth={1} />
              ))}

              {graph.edges.map(edge => {
                const source = getNode(edge.source)
                const target = getNode(edge.target)
                if (!source || !target) return null
                const path = layoutDir === 'vertical' ? pathForEdgeVertical(source, target) : pathForEdge(source, target)
                const flowHighlighted = highlightedFlowEdgeIds.has(edge.id)
                const targetRawColor = target.style?.color ?? getNodeDefaultColor(target)
                const targetColor = theme === 'light' && isWhiteColor(targetRawColor) ? '#0f172a' : targetRawColor
                const isDirectChildEdge = Boolean(highlightFlowNodeId) && edge.source === highlightFlowNodeId
                const stroke = selectedEdgeId === edge.id
                  ? '#8b5cf6'
                  : flowHighlighted && highlightFlowColor
                    ? isDirectChildEdge
                      ? `${targetColor}cc`
                      : `${highlightFlowColor}cc`
                    : theme === 'dark'
                      ? '#9ca3af99'
                      : '#64748b99'
                const strokeWidth = selectedEdgeId === edge.id ? 2.2 : flowHighlighted ? 2 : 1.35
                return (
                  <g key={edge.id} data-edge-id={edge.id} onMouseDown={e => onEdgeClick(e, edge.id)}>
                    <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
                    {edge.label && (() => {
                      const m = midpoint(source, target)
                      return (
                        <foreignObject x={m.x - 44} y={m.y - 16} width={88} height={26}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 999, border: '1px solid rgba(255,255,255,0.15)',
                            background: theme === 'dark' ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.92)',
                            fontSize: 10, fontWeight: 700,
                            color: theme === 'dark' ? '#e5e7eb' : '#1f2937',
                            padding: '2px 8px',
                            width: 'fit-content',
                            margin: '0 auto',
                          }}>{edge.label}</div>
                        </foreignObject>
                      )
                    })()}
                  </g>
                )
              })}
            </svg>

            {graph.nodes.map(node => {
              const selected = selectedNodeIds.includes(node.id)
              const isEditingTitle = inlineEdit?.nodeId === node.id && inlineEdit.field === 'title'
              const isEditingDescription = inlineEdit?.nodeId === node.id && inlineEdit.field === 'description'
              const linkedStep = node.type === 'step' && node.sourceStepId ? stepByIdLookup.get(node.sourceStepId) : undefined
              const fileType = normalizeFileType(node.fileType)
              const fileMeta = FILE_TYPE_META[fileType]
              const rawBaseColor = node.type === 'file' || node.type === 'xkit'
                ? (node.style?.color || fileMeta.color)
                : (node.style?.color || TYPE_COLOR[node.type])
              const baseColor = theme === 'light' && isWhiteColor(rawBaseColor) ? '#0f172a' : rawBaseColor
              const nodeFlowHighlighted = highlightedFlowNodeIds.has(node.id)
              const applyTypeEmphasis = (color: string): CSSProperties => (
                nodeFlowHighlighted
                  ? {
                      boxShadow: `0 0 0 2px ${color}2f`,
                      borderColor: `${color}bb`,
                    }
                  : {}
              )
              const nodeBg = theme === 'dark' ? '#0f172aee' : '#ffffffef'
              const nodeText = theme === 'dark' ? '#f8fafc' : '#0f172a'
              const roomAlpha = node.type === 'room' && node.id.startsWith('section-')
                ? sectionAlphaById.get(node.id.slice('section-'.length))
                : undefined
              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  onClick={e => onNodeClick(e, node.id)}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: 164,
                    minHeight: 52,
                    borderRadius: 16,
                    border: selected ? `2px solid ${baseColor}` : `1px solid ${baseColor}66`,
                    background: selected ? `${baseColor}22` : nodeBg,
                    boxShadow: selected ? `0 0 0 3px ${baseColor}30` : '0 10px 20px rgba(0,0,0,0.12)',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: nodeText,
                    transition: 'box-shadow 0.15s, border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      {node.type === 'theme' && (
                        <div style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: baseColor,
                          border: `1px solid ${baseColor}66`,
                          borderRadius: 999,
                          padding: '1px 6px',
                          whiteSpace: 'nowrap',
                          background: theme === 'dark' ? `${baseColor}14` : '#ffffff',
                          ...applyTypeEmphasis(baseColor),
                        }}>
                          THEME
                        </div>
                      )}
                      {node.type === 'room' && (
                        <div style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: '#84cc16',
                          border: '1px solid #84cc1666',
                          borderRadius: 999,
                          padding: '1px 6px',
                          whiteSpace: 'nowrap',
                          ...applyTypeEmphasis('#84cc16'),
                        }}>
                          {roomAlpha ? `ROOM ${roomAlpha}` : 'ROOM'}
                        </div>
                      )}
                      {node.type === 'step' && typeof node.stepOrder === 'number' && (
                        <>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#a78bfa',
                            border: '1px solid #a78bfa66',
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            ...applyTypeEmphasis('#a78bfa'),
                          }}>
                            STEP {node.stepLabel ?? node.stepOrder}
                          </div>
                        </>
                      )}
                      {node.type === 'step' && typeof node.stepOrder !== 'number' && (
                        <>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#a78bfa',
                            border: '1px solid #a78bfa66',
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            ...applyTypeEmphasis('#a78bfa'),
                          }}>
                            STEP
                          </div>
                        </>
                      )}
                      {node.type === 'file' && (
                        <>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#f8fafc',
                            border: `1px solid ${fileMeta.color}55`,
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            background: `${fileMeta.color}88`,
                            ...applyTypeEmphasis(fileMeta.color),
                          }}>
                            FILE
                          </div>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 900,
                            color: fileMeta.color,
                            border: `1px solid ${fileMeta.color}88`,
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            background: theme === 'dark' ? fileMeta.bg : '#ffffff',
                            letterSpacing: 0.3,
                            ...applyTypeEmphasis(fileMeta.color),
                          }}>
                            {fileMeta.short}
                          </div>
                        </>
                      )}
                      {node.type === 'xkit' && (
                        <>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#0b111f',
                            border: '1px solid #b6ff6155',
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            background: '#b6ff61cc',
                            ...applyTypeEmphasis('#b6ff61'),
                          }}>
                            XKIT
                          </div>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 900,
                            color: fileMeta.color,
                            border: `1px solid ${fileMeta.color}88`,
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            background: theme === 'dark' ? fileMeta.bg : '#ffffff',
                            letterSpacing: 0.3,
                            ...applyTypeEmphasis(fileMeta.color),
                          }}>
                            {fileMeta.short}
                          </div>
                        </>
                      )}
                      {node.type === 'dev' && (
                        <>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: '#4da6ff',
                            border: '1px solid #4da6ff66',
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            background: theme === 'dark' ? '#4da6ff20' : '#ffffff',
                            ...applyTypeEmphasis('#4da6ff'),
                          }}>
                            DEV
                          </div>
                          <div style={{
                            fontSize: 9,
                            fontWeight: 900,
                            color: '#4da6ff',
                            border: '1px solid #4da6ff88',
                            borderRadius: 999,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                            background: theme === 'dark' ? '#4da6ff1a' : '#ffffff',
                            letterSpacing: 0.3,
                            ...applyTypeEmphasis('#4da6ff'),
                          }}>
                            {(DEV_TRIGGER_OPTIONS.find(opt => opt.value === normalizeDevTriggerType(node.devTriggerType))?.short ?? 'BUTTON')}
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {node.pageUrl && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            const targetUrl = normalizePageUrl(node.pageUrl)
                            if (!targetUrl) return
                            window.open(targetUrl, '_blank', 'noopener,noreferrer')
                          }}
                          title="페이지 열기"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            border: `1px solid ${baseColor}55`,
                            background: `${baseColor}14`,
                            color: baseColor,
                            fontSize: 11,
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          ↗
                        </button>
                      )}
                      {linkedStep?.xkit && (
                        <span
                          title="Xkit"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `${TYPE_COLOR.xkit}1f`,
                            color: TYPE_COLOR.xkit,
                            border: `1px solid ${TYPE_COLOR.xkit}66`,
                          }}
                        >
                          <SearchIcon width={10} height={10} />
                        </span>
                      )}
                      {linkedStep?.key && (
                        <span
                          title="Lock"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fbbf241f',
                            color: '#fbbf24',
                            border: '1px solid #fbbf2466',
                          }}
                        >
                          <LockIcon width={10} height={10} />
                        </span>
                      )}
                      {linkedStep?.dev && (
                        <span
                          title="Dev"
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#60a5fa1f',
                            color: '#60a5fa',
                            border: '1px solid #60a5fa66',
                          }}
                        >
                          <ZapIcon width={10} height={10} />
                        </span>
                      )}
                      {connectFromNodeId === node.id && <span style={{ fontSize: 10, color: 'var(--accent)' }}>연결중</span>}
                    </div>
                  </div>
                  {isEditingTitle ? (
                    <input
                      autoFocus
                      value={inlineEdit.value}
                      onChange={e => setInlineEdit(prev => (prev ? { ...prev, value: e.target.value } : prev))}
                      onBlur={commitInlineEdit}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitInlineEdit()
                        }
                        if (e.key === 'Escape') setInlineEdit(null)
                      }}
                      style={{
                        ...panelInput,
                        marginTop: 2,
                        padding: '4px 6px',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={e => {
                        e.stopPropagation()
                        startInlineEdit(node, 'title')
                      }}
                      style={{ fontSize: 13, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {node.title}
                    </div>
                  )}
                  {isEditingDescription ? (
                    <textarea
                      autoFocus
                      value={inlineEdit.value}
                      onChange={e => setInlineEdit(prev => (prev ? { ...prev, value: e.target.value } : prev))}
                      onBlur={commitInlineEdit}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setInlineEdit(null)
                      }}
                      rows={2}
                      style={{
                        ...panelTextarea,
                        marginTop: 2,
                        minHeight: 38,
                        padding: '4px 6px',
                        fontSize: 11,
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={e => {
                        e.stopPropagation()
                        startInlineEdit(node, 'description')
                      }}
                      style={{ fontSize: 11, marginTop: 2, opacity: node.description ? 0.72 : 0.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {node.type === 'room'
                        ? normalizeRoomStepDescription(node.description)
                        : (node.description || '설명 추가')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const toolbarBtn: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const panelTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text-primary)',
  paddingTop: 2,
}

const panelLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-muted)',
}

const panelInput: CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  padding: '8px 9px',
  fontSize: 12,
}

const panelTextarea: CSSProperties = {
  ...panelInput,
  resize: 'vertical',
  minHeight: 68,
} as CSSProperties

const panelBtn: CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  padding: '7px 8px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
}
