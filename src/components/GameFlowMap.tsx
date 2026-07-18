import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameFlowSection, GameFlowSheet, GameStep, SkillFile, UserFlowConfig, UserFlowScreen, UserJourneyNode } from '../types'
import { UserJourneyEditor } from './UserJourneyEditor'
import { UploadIcon } from './ui/Icon'
import { STUDIO_TILE, STUDIO_COLS, STUDIO_ROWS, STUDIO_WIDTH, STUDIO_HEIGHT } from '../constants/studioGrid'

interface StepWithContext extends GameStep {
  sectionTitle: string
  sectionId: string
  globalIndex: number
  displayIndex: string
  memberStepIds: string[]
}

interface Props {
  sheet: GameFlowSheet
  floorPlanImage?: SkillFile | null
  onChange: (sheet: GameFlowSheet) => void
  mode?: 'path' | 'user'
  projectName?: string
}

const SECTION_COLORS = ['#9b6dff', '#4da6ff', '#00d4aa', '#ff7043', '#ff6b9d']

// 도면(맵 표면) 라이트/다크 테마. 앱 테마와 별개로 도면만 전환한다 — 밝은 도면은
// 현장 확인·인쇄 대조 시 가독성이 좋다. 선택은 localStorage 에 저장된다.
const MAP_THEMES = {
  dark: {
    surface: '#0d1117',
    surfaceActive: 'radial-gradient(circle, #1a2a3a 0%, #0d1117 100%)',
    gridBg: '#0a0a14', gridLine: '#4a5568', gridOpacity: 0.15,
    labelBg: 'rgba(0,0,0,0.35)',
    pinRing: '#0d1117', pinLightDisc: false,
    answerBg: '#1a1a2e', answerText: '#f0f0f5',
    // 섹션 칸 채움 투명도(hex alpha 접미사). 어두운 배경에선 옅어도 잘 보인다.
    cellFill: '0f', cellFillSelected: '16', cellFillView: '10', cellFillViewSelected: '14',
  },
  light: {
    surface: '#fbfcfe',
    surfaceActive: 'radial-gradient(circle, #edf3fb 0%, #fbfcfe 100%)',
    gridBg: '#f3f5f9', gridLine: '#8d9aad', gridOpacity: 0.35,
    labelBg: 'rgba(255,255,255,0.92)',
    pinRing: '#ffffff', pinLightDisc: true,
    answerBg: '#ffffff', answerText: '#1c2333',
    // 흰 배경에서는 같은 투명도로는 색이 거의 안 보이므로 훨씬 진하게 채운다.
    cellFill: '2e', cellFillSelected: '40', cellFillView: '26', cellFillViewSelected: '38',
  },
} as const
type MapThemeKey = keyof typeof MAP_THEMES
const MAP_THEME_LS_KEY = 'xynaps_passmap_map_theme'
const DEFAULT_SECTION_MAP_BOXES = [
  { x: 2, y: 3, w: 12, h: 11 },
  { x: 15, y: 2, w: 13, h: 12 },
  { x: 29, y: 3, w: 12, h: 11 },
  { x: 2, y: 18, w: 18, h: 13 },
  { x: 21, y: 18, w: 20, h: 13 },
]
const SECTION_CELL_PCT_W = 100 / STUDIO_COLS
const SECTION_CELL_PCT_H = 100 / STUDIO_ROWS

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

function getSectionDisplayTitle(index: number, title: string): string {
  const base = stripSectionPrefix(title) || title.trim()
  return `${getSectionAlphaLabel(index)}. ${base}`
}

function getPinColor(step: GameStep): string {
  if (step.dev) return '#4da6ff'
  if (step.key) return '#00d4aa'
  if (step.xkit) return '#f59e0b'
  if (step.auto) return '#6b7280'
  return '#9b6dff'
}

function getPinBg(step: GameStep): string {
  if (step.dev) return '#1e3a5f'
  if (step.key) return '#1a3a2a'
  if (step.xkit) return '#3a2a00'
  if (step.auto) return '#1a1a1a'
  return '#2a1a4a'
}

function getStepGroupId(step: GameStep): string {
  return step.stepGroup ?? step.id
}

function getSectionMapBox(section: GameFlowSection, index: number) {
  return section.mapBox ?? DEFAULT_SECTION_MAP_BOXES[index % DEFAULT_SECTION_MAP_BOXES.length]
}

function cellKey(x: number, y: number) {
  return `${x},${y}`
}

function parseCellKey(key: string) {
  const [xs, ys] = key.split(',')
  return { x: Number(xs), y: Number(ys) }
}

function getSectionCellSet(section: GameFlowSection, index: number): Set<string> {
  if (section.mapCells && section.mapCells.length > 0) {
    return new Set(section.mapCells)
  }
  const box = getSectionMapBox(section, index)
  const set = new Set<string>()
  for (let x = box.x; x < box.x + box.w; x += 1) {
    for (let y = box.y; y < box.y + box.h; y += 1) {
      set.add(cellKey(x, y))
    }
  }
  return set
}

function getBoxFromCells(cells: Set<string>, fallback: { x: number; y: number; w: number; h: number }) {
  if (cells.size === 0) return fallback
  let minX = STUDIO_COLS
  let minY = STUDIO_ROWS
  let maxX = 0
  let maxY = 0
  cells.forEach(k => {
    const { x, y } = parseCellKey(k)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function clampPinToSectionCells(
  pinX: number | undefined,
  pinY: number | undefined,
  cells: Set<string>,
  fallbackBox: { x: number; y: number; w: number; h: number }
) {
  if (pinX === undefined || pinY === undefined) return { pinX, pinY }
  if (cells.size === 0) {
    const minX = (fallbackBox.x / STUDIO_COLS) * 100
    const maxX = ((fallbackBox.x + fallbackBox.w) / STUDIO_COLS) * 100
    const minY = (fallbackBox.y / STUDIO_ROWS) * 100
    const maxY = ((fallbackBox.y + fallbackBox.h) / STUDIO_ROWS) * 100
    return {
      pinX: Math.max(minX, Math.min(maxX, pinX)),
      pinY: Math.max(minY, Math.min(maxY, pinY)),
    }
  }
  const col = Math.max(0, Math.min(STUDIO_COLS - 1, Math.floor((pinX / 100) * STUDIO_COLS)))
  const row = Math.max(0, Math.min(STUDIO_ROWS - 1, Math.floor((pinY / 100) * STUDIO_ROWS)))

  let best = { x: col, y: row }
  let bestDist = Number.MAX_SAFE_INTEGER
  cells.forEach(k => {
    const p = parseCellKey(k)
    const d = Math.abs(p.x - col) + Math.abs(p.y - row)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  })
  return {
    pinX: ((best.x + 0.5) / STUDIO_COLS) * 100,
    pinY: ((best.y + 0.5) / STUDIO_ROWS) * 100,
  }
}

function buildSectionOutlineSegments(cells: Set<string>) {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  cells.forEach(k => {
    const { x, y } = parseCellKey(k)
    if (!cells.has(cellKey(x, y - 1))) segments.push({ x1: x, y1: y, x2: x + 1, y2: y }) // top
    if (!cells.has(cellKey(x + 1, y))) segments.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 }) // right
    if (!cells.has(cellKey(x, y + 1))) segments.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 }) // bottom
    if (!cells.has(cellKey(x - 1, y))) segments.push({ x1: x, y1: y, x2: x, y2: y + 1 }) // left
  })
  return segments
}

function getSectionLabelAnchor(
  cells: Set<string>,
  fallbackBox: { x: number; y: number; w: number; h: number }
) {
  if (cells.size === 0) return { x: fallbackBox.x, y: fallbackBox.y }
  let bestX = fallbackBox.x
  let bestY = fallbackBox.y
  let initialized = false
  cells.forEach(key => {
    const { x, y } = parseCellKey(key)
    if (!initialized) {
      bestX = x
      bestY = y
      initialized = true
      return
    }
    if (y < bestY || (y === bestY && x < bestX)) {
      bestX = x
      bestY = y
    }
  })
  return { x: bestX, y: bestY }
}

function getSectionCenter(cells: Set<string>) {
  if (cells.size === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  cells.forEach(k => {
    const { x, y } = parseCellKey(k)
    sx += x + 0.5
    sy += y + 0.5
  })
  return { x: sx / cells.size, y: sy / cells.size }
}

type ArrowDirection = 'east' | 'west' | 'south' | 'north'

function getArrowDirection(from: { x: number; y: number }, to: { x: number; y: number }): ArrowDirection {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west'
  return dy >= 0 ? 'south' : 'north'
}

function getArrowGlyph(dir: ArrowDirection) {
  if (dir === 'east') return '→'
  if (dir === 'west') return '←'
  if (dir === 'south') return '↓'
  return '↑'
}

function scaleSectionCells(
  sourceCells: string[],
  fromBox: { x: number; y: number; w: number; h: number },
  toBox: { x: number; y: number; w: number; h: number }
) {
  const next = new Set<string>()
  const fromW = Math.max(1, fromBox.w)
  const fromH = Math.max(1, fromBox.h)
  const toW = Math.max(1, toBox.w)
  const toH = Math.max(1, toBox.h)

  sourceCells.forEach(k => {
    const { x, y } = parseCellKey(k)
    const xStartRatio = (x - fromBox.x) / fromW
    const xEndRatio = (x + 1 - fromBox.x) / fromW
    const yStartRatio = (y - fromBox.y) / fromH
    const yEndRatio = (y + 1 - fromBox.y) / fromH

    const x0 = Math.floor(toBox.x + xStartRatio * toW)
    const x1 = Math.ceil(toBox.x + xEndRatio * toW) - 1
    const y0 = Math.floor(toBox.y + yStartRatio * toH)
    const y1 = Math.ceil(toBox.y + yEndRatio * toH) - 1

    const clampedX0 = Math.max(toBox.x, Math.min(toBox.x + toW - 1, x0))
    const clampedX1 = Math.max(clampedX0, Math.min(toBox.x + toW - 1, x1))
    const clampedY0 = Math.max(toBox.y, Math.min(toBox.y + toH - 1, y0))
    const clampedY1 = Math.max(clampedY0, Math.min(toBox.y + toH - 1, y1))

    for (let tx = clampedX0; tx <= clampedX1; tx += 1) {
      for (let ty = clampedY0; ty <= clampedY1; ty += 1) {
        next.add(cellKey(tx, ty))
      }
    }
  })

  return Array.from(next)
}

function buildUserFlow(sheet: GameFlowSheet, projectName?: string): UserFlowConfig {
  return {
    title: sheet.userFlow?.title?.trim() || projectName?.trim() || '게임플로우 프로젝트',
    description: sheet.userFlow?.description?.trim() || '게임 플로우 스텝을 유저 여정과 연결해 정리하세요.',
    branchTitles: sheet.userFlow?.branchTitles ?? {},
    stepTitles: sheet.userFlow?.stepTitles ?? {},
    stepLinks: sheet.userFlow?.stepLinks ?? {},
    tableSyncKey: sheet.userFlow?.tableSyncKey,
    graph: sheet.userFlow?.graph,
    theme: sheet.userFlow?.theme ?? 'dark',
    screens: (sheet.userFlow?.screens ?? []).map(screen => ({
      ...screen,
      screenKind: screen.screenKind ?? 'manual',
      statusMode: screen.statusMode ?? 'default',
    })),
  }
}

function syncXkitScreens(userFlow: UserFlowConfig, allSteps: StepWithContext[]): UserFlowConfig {
  const graphNodes = userFlow.graph?.nodes ?? []
  const stepById = new Map(allSteps.map(step => [step.id, step]))
  const oldScreens = userFlow.screens ?? []
  const oldScreenById = new Map(oldScreens.map(screen => [screen.id, screen]))
  const manualScreens = oldScreens.filter(screen => !screen.sourceNodeId)
  const oldBaseBySource = new Map(oldScreens.filter(screen => screen.screenKind === 'xkit' && screen.sourceNodeId).map(screen => [screen.sourceNodeId!, screen]))

  const xkitNodes = graphNodes
    .filter((node): node is UserJourneyNode => node.type === 'xkit')
    .slice()
    .sort((a, b) => {
      const sa = a.sourceStepId ? stepById.get(a.sourceStepId)?.globalIndex ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
      const sb = b.sourceStepId ? stepById.get(b.sourceStepId)?.globalIndex ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
      if (sa !== sb) return sa - sb
      if (a.y !== b.y) return a.y - b.y
      return a.x - b.x
    })

  const generatedScreens: UserFlowScreen[] = []
  xkitNodes.forEach((node, index) => {
    const order = index + 1
    const baseId = oldBaseBySource.get(node.id)?.id ?? crypto.randomUUID()
    const oldBase = oldBaseBySource.get(node.id)
    const oldAnswerChain: UserFlowScreen[] = []
    if (oldBase) {
      const visited = new Set<string>()
      let nextId = oldBase.nextScreenId
      while (nextId && !visited.has(nextId)) {
        visited.add(nextId)
        const next = oldScreenById.get(nextId)
        if (!next || next.screenKind !== 'xkit-answer' || next.sourceNodeId !== node.id) break
        oldAnswerChain.push(next)
        nextId = next.nextScreenId
      }
    }
    const statusMode = oldBase?.statusMode ?? 'default'
    const answerChainCount = statusMode === 'answer'
      ? Math.max(1, Math.min(9, oldBase?.answerChainCount ?? Math.max(1, oldAnswerChain.length)))
      : 0
    const answerText = oldBase?.answerText ?? ''
    const baseTitle = `X${order}-${node.title}`
    const baseScreen: UserFlowScreen = {
      id: baseId,
      title: baseTitle,
      caption: oldBase?.caption ?? '',
      linkedStepId: node.sourceStepId ?? oldBase?.linkedStepId,
      imageDataUrl: oldBase?.imageDataUrl,
      imageName: oldBase?.imageName,
      sourceNodeId: node.id,
      screenKind: 'xkit',
      xkitSubtype: oldBase?.xkitSubtype ?? node.fileType ?? 'Clues',
      statusMode,
      answerChainCount,
      answerText,
      nextScreenId: undefined,
    }

    if (statusMode === 'answer') {
      generatedScreens.push(baseScreen)
      let previous = baseScreen
      for (let i = 0; i < answerChainCount; i += 1) {
        const suffix = String.fromCharCode(65 + i)
        const oldAnswer = oldAnswerChain[i]
        const answerId = oldAnswer?.id ?? crypto.randomUUID()
        previous.nextScreenId = answerId
        const answerScreen: UserFlowScreen = {
          id: answerId,
          title: `X${order}${suffix}-${node.title}`,
          caption: oldAnswer?.caption ?? '',
          linkedStepId: node.sourceStepId ?? oldAnswer?.linkedStepId,
          imageDataUrl: oldAnswer?.imageDataUrl,
          imageName: oldAnswer?.imageName,
          sourceNodeId: node.id,
          screenKind: 'xkit-answer',
          xkitSubtype: oldAnswer?.xkitSubtype ?? baseScreen.xkitSubtype ?? node.fileType ?? 'Clues',
          statusMode: 'default',
          nextScreenId: undefined,
        }
        generatedScreens.push(answerScreen)
        previous = answerScreen
      }
    } else {
      generatedScreens.push(baseScreen)
    }
  })

  const nextScreens = [...generatedScreens, ...manualScreens]
  if (JSON.stringify(nextScreens) === JSON.stringify(userFlow.screens ?? [])) return userFlow
  return { ...userFlow, screens: nextScreens }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function GameFlowMap({ sheet: savedSheet, onChange, mode = 'path', projectName }: Props) {
  // 드래그·리사이즈·칸 칠하기가 진행되는 동안은 저장하지 않고 draft 로만 화면을 갱신한다.
  // 매 mousemove 마다 저장하면 전체 프로젝트를 압축/해제하고 리렌더하느라 렉이 걸린다.
  // 마우스를 놓는 순간 한 번만 onChange 로 커밋한다.
  const [draftSheet, setDraftSheet] = useState<GameFlowSheet | null>(null)
  const draftRef = useRef<GameFlowSheet | null>(null)
  const gestureRef = useRef(false)
  const sheet = draftSheet ?? savedSheet

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverPin, setHoverPin] = useState<string | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [sectionCellEditMode, setSectionCellEditMode] = useState<'add' | 'remove' | null>(null)
  const [mapHeight, setMapHeight] = useState<number | null>(null)
  // 도면 라이트/다크 테마 (도면 표면에만 적용, 선호 저장)
  const [mapTheme, setMapTheme] = useState<MapThemeKey>(() => {
    try { return localStorage.getItem(MAP_THEME_LS_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
  })
  // 인쇄용 미리보기(정답지) 오버레이
  const [showPrint, setShowPrint] = useState(false)
  const [hoverPinRect, setHoverPinRect] = useState<{ x: number; y: number; step: StepWithContext; color: string } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const sectionPaintRef = useRef<{ active: boolean; lastCell: string | null }>({ active: false, lastCell: null })
  const skipNextMapClickRef = useRef(false)
  const resizeRef = useRef<{ active: boolean; startY: number; startH: number; corner: string }>({ active: false, startY: 0, startH: 0, corner: '' })

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault()
    e.stopPropagation()
    const currentH = mapRef.current?.getBoundingClientRect().height ?? 480
    resizeRef.current = { active: true, startY: e.clientY, startH: currentH, corner }
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.active) return
      const dy = ev.clientY - resizeRef.current.startY
      const newH = Math.max(200, resizeRef.current.startH + dy)
      setMapHeight(newH)
    }
    const onUp = () => {
      resizeRef.current.active = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // 파생 데이터는 sheet 가 바뀔 때만 재계산한다. 이전에는 매 렌더(드래그 중 draft 갱신 포함)
  // 마다 그룹핑 루프·필터·색상맵을 새로 돌려 렉의 원인이 되었다.
  const allSteps: StepWithContext[] = useMemo(() => {
    const result: StepWithContext[] = []
    let gIdx = 0
    for (const section of sheet.sections) {
      let sectionMainIndex = 0
      for (let i = 0; i < section.steps.length;) {
        const first = section.steps[i]
        const groupId = getStepGroupId(first)
        let j = i + 1
        while (j < section.steps.length && getStepGroupId(section.steps[j]) === groupId) j += 1
        const groupSteps = section.steps.slice(i, j)
        const pinSource = groupSteps.find(step => step.pinX !== undefined && step.pinY !== undefined) ?? groupSteps[0]

        sectionMainIndex += 1
        gIdx += 1
        result.push({
          ...first,
          xkit: groupSteps.some(step => step.xkit),
          key: groupSteps.some(step => step.key),
          dev: groupSteps.some(step => step.dev),
          pinX: pinSource.pinX,
          pinY: pinSource.pinY,
          sectionTitle: section.title,
          sectionId: section.id,
          globalIndex: gIdx,
          displayIndex: String(sectionMainIndex),
          memberStepIds: groupSteps.map(step => step.id),
        })
        i = j
      }
    }
    return result
  }, [sheet.sections])

  const placedSteps = useMemo(() => allSteps.filter(s => s.pinX !== undefined && s.pinY !== undefined), [allSteps])
  const unplacedSteps = useMemo(() => allSteps.filter(s => s.pinX === undefined || s.pinY === undefined), [allSteps])
  const sectionColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    sheet.sections.forEach((sec, i) => {
      map[sec.id] = SECTION_COLORS[i % SECTION_COLORS.length]
    })
    return map
  }, [sheet.sections])

  const userFlow = useMemo(() => buildUserFlow(sheet, projectName), [sheet, projectName])
  const isUserMode = mode === 'user'
  const MT = MAP_THEMES[mapTheme]

  useEffect(() => {
    if (!selectedSectionId) return
    if (sheet.sections.some(sec => sec.id === selectedSectionId)) return
    setSelectedSectionId(null)
  }, [selectedSectionId, sheet.sections])

  useEffect(() => {
    if (!isUserMode) return
    const synced = syncXkitScreens(userFlow, allSteps)
    if (synced !== userFlow) updateSheet({ ...sheet, userFlow: synced })
  }, [allSteps, isUserMode, sheet, userFlow])

  // Esc — 현재 진행 중인 모드를 우선순위대로 취소한다
  // (인쇄 미리보기 → 모양 편집 → 스텝 배치 대기 → 섹션 선택)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showPrint) setShowPrint(false)
      else if (sectionCellEditMode) setSectionCellEditMode(null)
      else if (selectedId) setSelectedId(null)
      else if (selectedSectionId) setSelectedSectionId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPrint, sectionCellEditMode, selectedId, selectedSectionId])

  function toggleMapTheme() {
    setMapTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(MAP_THEME_LS_KEY, next) } catch { /* ignore */ }
      return next
    })
  }

  function updateSheet(next: GameFlowSheet) {
    if (gestureRef.current) {
      draftRef.current = next
      setDraftSheet(next)
      return
    }
    onChange(next)
  }

  function beginGesture() {
    gestureRef.current = true
  }

  // 제스처 종료 — draft 를 한 번만 저장하고 저장본 기준으로 되돌린다.
  // reload() 가 동기라 prop 이 같은 배치에서 갱신되므로 깜빡임은 없다.
  function endGesture() {
    if (!gestureRef.current) return
    gestureRef.current = false
    const pending = draftRef.current
    draftRef.current = null
    setDraftSheet(null)
    if (pending) onChange(pending)
  }

  function updatePin(stepId: string, pinX?: number, pinY?: number) {
    const target = allSteps.find(step => step.id === stepId)
    const targetIds = new Set(target?.memberStepIds ?? [stepId])
    let bounded = { pinX, pinY }
    if (target && pinX !== undefined && pinY !== undefined) {
      const sectionIndex = sheet.sections.findIndex(sec => sec.id === target.sectionId)
      if (sectionIndex >= 0) {
        const sec = sheet.sections[sectionIndex]
        const cells = getSectionCellSet(sec, sectionIndex)
        const box = getSectionMapBox(sec, sectionIndex)
        bounded = clampPinToSectionCells(pinX, pinY, cells, box)
      }
    }

    updateSheet({
      ...sheet,
      sections: sheet.sections.map(sec => ({
        ...sec,
        steps: sec.steps.map(step => (targetIds.has(step.id) ? { ...step, pinX: bounded.pinX, pinY: bounded.pinY } : step)),
      })),
    })
  }

  // '섹션 선택' 버튼으로 배치: 선택한 미배치 스텝을 해당 섹션 '중앙'에 정확히 배치한다.
  // 도면 클릭 방식은 스텝이 원래 속한 섹션으로 clamp 되어 엉뚱한 자리로 튀는 문제가 있어,
  // 섹션 버튼을 누르면 그 섹션으로 (필요 시 이동시켜) 중앙에 확실히 배치되게 한다.
  function placeStepInSection(stepId: string, targetSectionId: string) {
    const target = allSteps.find(step => step.id === stepId)
    if (!target) return
    const memberIds = new Set(target.memberStepIds ?? [stepId])
    const targetIndex = sheet.sections.findIndex(sec => sec.id === targetSectionId)
    if (targetIndex < 0) return

    const targetSec = sheet.sections[targetIndex]
    const cells = getSectionCellSet(targetSec, targetIndex)
    const box = getSectionMapBox(targetSec, targetIndex)
    // 섹션 박스 중앙(%) → 실제 셀 중앙으로 스냅 (자유 모양 섹션도 유효 위치 보장)
    const centerX = ((box.x + box.w / 2) / STUDIO_COLS) * 100
    const centerY = ((box.y + box.h / 2) / STUDIO_ROWS) * 100
    const { pinX, pinY } = clampPinToSectionCells(centerX, centerY, cells, box)

    if (target.sectionId === targetSectionId) {
      // 이미 그 섹션 소속 → 순서 유지한 채 핀만 중앙으로 설정
      updateSheet({
        ...sheet,
        sections: sheet.sections.map(sec => ({
          ...sec,
          steps: sec.steps.map(step => (memberIds.has(step.id) ? { ...step, pinX, pinY } : step)),
        })),
      })
    } else {
      // 다른 섹션 → 그룹 스텝을 대상 섹션으로 이동시키고 중앙에 배치
      const movingSteps = (sheet.sections.find(sec => sec.id === target.sectionId)?.steps ?? [])
        .filter(step => memberIds.has(step.id))
        .map(step => ({ ...step, pinX, pinY }))
      updateSheet({
        ...sheet,
        sections: sheet.sections.map(sec => {
          if (sec.id === target.sectionId) return { ...sec, steps: sec.steps.filter(step => !memberIds.has(step.id)) }
          if (sec.id === targetSectionId) return { ...sec, steps: [...sec.steps, ...movingSteps] }
          return sec
        }),
      })
    }
    setSelectedId(null)
    setSelectedSectionId(targetSectionId)
  }

  function updateSectionMapBox(
    sectionId: string,
    nextBox: { x: number; y: number; w: number; h: number },
    options?: {
      mode?: 'move' | 'resize'
      startBox?: { x: number; y: number; w: number; h: number }
      initialPins?: Map<string, { x?: number; y?: number }>
    }
  ) {
    updateSheet({
      ...sheet,
      sections: sheet.sections.map((sec, secIndex) => {
        if (sec.id !== sectionId) return sec

        const dxPct = options?.mode === 'move' && options.startBox
          ? ((nextBox.x - options.startBox.x) / STUDIO_COLS) * 100
          : 0
        const dyPct = options?.mode === 'move' && options.startBox
          ? ((nextBox.y - options.startBox.y) / STUDIO_ROWS) * 100
          : 0

        let nextMapCells = sec.mapCells
        if (sec.mapCells && sec.mapCells.length > 0 && options?.startBox) {
          if (options.mode === 'move') {
            const dxCell = nextBox.x - options.startBox.x
            const dyCell = nextBox.y - options.startBox.y
            nextMapCells = sec.mapCells.map(k => {
              const p = parseCellKey(k)
              const nx = Math.max(0, Math.min(STUDIO_COLS - 1, p.x + dxCell))
              const ny = Math.max(0, Math.min(STUDIO_ROWS - 1, p.y + dyCell))
              return cellKey(nx, ny)
            })
          } else if (options.mode === 'resize') {
            nextMapCells = scaleSectionCells(sec.mapCells, options.startBox, nextBox)
          }
        }
        const nextCells = nextMapCells && nextMapCells.length > 0
          ? new Set(nextMapCells)
          : getSectionCellSet({ ...sec, mapBox: nextBox }, secIndex)

        return {
          ...sec,
          mapBox: nextBox,
          mapCells: nextMapCells,
          steps: sec.steps.map(step => {
            let nextPinX = step.pinX
            let nextPinY = step.pinY

            if (options?.mode === 'move' && options.initialPins) {
              const initial = options.initialPins.get(step.id)
              if (initial) {
                nextPinX = initial.x === undefined ? undefined : initial.x + dxPct
                nextPinY = initial.y === undefined ? undefined : initial.y + dyPct
              }
            }
            const clamped = clampPinToSectionCells(nextPinX, nextPinY, nextCells, nextBox)
            return { ...step, pinX: clamped.pinX, pinY: clamped.pinY }
          }),
        }
      }),
    })
  }

  function editSectionCell(sectionId: string, col: number, row: number, modeType: 'add' | 'remove') {
    updateSheet({
      ...sheet,
      sections: sheet.sections.map((sec, secIndex) => {
        if (sec.id !== sectionId) return sec
        const fallback = getSectionMapBox(sec, secIndex)
        const cells = getSectionCellSet(sec, secIndex)
        const key = cellKey(col, row)
        if (modeType === 'add') cells.add(key)
        if (modeType === 'remove' && cells.size > 1) cells.delete(key)
        const box = getBoxFromCells(cells, fallback)
        return {
          ...sec,
          mapBox: box,
          mapCells: Array.from(cells),
          steps: sec.steps.map(step => {
            const clamped = clampPinToSectionCells(step.pinX, step.pinY, cells, box)
            return { ...step, pinX: clamped.pinX, pinY: clamped.pinY }
          }),
        }
      }),
    })
  }

  function updateUserFlow(next: UserFlowConfig) {
    updateSheet({
      ...sheet,
      userFlow: next,
    })
  }

  function updateUserScreen(screenId: string, patch: Partial<UserFlowScreen>) {
    updateUserFlow({
      ...userFlow,
      screens: userFlow.screens.map(screen => (screen.id === screenId ? { ...screen, ...patch } : screen)),
    })
  }

  async function handleUserScreenUpload(screenId: string, file: File | null) {
    if (!file) return
    const imageDataUrl = await readFileAsDataUrl(file)
    updateUserScreen(screenId, { imageDataUrl, imageName: file.name })
  }

  function handleMapClick() {
    if (draggingId || mode !== 'path') return
    if (skipNextMapClickRef.current) {
      skipNextMapClickRef.current = false
      return
    }
    // 도면 클릭 배치는 제거됨(원래 섹션으로 clamp되어 엉뚱한 자리로 튀는 문제).
    // 미배치 스텝은 상단 '섹션 선택' 버튼으로만 배치한다.
    // 바탕 클릭은 진행 중인 선택(배치 대기 스텝 → 섹션 선택 순)을 취소한다.
    if (selectedId) { setSelectedId(null); return }
    setSelectedSectionId(null)
  }

  const handlePinMouseDown = useCallback((e: React.MouseEvent, stepId: string, pinX: number, pinY: number) => {
    e.stopPropagation()
    const step = allSteps.find(item => item.id === stepId)
    if (!step || selectedSectionId !== step.sectionId) return
    if (!mapRef.current) return
    skipNextMapClickRef.current = true
    const rect = mapRef.current.getBoundingClientRect()
    const currentX = (pinX / 100) * rect.width + rect.left
    const currentY = (pinY / 100) * rect.height + rect.top
    dragOffset.current = { x: e.clientX - currentX, y: e.clientY - currentY }
    setDraggingId(stepId)
    setSelectedId(null)
    beginGesture()

    function onMove(me: MouseEvent) {
      if (!mapRef.current) return
      const r = mapRef.current.getBoundingClientRect()
      const nx = Math.max(0, Math.min(100, ((me.clientX - dragOffset.current.x - r.left) / r.width) * 100))
      const ny = Math.max(0, Math.min(100, ((me.clientY - dragOffset.current.y - r.top) / r.height) * 100))
      updatePin(stepId, Math.round(nx * 10) / 10, Math.round(ny * 10) / 10)
    }

    function onUp() {
      setDraggingId(null)
      endGesture()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [allSteps, selectedSectionId])

  function handlePinDblClick(e: React.MouseEvent, stepId: string) {
    e.stopPropagation()
    updatePin(stepId, undefined, undefined)
  }

  // 'painted' = 칠함 / 'skip' = 대상 아님(드래그 중 무시) / 'cancel' = 바탕 클릭 → 모드 종료 / 'none' = 편집 상태 아님
  function applySectionCellEditFromPointer(clientX: number, clientY: number, initial: boolean): 'painted' | 'skip' | 'cancel' | 'none' {
    if (!sectionCellEditMode || !selectedSectionId || selectedId || !mapRef.current) return 'none'
    const rect = mapRef.current.getBoundingClientRect()
    const col = Math.max(0, Math.min(STUDIO_COLS - 1, Math.floor(((clientX - rect.left) / rect.width) * STUDIO_COLS)))
    const row = Math.max(0, Math.min(STUDIO_ROWS - 1, Math.floor(((clientY - rect.top) / rect.height) * STUDIO_ROWS)))
    const key = cellKey(col, row)
    if (sectionPaintRef.current.active && sectionPaintRef.current.lastCell === key) return 'painted'

    // 선택 섹션과 무관한 격자 바탕을 클릭하면 편집을 종료한다.
    // - 추가 모드: 섹션 칸이거나 그에 인접(8방향)한 칸만 유효
    // - 제거 모드: 섹션 칸만 유효
    const secIndex = sheet.sections.findIndex(sec => sec.id === selectedSectionId)
    if (secIndex >= 0) {
      const cells = getSectionCellSet(sheet.sections[secIndex], secIndex)
      const inCells = cells.has(key)
      let valid: boolean
      if (sectionCellEditMode === 'add') {
        let adjacent = inCells
        if (!adjacent) {
          for (let dx = -1; dx <= 1 && !adjacent; dx += 1) {
            for (let dy = -1; dy <= 1 && !adjacent; dy += 1) {
              if (dx === 0 && dy === 0) continue
              if (cells.has(cellKey(col + dx, row + dy))) adjacent = true
            }
          }
        }
        valid = adjacent
      } else {
        valid = inCells
      }
      if (!valid) return initial ? 'cancel' : 'skip'
    }

    sectionPaintRef.current.lastCell = key
    editSectionCell(selectedSectionId, col, row, sectionCellEditMode)
    return 'painted'
  }

  function handleMapMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== 'path') return
    beginGesture()
    const result = applySectionCellEditFromPointer(e.clientX, e.clientY, true)
    if (result === 'cancel') {
      // 격자 바탕 클릭 → 섹션 모양 편집 종료
      endGesture()
      setSectionCellEditMode(null)
      skipNextMapClickRef.current = true
      return
    }
    if (result !== 'painted') {
      endGesture()
      return
    }
    sectionPaintRef.current.active = true
    function onUp() {
      sectionPaintRef.current.active = false
      sectionPaintRef.current.lastCell = null
      endGesture()
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mouseup', onUp)
  }

  function handleMapMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!sectionPaintRef.current.active || mode !== 'path') return
    applySectionCellEditFromPointer(e.clientX, e.clientY, false)
  }

  function startSectionBoxDrag(
    e: React.MouseEvent,
    section: GameFlowSection,
    sectionIndex: number,
    modeType: 'move' | 'resize',
    resizeDir: 'nw' | 'ne' | 'sw' | 'se' = 'se'
  ) {
    e.stopPropagation()
    e.preventDefault()
    if (!mapRef.current || mode !== 'path' || sectionCellEditMode) return
    // 핀 배치 중에는 대지 이동보다 핀 배치를 우선한다.
    if (selectedId) return
    // 미선택 대지를 클릭하면 곧바로 선택하고 같은 드래그로 이동을 시작한다.
    // (이전에는 상단 '섹션 선택' 칩으로 먼저 골라야만 이동/리사이즈가 됐다)
    if (selectedSectionId !== section.id) setSelectedSectionId(section.id)
    skipNextMapClickRef.current = true

    const rect = mapRef.current.getBoundingClientRect()
    const box = getSectionMapBox(section, sectionIndex)
    const initialPins = new Map(
      section.steps.map(step => [step.id, { x: step.pinX, y: step.pinY }])
    )
    const startCol = ((e.clientX - rect.left) / rect.width) * STUDIO_COLS
    const startRow = ((e.clientY - rect.top) / rect.height) * STUDIO_ROWS
    const start = { ...box }
    beginGesture()

    function onMove(me: MouseEvent) {
      if (!mapRef.current) return
      const r = mapRef.current.getBoundingClientRect()
      const currentCol = ((me.clientX - r.left) / r.width) * STUDIO_COLS
      const currentRow = ((me.clientY - r.top) / r.height) * STUDIO_ROWS
      const dc = Math.round(currentCol - startCol)
      const dr = Math.round(currentRow - startRow)

      if (modeType === 'move') {
        const nx = Math.max(0, Math.min(STUDIO_COLS - start.w, start.x + dc))
        const ny = Math.max(0, Math.min(STUDIO_ROWS - start.h, start.y + dr))
        updateSectionMapBox(
          section.id,
          { ...start, x: nx, y: ny },
          { mode: 'move', startBox: start, initialPins }
        )
      } else {
        let nx = start.x
        let ny = start.y
        let nw = start.w
        let nh = start.h

        if (resizeDir === 'se') {
          nw = Math.max(2, Math.min(STUDIO_COLS - start.x, start.w + dc))
          nh = Math.max(2, Math.min(STUDIO_ROWS - start.y, start.h + dr))
        } else if (resizeDir === 'sw') {
          nx = Math.max(0, Math.min(start.x + start.w - 2, start.x + dc))
          nw = start.w + (start.x - nx)
          nh = Math.max(2, Math.min(STUDIO_ROWS - start.y, start.h + dr))
        } else if (resizeDir === 'ne') {
          ny = Math.max(0, Math.min(start.y + start.h - 2, start.y + dr))
          nh = start.h + (start.y - ny)
          nw = Math.max(2, Math.min(STUDIO_COLS - start.x, start.w + dc))
        } else if (resizeDir === 'nw') {
          nx = Math.max(0, Math.min(start.x + start.w - 2, start.x + dc))
          ny = Math.max(0, Math.min(start.y + start.h - 2, start.y + dr))
          nw = start.w + (start.x - nx)
          nh = start.h + (start.y - ny)
        }

        updateSectionMapBox(
          section.id,
          { ...start, x: nx, y: ny, w: nw, h: nh },
          { mode: 'resize', startBox: start }
        )
      }
    }

    function onUp() {
      endGesture()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isUserMode ? 16 : 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {!isUserMode && (
            <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
              {placedSteps.length}/{allSteps.length} 배치됨
            </span>
          )}
          <span style={{ color: mode === 'path' ? 'var(--text-muted)' : '#9fb3ff' }}>
            {mode === 'path'
              ? selectedId
                ? '상단 「섹션 선택」에서 섹션 버튼을 눌러 그 섹션 중앙에 배치하세요'
                : '핀 드래그로 이동 · 더블클릭으로 제거'
              : '게임 플로우를 유저 여정과 Xkit 화면 흐름으로 연결해 편집하세요'}
          </span>
        </div>
      </div>

      {mode === 'path' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              {sectionCellEditMode ? (
                <span style={{ color: sectionCellEditMode === 'add' ? '#b6ff61' : '#ef4444', fontWeight: 700 }}>
                  섹션 모양 {sectionCellEditMode === 'add' ? '추가' : '제거'} 모드 — {selectedSectionId
                    ? '칸을 클릭·드래그하세요 · 바탕 클릭 또는 Esc로 종료'
                    : '먼저 「섹션 선택」에서 편집할 섹션을 고르세요'}
                </span>
              ) : selectedId ? (
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>선택한 스텝 — 배치할 섹션 버튼을 누르세요 ▶ <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(바탕 클릭 · Esc 취소)</span></span>
              ) : unplacedSteps.length > 0 ? (
                <span>아래 미배치 스텝을 클릭해 배치할 수 있습니다</span>
              ) : (
                <span style={{ color: '#00d4aa' }}>모든 스텝이 배치되었습니다</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  onClick={toggleMapTheme}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, padding: 0,
                    border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg-card)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  aria-label={mapTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                  title={mapTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                  {mapTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                <button
                  onClick={() => setShowPrint(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, padding: 0,
                    border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg-card)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                  aria-label="Print"
                  title="Print"
                >
                  <PrinterIcon />
                </button>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                  섹션 모양 편집
                </span>
                <button
                  onClick={() => setSectionCellEditMode(prev => (prev === 'add' ? null : 'add'))}
                  style={{
                    width: 22, height: 22, borderRadius: 999, border: '1px solid var(--border)',
                    background: sectionCellEditMode === 'add' ? 'rgba(182,255,97,0.2)' : 'rgba(255,255,255,0.05)',
                    color: sectionCellEditMode === 'add' ? '#b6ff61' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 800, lineHeight: 1,
                  }}
                  title="섹션 칸 추가 모드"
                >
                  +
                </button>
                <button
                  onClick={() => setSectionCellEditMode(prev => (prev === 'remove' ? null : 'remove'))}
                  style={{
                    width: 22, height: 22, borderRadius: 999, border: '1px solid var(--border)',
                    background: sectionCellEditMode === 'remove' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                    color: sectionCellEditMode === 'remove' ? '#ef4444' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 800, lineHeight: 1,
                  }}
                  title="섹션 칸 제거 모드"
                >
                  −
                </button>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginRight: 2 }}>섹션 선택</span>
                {sheet.sections.map((sec, i) => (
                  <button
                    key={sec.id}
                    onClick={() => {
                      // 미배치 스텝이 선택된 상태면, 이 섹션 버튼은 '그 섹션 중앙에 배치' 동작을 한다.
                      if (selectedId) { placeStepInSection(selectedId, sec.id); return }
                      setSelectedSectionId(prev => (prev === sec.id ? null : sec.id))
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 999,
                      // 배치 대기(selectedId) 중에는 모든 섹션 버튼을 '배치 타겟'으로 강조한다.
                      border: selectedId
                        ? `1px solid ${SECTION_COLORS[i % SECTION_COLORS.length]}`
                        : `1px solid ${SECTION_COLORS[i % SECTION_COLORS.length]}66`,
                      background: selectedId
                        ? `${SECTION_COLORS[i % SECTION_COLORS.length]}22`
                        : selectedSectionId === sec.id
                          ? `${SECTION_COLORS[i % SECTION_COLORS.length]}22`
                          : 'rgba(255,255,255,0.03)',
                      color: selectedId || selectedSectionId === sec.id
                        ? SECTION_COLORS[i % SECTION_COLORS.length]
                        : 'var(--text-muted)',
                      fontSize: 10,
                      fontWeight: selectedId || selectedSectionId === sec.id ? 700 : 500,
                      padding: '3px 8px',
                      cursor: 'pointer',
                      boxShadow: selectedId ? `0 0 0 2px ${SECTION_COLORS[i % SECTION_COLORS.length]}33` : 'none',
                    }}
                    title={selectedId ? '이 섹션 중앙에 스텝 배치' : '편집 대상 섹션 선택'}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: SECTION_COLORS[i % SECTION_COLORS.length], flexShrink: 0 }} />
                    <span>{getSectionDisplayTitle(i, sec.title)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: '100%', position: 'relative' }}>
            {/* 외부 프레임: 리사이즈로 높이만 바뀌고 내용은 클리핑됨 */}
            <div
              style={{
                overflow: 'hidden',
                height: mapHeight != null ? mapHeight : undefined,
                border: selectedId ? '2px dashed #f59e0b' : '1px solid var(--border)',
                borderRadius: 16,
                transition: 'border-color 0.2s',
              }}
            >
              {/* 비율 유지 래퍼: 섹션/핀의 % height 계산 기준 */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: `${(STUDIO_HEIGHT / STUDIO_WIDTH) * 100}%` }}>
                <div
                  ref={mapRef}
                  onClick={handleMapClick}
                  onMouseDown={handleMapMouseDown}
                  onMouseMove={handleMapMouseMove}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: selectedId ? MT.surfaceActive : MT.surface,
                    cursor: sectionCellEditMode ? 'crosshair' : draggingId ? 'grabbing' : 'default',
                    userSelect: 'none',
                  }}
                >
              <FloorPlanPlaceholder bg={MT.gridBg} line={MT.gridLine} opacity={MT.gridOpacity} />

              {sheet.sections.map((sec, i) => {
                const color = sectionColorMap[sec.id] || SECTION_COLORS[i % SECTION_COLORS.length]
                const box = getSectionMapBox(sec, i)
                const cells = getSectionCellSet(sec, i)
                const labelAnchor = getSectionLabelAnchor(cells, box)
                const outline = buildSectionOutlineSegments(cells)
                const selectedSection = selectedSectionId === sec.id
                const isShapeEditing = sectionCellEditMode !== null
                const overlapArrows = (() => {
                  const byCell = new Map<string, { cell: { x: number; y: number }; direction: ArrowDirection }>()
                  const nextSection = sheet.sections[i + 1]
                  if (!nextSection) return []
                  const nextCells = getSectionCellSet(nextSection, i + 1)
                  const nextCenter = getSectionCenter(nextCells)

                  cells.forEach(k => {
                    if (!nextCells.has(k) || byCell.has(k)) return
                    const p = parseCellKey(k)
                    const direction = getArrowDirection({ x: p.x + 0.5, y: p.y + 0.5 }, nextCenter)
                    byCell.set(k, { cell: p, direction })
                  })

                  return Array.from(byCell.values())
                })()
                return (
                  <div key={`box-${sec.id}`} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
                    {isShapeEditing ? (
                      Array.from(cells).map(k => {
                        const p = parseCellKey(k)
                        return (
                          <div
                            key={`${sec.id}-${k}`}
                          style={{
                            position: 'absolute',
                            left: `${p.x * SECTION_CELL_PCT_W}%`,
                            top: `${p.y * SECTION_CELL_PCT_H}%`,
                              width: `${SECTION_CELL_PCT_W}%`,
                              height: `${SECTION_CELL_PCT_H}%`,
                            border: `1px solid ${selectedSection ? color : `${color}55`}`,
                            background: `${color}${selectedSection ? MT.cellFillSelected : MT.cellFill}`,
                            boxSizing: 'border-box',
                            pointerEvents: 'none',
                          }}
                        />
                        )
                      })
                    ) : (
                      <>
                        {Array.from(cells).map(k => {
                          const p = parseCellKey(k)
                          return (
                            <div
                              key={`${sec.id}-view-${k}`}
                              style={{
                                position: 'absolute',
                                left: `${p.x * SECTION_CELL_PCT_W}%`,
                                top: `${p.y * SECTION_CELL_PCT_H}%`,
                                width: `${SECTION_CELL_PCT_W}%`,
                                height: `${SECTION_CELL_PCT_H}%`,
                                background: `${color}${selectedSection ? MT.cellFillViewSelected : MT.cellFillView}`,
                                boxSizing: 'border-box',
                                pointerEvents: 'none',
                              }}
                            />
                          )
                        })}
                        <svg
                          viewBox={`0 0 ${STUDIO_COLS} ${STUDIO_ROWS}`}
                          preserveAspectRatio="none"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        >
                          {outline.map((s, idx) => (
                            <line
                              key={`${sec.id}-outline-${idx}`}
                              x1={s.x1}
                              y1={s.y1}
                              x2={s.x2}
                              y2={s.y2}
                              stroke={selectedSection ? color : `${color}cc`}
                              strokeWidth={0.09}
                              vectorEffect="non-scaling-stroke"
                              strokeLinecap="square"
                            />
                          ))}
                        </svg>
                        <div
                          onMouseDown={e => {
                            startSectionBoxDrag(e, sec, i, 'move')
                          }}
                          onClick={e => {
                            e.stopPropagation()
                          }}
                          style={{
                            position: 'absolute',
                            left: `${(box.x / STUDIO_COLS) * 100}%`,
                            top: `${(box.y / STUDIO_ROWS) * 100}%`,
                            width: `${(box.w / STUDIO_COLS) * 100}%`,
                            height: `${(box.h / STUDIO_ROWS) * 100}%`,
                            borderRadius: 4,
                            boxSizing: 'border-box',
                            cursor: 'move',
                            background: 'transparent',
                            // 스텝 배치 중(selectedId)에는 대지가 클릭을 가로채지 않도록 통과시켜
                            // 도면 위 어디든(대지 안 포함) 클릭해 핀을 배치할 수 있게 한다.
                            pointerEvents: selectedId ? 'none' : 'auto',
                          }}
                        />
                      </>
                    )}
                    <div
                      onMouseDown={e => {
                        startSectionBoxDrag(e, sec, i, 'move')
                      }}
                      onClick={e => {
                        e.stopPropagation()
                      }}
                      style={{
                        position: 'absolute',
                        left: `${(labelAnchor.x / STUDIO_COLS) * 100}%`,
                        top: `${(labelAnchor.y / STUDIO_ROWS) * 100}%`,
                        transform: 'translate(2px,2px)',
                        fontSize: 10,
                        color,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: selectedSection ? `${color}22` : MT.labelBg,
                        border: `1px solid ${color}66`,
                        cursor: mode === 'path' ? 'move' : 'default',
                        pointerEvents: selectedId ? 'none' : 'auto',
                      }}
                    >
                      {getSectionDisplayTitle(i, sec.title)}
                    </div>
                    {selectedSection && !selectedId && (
                      <div
                        onMouseDown={e => {
                          startSectionBoxDrag(e, sec, i, 'resize', 'se')
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ ...sectionResizeHandleStyle(color, ((box.x + box.w) / STUDIO_COLS) * 100, ((box.y + box.h) / STUDIO_ROWS) * 100, 'nwse-resize'), pointerEvents: 'auto' }}
                        title="우하단 크기 조절"
                      />
                    )}
                    {overlapArrows.map((item, idx) => (
                      <div
                        key={`overlap-arrow-${sec.id}-${idx}-${item.cell.x}-${item.cell.y}`}
                        style={{
                          position: 'absolute',
                          left: `${item.cell.x * SECTION_CELL_PCT_W}%`,
                          top: `${item.cell.y * SECTION_CELL_PCT_H}%`,
                          width: `${SECTION_CELL_PCT_W}%`,
                          height: `${SECTION_CELL_PCT_H}%`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          zIndex: 4,
                        }}
                        title={`출구 방향: ${getSectionAlphaLabel(i)} → ${getSectionAlphaLabel(i + 1)}`}
                      >
                        <span
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
                            lineHeight: 1,
                            color,
                            textShadow: `0 0 8px ${color}99`,
                            userSelect: 'none',
                          }}
                        >
                          {getArrowGlyph(item.direction)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}

              {placedSteps.map(step => {
                const pinColor = getPinColor(step)
                const pinBg = getPinBg(step)
                const sectionColor = sectionColorMap[step.sectionId] || '#9b6dff'
                const pinDraggable = selectedSectionId === step.sectionId
                const isDragging = draggingId === step.id
                const isHover = hoverPin === step.id
                const answerText = (step.output || '').trim() || '—'
                const sectionIndex = sheet.sections.findIndex(sec => sec.id === step.sectionId)
                const sectionCells = sectionIndex >= 0 ? getSectionCellSet(sheet.sections[sectionIndex], sectionIndex) : new Set<string>()
                const sectionBox = sectionIndex >= 0
                  ? getBoxFromCells(sectionCells, getSectionMapBox(sheet.sections[sectionIndex], sectionIndex))
                  : { x: 0, y: 0, w: STUDIO_COLS, h: STUDIO_ROWS }
                const sectionLeftPct = (sectionBox.x / STUDIO_COLS) * 100
                const sectionRightPct = ((sectionBox.x + sectionBox.w) / STUDIO_COLS) * 100
                const sectionMidPct = (sectionLeftPct + sectionRightPct) / 2
                const edgeThresholdPct = Math.max(SECTION_CELL_PCT_W * 0.9, 2)
                const pinXPct = step.pinX ?? 0
                const nearLeftEdge = pinXPct <= sectionLeftPct + edgeThresholdPct
                const nearRightEdge = pinXPct >= sectionRightPct - edgeThresholdPct
                const answerOnRight = nearLeftEdge ? true : nearRightEdge ? false : pinXPct <= sectionMidPct
                return (
                  <div
                    key={step.id}
                    onMouseDown={e => handlePinMouseDown(e, step.id, step.pinX!, step.pinY!)}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => handlePinDblClick(e, step.id)}
                    onMouseEnter={e => {
                      setHoverPin(step.id)
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setHoverPinRect({ x: r.left + r.width / 2, y: r.top, step, color: pinColor })
                    }}
                    onMouseLeave={() => { setHoverPin(null); setHoverPinRect(null) }}
                    style={{
                      position: 'absolute',
                      left: `${step.pinX}%`,
                      top: `${step.pinY}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: isDragging ? 100 : isHover ? 10 : 5,
                      cursor: pinDraggable ? (draggingId ? 'grabbing' : 'grab') : 'default',
                      opacity: pinDraggable ? 1 : 0.72,
                      transition: isDragging ? 'none' : 'transform 0.1s',
                    }}
                  >
                    <div style={{
                      width: isDragging || isHover ? 36 : 30,
                      height: isDragging || isHover ? 36 : 30,
                      borderRadius: '50%',
                      background: MT.pinLightDisc ? '#ffffff' : pinBg,
                      border: `2px solid ${pinColor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 ${isHover ? 12 : 6}px ${pinColor}88`,
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}>
                      <span style={{ fontSize: isDragging || isHover ? 12 : 10, fontWeight: 800, color: pinColor }}>
                        {step.displayIndex}
                      </span>
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 8, height: 8, borderRadius: '50%',
                        background: sectionColor, border: `1px solid ${MT.pinRing}`,
                      }} />
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        [answerOnRight ? 'left' : 'right']: '100%',
                        transform: answerOnRight ? 'translate(8px, -50%)' : 'translate(-8px, -50%)',
                        fontSize: 10,
                        fontWeight: 700,
                        color: MT.answerText,
                        background: MT.answerBg,
                        border: `1px solid ${pinColor}66`,
                        borderRadius: 6,
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        pointerEvents: 'none',
                        boxShadow: `0 2px 8px ${pinColor}33`,
                      }}
                      title={answerText}
                    >
                      {answerText}
                    </div>

                  </div>
                )
              })}

                </div>
              </div>
            </div>
            {/* 모서리 리사이즈 핸들 (SW, SE) */}
            {(['sw', 'se'] as const).map(corner => (
              <div
                key={corner}
                onMouseDown={e => handleResizeMouseDown(e, corner)}
                style={{
                  position: 'absolute',
                  bottom: -5,
                  ...(corner === 'sw' ? { left: -5 } : { right: -5 }),
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: '#f59e0b',
                  border: '2px solid #0d1117',
                  cursor: 's-resize',
                  zIndex: 100,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                미배치 스텝 {unplacedSteps.length > 0 ? `(${unplacedSteps.length})` : ''}
              </div>
              {unplacedSteps.length === 0 ? (
                <div style={{ padding: '10px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 12, color: '#00d4aa' }}>
                  모두 배치됨
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {unplacedSteps.map(step => {
                    const pinColor = getPinColor(step)
                    const isSelected = selectedId === step.id
                    return (
                      <div
                        key={step.id}
                        onClick={() => {
                          // 대지 클릭으로 남았을 수 있는 stale skip 플래그를 초기화해
                          // 배치 첫 클릭이 먹히지 않도록 한다.
                          skipNextMapClickRef.current = false
                          setSelectedId(isSelected ? null : step.id)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                          border: isSelected ? `1px solid ${pinColor}` : '1px solid var(--border)',
                          background: isSelected ? `${pinColor}22` : 'var(--bg-card)',
                          transition: 'all 0.15s',
                          maxWidth: 220,
                        }}
                      >
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: getPinBg(step),
                          border: `2px solid ${pinColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color: pinColor,
                        }}>
                          {step.displayIndex}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? pinColor : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {step.clue || '(무제)'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {step.sectionTitle}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ flexShrink: 0, minWidth: 180, marginLeft: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'right' }}>분류 컬러</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'flex-end' }}>
                {[
                  { label: 'Xkit', color: '#f59e0b' },
                  { label: 'Lock', color: '#00d4aa' },
                  { label: 'Dev', color: '#4da6ff' },
                  { label: '기타', color: '#9b6dff' },
                  { label: 'AUTO', color: '#6b7280' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <UserFlowPanel
          userFlow={userFlow}
          projectName={projectName}
          sections={sheet.sections}
          allSteps={allSteps}
          onPatchUserFlow={updateUserFlow}
          onUpdateScreen={updateUserScreen}
          onUploadScreen={handleUserScreenUpload}
        />
      )}

      {/* 인쇄용 정답지 미리보기 — 밝은 배경 고정, A4 가로 최적화 */}
      {showPrint && createPortal(
        <PassMapPrintView
          sheet={sheet}
          allSteps={allSteps}
          sectionColorMap={sectionColorMap}
          projectName={projectName}
          onClose={() => setShowPrint(false)}
        />,
        document.body
      )}

      {/* 핀 호버 팝업 — overflow:hidden 프레임 밖에 포털로 렌더링 */}
      {hoverPinRect && !draggingId && createPortal(
        <div style={{
          position: 'fixed',
          left: hoverPinRect.x,
          top: hoverPinRect.y - 8,
          transform: 'translateX(-50%) translateY(-100%)',
          background: '#1a1a2e',
          border: `1px solid ${hoverPinRect.color}`,
          borderRadius: 8,
          padding: '6px 10px',
          minWidth: 140,
          maxWidth: 220,
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: `0 4px 16px ${hoverPinRect.color}44`,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
            {hoverPinRect.step.sectionTitle}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: hoverPinRect.color, marginBottom: 4 }}>
            #{hoverPinRect.step.displayIndex} {hoverPinRect.step.clue}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            IN: {hoverPinRect.step.input || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            OUT: {hoverPinRect.step.output || '—'}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {hoverPinRect.step.xkit && <span style={miniBadge('#3a2a00', '#f59e0b')}>Xkit</span>}
            {hoverPinRect.step.key && <span style={miniBadge('#1a3a2a', '#00d4aa')}>Key</span>}
            {hoverPinRect.step.dev && <span style={miniBadge('#1e3a5f', '#4da6ff')}>Dev</span>}
            {hoverPinRect.step.auto && <span style={miniBadge('#222', '#9ca3af')}>AUTO</span>}
            {hoverPinRect.step.problemType && <span style={miniBadge('var(--accent-dim)', 'var(--accent)')}>{hoverPinRect.step.problemType}</span>}
          </div>
          <div style={{ fontSize: 9, color: '#4b5563', marginTop: 4 }}>더블클릭으로 핀 제거</div>
        </div>,
        document.body
      )}
    </div>
  )
}

function UserFlowPanel({
  userFlow,
  projectName,
  sections,
  allSteps,
  onPatchUserFlow,
  onUpdateScreen,
  onUploadScreen,
}: {
  userFlow: UserFlowConfig
  projectName?: string
  sections: GameFlowSection[]
  allSteps: StepWithContext[]
  onPatchUserFlow: (next: UserFlowConfig) => void
  onUpdateScreen: (screenId: string, patch: Partial<UserFlowScreen>) => void
  onUploadScreen: (screenId: string, file: File | null) => Promise<void>
}) {
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null)
  // 폰 화면 hover 시 루트 가지(여정) 도면에서 같은 스텝 노드를 강조하기 위한 공유 상태
  const [highlightStepId, setHighlightStepId] = useState<string | null>(null)
  const previewScreen = useMemo(
    () => userFlow.screens.find(screen => screen.id === previewScreenId) ?? null,
    [previewScreenId, userFlow.screens]
  )

  useEffect(() => {
    if (!previewScreenId) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewScreenId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewScreenId])

  function toggleAnswerContinuation(screenId: string, enabled: boolean) {
    const byId = new Map(userFlow.screens.map(screen => [screen.id, { ...screen }]))
    const current = byId.get(screenId)
    if (!current || !current.sourceNodeId) return

    const sameSource = (screen: UserFlowScreen | undefined) =>
      Boolean(screen && screen.sourceNodeId === current.sourceNodeId)

    if (enabled) {
      const next = current.nextScreenId ? byId.get(current.nextScreenId) : undefined
      if (!sameSource(next) || next?.screenKind !== 'xkit-answer') {
        const newAnswer: UserFlowScreen = {
          id: crypto.randomUUID(),
          title: current.title,
          caption: '',
          linkedStepId: current.linkedStepId,
          sourceNodeId: current.sourceNodeId,
          screenKind: 'xkit-answer',
          xkitSubtype: current.xkitSubtype,
          statusMode: 'default',
          nextScreenId: undefined,
        }
        current.nextScreenId = newAnswer.id
        byId.set(newAnswer.id, newAnswer)
      }
    } else {
      const removeIds = new Set<string>()
      let cursorId = current.nextScreenId
      while (cursorId) {
        const cursor = byId.get(cursorId)
        if (!sameSource(cursor) || cursor?.screenKind !== 'xkit-answer') break
        removeIds.add(cursor.id)
        cursorId = cursor.nextScreenId
      }
      current.nextScreenId = undefined
      removeIds.forEach(id => byId.delete(id))
    }

    const base = Array.from(byId.values()).find(screen => screen.sourceNodeId === current.sourceNodeId && screen.screenKind === 'xkit')
    if (base) {
      let chainCount = 0
      const visited = new Set<string>()
      let cursorId = base.nextScreenId
      while (cursorId && !visited.has(cursorId)) {
        visited.add(cursorId)
        const cursor = byId.get(cursorId)
        if (!sameSource(cursor) || cursor?.screenKind !== 'xkit-answer') break
        chainCount += 1
        cursorId = cursor.nextScreenId
      }
      base.answerChainCount = chainCount
      base.statusMode = chainCount > 0 ? 'answer' : 'default'
    }

    const originalOrder = userFlow.screens
    const nextScreens = originalOrder
      .filter(screen => byId.has(screen.id))
      .map(screen => byId.get(screen.id)!)

    const appended = Array.from(byId.values()).filter(screen => !originalOrder.some(origin => origin.id === screen.id))
    onPatchUserFlow({
      ...userFlow,
      screens: [...nextScreens, ...appended],
    })
  }

  const screenById = useMemo(() => new Map(userFlow.screens.map(screen => [screen.id, screen])), [userFlow.screens])
  const screenItems = useMemo(() => {
    const consumed = new Set<string>()
    const items: Array<{ id: string; kind: 'single' | 'chain'; base: UserFlowScreen; chain: UserFlowScreen[]; tagNo: number }> = []
    let tagNo = 0
    userFlow.screens.forEach(screen => {
      if (consumed.has(screen.id)) return
      tagNo += 1
      if (screen.screenKind === 'xkit') {
        const chain: UserFlowScreen[] = [screen]
        const visited = new Set<string>([screen.id])
        let nextId = screen.nextScreenId
        while (nextId && !visited.has(nextId)) {
          visited.add(nextId)
          const next = screenById.get(nextId)
          if (!next || next.screenKind !== 'xkit-answer') break
          chain.push(next)
          nextId = next.nextScreenId
        }
        if (chain.length > 1) {
          items.push({ id: chain.map(node => node.id).join('-'), kind: 'chain', base: screen, chain, tagNo })
          chain.forEach(node => consumed.add(node.id))
          return
        }
      }
      items.push({ id: screen.id, kind: 'single', base: screen, chain: [screen], tagNo })
      consumed.add(screen.id)
    })
    return items
  }, [screenById, userFlow.screens])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <UserJourneyEditor
        userFlow={userFlow}
        projectName={projectName}
        highlightStepId={highlightStepId}
        sections={sections}
        steps={allSteps.map(step => ({
          id: step.id,
          sectionId: step.sectionId,
          sectionTitle: step.sectionTitle,
          clue: step.clue,
          story: step.story,
          input: step.input,
          xkit: step.xkit,
          key: step.key,
          dev: step.dev,
          output: step.output,
          globalIndex: step.globalIndex,
          displayIndex: step.displayIndex,
        }))}
        onChangeUserFlow={onPatchUserFlow}
      />

      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 20,
        background: 'var(--bg-card)',
        padding: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Xkit 폰 디스플레이</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>하단에서 화면을 추가하고, 이미지를 첨부해 유저 플로우 스텝과 연결할 수 있습니다.</div>
          </div>
        </div>

        {userFlow.screens.length === 0 ? (
          <div style={{
            borderRadius: 18,
            border: '1px dashed var(--border)',
            padding: '28px 18px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            아직 추가된 폰 화면이 없습니다. Xkit 앱 화면이나 와이어프레임 이미지를 붙여 흐름을 정리해보세요.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {screenItems.map(item => (
              item.kind === 'chain' ? (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 10,
                    borderRadius: 22,
                    border: '1px solid var(--border)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(8,10,14,0.94) 100%)',
                    padding: '14px 14px 0 14px',
                  }}
                >
                  {item.chain.map((chainScreen, index) => (
                    <div key={chainScreen.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <PhoneScreenCard
                        screen={chainScreen}
                        allSteps={allSteps}
                        onUpdate={onUpdateScreen}
                        onToggleAnswerContinuation={toggleAnswerContinuation}
                        onOpenPreview={setPreviewScreenId}
                        onHighlightStep={setHighlightStepId}
                        onUpload={onUploadScreen}
                        merged
                        tagNo={item.tagNo}
                      />
                      {index < item.chain.length - 1 && (
                        <div
                          aria-hidden
                          style={{
                            alignSelf: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 18,
                            fontWeight: 700,
                            lineHeight: 1,
                            opacity: 0.82,
                            padding: '0 2px',
                            userSelect: 'none',
                          }}
                        >
                          →
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <PhoneScreenCard
                  key={item.id}
                  screen={item.base}
                  allSteps={allSteps}
                  onUpdate={onUpdateScreen}
                  onToggleAnswerContinuation={toggleAnswerContinuation}
                  onOpenPreview={setPreviewScreenId}
                  onHighlightStep={setHighlightStepId}
                  onUpload={onUploadScreen}
                  tagNo={item.tagNo}
                />
              )
            ))}
          </div>
        )}
      </div>

      {previewScreen && (
        <div
          role="presentation"
          onClick={() => setPreviewScreenId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(3, 6, 12, 0.76)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(92vw, 520px)',
              borderRadius: 22,
              border: '1px solid var(--border)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(8,10,14,0.98) 100%)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{previewScreen.title}</div>
              <button
                type="button"
                onClick={() => setPreviewScreenId(null)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div style={{
              width: 'min(86vw, 390px)',
              height: 'min(80vh, 742px)',
              margin: '0 auto',
              borderRadius: 36,
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#090b0f',
              padding: 14,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: 28,
                overflow: 'hidden',
                background: previewScreen.imageDataUrl ? '#fff' : 'linear-gradient(180deg, rgba(182,255,97,0.09) 0%, rgba(182,255,97,0.02) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {previewScreen.imageDataUrl ? (
                  <img src={previewScreen.imageDataUrl} alt={previewScreen.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>업로드된 화면이 없습니다</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PhoneScreenCard({
  screen,
  allSteps,
  onUpdate,
  onToggleAnswerContinuation,
  onOpenPreview,
  onUpload,
  onHighlightStep,
  merged = false,
  tagNo,
}: {
  screen: UserFlowScreen
  allSteps: StepWithContext[]
  onUpdate: (screenId: string, patch: Partial<UserFlowScreen>) => void
  onToggleAnswerContinuation: (screenId: string, enabled: boolean) => void
  onOpenPreview: (screenId: string) => void
  onUpload: (screenId: string, file: File | null) => Promise<void>
  onHighlightStep?: (stepId: string | null) => void
  merged?: boolean
  tagNo: number
}) {
  const linkedStep = allSteps.find(step => step.id === screen.linkedStepId)
  const isAutoXkit = screen.screenKind === 'xkit' || screen.screenKind === 'xkit-answer'
  const canEditStatus = screen.screenKind === 'xkit' || screen.screenKind === 'xkit-answer'
  const answerChainCount = Math.max(1, Math.min(9, screen.answerChainCount ?? 1))
  const answerEnabled = screen.screenKind === 'xkit'
    ? (screen.statusMode ?? 'default') === 'answer'
    : Boolean(screen.nextScreenId)
  const subtype = (screen.xkitSubtype ?? 'Clues') as 'Clues' | 'Audio' | 'Video'
  const subtypeMeta = xkitSubtypeMeta[subtype]
  const canEditSubtypeBadge = screen.screenKind === 'xkit-answer'

  return (
    <div
      onMouseEnter={() => { if (screen.linkedStepId) onHighlightStep?.(screen.linkedStepId) }}
      onMouseLeave={() => onHighlightStep?.(null)}
      style={{
        minWidth: 320,
        maxWidth: 340,
        minHeight: 860,
        borderRadius: 22,
        border: merged ? 'none' : '1px solid var(--border)',
        background: merged ? 'transparent' : 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(8,10,14,0.94) 100%)',
        padding: merged ? 0 : 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        paddingBottom: merged ? 26 : 40,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <input
          value={screen.title}
          onChange={e => onUpdate(screen.id, { title: e.target.value })}
          placeholder="화면 이름"
          style={flowInputStyle(13, '#fff', 700)}
          readOnly={isAutoXkit}
        />
      </div>

      <input
        id={`screen-upload-${screen.id}`}
        type="file"
        accept="image/*"
        onChange={async e => {
          await onUpload(screen.id, e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 24 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isAutoXkit && (
            <>
              <span style={xkitMetaBadgeStyle}>{linkedStep ? `연결 STEP ${linkedStep.displayIndex}` : '연결 STEP —'}</span>
              <span
                onClick={() => {
                  if (!canEditSubtypeBadge) return
                  onUpdate(screen.id, { xkitSubtype: getNextXkitSubtype(subtype) })
                }}
                role={canEditSubtypeBadge ? 'button' : undefined}
                title={canEditSubtypeBadge ? '클릭하여 타입 변경' : undefined}
                style={{
                  ...xkitMetaBadgeStyle,
                  color: subtypeMeta.color,
                  border: `1px solid ${subtypeMeta.color}55`,
                  background: subtypeMeta.bg,
                  cursor: canEditSubtypeBadge ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                {subtypeMeta.short}
              </span>
            </>
          )}
        </div>
        <label
          htmlFor={`screen-upload-${screen.id}`}
          style={xkitMetaUploadButtonStyle}
          title="이미지 업로드"
        >
          <UploadIcon width={10} height={10} />
        </label>
      </div>

      <div style={{
        alignSelf: 'center',
        width: 216,
        height: 412,
        position: 'relative',
        overflow: 'visible',
        borderRadius: 28,
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#090b0f',
        padding: 10,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        cursor: 'zoom-in',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: 22,
          overflow: 'hidden',
          background: screen.imageDataUrl ? '#fff' : 'linear-gradient(180deg, rgba(182,255,97,0.09) 0%, rgba(182,255,97,0.02) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'zoom-in',
        }}>
          {screen.imageDataUrl ? (
            <img
              src={screen.imageDataUrl}
              alt={screen.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onClick={() => onOpenPreview(screen.id)}
            />
          ) : (
            <div
              style={{ width: '100%', height: '100%' }}
              onClick={() => onOpenPreview(screen.id)}
            />
          )}
        </div>
      </div>

      <div style={{
        width: '100%',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.03)',
        color: 'var(--text-primary)',
        padding: '10px 12px',
        fontSize: 12,
        fontWeight: 700,
      }}>
        {linkedStep ? `STEP ${linkedStep.displayIndex} · ${linkedStep.clue}` : 'STEP —'}
      </div>

      {isAutoXkit && (
        <>
          {canEditStatus && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>상태 타입</div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontSize: 11, color: answerEnabled ? '#b6ff61' : 'var(--text-muted)', fontWeight: 700 }}>
                  {answerEnabled ? 'Answer' : 'Default'}
                </span>
                <input
                  type="checkbox"
                  checked={answerEnabled}
                  onChange={e => {
                    if (screen.screenKind === 'xkit') {
                      onUpdate(screen.id, {
                        statusMode: e.target.checked ? 'answer' : 'default',
                        answerChainCount: e.target.checked ? answerChainCount : 0,
                      })
                      return
                    }
                    onToggleAnswerContinuation(screen.id, e.target.checked)
                  }}
                  style={{ display: 'none' }}
                />
                <span style={{
                  width: 34,
                  height: 20,
                  borderRadius: 999,
                  border: '1px solid rgba(182,255,97,0.35)',
                  background: answerEnabled ? 'rgba(182,255,97,0.35)' : 'rgba(255,255,255,0.08)',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}>
                  <span style={{
                    position: 'absolute',
                    top: 2,
                    left: answerEnabled ? 16 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: answerEnabled ? '#b6ff61' : '#cbd5e1',
                    transition: 'left 0.15s ease, background 0.15s ease',
                  }} />
                </span>
              </label>
            </div>
          )}

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              정답 텍스트
            </span>
            <input
              value={screen.answerText ?? ''}
              onChange={e => onUpdate(screen.id, { answerText: e.target.value })}
              placeholder="정답 입력"
              disabled={!answerEnabled}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                fontSize: 12,
                opacity: answerEnabled ? 1 : 0.45,
              }}
            />
          </label>
        </>
      )}

      <textarea
        value={screen.caption ?? ''}
        onChange={e => onUpdate(screen.id, { caption: e.target.value })}
        placeholder="이 화면의 목적이나 유저 액션 메모"
        rows={4}
        style={flowTextareaStyle}
      />

      <div
        style={{
          position: 'absolute',
          left: merged ? 0 : 14,
          bottom: 10,
          fontSize: 11,
          fontWeight: 800,
          color: '#b6ff61',
        }}
      >
        {`TAG ${tagNo}`}
      </div>
    </div>
  )
}

// 단순한 2D 스트로크 아이콘 (텍스트 없는 아이콘 전용 버튼용)
function SunIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  )
}
function MoonIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
    </svg>
  )
}
function PrinterIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V3h12v6" />
      <rect x="3.5" y="9" width="17" height="8" rx="1.5" />
      <path d="M6 14h12v7H6z" />
    </svg>
  )
}

function miniBadge(bg: string, color: string): React.CSSProperties {
  return {
    fontSize: 9,
    background: bg,
    color,
    borderRadius: 999,
    padding: '2px 7px',
    fontWeight: 700,
  }
}

function flowInputStyle(fontSize: number, color: string, fontWeight: number): React.CSSProperties {
  return {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color,
    fontSize,
    fontWeight,
    padding: 0,
  }
}

const flowTextareaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-secondary)',
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: 1.5,
  resize: 'vertical',
}

const xkitMetaBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#b6ff61',
  border: '1px solid rgba(182,255,97,0.35)',
  background: 'rgba(182,255,97,0.12)',
  borderRadius: 999,
  padding: '3px 8px',
}

const xkitMetaUploadButtonStyle: React.CSSProperties = {
  ...xkitMetaBadgeStyle,
  color: '#e5e7eb',
  border: '1px solid rgba(255,255,255,0.22)',
  background: 'rgba(255,255,255,0.06)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  minWidth: 24,
  minHeight: 22,
  padding: '3px 7px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
}

function getNextXkitSubtype(current: 'Clues' | 'Audio' | 'Video'): 'Clues' | 'Audio' | 'Video' {
  if (current === 'Clues') return 'Audio'
  if (current === 'Audio') return 'Video'
  return 'Clues'
}

function sectionResizeHandleStyle(color: string, leftPct: number, topPct: number, cursor: React.CSSProperties['cursor']): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: 'translate(-6px,-6px)',
    width: 10,
    height: 10,
    borderRadius: 3,
    border: `1px solid ${color}`,
    background: '#0d1117',
    cursor,
    zIndex: 3,
  }
}

const xkitSubtypeMeta: Record<'Clues' | 'Audio' | 'Video', { short: string; color: string; bg: string }> = {
  Clues: { short: 'CLUE', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  Audio: { short: 'AUDIO', color: '#22d3ee', bg: 'rgba(34,211,238,0.14)' },
  Video: { short: 'VIDEO', color: '#f472b6', bg: 'rgba(244,114,182,0.14)' },
}

// ── 인쇄용 정답지(PassMap Print) ─────────────────────────────────────────────
// 현장 GM이 종이로 들고 쓰는 정답지. 잉크 친화적 밝은 배경으로 고정하고
// A4 가로 기준으로 도면(SVG) + 범례 + 섹션별 정답표를 한 문서로 구성한다.
function PassMapPrintView({
  sheet, allSteps, sectionColorMap, projectName, onClose,
}: {
  sheet: GameFlowSheet
  allSteps: StepWithContext[]
  sectionColorMap: Record<string, string>
  projectName?: string
  onClose: () => void
}) {
  const placed = allSteps.filter(s => s.pinX !== undefined && s.pinY !== undefined)
  const printedAt = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const flagBadge = (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 9, fontWeight: 800, color: fg, background: bg,
    borderRadius: 4, padding: '1px 5px', marginRight: 3, letterSpacing: 0.3,
  })
  return (
    <div
      className="passmap-print-root"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, overflow: 'auto',
        background: '#ffffff', color: '#151a24',
        fontFamily: 'inherit', padding: '20px 28px 40px',
      }}
    >
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          .passmap-print-root, .passmap-print-root * { visibility: visible !important; }
          .passmap-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; padding: 0 !important; }
          .passmap-no-print { display: none !important; }
          .passmap-print-section { break-inside: avoid; }
        }
        .passmap-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* 화면 전용 상단 바 */}
      <div className="passmap-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e3e7ee' }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>인쇄 미리보기 — PassMap 정답지</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#151a24', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            🖨 인쇄하기
          </button>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #d4dae4', background: '#fff', color: '#3a4356', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            닫기 (Esc)
          </button>
        </div>
      </div>

      {/* 문서 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.3 }}>
          PassMap 정답지{projectName ? ` · ${projectName}` : ''}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          {sheet.sections.length}개 섹션 · {allSteps.length}개 스텝 · 출력일 {printedAt}
        </div>
      </div>

      {/* 도면 (SVG — 인쇄에서 벡터로 선명) */}
      <svg
        viewBox={`0 0 ${STUDIO_COLS} ${STUDIO_ROWS}`}
        style={{ width: '100%', border: '1px solid #ccd3de', borderRadius: 8, background: '#ffffff', display: 'block' }}
      >
        {Array.from({ length: STUDIO_COLS + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i} y1={0} x2={i} y2={STUDIO_ROWS} stroke="#eef1f6" strokeWidth={0.04} />
        ))}
        {Array.from({ length: STUDIO_ROWS + 1 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i} x2={STUDIO_COLS} y2={i} stroke="#eef1f6" strokeWidth={0.04} />
        ))}
        {sheet.sections.map((sec, i) => {
          const color = sectionColorMap[sec.id] || SECTION_COLORS[i % SECTION_COLORS.length]
          const box = getSectionMapBox(sec, i)
          const cells = getSectionCellSet(sec, i)
          const outline = buildSectionOutlineSegments(cells)
          const labelAnchor = getSectionLabelAnchor(cells, box)
          return (
            <g key={sec.id}>
              {Array.from(cells).map(k => {
                const p = parseCellKey(k)
                return <rect key={k} x={p.x} y={p.y} width={1} height={1} fill={`${color}14`} />
              })}
              {outline.map((s, idx) => (
                <line key={idx} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={color} strokeWidth={0.12} strokeLinecap="square" />
              ))}
              <text
                x={labelAnchor.x + 0.35} y={labelAnchor.y + 1.05}
                fontSize={0.95} fontWeight={800} fill={color}
                stroke="#ffffff" strokeWidth={0.16} paintOrder="stroke"
              >
                {getSectionDisplayTitle(i, sec.title)}
              </text>
            </g>
          )
        })}
        {placed.map(step => {
          const pinColor = getPinColor(step)
          const cx = ((step.pinX ?? 0) / 100) * STUDIO_COLS
          const cy = ((step.pinY ?? 0) / 100) * STUDIO_ROWS
          const answer = (step.output || '').trim()
          const onRight = (step.pinX ?? 0) <= 62
          return (
            <g key={step.id}>
              <circle cx={cx} cy={cy} r={0.78} fill="#ffffff" stroke={pinColor} strokeWidth={0.16} />
              <text x={cx} y={cy + 0.3} fontSize={0.8} fontWeight={800} fill="#1c2333" textAnchor="middle">
                {step.displayIndex}
              </text>
              {answer && (
                <text
                  x={onRight ? cx + 1.15 : cx - 1.15} y={cy + 0.27}
                  fontSize={0.72} fontWeight={700} fill="#2a3242"
                  textAnchor={onRight ? 'start' : 'end'}
                  stroke="#ffffff" strokeWidth={0.14} paintOrder="stroke"
                >
                  {answer.length > 26 ? `${answer.slice(0, 26)}…` : answer}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', margin: '10px 2px 18px', fontSize: 10.5, color: '#4a5468' }}>
        <span style={{ fontWeight: 800 }}>분류</span>
        {[
          { label: 'Xkit', color: '#b45309' },
          { label: 'Lock/Key', color: '#0f766e' },
          { label: 'Dev', color: '#1d4ed8' },
          { label: '기타', color: '#7c3aed' },
          { label: 'AUTO', color: '#6b7280' },
        ].map(item => (
          <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
            {item.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>핀 번호는 섹션 내 순번 · 라벨은 OUT PUT(획득/개방)</span>
      </div>

      {/* 섹션별 정답표 */}
      {sheet.sections.map((sec, i) => {
        const color = sectionColorMap[sec.id] || SECTION_COLORS[i % SECTION_COLORS.length]
        return (
          <div key={sec.id} className="passmap-print-section" style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
              background: `${color}14`, borderLeft: `4px solid ${color}`, borderRadius: 4, marginBottom: 4,
            }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#1c2333' }}>{getSectionDisplayTitle(i, sec.title)}</span>
              <span style={{ fontSize: 10, color: '#6b7280' }}>{sec.steps.length}개 스텝</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #d4dae4', color: '#4a5468' }}>
                  <th style={{ width: 26, padding: '3px 6px', textAlign: 'left' }}>No</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>단서</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>IN PUT (입력·행동)</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>OUT PUT (획득·개방)</th>
                  <th style={{ width: 120, padding: '3px 6px', textAlign: 'left' }}>표식</th>
                </tr>
              </thead>
              <tbody>
                {sec.steps.map((step, si) => (
                  <tr key={step.id} style={{ borderBottom: '1px solid #eceff4', verticalAlign: 'top' }}>
                    <td style={{ padding: '3px 6px', fontWeight: 800, color }}>{si + 1}</td>
                    <td style={{ padding: '3px 6px', fontWeight: 700 }}>{step.clue || '—'}</td>
                    <td style={{ padding: '3px 6px', color: '#3a4356' }}>
                      {(step.inputTags ?? []).map(tag => (
                        <span key={tag} style={{
                          display: 'inline-block', fontSize: 8.5, fontWeight: 800, color: '#3a4356',
                          border: '1px solid #9aa4b5', borderRadius: 4, padding: '0 4px', marginRight: 3,
                        }}>{tag}</span>
                      ))}
                      {step.input || '—'}
                    </td>
                    <td style={{ padding: '3px 6px', color: '#3a4356' }}>
                      {(step.outputTags ?? []).map(tag => (
                        <span key={tag} style={{
                          display: 'inline-block', fontSize: 8.5, fontWeight: 800, color: '#3a4356',
                          border: '1px solid #9aa4b5', borderRadius: 4, padding: '0 4px', marginRight: 3,
                        }}>{tag}</span>
                      ))}
                      {step.output || '—'}
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      {step.xkit && <span style={flagBadge('#fef3c7', '#b45309')}>XKIT</span>}
                      {step.key && <span style={flagBadge('#ccfbf1', '#0f766e')}>KEY</span>}
                      {step.dev && <span style={flagBadge('#dbeafe', '#1d4ed8')}>DEV</span>}
                      {step.auto && <span style={flagBadge('#f3f4f6', '#6b7280')}>AUTO</span>}
                      {step.problemType && <span style={flagBadge('#ede9fe', '#7c3aed')}>{step.problemType}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function FloorPlanPlaceholder({ bg, line, opacity }: { bg: string; line: string; opacity: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: bg }}>
      <svg viewBox={`0 0 ${STUDIO_WIDTH} ${STUDIO_HEIGHT}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity }}>
        <defs>
          <pattern id="grid" width={STUDIO_TILE} height={STUDIO_TILE} patternUnits="userSpaceOnUse">
            <path d={`M ${STUDIO_TILE} 0 L 0 0 0 ${STUDIO_TILE}`} fill="none" stroke={line} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}
