import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { getProjects } from '../lib/storage'
import type { GameFlowSection, GameFlowSheet, GameStep } from '../types'
import {
  ButtonPressIcon, FolderOpenIcon, LockIcon, BoxArrowDownIcon, HandRemoveIcon, KeyTriggerIcon,
  PersonWalkIcon, ArrowUpMarkIcon, CircleMarkIcon, XMarkIcon, HashIcon, HexagonIcon,
  LightBulbIcon, FilmIcon, MusicNoteIcon, CheckIcon, CloseIcon, HistoryIcon, UploadIcon,
  SearchIcon, FloorTileIcon, WallBrickIcon, DoorPanelIcon, EraserIcon,
  PlaceCursorIcon, MoveArrowsIcon, GearIcon, FurnChairIcon, FurnDeskIcon, FurnCabinetIcon,
  FurnShelfIcon, FurnTvIcon, FurnLampIcon, FurnPlantIcon, FurnToiletIcon, FurnBathIcon,
  FurnSinkIcon, FurnMirrorIcon, FurnFridgeIcon, FurnLockerIcon, FurnWardrobeIcon,
  FurnPrinterIcon, FurnBoardIcon, FurnIvStandIcon, FurnMedCabIcon, FurnPhoneIcon,
  FurnCamIcon, FurnClockIcon, FurnItemIcon, FurnDresserIcon, BoxIcon, SaveDiskIcon,
  SunIcon, MoonIcon, AgentIconPd, FurnBedIcon, FurnSofaIcon,
} from './ui/Icon'
import { STUDIO_TILE, STUDIO_COLS, STUDIO_ROWS, STUDIO_WIDTH, STUDIO_HEIGHT } from '../constants/studioGrid'

// ── Constants ──────────────────────────────────────────────────
const TILE = STUDIO_TILE
const COLS = STUDIO_COLS
const ROWS = STUDIO_ROWS
const W = STUDIO_WIDTH
const H = STUDIO_HEIGHT
const SPD = 2
const CHW = 16
const CHH = 24
const FRAME_TICKS = 8
const ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7.5 6.5l5-5a1.4 1.4 0 0 1 2 0l7 7a1.4 1.4 0 0 1 0 2l-7.5 7.5H8l-5.5-5.5a1.4 1.4 0 0 1 0-2l5-4.5Z' fill='%23f6d4cb' stroke='%23523f44' stroke-width='1.4'/%3E%3Cpath d='M10.5 3.5l10 10' stroke='%23b96b76' stroke-width='1.5'/%3E%3Cpath d='M2 19.5h12' stroke='%23ff6b6b' stroke-width='1.7'/%3E%3C/g%3E%3C/svg%3E") 4 18, crosshair`

// ── Types ──────────────────────────────────────────────────────
type Mode = 'edit' | 'play'
type Tool = 'floor' | 'wall' | 'door' | 'place' | 'move' | 'dev'
type DoorType = 'doorS' | 'doorD' | 'doorSl'
type Cat = 'storage' | 'tables' | 'chairs' | 'appliances' | 'decor' | 'bathroom' | 'kitchen' | 'lock' | 'door'
type Dir = 'up' | 'down' | 'left' | 'right'
type DevType = 'eml' | 'light' | 'sound' | 'video' | 'trigger'
type LightColor = 'yellow' | 'red' | 'blue' | 'green' | 'uv'
type TriggerType = 'button' | 'open' | 'close' | 'puton' | 'remove' | 'key'

interface PItem { uid: string; itemId: string; x: number; y: number; rot: 0|1|2|3; flip: boolean }
interface PMark { uid: string; markId: string; x: number; y: number; w: number; h: number; sides?: number; color?: string; label?: string; fontSize?: number }

interface MapSnapshot {
  tiles: number[][]
  placedItems: PItem[]
  marks: PMark[]
  devItems: DevItem[]
  devRules: DevRule[]
  gridTheme: 'dark' | 'light'
}
interface HistoryEntry {
  id: string
  savedAt: string
  snapshot: MapSnapshot
}

const MAX_HISTORY = 7

function getMapKey(projectId: string) { return `xynaps_meta_map_${projectId}` }
function getHistoryKey(projectId: string) { return `xynaps_meta_hist_${projectId}` }

function loadMapSnapshot(projectId: string): MapSnapshot | null {
  try { return JSON.parse(localStorage.getItem(getMapKey(projectId)) || 'null') }
  catch { return null }
}
function loadHistory(projectId: string): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(getHistoryKey(projectId)) || '[]') }
  catch { return [] }
}
function persistSnapshot(projectId: string, snap: MapSnapshot, hist: HistoryEntry[]) {
  const entry: HistoryEntry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), snapshot: snap }
  const next = [entry, ...hist].slice(0, MAX_HISTORY)
  localStorage.setItem(getMapKey(projectId), JSON.stringify(snap))
  localStorage.setItem(getHistoryKey(projectId), JSON.stringify(next))
  return next
}
interface MItem { id: string; name: string; cat: Cat; w: number; h: number }
interface DevItem {
  uid: string
  type: DevType
  x: number
  y: number
  name: string
  active: boolean
  linkedDoorUid?: string   // EML only
  lightColor?: LightColor  // light only
  audioUrl?: string        // sound only
  audioName?: string       // sound only
  videoUrl?: string        // video only
  videoName?: string       // video only
  triggerType?: TriggerType // trigger only
}
interface DevRule {
  uid: string
  name?: string                          // user-set rule label
  inputUids: string[]                    // trigger/EML device uids (AND logic)
  outputUids: string[]                   // effect device uids
  outputDelays?: Record<string, number>  // outputUid → delay in seconds (0 = immediate)
}
interface BuildingRule {
  uid: string
  inputUids: string[]
  outputUids: string[]
  step: 'inputs' | 'outputs'
}

interface FlowSketchSection {
  id: string
  title: string
  alpha: string
  color: string
  cells: Array<{ x: number; y: number }>
}

interface FlowSketchPin {
  x: number
  y: number
  label: string
  color: string
}

type FlowArrowDirection = 'east' | 'west' | 'south' | 'north'

interface FlowSketchArrow {
  x: number
  y: number
  direction: FlowArrowDirection
  color: string
}

const FLOW_SKETCH_COLORS = ['#9b6dff', '#4da6ff', '#00d4aa', '#ff7043', '#ff6b9d']

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

// ── Color Palette (muted, desaturated — reference style) ───────
const C = {
  // Floors
  F1_BASE: '#d4cfc8', F1_LINE: '#b8b2aa',   // warm gray (bedroom/living)
  F2_BASE: '#c8bc9a', F2_LINE: '#a89870',   // warm wood (study)
  F3_BASE: '#c8ccd4', F3_LINE: '#aab0b8',   // cool gray (bathroom/medical)
  F4A: '#d0ccC8',     F4B: '#bcb8b4',        // checker (school)
  // Wall & void
  WALL: '#787068',    WALL_HI: '#989088',    WALL_SH: '#504840',
  VOID: '#727780',    VOID2: '#5c6169',
  VOID_LIGHT: '#d4cfc8', VOID_LIGHT2: '#bfb8b0',
  // Furniture — muted whites/grays
  FW: '#f0ece8',      // near white
  FL: '#d8d4d0',      // light gray
  FM: '#a8a4a0',      // medium gray
  FD: '#706c68',      // dark gray
  FVD: '#3a3632',     // very dark
  WL: '#c8b890',      // warm light wood
  WD: '#907850',      // warm dark wood
  WS: '#604030',      // wood shadow
  // Accent (minimal)
  LEAF: '#7a9870',    LEAFD: '#506048',
  POT: '#b07050',     WATB: '#b0c8d8',
  // Warm pixel-art wood palette
  WP1: '#C8A870',     // 밝은 원목 (하이라이트)
  WP2: '#8B6340',     // 중간 원목 (기본)
  WP3: '#5C3D1E',     // 어두운 원목 (그림자)
  WP4: '#3A2010',     // 외곽선
  UPG: '#5D9E6A',     // 녹색 패브릭
  UPGD:'#3A6B45',     // 녹색 패브릭 어둠
  UPGL:'#8DC89A',     // 녹색 패브릭 하이라이트
  BED: '#E8DDD0',     // 침구 크림
  BEDD:'#C4B8A8',     // 침구 그림자
}

// ── Rotation helpers ───────────────────────────────────────────
function effDims(item: MItem, rot: 0|1|2|3): { w: number; h: number } {
  return rot % 2 === 0 ? { w: item.w, h: item.h } : { w: item.h, h: item.w }
}

function drawItemRot(ctx: CanvasRenderingContext2D, px: number, py: number, item: MItem, rot: 0|1|2|3, flip = false) {
  const { w: ew, h: eh } = effDims(item, rot)
  ctx.save()
  ctx.translate(px + (ew * TILE) / 2, py + (eh * TILE) / 2)
  if (flip) ctx.scale(-1, 1)
  ctx.rotate((rot * Math.PI) / 2)
  DRAW_FNS[item.id]?.(ctx, -(item.w * TILE) / 2, -(item.h * TILE) / 2)
  ctx.restore()
}

// ── Helper drawing ─────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D

function r(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

function r3(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, hi: string, sh: string) {
  r(ctx, x, y, w, h, base)
  r(ctx, x, y, w, 1, hi); r(ctx, x, y, 1, h, hi)
  r(ctx, x + w - 1, y, 1, h, sh); r(ctx, x, y + h - 1, w, 1, sh)
}

function ol(ctx: Ctx, x: number, y: number, w: number, h: number, c = '#18140e') {
  ctx.strokeStyle = c; ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}

// ── Tile drawing ───────────────────────────────────────────────
function drawTile(ctx: Ctx, gx: number, gy: number, t: number, lightGrid = false) {
  const px = gx * TILE, py = gy * TILE
  switch (t) {
    case 0: { // void/exterior — grid background
      r(ctx, px, py, TILE, TILE, lightGrid ? C.VOID_LIGHT : C.VOID)
      ctx.strokeStyle = lightGrid ? '#afa8a0' : '#8b9098'
      ctx.lineWidth = 0.5
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1)
      break
    }
    case 1: { // warm gray floor (bedroom/living)
      r(ctx, px, py, TILE, TILE, C.F1_BASE)
      ctx.fillStyle = C.F1_LINE
      for (let i = 7; i < TILE; i += 8) ctx.fillRect(px, py + i, TILE, 1)
      r(ctx, px, py, TILE, 1, 'rgba(255,255,255,0.1)')
      break
    }
    case 2: { // warm wood floor
      r(ctx, px, py, TILE, TILE, C.F2_BASE)
      ctx.fillStyle = C.F2_LINE
      for (let i = 0; i < TILE; i += 8) ctx.fillRect(px, py + i, TILE, 1)
      r(ctx, px + TILE / 2, py, 1, TILE, C.F2_LINE)
      break
    }
    case 3: { // cool gray (bathroom/medical)
      r(ctx, px, py, TILE, TILE, C.F3_BASE)
      ctx.fillStyle = C.F3_LINE
      ctx.fillRect(px + TILE - 1, py, 1, TILE)
      ctx.fillRect(px, py + TILE - 1, TILE, 1)
      r(ctx, px, py, TILE, 1, 'rgba(255,255,255,0.08)')
      break
    }
    case 4: { // checker
      const isA = (gx + gy) % 2 === 0
      r(ctx, px, py, TILE, TILE, isA ? C.F4A : C.F4B)
      r(ctx, px, py + TILE - 1, TILE, 1, isA ? '#b0aca8' : '#a0a09a')
      r(ctx, px + TILE - 1, py, 1, TILE, isA ? '#b0aca8' : '#a0a09a')
      break
    }
    case 5: { // wall — medium gray
      r(ctx, px, py, TILE, TILE, C.WALL)
      ctx.fillStyle = '#686460'
      for (let i = 8; i < TILE; i += 8) ctx.fillRect(px, py + i, TILE, 1)
      r(ctx, px, py, TILE, 1, C.WALL_HI); r(ctx, px, py, 1, TILE, C.WALL_HI)
      r(ctx, px + TILE - 1, py, 1, TILE, C.WALL_SH); r(ctx, px, py + TILE - 1, TILE, 1, C.WALL_SH)
      break
    }
    case 6: { // marble checker — black/white marble with metallic grout
      const isLight = (gx + gy) % 2 === 0
      r(ctx, px, py, TILE, TILE, isLight ? '#dedad4' : '#2c201a')
      // Subtle veins
      ctx.fillStyle = isLight ? 'rgba(160,148,136,0.35)' : 'rgba(110,74,50,0.45)'
      const v = gx * 13 + gy * 7
      ctx.fillRect(px + (v % 10) + 2, py + (v * 3 % 10) + 2, 9, 1)
      ctx.fillRect(px + (v * 5 % 10) + 1, py + (v * 7 % 8) + 8, 7, 1)
      ctx.fillRect(px + (v * 3 % 12) + 1, py + (v * 9 % 10) + 15, 10, 1)
      // Bevel
      r(ctx, px + 1, py + 1, TILE - 2, 1, isLight ? '#f0ece8' : '#3e2c24')
      r(ctx, px + 1, py + 1, 1, TILE - 2, isLight ? '#f0ece8' : '#3e2c24')
      r(ctx, px + TILE - 2, py + 1, 1, TILE - 2, isLight ? '#b8b4ae' : '#1a120e')
      r(ctx, px + 1, py + TILE - 2, TILE - 2, 1, isLight ? '#b8b4ae' : '#1a120e')
      // Metallic grout
      r(ctx, px, py, TILE, 1, '#787068'); r(ctx, px, py, 1, TILE, '#787068')
      break
    }
    case 7: { // beige stone — square cut limestone
      r(ctx, px, py, TILE, TILE, '#c4bba8')
      r(ctx, px + 2, py + 2, TILE - 4, TILE - 4, '#cac2ae')
      // Center subtle texture
      const s7 = gx * 11 + gy * 17
      ctx.fillStyle = 'rgba(140,128,108,0.2)'
      ctx.fillRect(px + (s7 % 8) + 3, py + (s7 * 3 % 8) + 3, 5, 1)
      ctx.fillRect(px + (s7 * 5 % 10) + 2, py + (s7 * 7 % 10) + 10, 6, 1)
      // Bevel
      r(ctx, px + 1, py + 1, TILE - 2, 1, '#ddd4bc'); r(ctx, px + 1, py + 1, 1, TILE - 2, '#ddd4bc')
      r(ctx, px + TILE - 2, py + 1, 1, TILE - 2, '#a09080'); r(ctx, px + 1, py + TILE - 2, TILE - 2, 1, '#a09080')
      // Dark grout
      r(ctx, px, py, TILE, 1, '#6a6050'); r(ctx, px, py, 1, TILE, '#6a6050')
      break
    }
    case 8: { // pebble / gravel
      r(ctx, px, py, TILE, TILE, '#b89858')
      const h8 = gx * 13 + gy * 7
      const pebbles = [
        { ox: h8 % 14,          oy: (h8 * 3) % 14,       rw: 5, rh: 4, c: '#c8a86a' },
        { ox: (h8 * 7 + 8) % 16, oy: (h8 * 11 + 4) % 14,  rw: 4, rh: 3, c: '#a08848' },
        { ox: (h8 * 2 + 4) % 12, oy: (h8 * 9 + 10) % 12,  rw: 6, rh: 5, c: '#d0b878' },
        { ox: (h8 * 11 + 2) % 14, oy: (h8 * 3 + 6) % 16,  rw: 3, rh: 3, c: '#b09060' },
        { ox: (h8 * 5 + 10) % 18, oy: (h8 * 7 + 2) % 10,  rw: 3, rh: 2, c: '#9090a0' },
        { ox: (h8 * 9 + 6) % 12,  oy: (h8 * 5 + 12) % 14, rw: 4, rh: 4, c: '#c0a060' },
      ]
      for (const p of pebbles) {
        ctx.fillStyle = p.c
        ctx.beginPath()
        ctx.ellipse(px + p.ox + 3, py + p.oy + 3, p.rw, p.rh, (h8 * p.rw * 0.3) % Math.PI, 0, Math.PI * 2)
        ctx.fill()
        // pebble highlight
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.beginPath()
        ctx.ellipse(px + p.ox + 2, py + p.oy + 2, p.rw * 0.5, p.rh * 0.4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 9: { // grass — green with leaf scatter
      r(ctx, px, py, TILE, TILE, '#6a8c28')
      const s9 = gx * 17 + gy * 11
      const leaves = [
        { ox: s9 % 14,           oy: (s9 * 3) % 14 },
        { ox: (s9 * 5 + 6) % 16, oy: (s9 * 7 + 4) % 16 },
        { ox: (s9 * 3 + 9) % 12, oy: (s9 * 11 + 8) % 12 },
        { ox: (s9 * 9 + 3) % 18, oy: (s9 * 2 + 12) % 16 },
      ]
      for (const l of leaves) {
        ctx.fillStyle = (s9 + l.ox) % 3 === 0 ? '#7aaa30' : '#5a7820'
        // small leaf: 3 rects forming a star/leaf cluster
        ctx.fillRect(px + l.ox + 1, py + l.oy,     3, 1)
        ctx.fillRect(px + l.ox,     py + l.oy + 1, 1, 3)
        ctx.fillRect(px + l.ox + 2, py + l.oy + 1, 1, 3)
        ctx.fillRect(px + l.ox + 1, py + l.oy + 4, 3, 1)
      }
      break
    }
    case 10: { // green ceramic tiles — zellige style
      r(ctx, px, py, TILE, TILE, '#4a8055')
      // Bevel for slight 3D
      r(ctx, px + 1, py + 1, TILE - 2, 1, '#5a9865'); r(ctx, px + 1, py + 1, 1, TILE - 2, '#5a9865')
      r(ctx, px + TILE - 2, py + 1, 1, TILE - 2, '#387048'); r(ctx, px + 1, py + TILE - 2, TILE - 2, 1, '#387048')
      // Inner face (slight center highlight)
      r(ctx, px + 2, py + 2, TILE - 4, TILE - 4, '#4e8859')
      // Grout (tan/beige like the reference)
      r(ctx, px, py, TILE, 1, '#c8b070'); r(ctx, px, py, 1, TILE, '#c8b070')
      break
    }
    case 11: { // 나무 파케이 — pixel wood parquet (alternating plank direction)
      const alt = (gx + gy) % 2 === 0
      const base = alt ? '#c07840' : '#b86830'
      r(ctx, px, py, TILE, TILE, base)
      ctx.fillStyle = '#8a4a18'
      if (alt) {
        // horizontal planks
        for (let i = 6; i < TILE; i += 6) ctx.fillRect(px, py + i, TILE, 1)
        ctx.fillRect(px + TILE / 2, py, 1, TILE)
        ctx.fillStyle = 'rgba(200,140,60,0.2)'
        ctx.fillRect(px + 3, py + 2, TILE - 6, 1)
        ctx.fillRect(px + 5, py + 9, TILE - 10, 1)
      } else {
        // vertical planks
        for (let i = 6; i < TILE; i += 6) ctx.fillRect(px + i, py, 1, TILE)
        ctx.fillRect(px, py + TILE / 2, TILE, 1)
        ctx.fillStyle = 'rgba(200,140,60,0.2)'
        ctx.fillRect(px + 2, py + 3, 1, TILE - 6)
        ctx.fillRect(px + 9, py + 5, 1, TILE - 10)
      }
      r(ctx, px, py, TILE, 1, 'rgba(255,255,255,0.07)')
      break
    }
    case 12: { // 꽃밭 — flower field with leaf clusters and pixel flowers
      r(ctx, px, py, TILE, TILE, '#4a9a1a')
      const s12 = gx * 13 + gy * 17
      const leaves12 = [
        { ox: s12 % 12,         oy: (s12 * 3) % 12 },
        { ox: (s12 * 5 + 5) % 14, oy: (s12 * 7 + 3) % 14 },
        { ox: (s12 * 3 + 8) % 10, oy: (s12 * 11 + 7) % 10 },
      ]
      for (const l of leaves12) {
        ctx.fillStyle = '#2a6a08'
        ctx.fillRect(px + l.ox + 1, py + l.oy,     2, 1)
        ctx.fillRect(px + l.ox,     py + l.oy + 1, 1, 2)
        ctx.fillRect(px + l.ox + 2, py + l.oy + 1, 1, 2)
        ctx.fillStyle = '#3a8010'
        ctx.fillRect(px + l.ox + 1, py + l.oy + 1, 1, 1)
      }
      if ((s12 * 13) % 7 === 0) {
        const fx = (s12 * 3) % 18 + 3, fy = (s12 * 7) % 18 + 3
        ctx.fillStyle = '#f8f8e0'
        ctx.fillRect(px + fx,     py + fy - 1, 1, 3)
        ctx.fillRect(px + fx - 1, py + fy,     3, 1)
        ctx.fillStyle = '#e8c020'
        ctx.fillRect(px + fx,     py + fy,     1, 1)
      }
      break
    }
    case 13: { // 시멘트 — concrete / cement floor
      r(ctx, px, py, TILE, TILE, '#b0b0b4')
      const s13 = gx * 11 + gy * 13
      ctx.fillStyle = 'rgba(80,80,88,0.07)'
      ctx.fillRect(px + s13 % 10 + 1,          py + (s13 * 3) % 10 + 1, 6, 5)
      ctx.fillRect(px + (s13 * 7 + 4) % 12 + 1, py + (s13 * 5 + 6) % 14 + 1, 8, 4)
      ctx.fillStyle = 'rgba(200,200,210,0.06)'
      ctx.fillRect(px + (s13 * 3 + 7) % 14 + 1, py + (s13 * 9 + 2) % 12 + 1, 5, 7)
      break
    }
    case 15: { // 벽돌 — brick wall
      r(ctx, px, py, TILE, TILE, '#703018')
      const bH = 8
      for (let row = 0; row * bH < TILE; row++) {
        const off = (gy * 4 + row) % 2 === 0 ? 0 : 12
        const colors = ['#b84828', '#c05030', '#a84020']
        for (let bx = -off; bx < TILE; bx += 24) {
          ctx.fillStyle = colors[Math.abs((bx / 4 + row + gx)) % 3]
          ctx.fillRect(px + bx + 1, py + row * bH + 1, 21, bH - 2)
          ctx.fillStyle = 'rgba(255,200,180,0.12)'
          ctx.fillRect(px + bx + 1, py + row * bH + 1, 21, 2)
          ctx.fillStyle = 'rgba(0,0,0,0.12)'
          ctx.fillRect(px + bx + 1, py + row * bH + bH - 2, 21, 1)
        }
      }
      break
    }
    case 16: { // 흰 벽 — white plaster
      r(ctx, px, py, TILE, TILE, '#e8e4de')
      const s16 = gx * 17 + gy * 13
      ctx.fillStyle = 'rgba(160,152,142,0.07)'
      ctx.fillRect(px + s16 % 8 + 2,       py + (s16 * 3) % 8 + 2,  5, 3)
      ctx.fillRect(px + (s16 * 5) % 10 + 3, py + (s16 * 7) % 10 + 9, 6, 2)
      r(ctx, px + TILE - 1, py, 1, TILE, 'rgba(0,0,0,0.04)')
      r(ctx, px, py + TILE - 1, TILE, 1, 'rgba(0,0,0,0.04)')
      break
    }
    case 17: { // 암석 — dark stone wall
      r(ctx, px, py, TILE, TILE, '#3a3830')
      const bH17 = 8, bW17 = 12
      ctx.strokeStyle = '#22201a'
      ctx.lineWidth = 1
      for (let row = 0; row * bH17 < TILE; row++) {
        const off17 = (gy * 2 + row) % 2 === 0 ? 0 : bW17 / 2
        for (let bx = -off17; bx < TILE; bx += bW17) {
          const shade = ['#424038', '#3e3c34', '#464440'][(Math.abs(bx + row * 3 + gx)) % 3]
          ctx.fillStyle = shade
          ctx.fillRect(px + bx + 1, py + row * bH17 + 1, bW17 - 2, bH17 - 2)
        }
      }
      r(ctx, px, py, TILE, 1, 'rgba(255,255,255,0.05)')
      break
    }
    case 18: { // 나무 패널 — vertical wood wall paneling
      r(ctx, px, py, TILE, TILE, C.WP2)
      ctx.fillStyle = C.WP3
      for (let i = 8; i < TILE; i += 8) ctx.fillRect(px + i, py, 1, TILE)
      const s18 = gx * 7 + gy * 11
      ctx.fillStyle = 'rgba(80,40,10,0.18)'
      ctx.fillRect(px + 1,  py + s18 % 6 + 2,      6, 1)
      ctx.fillRect(px + 9,  py + (s18 * 3) % 8 + 4, 6, 1)
      ctx.fillRect(px + 17, py + (s18 * 5) % 10 + 1, 6, 1)
      r(ctx, px, py, TILE, 1, 'rgba(255,255,255,0.07)')
      break
    }
    case 19: { // 콘크리트 — concrete wall with panel lines
      r(ctx, px, py, TILE, TILE, '#8a8c90')
      ctx.fillStyle = '#707278'
      ctx.fillRect(px + TILE / 2, py, 1, TILE)
      ctx.fillRect(px, py + TILE / 2, TILE, 1)
      const s19 = gx * 13 + gy * 9
      ctx.fillStyle = 'rgba(50,52,58,0.07)'
      ctx.fillRect(px + s19 % 10 + 1, py + (s19 * 3) % 8 + 1, 6, 4)
      r(ctx, px, py, TILE, 1, 'rgba(255,255,255,0.06)')
      r(ctx, px + TILE - 1, py, 1, TILE, 'rgba(0,0,0,0.06)')
      break
    }
    default: break
  }
}

// ── Dev item drawing ──────────────────────────────────────────
const LIGHT_COLORS: Record<LightColor, { on: string; glow: string; label: string }> = {
  yellow: { on: '#ffe066', glow: 'rgba(255,220,80,0.35)',  label: '노랑' },
  red:    { on: '#ff5555', glow: 'rgba(255,60,60,0.35)',   label: '빨강' },
  blue:   { on: '#55aaff', glow: 'rgba(60,140,255,0.35)', label: '파랑' },
  green:  { on: '#55ee88', glow: 'rgba(60,220,100,0.35)', label: '초록' },
  uv:     { on: '#cc66ff', glow: 'rgba(180,60,255,0.38)', label: 'UV' },
}

const TRIGGER_TYPES: Record<TriggerType, { icon: ReactNode; label: string; color: string; canvasLabel: string }> = {
  button: { icon: <ButtonPressIcon  width={12} height={12} />, label: 'Button',  color: '#ffaa44', canvasLabel: 'BTN' },
  open:   { icon: <FolderOpenIcon   width={12} height={12} />, label: 'Open',    color: '#44ddff', canvasLabel: 'OPN' },
  close:  { icon: <LockIcon         width={12} height={12} />, label: 'Close',   color: '#ff7755', canvasLabel: 'CLS' },
  puton:  { icon: <BoxArrowDownIcon width={12} height={12} />, label: 'Put-On',  color: '#88cc44', canvasLabel: 'PUT' },
  remove: { icon: <HandRemoveIcon   width={12} height={12} />, label: 'Remove',  color: '#dd88ff', canvasLabel: 'RMV' },
  key:    { icon: <KeyTriggerIcon   width={12} height={12} />, label: 'Key',     color: '#ffcc44', canvasLabel: 'KEY' },
}

function drawDevLight(ctx: Ctx, px: number, py: number, color: LightColor, active: boolean) {
  const { on, glow } = LIGHT_COLORS[color]
  if (active) {
    // Glow halo
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.fillStyle = glow.replace('0.35', '0.18').replace('0.38', '0.18')
    ctx.beginPath()
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // Bulb body
  const cx = px + TILE / 2, cy = py + TILE / 2
  ctx.fillStyle = active ? on : '#555050'
  ctx.beginPath(); ctx.arc(cx, cy - 3, 6, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = active ? on : '#888'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy - 3, 6, 0, Math.PI * 2); ctx.stroke()
  // Base
  ctx.fillStyle = '#888880'
  ctx.fillRect(cx - 3, cy + 3, 6, 3)
  ctx.fillRect(cx - 2, cy + 6, 4, 2)
  // Shine on active
  if (active) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillRect(cx - 3, cy - 6, 2, 2)
  }
  // Label
  ctx.save()
  ctx.font = 'bold 7px sans-serif'
  ctx.fillStyle = active ? on : '#666'
  ctx.textAlign = 'center'
  ctx.fillText(active ? '●' : '○', cx, py + TILE - 1)
  ctx.restore()
}

function drawDevSound(ctx: Ctx, px: number, py: number, active: boolean) {
  const cx = px + TILE / 2, cy = py + TILE / 2
  if (active) {
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = 'rgba(80,200,120,0.4)'
    ctx.beginPath(); ctx.arc(cx, cy, TILE, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  // 이모지 음표 직접 표시
  ctx.save()
  ctx.globalAlpha = active ? 1 : 0.55
  ctx.font = '14px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🎵', cx, cy)
  ctx.restore()
}

function drawDevVideo(ctx: Ctx, px: number, py: number, active: boolean) {
  const cx = px + TILE / 2, cy = py + TILE / 2
  const col = active ? '#ee8844' : '#888'
  if (active) {
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ee884440'
    ctx.beginPath(); ctx.arc(cx, cy, TILE, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  // Film frame rectangle
  ctx.strokeStyle = col; ctx.lineWidth = 1.5
  ctx.strokeRect(cx - 7, cy - 5, 14, 10)
  // Sprocket holes (2 left, 2 right)
  ctx.fillStyle = col
  for (const [fx, fy] of [[cx - 6, cy - 3], [cx - 6, cy + 1], [cx + 4, cy - 3], [cx + 4, cy + 1]] as [number,number][])
    ctx.fillRect(fx, fy, 2, 2)
  // Play triangle
  ctx.beginPath(); ctx.moveTo(cx - 2, cy - 3); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx - 2, cy + 3)
  ctx.closePath(); ctx.fill()
  // Label
  ctx.save(); ctx.font = 'bold 5px sans-serif'; ctx.fillStyle = col
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText('VID', cx, py + TILE - 1); ctx.restore()
}

function drawDevTrigger(ctx: Ctx, px: number, py: number, triggerType: TriggerType, active: boolean) {
  const cx = px + TILE / 2, cy = py + TILE / 2
  const { color, canvasLabel } = TRIGGER_TYPES[triggerType]
  // Glow when active
  if (active) {
    ctx.save(); ctx.globalAlpha = 0.3
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(cx, cy, TILE, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  // Body circle
  ctx.fillStyle = active ? color + 'cc' : '#3a3a3a'
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = active ? color : color + '66'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke()
  // Inner dot
  ctx.fillStyle = active ? '#fff' : color + '88'
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
  // Label
  ctx.save(); ctx.font = 'bold 5px sans-serif'; ctx.fillStyle = active ? color : '#666'
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText(canvasLabel, cx, py + TILE - 1)
  ctx.restore()
}

function drawConnectionLines(ctx: Ctx, devItems: DevItem[], rules: DevRule[], firedUids: Set<string>) {
  for (const rule of rules) {
    const fired = firedUids.has(rule.uid)
    const inputDevs = rule.inputUids.map(uid => devItems.find(d => d.uid === uid)).filter(Boolean) as DevItem[]
    const allInputsActive = inputDevs.length > 0 && inputDevs.every(d => d.active)

    for (const inputUid of rule.inputUids) {
      for (const outputUid of rule.outputUids) {
        const inp = devItems.find(d => d.uid === inputUid)
        const out = devItems.find(d => d.uid === outputUid)
        if (!inp || !out) continue

        const active = allInputsActive
        const x1 = (inp.x + 0.5) * TILE, y1 = (inp.y + 0.5) * TILE
        const x2 = (out.x + 0.5) * TILE, y2 = (out.y + 0.5) * TILE

        ctx.save()
        ctx.globalAlpha = fired ? 1 : active ? 0.75 : 0.35
        ctx.strokeStyle = fired ? '#ffcc44' : active ? '#88ddff' : '#6688aa'
        ctx.lineWidth = fired ? 2.5 : 1.5
        if (!active && !fired) ctx.setLineDash([4, 4])

        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
        ctx.setLineDash([])

        const ang = Math.atan2(y2 - y1, x2 - x1)
        const aLen = fired ? 10 : 7
        ctx.fillStyle = fired ? '#ffcc44' : active ? '#88ddff' : '#6688aa'
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - aLen * Math.cos(ang - 0.4), y2 - aLen * Math.sin(ang - 0.4))
        ctx.lineTo(x2 - aLen * Math.cos(ang + 0.4), y2 - aLen * Math.sin(ang + 0.4))
        ctx.closePath(); ctx.fill()

        if (fired) {
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
          ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#ffcc44'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('▶', mx, my)
        }
        ctx.restore()
      }
    }
  }
}

function drawEMLOpenOverlay(ctx: Ctx, px: number, py: number, item: MItem, rot: 0|1|2|3) {
  const { w: ew, h: eh } = effDims(item, rot)
  // Same center-transform as drawItemRot → arc follows door rotation automatically
  ctx.save()
  ctx.translate(px + (ew * TILE) / 2, py + (eh * TILE) / 2)
  ctx.rotate((rot * Math.PI) / 2)
  const iw = item.w * TILE, ih = item.h * TILE
  const ox = -iw / 2, oy = -ih / 2

  // Green tint over opening area
  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#40ee80'
  ctx.fillRect(ox, oy, iw, ih)

  ctx.globalAlpha = 0.85
  ctx.strokeStyle = '#40ee80'
  ctx.setLineDash([3, 2])

  if (item.id === 'doorS') {
    // Swing arc from hinge (bottom-left in original space)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(ox + 1, oy + ih - 1, iw - 2, -Math.PI / 2, 0)
    ctx.stroke()
    // Open door panel perpendicular (along left edge = door swung open)
    ctx.setLineDash([])
    ctx.strokeStyle = '#60ff99'; ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(ox + 1, oy + ih - 1)
    ctx.lineTo(ox + 1, oy + 2)
    ctx.stroke()
  } else if (item.id === 'doorD') {
    ctx.lineWidth = 1.2
    // Left arc
    ctx.beginPath()
    ctx.arc(ox + 1, oy + ih - 1, iw / 2 - 1, -Math.PI / 2, 0)
    ctx.stroke()
    // Right arc
    ctx.beginPath()
    ctx.arc(ox + iw - 1, oy + ih - 1, iw / 2 - 1, Math.PI, -Math.PI / 2)
    ctx.stroke()
    // Open panels along sides
    ctx.setLineDash([])
    ctx.strokeStyle = '#60ff99'; ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(ox + 1, oy + ih - 1); ctx.lineTo(ox + 1, oy + iw / 2 + 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ox + iw - 1, oy + ih - 1); ctx.lineTo(ox + iw - 1, oy + iw / 2 + 2)
    ctx.stroke()
  } else if (item.id === 'doorSl') {
    // Slide open: both panels stacked to one side
    ctx.setLineDash([])
    ctx.strokeStyle = '#60ff99'; ctx.lineWidth = 2
    ctx.strokeRect(ox + 2, oy + 2, iw / 2 - 3, ih - 4)
    ctx.strokeRect(ox + iw / 2 + 1, oy + 3, iw / 2 - 3, ih - 6)
    // Arrow →
    ctx.lineWidth = 1; ctx.setLineDash([2, 2])
    ctx.strokeStyle = '#40ee80'
    ctx.beginPath()
    ctx.moveTo(ox + iw / 2, oy + ih / 2)
    ctx.lineTo(ox + iw - 3, oy + ih / 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(ox + iw - 7, oy + ih / 2 - 3)
    ctx.lineTo(ox + iw - 3, oy + ih / 2)
    ctx.lineTo(ox + iw - 7, oy + ih / 2 + 3)
    ctx.stroke()
  }

  ctx.setLineDash([])
  ctx.restore()
}

// ── Item catalog ────────────────────────────────────────────────
// 가구 추가 방법:
// 1. 아래 ITEMS 배열에 항목 추가:
//    { id: 'myItem', name: '이름', cat: 'home', w: 1, h: 1 }
//    · cat: 'home' | 'office' | 'school' | 'bathroom' | 'medical'
//    · w/h: 최대 2×2 권장 (TILE=24px 기준)
// 2. DRAW_FNS 객체에 동일 id로 드로우 함수 추가:
//    myItem: (ctx, px, py) => { r3(ctx,x,y,w,h,base,hi,sh); ol(ctx,x,y,w,h) }
//    · r3(ctx, x,y,w,h, 기본색, 하이라이트, 그림자)  · r(ctx, x,y,w,h, 색상) — 단순 채우기
//    · ol(ctx, x,y,w,h) — 외곽선  · T = 24px, 좌상단 기준 px/py
//    · 따뜻한 목재: C.WP1~WP4  · 패브릭: C.UPG/UPGD/UPGL
// 3. ITEM_ICONS 객체에 이모지 추가: myItem: '🪑'
// ── Crime Scene Mark catalog ─────────────────────────────────
type MarkId = 'runPerson' | 'arrowMark' | 'circleMark' | 'exMark' | 'numMark' | 'polygon'
const MARKS: { id: MarkId; name: string; icon: ReactNode }[] = [
  { id: 'runPerson',  name: '사람',       icon: <PersonWalkIcon  width={16} height={16} /> },
  { id: 'arrowMark',  name: '화살표',     icon: <ArrowUpMarkIcon width={16} height={16} /> },
  { id: 'circleMark', name: '원형 마크',  icon: <CircleMarkIcon  width={16} height={16} /> },
  { id: 'exMark',     name: 'X 마크',     icon: <XMarkIcon       width={16} height={16} /> },
  { id: 'numMark',    name: '번호판',     icon: <HashIcon        width={16} height={16} /> },
  { id: 'polygon',    name: '도형',       icon: <HexagonIcon     width={16} height={16} /> },
]

const MARK_HANDLE = 8  // px — resize handle size

function drawMark(ctx: Ctx, id: string, x: number, y: number, w: number, h: number, sides?: number, color?: string, label?: string, fontSize?: number) {
  ctx.save()
  ctx.globalAlpha = 0.82
  ctx.fillStyle = '#111111'
  ctx.translate(x, y)
  ctx.scale(w / 48, h / 48)
  switch (id) {
    case 'runPerson': {
      // 서 있는 사람 실루엣 (화장실 표지판 스타일, 48×48 기준)
      const rr = (rx: number, ry: number, rw: number, rh: number, rad: number) => {
        ctx.beginPath()
        ctx.moveTo(rx + rad, ry)
        ctx.lineTo(rx + rw - rad, ry)
        ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rad)
        ctx.lineTo(rx + rw, ry + rh - rad)
        ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rad, ry + rh)
        ctx.lineTo(rx + rad, ry + rh)
        ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rad)
        ctx.lineTo(rx, ry + rad)
        ctx.quadraticCurveTo(rx, ry, rx + rad, ry)
        ctx.closePath()
        ctx.fill()
      }
      // 머리
      ctx.beginPath(); ctx.arc(24, 6, 6, 0, Math.PI * 2); ctx.fill()
      // 몸통
      rr(17, 14, 14, 17, 4)
      // 왼쪽 팔
      rr(10, 14, 6, 17, 3)
      // 오른쪽 팔
      rr(32, 14, 6, 17, 3)
      // 왼쪽 다리
      rr(15, 30, 8, 17, 3)
      // 오른쪽 다리
      rr(25, 30, 8, 17, 3)
      break
    }
    case 'deadBody': {
      // 쓰러진 사람 — 크라임씬 chalk outline (48×48)
      // 포즈: 머리 좌측, 몸통 수평, 양팔 좌상단으로 뻗음(V자), 양 다리 우측 굽힘
      ctx.strokeStyle = ctx.fillStyle
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      // 머리
      ctx.beginPath(); ctx.arc(7, 25, 4.5, 0, Math.PI * 2); ctx.stroke()
      // 위팔 (좌상단 높이)
      ctx.beginPath(); ctx.moveTo(11, 22); ctx.lineTo(2, 6); ctx.stroke()
      // 아래팔 (좌상단 완만)
      ctx.beginPath(); ctx.moveTo(11, 24); ctx.lineTo(3, 15); ctx.stroke()
      // 몸통 (수평)
      ctx.beginPath(); ctx.moveTo(12, 25); ctx.lineTo(32, 26); ctx.stroke()
      // 위 다리 (오른쪽 상단 방향, 무릎 굽힘)
      ctx.beginPath()
      ctx.moveTo(30, 23); ctx.lineTo(40, 15); ctx.lineTo(46, 21); ctx.stroke()
      // 아래 다리 (오른쪽 하단 방향, 무릎 굽힘)
      ctx.beginPath()
      ctx.moveTo(32, 28); ctx.lineTo(41, 36); ctx.lineTo(46, 40); ctx.stroke()
      break
    }
    case 'arrowMark': {
      // 두꺼운 화살표 (위 방향)
      ctx.beginPath()
      ctx.moveTo(24, 2); ctx.lineTo(44, 24); ctx.lineTo(34, 24)
      ctx.lineTo(34, 46); ctx.lineTo(14, 46); ctx.lineTo(14, 24)
      ctx.lineTo(4, 24); ctx.closePath(); ctx.fill()
      break
    }
    case 'circleMark': {
      // 두꺼운 원 (도넛)
      ctx.beginPath(); ctx.arc(24, 24, 22, 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath(); ctx.arc(24, 24, 14, 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      break
    }
    case 'exMark': {
      // X 마크 (두꺼운 교차)
      ctx.save(); ctx.translate(24, 24); ctx.rotate(Math.PI / 4)
      ctx.fillRect(-6, -22, 12, 44)
      ctx.fillRect(-22, -6, 44, 12)
      ctx.restore()
      break
    }
    case 'numMark': {
      // 번호판 — color/label/fontSize 지원
      const bgClr = color ?? '#e8e020'
      // 텍스트 대비색 자동 선택 (luminance 기반)
      const hex = bgClr.replace('#','')
      const pr = parseInt(hex.substring(0,2),16)
      const pg = parseInt(hex.substring(2,4),16)
      const pb = parseInt(hex.substring(4,6),16)
      const lum = (0.299*pr + 0.587*pg + 0.114*pb) / 255
      const textClr = lum > 0.55 ? '#111111' : '#ffffff'
      // 라운드 직사각형 배경
      ctx.fillStyle = bgClr
      ctx.beginPath()
      ctx.roundRect(3, 8, 42, 32, 5)
      ctx.fill()
      ctx.strokeStyle = lum > 0.55 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      // 텍스트
      const txt = label !== undefined ? label : '1'
      const fs = fontSize ?? 22
      ctx.fillStyle = textClr
      ctx.font = `bold ${fs}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt, 24, 25, 38)
      break
    }
    case 'polygon': {
      // 다각형 — sides: 3~10, color: 커스텀
      const n = sides ?? 6
      const clr = color ?? '#3b82f6'
      const cx = 24, cy = 24, rOuter = 21
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI / n) - Math.PI / 2
        const vx = cx + rOuter * Math.cos(angle)
        const vy = cy + rOuter * Math.sin(angle)
        if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy)
      }
      ctx.closePath()
      ctx.fillStyle = clr
      ctx.globalAlpha = 0.55
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = clr
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.stroke()
      // 텍스트 (label 지정 시 사용, 없으면 꼭짓점 수 기본, 빈 문자열이면 미표시)
      const displayText = label !== undefined ? label : String(n)
      if (displayText.length > 0) {
        const fs = fontSize ?? (displayText.length > 3 ? 9 : 13)
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${fs}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(displayText, cx, cy, 38)
      }
      break
    }
  }
  ctx.restore()
}

function drawMarkHandles(ctx: Ctx, mark: PMark, sel: boolean) {
  if (!sel) return
  const { x, y, w, h } = mark
  // 선택 테두리
  ctx.save()
  ctx.strokeStyle = '#00d8ff'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.setLineDash([])
  // 4 모서리 핸들
  const corners = [[x, y], [x + w - MARK_HANDLE, y], [x, y + h - MARK_HANDLE], [x + w - MARK_HANDLE, y + h - MARK_HANDLE]]
  for (const [hx, hy] of corners) {
    ctx.fillStyle = '#00d8ff'
    ctx.fillRect(hx, hy, MARK_HANDLE, MARK_HANDLE)
    ctx.strokeStyle = '#005580'
    ctx.lineWidth = 1
    ctx.strokeRect(hx + 0.5, hy + 0.5, MARK_HANDLE - 1, MARK_HANDLE - 1)
  }
  ctx.restore()
}

function getMarkHandleAt(mark: PMark, px: number, py: number): 'tl'|'tr'|'bl'|'br'|null {
  const { x, y, w, h } = mark
  const H = MARK_HANDLE
  if (px >= x && px < x + H && py >= y && py < y + H) return 'tl'
  if (px >= x + w - H && px < x + w && py >= y && py < y + H) return 'tr'
  if (px >= x && px < x + H && py >= y + h - H && py < y + h) return 'bl'
  if (px >= x + w - H && px < x + w && py >= y + h - H && py < y + h) return 'br'
  return null
}

const ITEMS: MItem[] = [
  // SCHOOL
  { id: 'wardrobeD',    name: '양문 옷장',   cat: 'storage', w: 2, h: 2 },
  { id: 'steelCab',     name: '철제 캐비닛', cat: 'storage', w: 1, h: 2 },
  { id: 'bookshelf',    name: '책장',        cat: 'storage', w: 2, h: 2 },
  { id: 'fridge',       name: '냉장고',      cat: 'kitchen', w: 1, h: 2 },
  { id: 'washer',       name: '드럼 세탁기', cat: 'appliances', w: 1, h: 1 },
  { id: 'wallClock',    name: '시계',        cat: 'decor',   w: 1, h: 1 },
  { id: 'hangDress',    name: '옷 (교복)',   cat: 'decor',   w: 1, h: 1 },
  { id: 'itemShoes',    name: '신발',        cat: 'decor',   w: 1, h: 1 },
  { id: 'itemBag',      name: '가방',        cat: 'decor',   w: 1, h: 1 },
  { id: 'itemBackpack', name: '책가방',      cat: 'decor',   w: 1, h: 1 },
  { id: 'itemGlasses',  name: '안경',        cat: 'decor',   w: 1, h: 1 },
  { id: 'itemBook',     name: '책',          cat: 'decor',   w: 1, h: 1 },
  { id: 'itemNote',     name: '노트',        cat: 'decor',   w: 1, h: 1 },
  { id: 'itemPencil',   name: '연필',        cat: 'decor',   w: 1, h: 1 },
  { id: 'easel',        name: '나무 이젤',   cat: 'decor',   w: 1, h: 2 },
  { id: 'vanitySink',   name: '하부서랍세면대', cat: 'bathroom', w: 2, h: 2 },

  { id: 'sDesk',        name: '책상+의자',   cat: 'tables', w: 1, h: 2 },
  { id: 'sDeskOnly',    name: '책상',        cat: 'tables', w: 1, h: 1 },
  { id: 'computerDesk', name: '컴퓨터 책상', cat: 'tables', w: 3, h: 2 },
  { id: 'readingDesk',  name: '독서 책상',   cat: 'tables', w: 3, h: 2 },
  { id: 'sChair',      name: '의자',      cat: 'chairs', w: 1, h: 1 },
  { id: 'chairFront',  name: '의자 (정면)', cat: 'chairs', w: 1, h: 1 },
  { id: 'chairLeft',   name: '의자 (왼측)', cat: 'chairs', w: 1, h: 1 },
  { id: 'chairBack',   name: '의자 (뒷면)', cat: 'chairs', w: 1, h: 1 },
  // LOCK
  { id: 'lockKey',   name: '열쇠 자물쇠',   cat: 'lock', w: 1, h: 1 },
  { id: 'lockDir',   name: '방향 자물쇠',   cat: 'lock', w: 1, h: 1 },
  { id: 'lockNum',   name: '숫자 자물쇠',   cat: 'lock', w: 1, h: 1 },
  { id: 'lockAlpha', name: '알파벳 자물쇠', cat: 'lock', w: 1, h: 1 },
  { id: 'lockPad',   name: '키패드',        cat: 'lock', w: 1, h: 1 },
  { id: 'keyItem',   name: '열쇠',          cat: 'lock', w: 1, h: 1 },
  { id: 'magnifier', name: '돋보기',   cat: 'lock',       w: 1, h: 1 },
  { id: 'telephone', name: '전화기',     cat: 'appliances', w: 1, h: 1 },
  { id: 'mobilePhone', name: '핸드폰', cat: 'appliances', w: 1, h: 1 },
  { id: 'videoCam',  name: '비디오 카메라', cat: 'appliances', w: 1, h: 1 },
  { id: 'projector', name: '프로젝트 빔',   cat: 'appliances', w: 1, h: 1 },
  { id: 'headset',   name: '헤드셋',        cat: 'appliances', w: 1, h: 1 },
  { id: 'monitor',   name: '모니터',        cat: 'appliances', w: 1, h: 1 },
  // BATHROOM
  { id: 'toilet',    name: '변기',        cat: 'bathroom', w: 1, h: 2 },
  { id: 'sink',      name: '세면대',      cat: 'bathroom', w: 1, h: 1 },
  { id: 'mirrorS',   name: '거울 (소)',   cat: 'bathroom', w: 1, h: 1 },
  { id: 'mirrorL',   name: '거울 (대)',   cat: 'bathroom', w: 1, h: 2 },
  // DOOR
  { id: 'doorS',    name: '외문',   cat: 'door',     w: 1, h: 1 },
  { id: 'doorD',    name: '양문',   cat: 'door',     w: 2, h: 1 },
  { id: 'doorSl',   name: '슬라이드문', cat: 'door', w: 2, h: 1 },
]

// ── Item draw functions ────────────────────────────────────────
type DrawFn = (ctx: Ctx, px: number, py: number) => void
const T = TILE

const DRAW_FNS: Record<string, DrawFn> = {

  // ── HOME ─────────────────────────────────────

  bed: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    // 헤드보드 (원목)
    r3(ctx, px + 1, py + 1, W - 2, 10, C.WP3, C.WP2, C.WP4)
    r(ctx, px + 4, py + 3, 8, 5, C.WP2)
    r(ctx, px + W - 12, py + 3, 8, 5, C.WP2)
    // 베개 2개
    r3(ctx, px + 2, py + 13, 19, 10, C.BED, '#f8f4ee', C.BEDD)
    r3(ctx, px + 26, py + 13, 19, 10, C.BED, '#f8f4ee', C.BEDD)
    // 이불
    r3(ctx, px + 1, py + 25, W - 2, H - 32, C.WP1, C.BED, C.BEDD)
    ctx.fillStyle = C.BEDD
    for (let i = 4; i < H - 32; i += 5) ctx.fillRect(px + 1, py + 25 + i, W - 2, 1)
    // 풋보드 (원목)
    r3(ctx, px + 1, py + H - 6, W - 2, 5, C.WP3, C.WP2, C.WP4)
    ol(ctx, px, py, W, H, C.WP4)
  },

  sofa: (ctx, px, py) => {
    const W = 2 * T, H = 1 * T
    // 팔걸이 (녹색 패브릭)
    r3(ctx, px, py, 6, H, C.UPGD, C.UPG, C.WP4)
    r3(ctx, px + W - 6, py, 6, H, C.UPGD, C.UPG, C.WP4)
    // 등받이
    r3(ctx, px + 6, py, W - 12, 7, C.UPGD, C.UPG, C.WP4)
    // 좌석 쿠션 2개
    const cw = Math.floor((W - 14) / 2)
    r3(ctx, px + 7, py + 7, cw, H - 8, C.UPG, C.UPGL, C.UPGD)
    r3(ctx, px + 8 + cw, py + 7, cw, H - 8, C.UPG, C.UPGL, C.UPGD)
    ol(ctx, px, py, W, H, C.WP4)
  },

  bookshelf: (ctx, px, py) => {
    // 2×2 (48×48px) — 책장 (픽셀아트 책 빼곡히)
    const W = 2 * T, H = 2 * T
    const SH = '#4a3020', SHH = '#6a4830', SHD = '#2e1c10'
    // 선반 본체
    r3(ctx, px, py, W, H, SH, SHH, SHD)
    // 상단 몰딩
    r(ctx, px, py, W, 4, SHD); r(ctx, px, py, W, 1, SHH)
    // 하단 받침
    r(ctx, px, py + H - 4, W, 4, SHD); r(ctx, px, py + H - 1, W, 1, SHH)
    // 중간 선반판
    r(ctx, px, py + H / 2 - 2, W, 3, SHD); r(ctx, px, py + H / 2 - 2, W, 1, SHH)
    // 상단 칸 책들
    const booksT = [
      { x: 2, w: 5, c: '#c04040' }, { x: 7, w: 4, c: '#4060c0' }, { x: 11, w: 6, c: '#40a040' },
      { x: 17, w: 3, c: '#c0a020' }, { x: 20, w: 5, c: '#8040c0' }, { x: 25, w: 4, c: '#c06020' },
      { x: 29, w: 5, c: '#2080a0' }, { x: 34, w: 4, c: '#c04060' }, { x: 38, w: 5, c: '#506030' },
      { x: 43, w: 3, c: '#a03030' },
    ]
    for (const b of booksT) {
      r(ctx, px + b.x, py + 5, b.w, H / 2 - 9, b.c)
      r(ctx, px + b.x, py + 5, b.w, 2, 'rgba(255,255,255,0.25)')
      r(ctx, px + b.x, py + 5, 1, H / 2 - 9, 'rgba(0,0,0,0.2)')
    }
    // 하단 칸 책들
    const booksB = [
      { x: 2, w: 4, c: '#5050c0' }, { x: 6, w: 6, c: '#a04020' }, { x: 12, w: 3, c: '#208050' },
      { x: 15, w: 5, c: '#c03060' }, { x: 20, w: 4, c: '#706020' }, { x: 24, w: 6, c: '#205090' },
      { x: 30, w: 3, c: '#904040' }, { x: 33, w: 5, c: '#308060' }, { x: 38, w: 4, c: '#c07020' },
      { x: 42, w: 4, c: '#503080' },
    ]
    const by = py + H / 2 + 1
    for (const b of booksB) {
      r(ctx, px + b.x, by, b.w, H / 2 - 7, b.c)
      r(ctx, px + b.x, by, b.w, 2, 'rgba(255,255,255,0.25)')
      r(ctx, px + b.x, by, 1, H / 2 - 7, 'rgba(0,0,0,0.2)')
    }
    ol(ctx, px, py, W, H, SHD)
  },

  washer: (ctx, px, py) => {
    // 1×1 (24×24px) — 드럼 세탁기 (정면뷰)
    const W = T, H = T
    const BOD = '#e0e4e8', BOD_HI = '#f0f4f8', BOD_SH = '#a8b0b8', BOD_DK = '#606870'
    const PNL = '#4870a8', PNL_HI = '#6898d0', PNL_DK = '#2a4878'
    // 본체
    r3(ctx, px, py, W, H, BOD, BOD_HI, BOD_SH)
    // 상단 컨트롤 패널
    r3(ctx, px + 1, py + 1, W - 2, 5, PNL, PNL_HI, PNL_DK)
    r(ctx, px + 3, py + 2, 3, 3, '#c0d8f0')   // 다이얼
    r(ctx, px + W - 6, py + 2, 3, 3, '#f05050') // 전원 버튼
    r(ctx, px + W - 10, py + 2, 3, 3, '#60b060')
    // 드럼 도어 (원형 유리창)
    ctx.fillStyle = BOD_DK
    ctx.beginPath(); ctx.arc(px + W / 2, py + 14, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1828a0'
    ctx.beginPath(); ctx.arc(px + W / 2, py + 14, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2840c8'
    ctx.beginPath(); ctx.arc(px + W / 2, py + 14, 5, 0, Math.PI * 2); ctx.fill()
    // 드럼 창 반사
    ctx.fillStyle = 'rgba(200,220,255,0.5)'
    ctx.beginPath(); ctx.arc(px + W / 2 - 2, py + 12, 3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath(); ctx.arc(px + W / 2 - 2, py + 11, 1.5, 0, Math.PI * 2); ctx.fill()
    // 도어 힌지
    r(ctx, px + 3, py + 7, 2, 2, BOD_DK)
    ol(ctx, px, py, W, H, BOD_DK)
  },

  wallClock: (ctx, px, py) => {
    // 1×1 (24×24px) — 벽시계
    const W = T, H = T, cx = px + W / 2, cy = py + H / 2
    // 시계 외곽 프레임
    ctx.fillStyle = C.WP3
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = C.WP2
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill()
    // 시계 면
    ctx.fillStyle = '#f8f4ec'
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill()
    // 눈금 (12, 3, 6, 9시)
    ctx.fillStyle = C.WP4
    r(ctx, cx - 1, py + 2, 2, 2, C.WP4) // 12시
    r(ctx, px + W - 4, cy - 1, 2, 2, C.WP4) // 3시
    r(ctx, cx - 1, py + H - 4, 2, 2, C.WP4) // 6시
    r(ctx, px + 2, cy - 1, 2, 2, C.WP4) // 9시
    // 시침 (10시 방향)
    ctx.strokeStyle = C.WP4; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 3, cy - 4); ctx.stroke()
    // 분침 (2시 방향)
    ctx.strokeStyle = '#404040'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 4, cy - 5); ctx.stroke()
    ctx.lineWidth = 1
    // 중심 점
    ctx.fillStyle = C.WP4
    ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill()
  },

  hangDress: (ctx, px, py) => {
    // 1×1 (24×24px) — 여자 교복 (옷걸이)
    const W = T
    const BLZ = '#1a2850', BLZ_HI = '#2a3870', BLZ_SH = '#0e1830'  // 네이비 블레이저
    const WHT = '#f0f0f0'  // 흰 블라우스
    const SKT = '#1a2850', SKT_HI = '#243060', SKT_SH = '#0e1830'  // 네이비 스커트

    // ── 옷걸이 ──
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(px + 12, py + 3, 2, Math.PI, 0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px + 12, py + 1); ctx.lineTo(px + 12, py + 0); ctx.stroke()
    ctx.strokeStyle = '#707070'
    ctx.beginPath(); ctx.moveTo(px + 3, py + 7); ctx.lineTo(px + 12, py + 5); ctx.lineTo(px + 21, py + 7); ctx.stroke()
    ctx.lineWidth = 1

    // ── 블레이저 (상의) ──
    r3(ctx, px + 4, py + 7, W - 8, 8, BLZ, BLZ_HI, BLZ_SH)
    // 블라우스 칼라 (V넥 흰색)
    r(ctx, px + 9,  py + 7, 2, 5, WHT)   // 왼쪽 칼라
    r(ctx, px + 13, py + 7, 2, 5, WHT)   // 오른쪽 칼라
    r(ctx, px + 11, py + 8, 2, 3, WHT)   // 가운데
    // 빨간 리본 넥타이
    r(ctx, px + 10, py + 9, 4, 2, '#cc2020')
    r(ctx, px + 11, py + 11, 2, 2, '#cc2020')
    r(ctx, px + 10, py + 10, 1, 1, '#ee4040')
    // 블레이저 가슴 포켓
    r(ctx, px + 5, py + 9, 3, 2, BLZ_HI)
    r(ctx, px + 5, py + 9, 3, 1, '#3a5090')

    // ── 스커트 (하단) ──
    r3(ctx, px + 3, py + 15, W - 6, 8, SKT, SKT_HI, SKT_SH)
    // 주름 선 (세로 라인)
    for (let i = 0; i < 4; i++) {
      r(ctx, px + 5 + i * 4, py + 15, 1, 8, 'rgba(255,255,255,0.15)')
      r(ctx, px + 6 + i * 4, py + 15, 1, 8, 'rgba(0,0,0,0.18)')
    }
    // 스커트 하단 라인
    r(ctx, px + 3, py + 22, W - 6, 1, '#3a5090')
  },

  itemShoes: (ctx, px, py) => {
    // 1×1 (24×24px) — 위에서 본 빨간 운동화 두 짝 (탑뷰)
    const RED   = '#d93232'   // 빨간 어퍼
    const RED_D = '#aa2020'   // 빨간 측면/그림자
    const ANKLE = '#5a2e10'   // 발목 내부 갈색
    const ANKLE_H = '#7a4022' // 갈색 내부 하이라이트
    const LACE  = '#f2f2f2'   // 흰 레이스 줄
    const MID   = '#e4e4ea'   // 미드솔 흰회색
    const SOL   = '#8090a4'   // 아웃솔 청회색
    const SOL_D = '#5a6678'   // 아웃솔 그림자
    const OL    = '#1a1a22'   // 외곽선

    const shoe = (sx: number) => {
      const sy = py + 1
      // 아웃솔 그림자 (맨 아래)
      r(ctx, sx + 1, sy + 19, 7, 2, SOL_D)
      // 아웃솔 청회색 (발끝 솔)
      r(ctx, sx,     sy + 16, 9, 4, SOL)
      // 미드솔 흰색
      r(ctx, sx,     sy + 13, 9, 3, MID)
      r(ctx, sx,     sy + 13, 9, 1, SOL)   // 미드솔 상단 경계
      // 빨간 사이드 패널 (레이스 구역 양쪽)
      r(ctx, sx,     sy + 5,  2, 8, RED_D)
      r(ctx, sx + 7, sy + 5,  2, 8, RED_D)
      // 레이스 구역 배경 (빨간)
      r(ctx, sx + 2, sy + 5,  5, 8, RED)
      // 흰 레이스 3줄
      r(ctx, sx + 1, sy + 6,  7, 2, LACE)
      r(ctx, sx + 1, sy + 9,  7, 2, LACE)
      r(ctx, sx + 1, sy + 12, 7, 2, LACE)  // 마지막 레이스 (미드솔 경계)
      // 발목 위 빨간 어퍼
      r(ctx, sx,     sy + 3,  9, 2, RED)
      // 발목 개구부 (갈색 내부)
      r(ctx, sx + 1, sy,      7, 4, ANKLE)
      r(ctx, sx + 2, sy,      5, 2, ANKLE_H)  // 내부 하이라이트
      // 외곽선
      ol(ctx, sx, sy, 9, 20, OL)
    }

    shoe(px + 1)
    shoe(px + 14)
  },

  itemBag: (ctx, px, py) => {
    // 1×1 (24×24px) — 가방 (숄더백)
    const BG = '#8B4513', BG_HI = '#a85a28', BG_SH = '#5a2c0a', BG_DK = '#3a1a05'
    const HW = '#c8a830'   // 골드 하드웨어
    // 가방 본체
    r3(ctx, px + 2, py + 8, 20, 14, BG, BG_HI, BG_SH)
    // 플랩 (덮개)
    r3(ctx, px + 2, py + 5, 20, 9, BG_HI, '#c07030', BG)
    // 플랩 하단 라운드
    r(ctx, px + 3, py + 13, 18, 1, BG_HI)
    // 잠금장치 (골드)
    r(ctx, px + 9, py + 12, 6, 4, HW)
    r(ctx, px + 10, py + 13, 4, 2, '#e8c040')
    r(ctx, px + 11, py + 11, 2, 2, HW)           // 걸쇠
    // 스트랩
    ctx.strokeStyle = BG_SH; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px + 5, py + 5); ctx.quadraticCurveTo(px + 12, py + 1, px + 19, py + 5); ctx.stroke()
    ctx.lineWidth = 1
    // 스티치
    r(ctx, px + 3, py + 9, 18, 1, 'rgba(0,0,0,0.2)')
    ol(ctx, px + 2, py + 5, 20, 17, BG_DK)
  },

  itemBackpack: (ctx, px, py) => {
    // 1×1 (24×24px) — 책가방 (백팩)
    const BG = '#1a3a6a', BG_HI = '#2a5090', BG_SH = '#0e2040', BG_DK = '#081028'
    const ZIP = '#c0c0c0', ACC = '#f0c030'
    // 가방 본체
    r3(ctx, px + 3, py + 3, 18, 19, BG, BG_HI, BG_SH)
    // 앞 포켓
    r3(ctx, px + 5, py + 12, 14, 9, BG_SH, BG, BG_DK)
    // 포켓 지퍼
    r(ctx, px + 5, py + 12, 14, 1, ZIP)
    r(ctx, px + 11, py + 11, 2, 2, ZIP)          // 지퍼 손잡이
    // 메인 지퍼
    r(ctx, px + 3, py + 3, 18, 1, ZIP)
    r(ctx, px + 18, py + 2, 2, 2, ZIP)           // 지퍼 손잡이
    // 상단 핸들
    ctx.strokeStyle = BG_HI; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px + 9, py + 3); ctx.lineTo(px + 9, py + 1); ctx.lineTo(px + 15, py + 1); ctx.lineTo(px + 15, py + 3); ctx.stroke()
    ctx.lineWidth = 1
    // 키링 / 배지 (노란 원)
    ctx.fillStyle = ACC
    ctx.beginPath(); ctx.arc(px + 7, py + 16, 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(px + 7, py + 16, 1, 0, Math.PI * 2); ctx.fill()
    ol(ctx, px + 3, py + 3, 18, 19, BG_DK)
  },

  itemGlasses: (ctx, px, py) => {
    // 1×1 (24×24px) — 안경
    const FR = '#1a1a1a', LENS = '#a8c8e0', LENS_HI = '#c8e4f4'
    // 안경 렌즈 (좌)
    ctx.fillStyle = LENS
    ctx.beginPath(); ctx.roundRect(px + 2, py + 9, 8, 7, 2); ctx.fill()
    ctx.fillStyle = LENS_HI
    ctx.beginPath(); ctx.roundRect(px + 3, py + 10, 3, 2, 1); ctx.fill()
    // 안경 렌즈 (우)
    ctx.fillStyle = LENS
    ctx.beginPath(); ctx.roundRect(px + 14, py + 9, 8, 7, 2); ctx.fill()
    ctx.fillStyle = LENS_HI
    ctx.beginPath(); ctx.roundRect(px + 15, py + 10, 3, 2, 1); ctx.fill()
    // 프레임 테두리
    ctx.strokeStyle = FR; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(px + 2, py + 9, 8, 7, 2); ctx.stroke()
    ctx.beginPath(); ctx.roundRect(px + 14, py + 9, 8, 7, 2); ctx.stroke()
    ctx.lineWidth = 1
    // 코다리 (브릿지)
    r(ctx, px + 10, py + 11, 4, 2, FR)
    // 안경다리 (좌우 템플)
    r(ctx, px + 1, py + 11, 2, 1, FR)
    r(ctx, px + 21, py + 11, 2, 1, FR)
  },

  itemBook: (ctx, px, py) => {
    // 1×1 (24×24px) — 책 (닫힌 상태, 탑뷰 사선)
    const COV = '#c03030', COV_HI = '#e04040', COV_SH = '#801818'
    const PAG = '#f4f0e8', PAG_SH = '#d0c8b8', SPINE = '#801818'
    // 책등 (세로 왼쪽)
    r3(ctx, px + 2, py + 3, 5, 18, SPINE, '#a02020', '#600808')
    // 표지
    r3(ctx, px + 7, py + 2, 15, 20, COV, COV_HI, COV_SH)
    // 페이지 (오른쪽 끝)
    r(ctx, px + 21, py + 3, 1, 18, PAG)
    r(ctx, px + 20, py + 3, 1, 18, PAG_SH)
    // 표지 제목 줄 (흰 선)
    r(ctx, px + 9, py + 7, 11, 1, 'rgba(255,255,255,0.5)')
    r(ctx, px + 9, py + 9, 8, 1, 'rgba(255,255,255,0.35)')
    r(ctx, px + 9, py + 14, 9, 1, 'rgba(255,255,255,0.3)')
    r(ctx, px + 9, py + 16, 6, 1, 'rgba(255,255,255,0.3)')
    ol(ctx, px + 2, py + 2, 20, 20, '#400808')
  },

  itemNote: (ctx, px, py) => {
    // 1×1 (24×24px) — 노트 (나선형 링노트)
    const COV = '#f0f0f0', LIN = '#a8c8e8', MAR = '#e87878', SPR = '#909090'
    // 노트 본체
    r3(ctx, px + 4, py + 2, 18, 20, COV, '#ffffff', '#d0d0c8')
    // 여백 세로선 (빨간 마진)
    r(ctx, px + 8, py + 2, 1, 20, MAR)
    // 줄 (파란 라인)
    for (let i = 0; i < 5; i++) r(ctx, px + 9, py + 5 + i * 3, 11, 1, LIN)
    // 스프링 (왼쪽)
    for (let i = 0; i < 5; i++) {
      r(ctx, px + 4, py + 3 + i * 4, 3, 2, SPR)
      r(ctx, px + 3, py + 4 + i * 4, 2, 2, '#c0c0c0')
    }
    ol(ctx, px + 4, py + 2, 18, 20, '#a0a098')
  },

  itemPencil: (ctx, px, py) => {
    // 1×1 (24×24px) — 연필 (사선 배치)
    const YEL = '#f0c830', YEL_HI = '#f8e060', YEL_SH = '#c09010'
    const WOOD = '#d4a870', TIP = '#282828', ERASER = '#e88090', BAND = '#c0a030'
    // 연필 몸통 (사선, 좌상→우하)
    for (let i = 0; i < 16; i++) {
      r(ctx, px + 2 + i, py + 2 + i, 3, 3, YEL)
    }
    // 상단 하이라이트 라인
    for (let i = 0; i < 14; i++) r(ctx, px + 2 + i, py + 2 + i, 1, 1, YEL_HI)
    // 하단 그림자 라인
    for (let i = 0; i < 14; i++) r(ctx, px + 4 + i, py + 4 + i, 1, 1, YEL_SH)
    // 나무 부분 (뾰족한 끝, 우하)
    r(ctx, px + 17, py + 17, 2, 2, WOOD)
    r(ctx, px + 18, py + 18, 2, 2, WOOD)
    r(ctx, px + 19, py + 19, 2, 2, '#c09060')
    // 심 (tip)
    r(ctx, px + 20, py + 20, 2, 2, TIP)
    r(ctx, px + 21, py + 21, 1, 1, '#505050')
    // 지우개 (좌상)
    r(ctx, px + 2, py + 2, 3, 3, ERASER)
    // 지우개 밴드
    r(ctx, px + 4, py + 4, 2, 2, BAND)
  },

  easel: (ctx, px, py) => {
    // 1×2 (24×48px) — 나무 이젤 (픽셀아트 참고)
    const WD = '#c8663a', WD_HI = '#d4885a', WD_D = '#8c3e1e'
    const CV = '#f0ebcc', CV_HI = '#f8f4e0', CV_SH = '#d4d0a0'

    // 상단 핀/클램프
    r(ctx, px + 9,  py,     6, 3, WD_D)
    r(ctx, px + 10, py,     4, 2, WD)

    // 상단 가로대
    r3(ctx, px + 1, py + 2, 22, 4, WD, WD_HI, WD_D)

    // 왼쪽 세로 레일 (캔버스 뒤)
    r(ctx, px + 2,  py + 3, 3, 25, WD)
    r(ctx, px + 2,  py + 3, 1, 25, WD_HI)

    // 오른쪽 세로 레일
    r(ctx, px + 19, py + 3, 3, 25, WD)
    r(ctx, px + 21, py + 3, 1, 25, WD_D)

    // 캔버스 (크림색)
    r(ctx, px + 4,  py + 4, 16, 22, CV)
    r(ctx, px + 6,  py + 6, 12, 17, CV_HI)
    r(ctx, px + 4,  py + 4,  1, 22, CV_SH)  // 왼쪽 그림자
    r(ctx, px + 4,  py + 24, 16,  2, CV_SH) // 하단 그림자

    // 중간 가로대 (선반)
    r3(ctx, px,     py + 27, 24, 4, WD_D, WD, WD_D)

    // 왼쪽 앞 다리 (대각선 좌하)
    r(ctx, px + 4,  py + 31, 3, 4, WD)
    r(ctx, px + 3,  py + 35, 3, 4, WD)
    r(ctx, px + 2,  py + 39, 3, 4, WD)
    r(ctx, px + 1,  py + 43, 3, 5, WD)

    // 오른쪽 앞 다리 (대각선 우하)
    r(ctx, px + 17, py + 31, 3, 4, WD)
    r(ctx, px + 18, py + 35, 3, 4, WD)
    r(ctx, px + 19, py + 39, 3, 4, WD)
    r(ctx, px + 20, py + 43, 3, 5, WD)

    // 뒤 지지대 (중앙 수직)
    r(ctx, px + 10, py + 31, 4, 17, WD_D)
  },

  wardrobeD: (ctx, px, py) => {
    // 2×2 (48×48px) — 양문 옷장 (더 큰 버전, 상단 몰딩 강조)
    const W = 2 * T, H = 2 * T
    r3(ctx, px, py, W, H, C.WP2, C.WP1, C.WP3)
    // 상단 몰딩
    r(ctx, px, py, W, 6, C.WP3)
    r(ctx, px, py, W, 1, C.WP1)
    r(ctx, px + 1, py + 1, W - 2, 1, C.WP1)
    // 왼쪽 문짝
    r3(ctx, px + 2, py + 7, W / 2 - 3, H - 9, C.WP1, '#dcc898', C.WP2)
    // 왼쪽 문 상단 패널
    r3(ctx, px + 4, py + 10, W / 2 - 7, 13, C.WP2, C.WP1, C.WP3)
    // 왼쪽 문 하단 패널
    r3(ctx, px + 4, py + 26, W / 2 - 7, H - 31, C.WP2, C.WP1, C.WP3)
    // 오른쪽 문짝
    r3(ctx, px + W / 2 + 1, py + 7, W / 2 - 3, H - 9, C.WP1, '#dcc898', C.WP2)
    // 오른쪽 문 상단 패널
    r3(ctx, px + W / 2 + 3, py + 10, W / 2 - 7, 13, C.WP2, C.WP1, C.WP3)
    // 오른쪽 문 하단 패널
    r3(ctx, px + W / 2 + 3, py + 26, W / 2 - 7, H - 31, C.WP2, C.WP1, C.WP3)
    // 중앙 세로선 (문 틈)
    r(ctx, px + W / 2 - 1, py + 7, 2, H - 9, C.WP3)
    // 손잡이
    r(ctx, px + W / 2 - 5, py + H / 2 - 3, 3, 6, C.WP4)
    r(ctx, px + W / 2 + 2, py + H / 2 - 3, 3, 6, C.WP4)
    ol(ctx, px, py, W, H, C.WP4)
  },

  steelCab: (ctx, px, py) => {
    // 1×2 (24×48px) — 철제 1단 캐비닛 (단문, 다크 프레임)
    const W = T, H = 2 * T
    const FRAME = '#5a2a2a', FRAME_HI = '#7a3a3a', FRAME_DK = '#3a1818'
    const DOOR  = '#b0a898', DOOR_HI  = '#ccc4b8', DOOR_SH  = '#888070'
    // 외곽 프레임 (짙은 적갈색)
    r3(ctx, px, py, W, H, FRAME, FRAME_HI, FRAME_DK)
    // 상단 몰딩 띠
    r(ctx, px + 1, py + 1, W - 2, 5, FRAME_HI)
    r(ctx, px + 1, py + 2, W - 2, 1, '#9a5050')
    // 문 패널 (안쪽)
    r3(ctx, px + 3, py + 7, W - 6, H - 10, DOOR, DOOR_HI, DOOR_SH)
    // 문 인셋 프레임
    r3(ctx, px + 5, py + 10, W - 10, H - 16, DOOR_SH, DOOR, '#706860')
    r(ctx, px + 6, py + 11, W - 12, H - 18, '#a09888')
    // 손잡이 (우측, 중간 높이)
    r(ctx, px + W - 7, py + H / 2 - 4, 4, 7, FRAME_DK)
    r(ctx, px + W - 6, py + H / 2 - 3, 2, 5, '#7a5050')
    // 하단 몰딩 띠
    r(ctx, px + 1, py + H - 6, W - 2, 4, FRAME)
    ol(ctx, px, py, W, H, FRAME_DK)
  },

  vanitySink: (ctx, px, py) => {
    // 2×2 (48×48px) — 하부서랍세면대 (상단 세면대 + 하단 원목 캐비닛)
    const W = 2 * T, H = 2 * T
    // ── 하단 캐비닛 (원목, 하단 절반) ──
    const CAB = C.WP2, CAB_HI = C.WP1, CAB_SH = C.WP3, CAB_DK = C.WP4
    r3(ctx, px, py + H / 2, W, H / 2, CAB, CAB_HI, CAB_SH)
    // 왼쪽 문
    r3(ctx, px + 2, py + H / 2 + 2, W / 2 - 3, H / 2 - 4, CAB_HI, '#dcc898', CAB)
    r3(ctx, px + 4, py + H / 2 + 5, W / 2 - 7, H / 2 - 10, CAB, CAB_HI, CAB_SH)
    // 오른쪽 문
    r3(ctx, px + W / 2 + 1, py + H / 2 + 2, W / 2 - 3, H / 2 - 4, CAB_HI, '#dcc898', CAB)
    r3(ctx, px + W / 2 + 3, py + H / 2 + 5, W / 2 - 7, H / 2 - 10, CAB, CAB_HI, CAB_SH)
    // 문 중앙 틈
    r(ctx, px + W / 2 - 1, py + H / 2 + 2, 2, H / 2 - 4, CAB_SH)
    // 왼쪽 손잡이
    r(ctx, px + W / 2 - 6, py + H * 3 / 4 - 1, 4, 3, CAB_DK)
    // 오른쪽 손잡이
    r(ctx, px + W / 2 + 2, py + H * 3 / 4 - 1, 4, 3, CAB_DK)
    // 캐비닛 하단 발
    r(ctx, px + 4,     py + H - 3, 4, 3, CAB_DK)
    r(ctx, px + W - 8, py + H - 3, 4, 3, CAB_DK)
    ol(ctx, px, py + H / 2, W, H / 2, CAB_DK)
    // ── 상단 세면대 카운터 ──
    const CTR = '#e8eeee', CTR_HI = '#f6fafa', CTR_SH = '#b0bcbc'
    r3(ctx, px, py + H / 2 - 4, W, 6, CTR_SH, CTR, '#8898a0') // 카운터 두께
    r3(ctx, px, py,              W, H / 2 - 2, CTR, CTR_HI, CTR_SH)
    // 세면대 볼 (중앙 타원)
    ctx.fillStyle = '#c8d8dc'
    ctx.beginPath(); ctx.ellipse(px + W / 2, py + H / 4 + 1, 15, 10, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#dceaee'
    ctx.beginPath(); ctx.ellipse(px + W / 2 - 1, py + H / 4, 12, 8, 0, 0, Math.PI * 2); ctx.fill()
    // 수도꼭지
    r3(ctx, px + W / 2 - 3, py + 2, 6, 5, '#909898', '#b0b8b8', '#606868')
    r(ctx, px + W / 2 - 1, py + 6, 2, 5, '#808888')   // 목
    // 냉온수 레버 (좌=파랑, 우=빨강)
    r(ctx, px + W / 2 - 8, py + 4, 4, 3, '#6090c0')
    r(ctx, px + W / 2 + 4, py + 4, 4, 3, '#c06060')
    // 배수구
    ctx.fillStyle = '#8898a0'
    ctx.beginPath(); ctx.arc(px + W / 2, py + H / 4 + 4, 2, 0, Math.PI * 2); ctx.fill()
    ol(ctx, px, py, W, H / 2, CTR_SH)
  },

  wardrobe: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    r3(ctx, px, py, W, H, C.WP2, C.WP1, C.WP3)
    // 상단 몰딩
    r(ctx, px, py, W, 5, C.WP3); r(ctx, px, py, W, 1, C.WP1)
    // 두짝 문
    r3(ctx, px + 2, py + 6, W / 2 - 3, H - 8, C.WP1, '#dcc898', C.WP2)
    r3(ctx, px + W / 2 + 1, py + 6, W / 2 - 3, H - 8, C.WP1, '#dcc898', C.WP2)
    // 문 패널 인셋
    r3(ctx, px + 4, py + 10, W / 2 - 7, H / 2 - 10, C.WP2, C.WP1, C.WP3)
    r3(ctx, px + W / 2 + 3, py + 10, W / 2 - 7, H / 2 - 10, C.WP2, C.WP1, C.WP3)
    // 손잡이
    r(ctx, px + W / 2 - 5, py + H / 2 - 2, 3, 4, C.WP4)
    r(ctx, px + W / 2 + 2, py + H / 2 - 2, 3, 4, C.WP4)
    r(ctx, px + W / 2 - 1, py + 6, 2, H - 8, C.WP3)
    ol(ctx, px, py, W, H, C.WP4)
  },

  dresser: (ctx, px, py) => {
    const W = 2 * T, H = T
    r3(ctx, px, py, W, H, C.WP2, C.WP1, C.WP3)
    r3(ctx, px + 2, py + 2, W - 4, H / 2 - 3, C.WP1, '#dcc898', C.WP2)
    r3(ctx, px + 2, py + H / 2 + 1, W - 4, H / 2 - 3, C.WP1, '#dcc898', C.WP2)
    r(ctx, px + W / 2 - 5, py + H / 4 - 2, 10, 3, C.WP4)
    r(ctx, px + W / 2 - 5, py + H * 3 / 4 - 2, 10, 3, C.WP4)
    ol(ctx, px, py, W, H, C.WP4)
  },

  plant: (ctx, px, py) => {
    // Pot
    r3(ctx, px + 6, py + 14, T - 12, T - 14, C.POT, '#c08060', '#804030')
    r(ctx, px + 7, py + 14, T - 14, 4, '#604030')
    // Leaves
    r(ctx, px + 6, py + 7, 12, 9, C.LEAF)
    r(ctx, px + 2, py + 9, 8, 6, C.LEAFD)
    r(ctx, px + 14, py + 9, 8, 6, C.LEAFD)
    r(ctx, px + 8, py + 4, 8, 6, C.LEAF)
    r(ctx, px + T / 2 - 1, py + 11, 2, 5, C.LEAFD)
    ol(ctx, px + 2, py + 4, T - 4, T - 4, '#1e1c0e')
  },

  tv: (ctx, px, py) => {
    const W = 2 * T
    r3(ctx, px, py + 2, W, T - 4, '#383840', '#484850', '#1e1e28')
    r(ctx, px + 4, py + 5, W - 8, T - 12, '#18203c')
    r(ctx, px + 4, py + 5, W - 8, 3, '#28306a')  // glare
    r(ctx, px + W / 2 - 4, py + T - 3, 8, 3, '#282830')
    ol(ctx, px, py + 2, W, T - 4)
  },

  fridge: (ctx, px, py) => {
    const H = 2 * T
    r3(ctx, px, py, T, H, '#d8e0e4', '#eaf0f4', '#a0b0b8')
    r3(ctx, px + 2, py + 2, T - 4, H / 3 - 2, '#f0f6fa', '#ffffff', '#c8d4da')
    r3(ctx, px + 2, py + H / 3 + 1, T - 4, H * 2 / 3 - 3, '#f0f6fa', '#ffffff', '#c8d4da')
    r(ctx, px + T - 7, py + H / 6 - 3, 4, 8, '#7090a0')
    r(ctx, px + T - 7, py + H / 2, 4, 10, '#7090a0')
    r(ctx, px + 2, py + H / 3, T - 4, 2, '#a0b0b8')
    ol(ctx, px, py, T, H, '#607080')
  },

  lamp: (ctx, px, py) => {
    r3(ctx, px + 8, py + T - 6, T - 16, 5, C.FM, C.FL, C.FD)
    r(ctx, px + T / 2 - 1, py + 8, 2, T - 12, C.FD)
    r3(ctx, px + 3, py + 2, T - 6, 8, C.FL, C.FW, C.FM)
    ol(ctx, px + 3, py + 2, T - 6, T - 4)
  },

  // ── OFFICE ───────────────────────────────────

  oDesk: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    r3(ctx, px, py, W, H, C.WL, '#d8c8a0', C.WD)
    // Monitor
    r3(ctx, px + 6, py + 3, W - 16, H / 2 + 2, '#28283a', '#383848', '#181820')
    r(ctx, px + 8, py + 5, W - 20, H / 2 - 2, '#182040')
    r(ctx, px + 8, py + 5, W - 20, 3, '#283060')
    r(ctx, px + W / 2 - 4, py + H / 2 + 3, 8, 4, '#303040')
    r(ctx, px + W / 2 - 7, py + H / 2 + 6, 14, 3, '#303040')
    // Keyboard
    r3(ctx, px + 3, py + H - 11, W - 6, 9, '#c8c4be', '#d8d4ce', C.FM)
    for (let j = 0; j < 5; j++) r(ctx, px + 5 + j * 7, py + H - 9, 5, 1, C.FM)
    for (let j = 0; j < 5; j++) r(ctx, px + 5 + j * 7, py + H - 6, 5, 1, C.FM)
    ol(ctx, px, py, W, H)
  },

  cabinet: (ctx, px, py) => {
    const H = 2 * T
    r3(ctx, px, py, T, H, C.WP2, C.WP1, C.WP3)
    const dh = Math.floor((H - 6) / 3)
    for (let i = 0; i < 3; i++) {
      r3(ctx, px + 2, py + 3 + i * (dh + 1), T - 4, dh - 1, C.WP1, '#dcc898', C.WP2)
      r(ctx, px + T / 2 - 3, py + 3 + i * (dh + 1) + Math.floor(dh / 2) - 2, 6, 3, C.WP4)
    }
    ol(ctx, px, py, T, H, C.WP4)
  },

  printer: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    r3(ctx, px, py + 5, W, H - 5, C.FL, C.FW, C.FM)
    r3(ctx, px + 2, py, W - 4, 13, '#d0ccc8', '#dcdad6', C.FM)
    r3(ctx, px + 4, py + H - 15, W - 8, 9, C.FM, C.FL, C.FD)
    r(ctx, px + W - 15, py + 2, 11, 9, '#383840')
    r(ctx, px + W - 14, py + 3, 3, 3, '#50c050')
    r(ctx, px + W - 10, py + 3, 3, 3, '#c05050')
    ol(ctx, px, py + 5, W, H - 5)
  },

  cTable: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    // 다리 (모서리)
    r(ctx, px + 4, py + 2, 5, 4, C.WP3)
    r(ctx, px + W - 9, py + 2, 5, 4, C.WP3)
    r(ctx, px + 4, py + H - 6, 5, 4, C.WP3)
    r(ctx, px + W - 9, py + H - 6, 5, 4, C.WP3)
    // 상판
    r3(ctx, px + 3, py + 3, W - 6, H - 6, C.WP2, C.WP1, C.WP3)
    r(ctx, px + 7, py + 7, W - 14, H - 14, C.WP1)
    r(ctx, px + 7, py + 7, W - 14, 2, '#dcc898')   // 상판 반사
    ol(ctx, px + 3, py + 3, W - 6, H - 6, C.WP4)
  },

  shelf: (ctx, px, py) => {
    const H = 2 * T
    r3(ctx, px, py, T, H, C.WP2, C.WP1, C.WP3)
    r(ctx, px + 2, py + Math.floor(H / 3), T - 4, 3, C.WP3)
    r(ctx, px + 2, py + Math.floor(H * 2 / 3), T - 4, 3, C.WP3)
    const bc = ['#c87858', '#5888a8', '#a8a058', '#588898']
    for (let i = 0; i < 4; i++) r(ctx, px + 3 + i * 4, py + 4, 3, Math.floor(H / 3) - 6, bc[i])
    for (let i = 0; i < 3; i++) r(ctx, px + 3 + i * 5, py + Math.floor(H / 3) + 4, 4, Math.floor(H / 3) - 7, bc[(i + 2) % 4])
    ol(ctx, px, py, T, H, C.WP4)
  },

  // ── SCHOOL ───────────────────────────────────

  sDesk: (ctx, px, py) => {
    // 1×2 (24×48px) — 책상(상단) + 의자(하단) 픽셀아트
    const W = T, H = 2 * T
    const TEAL  = '#4AACA0', TEAL_HI = '#72C8C0', TEAL_SH = '#287870'
    const TAN   = '#D4B870', TAN_HI  = '#E8CC88', TAN_SH  = '#9A7C38'
    const LEG   = '#7A5030', LEG_SH  = '#4A2810'

    // ── 책상 다리 (네 모서리, 상판 아래) ──
    r(ctx, px + 2,     py + 13, 3, 8, LEG)
    r(ctx, px + W - 5, py + 13, 3, 8, LEG)

    // ── 책상 상판 ──
    r3(ctx, px + 1, py + 1, W - 2, 13, TAN, TAN_HI, TAN_SH)
    r(ctx, px + 3,  py + 2,  W - 6, 4, TAN_HI)    // 상판 반사

    // ── 의자 다리 (좌/우) ──
    r(ctx, px + 3,     py + 28, 3, 14, LEG)
    r(ctx, px + W - 6, py + 28, 3, 14, LEG)
    // 다리 하단 발
    r(ctx, px + 2,     py + H - 4, 4, 3, LEG_SH)
    r(ctx, px + W - 6, py + H - 4, 4, 3, LEG_SH)

    // ── 의자 좌석 (틸 쿠션) ──
    r3(ctx, px + 2, py + 23, W - 4, 10, TEAL, TEAL_HI, TEAL_SH)
    r(ctx, px + 4,  py + 24, W - 8, 3,  TEAL_HI)   // 좌석 반사

    // ── 의자 등받이 ──
    r3(ctx, px + 4, py + 35, W - 8, 8, TEAL, TEAL_HI, TEAL_SH)

    ol(ctx, px + 1, py + 1, W - 2, 13, TAN_SH)
    ol(ctx, px + 2, py + 23, W - 4, 10, TEAL_SH)
    ol(ctx, px + 4, py + 35, W - 8, 8, TEAL_SH)
  },

  sDeskOnly: (ctx, px, py) => {
    // 1×1 (24×24px) — 책상만
    const TAN = '#D4B870', TAN_HI = '#E8CC88', TAN_SH = '#9A7C38'
    const LEG = '#7A5030', LEG_SH = '#4A2810'
    // 다리 (하단 양쪽)
    r(ctx, px + 2,     py + 14, 3, 8, LEG)
    r(ctx, px + T - 5, py + 14, 3, 8, LEG)
    r(ctx, px + 2,     py + T - 3, 4, 3, LEG_SH)
    r(ctx, px + T - 6, py + T - 3, 4, 3, LEG_SH)
    // 상판
    r3(ctx, px + 1, py + 1, T - 2, 14, TAN, TAN_HI, TAN_SH)
    r(ctx, px + 3, py + 2, T - 6, 5, TAN_HI)
    ol(ctx, px + 1, py + 1, T - 2, 14, TAN_SH)
  },

  computerDesk: (ctx, px, py) => {
    // 3×2 (72×48px) — 컴퓨터 책상
    const W = 3 * T, H = 2 * T
    // ── 책상 하단 (서랍 없음, 다리) ──
    r3(ctx, px,      py + 28, W,     5, C.WP2, C.WP1, C.WP3)   // 상판
    r3(ctx, px + 4,  py + 33, W - 8, 6, C.WP3, C.WP2, C.WP4)   // 가로 보
    // 4개 다리
    r(ctx, px + 4,      py + 33, 4, 15, C.WP3)
    r(ctx, px + W - 8,  py + 33, 4, 15, C.WP3)
    r(ctx, px + 5,      py + 34, 3, 14, C.WP4)   // 다리 그림자
    r(ctx, px + W - 7,  py + 34, 3, 14, C.WP4)
    ol(ctx, px, py + 28, W, H - 28, C.WP4)
    // ── 타워 PC (x=1~13, y=1~26) ──
    r3(ctx, px + 1, py + 1, 12, 26, '#B0B0A8', '#C8C8C0', '#808078')
    r(ctx, px + 2, py + 4,  10, 2, '#686860')
    r(ctx, px + 2, py + 8,  10, 2, '#686860')
    r(ctx, px + 2, py + 12, 10, 2, '#686860')
    r(ctx, px + 3, py + 16,  4, 4, '#404840')
    r(ctx, px + 4, py + 22,  3, 2, '#3868B8')
    ol(ctx, px + 1, py + 1, 12, 26, '#585850')
    // ── 모니터 (x=15~52, y=0~26) ──
    r3(ctx, px + 15, py, 37, 26, '#A8A8A0', '#C0C0B8', '#787870')
    r(ctx,  px + 17, py + 2, 33, 19, '#101838')
    for (let i = 0; i < 4; i++) {
      r(ctx, px + 19, py + 4 + i * 4, 29, 2, '#2848A0')
      r(ctx, px + 19, py + 5 + i * 4, 29, 1, '#3060C8')
    }
    r3(ctx, px + 29, py + 22, 11, 6, '#909088', '#A8A8A0', '#707068')  // 스탠드
    ol(ctx, px + 15, py, 37, 26, '#585850')
    // ── 키보드 (x=14~60, y=23~28) ──
    r3(ctx, px + 14, py + 23, 44, 5, '#C8C0B0', '#E0D8C8', '#A0988A')
    for (let i = 0; i < 7; i++) r(ctx, px + 15 + i * 6, py + 24, 5, 2, '#A89880')
    // ── 마우스 (x=61~70, y=23~28) ──
    r3(ctx, px + 61, py + 23, 9, 7, '#7888B8', '#98A8D0', '#485890')
    r(ctx,  px + 63, py + 23, 5, 1, '#A8B8E0')
  },

  readingDesk: (ctx, px, py) => {
    // 3×2 (72×48px) — 독서 책상
    const W = 3 * T, H = 2 * T
    // ── 책상 하단 (서랍 없음, 다리) ──
    r3(ctx, px,      py + 28, W,     5, C.WP2, C.WP1, C.WP3)
    r3(ctx, px + 4,  py + 33, W - 8, 6, C.WP3, C.WP2, C.WP4)
    r(ctx, px + 4,      py + 33, 4, 15, C.WP3)
    r(ctx, px + W - 8,  py + 33, 4, 15, C.WP3)
    r(ctx, px + 5,      py + 34, 3, 14, C.WP4)
    r(ctx, px + W - 7,  py + 34, 3, 14, C.WP4)
    ol(ctx, px, py + 28, W, H - 28, C.WP4)
    // ── 책상 위 면 (빈 나무) ──
    r3(ctx, px, py, W, 28, C.WP2, C.WP1, C.WP3)
    r(ctx, px + 1, py + 1, W - 2, 2, C.WP1)
  },

  sChair: (ctx, px, py) => {
    // 1×1 (24×24px) — 의자만
    const TEAL = '#4AACA0', TEAL_HI = '#72C8C0', TEAL_SH = '#287870'
    const LEG = '#7A5030', LEG_SH = '#4A2810'
    // 다리
    r(ctx, px + 3,     py + 3, 2, 10, LEG)
    r(ctx, px + T - 5, py + 3, 2, 10, LEG)
    r(ctx, px + 2,     py + T - 4, 3, 3, LEG_SH)
    r(ctx, px + T - 5, py + T - 4, 3, 3, LEG_SH)
    // 좌석
    r3(ctx, px + 2, py + 3, T - 4, 9, TEAL, TEAL_HI, TEAL_SH)
    r(ctx, px + 4, py + 4, T - 8, 3, TEAL_HI)
    // 등받이
    r3(ctx, px + 4, py + 14, T - 8, 8, TEAL, TEAL_HI, TEAL_SH)
    ol(ctx, px + 2, py + 3, T - 4, 9, TEAL_SH)
    ol(ctx, px + 4, py + 14, T - 8, 8, TEAL_SH)
  },

  chairFront: (ctx, px, py) => {
    // 정면 — 1×1 (24×24)
    const WD = '#C87838', WH = '#E89848', WS = '#8B4820', DK = '#5C2810'
    // 다리
    r(ctx, px + 3,  py + 17, 3, 6, DK)
    r(ctx, px + 18, py + 17, 3, 6, DK)
    // 좌석
    r3(ctx, px + 1, py + 11, 22, 7, WD, WH, WS)
    r(ctx, px + 2, py + 12, 20, 2, WH)
    // 등받이 테두리
    r3(ctx, px + 2, py + 1, 20, 10, WS, WD, DK)
    // 등받이 안쪽 패널 (밝은 원목)
    r3(ctx, px + 4, py + 3, 16, 6, WD, WH, WS)
    ol(ctx, px + 1, py + 11, 22, 7, DK)
    ol(ctx, px + 2, py + 1, 20, 10, DK)
  },

  chairLeft: (ctx, px, py) => {
    // 왼측 — 1×1 (24×24)
    const WD = '#C87838', WH = '#E89848', WS = '#8B4820', DK = '#5C2810'
    // 다리
    r(ctx, px + 6,  py + 17, 3, 6, DK)
    r(ctx, px + 18, py + 17, 3, 6, DK)
    // 좌석
    r3(ctx, px + 5, py + 11, 17, 7, WD, WH, WS)
    r(ctx, px + 6, py + 12, 15, 2, WH)
    // 등받이 (왼쪽 수직 기둥)
    r3(ctx, px + 1, py + 1, 6, 22, WS, WD, DK)
    r(ctx, px + 2, py + 2, 3, 18, WD)
    ol(ctx, px + 5, py + 11, 17, 7, DK)
    ol(ctx, px + 1, py + 1, 6, 22, DK)
  },

  chairBack: (ctx, px, py) => {
    // 뒷면 — 1×1 (24×24)
    const WD = '#C87838', WH = '#E89848', WS = '#8B4820', DK = '#5C2810'
    // 다리
    r(ctx, px + 2,  py + 17, 3, 6, DK)
    r(ctx, px + 19, py + 17, 3, 6, DK)
    // 팔걸이 좌우
    r3(ctx, px + 1, py + 11, 4, 7, WS, WD, DK)
    r3(ctx, px + 19, py + 11, 4, 7, WS, WD, DK)
    // 좌석 (뒷면이라 좁게)
    r3(ctx, px + 4, py + 12, 16, 6, WD, WH, WS)
    // 등받이 (넓게)
    r3(ctx, px + 1, py + 1, 22, 11, WS, WD, DK)
    r(ctx, px + 3, py + 3, 18, 7, WD)
    r(ctx, px + 3, py + 3, 18, 2, WH)
    ol(ctx, px + 1, py + 1, 22, 11, DK)
  },

  tDesk: (ctx, px, py) => {
    const W = 2 * T
    r3(ctx, px, py, W, T, C.WP2, C.WP1, C.WP3)
    r(ctx, px + 2, py + 2, W - 4, 3, C.WP1)             // 상판 반사
    r3(ctx, px + W - 10, py + 3, 8, T - 6, C.WP3, C.WP2, C.WP4)  // 서랍
    r(ctx, px + W - 7, py + T / 2 - 1, 3, 2, C.WP1)     // 손잡이
    ol(ctx, px, py, W, T, C.WP4)
  },

  board: (ctx, px, py) => {
    const W = 2 * T
    r3(ctx, px, py, W, T, '#6a5848', '#7a6858', '#4a3830')   // 나무 프레임
    r(ctx, px + 3, py + 3, W - 6, T - 6, '#2a4030')          // 칠판 면
    r(ctx, px + 5, py + 7, 16, 1, 'rgba(255,255,255,0.55)')   // 글씨 선 1
    r(ctx, px + 5, py + 11, 22, 1, 'rgba(255,255,255,0.35)')  // 글씨 선 2
    r(ctx, px + W - 12, py + T - 5, 8, 3, '#e0d8c8')          // 지우개
    ol(ctx, px, py, W, T, '#3a2010')
  },

  locker: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    r3(ctx, px, py, W, H, '#7080a0', '#8898b8', '#505870')
    r3(ctx, px + 1, py + 1, W / 2 - 2, H - 2, '#8898b8', '#a0aed0', '#606880')
    r3(ctx, px + W / 2 + 1, py + 1, W / 2 - 2, H - 2, '#8898b8', '#a0aed0', '#606880')
    for (let i = 4; i < 14; i += 3) {
      r(ctx, px + 4, py + i, W / 2 - 8, 1, '#506080')
      r(ctx, px + W / 2 + 4, py + i, W / 2 - 8, 1, '#506080')
    }
    r(ctx, px + W / 2 - 5, py + H / 2 - 4, 3, 7, '#303850')
    r(ctx, px + W / 2 + 2, py + H / 2 - 4, 3, 7, '#303850')
    ol(ctx, px, py, W, H, '#303850')
  },

  // ── LOCK ─────────────────────────────────────

  lockKey: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', SH = '#a0a0b8'
    // 자물쇠 몸체 (하단 직사각형)
    r(ctx, px + 7, py + 12, 10, 9, W)
    // 자물쇠 상단 고리 (U자) — 왼쪽/오른쪽/윗선
    r(ctx, px + 8, py + 6, 2, 8, W)   // 왼쪽 기둥
    r(ctx, px + 14, py + 6, 2, 8, W)  // 오른쪽 기둥
    r(ctx, px + 8, py + 6, 8, 2, W)   // 상단 가로
    // 열쇠구멍 (몸체 중앙)
    r(ctx, px + 11, py + 15, 2, 2, '#1a1a2a')  // 원형 구멍 (상)
    r(ctx, px + 11, py + 17, 2, 3, '#1a1a2a')  // 열쇠 슬롯 (하)
    // 하이라이트
    r(ctx, px + 7, py + 12, 10, 1, SH)
  },

  lockDir: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', BG = '#1a1a2a'
    // 상단 고리 (U자)
    r(ctx, px + 8,  py + 2, 2, 9, W)   // 왼쪽 기둥
    r(ctx, px + 14, py + 2, 2, 9, W)   // 오른쪽 기둥
    r(ctx, px + 8,  py + 2, 8, 2, W)   // 상단 가로
    // 원형 몸체
    ctx.fillStyle = W
    ctx.beginPath(); ctx.arc(px + 12, py + 16, 7, 0, Math.PI * 2); ctx.fill()
    // 내부 원 (어두운)
    ctx.fillStyle = BG
    ctx.beginPath(); ctx.arc(px + 12, py + 16, 4, 0, Math.PI * 2); ctx.fill()
    // 방향 십자 (흰색, 내부 원 위)
    r(ctx, px + 11, py + 12, 2, 8, W)  // 세로
    r(ctx, px + 8,  py + 15, 8, 2, W)  // 가로
    // 중심 점 (어둠)
    r(ctx, px + 11, py + 15, 2, 2, BG)
  },

  lockNum: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', SH = '#a0a0b8'
    // 자물쇠 몸체
    r(ctx, px + 4, py + 10, 16, 12, W)
    // 상단 고리 (U자)
    r(ctx, px + 7, py + 4, 2, 8, W)
    r(ctx, px + 15, py + 4, 2, 8, W)
    r(ctx, px + 7, py + 4, 10, 2, W)
    // "123" 텍스트
    ctx.fillStyle = '#1a1a2a'
    ctx.font = 'bold 6px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('123', px + 12, py + 16)
    // 하이라이트
    r(ctx, px + 4, py + 10, 16, 1, SH)
  },

  lockAlpha: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', SH = '#a0a0b8'
    // 자물쇠 몸체
    r(ctx, px + 4, py + 10, 16, 12, W)
    // 상단 고리 (U자)
    r(ctx, px + 7, py + 4, 2, 8, W)
    r(ctx, px + 15, py + 4, 2, 8, W)
    r(ctx, px + 7, py + 4, 10, 2, W)
    // "ABC" 텍스트
    ctx.fillStyle = '#1a1a2a'
    ctx.font = 'bold 6px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ABC', px + 12, py + 16)
    // 하이라이트
    r(ctx, px + 4, py + 10, 16, 1, SH)
  },

  lockPad: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', SH = '#a0a0b8'
    // 키패드 패널 외형
    r(ctx, px + 3, py + 3, 18, 18, W)
    // 3×4 그리드 버튼 — 맨 아래 좌/우 제외
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        if (row === 3 && col === 0) continue  // 빨간 버튼
        if (row === 3 && col === 2) continue  // 초록 버튼
        r(ctx, px + 4 + col * 6, py + 4 + row * 4, 4, 3, '#1a1a2a')
      }
    }
    // 맨 아래 왼쪽 — 빨간색
    r(ctx, px + 4,  py + 16, 4, 3, '#cc3333')
    // 맨 아래 오른쪽 — 초록색
    r(ctx, px + 16, py + 16, 4, 3, '#33aa44')
    // 하이라이트
    r(ctx, px + 3, py + 3, 18, 1, SH)
    r(ctx, px + 3, py + 3, 1, 18, SH)
  },

  keyItem: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', BG = '#1a1a2a'
    // 열쇠 링 (흰 원)
    ctx.fillStyle = W
    ctx.beginPath(); ctx.arc(px + 8, py + 11, 7, 0, Math.PI * 2); ctx.fill()
    // 십자 구멍 (✚ 모양 컷아웃)
    r(ctx, px + 7, py + 8,  3, 7, BG)  // 세로
    r(ctx, px + 5, py + 10, 7, 3, BG)  // 가로
    // 샤프트 (가로)
    r(ctx, px + 14, py + 10, 9, 3, W)
    // 이빨 2개 (아래)
    r(ctx, px + 16, py + 13, 2, 3, W)
    r(ctx, px + 20, py + 13, 2, 2, W)
  },

  magnifier: (ctx, px, py) => {
    // 검은 배경
    r(ctx, px, py, T, T, '#1a1a2a')
    const W = '#e8e8e8', BG = '#1a1a2a'
    // 렌즈 외곽 (흰 원)
    ctx.fillStyle = W
    ctx.beginPath(); ctx.arc(px + 10, py + 10, 7, 0, Math.PI * 2); ctx.fill()
    // 렌즈 내부 (어둠 — 투명한 유리 느낌)
    ctx.fillStyle = BG
    ctx.beginPath(); ctx.arc(px + 10, py + 10, 5, 0, Math.PI * 2); ctx.fill()
    // 반사 하이라이트
    r(ctx, px + 7, py + 7, 2, 1, W)
    // 손잡이 (대각선)
    r(ctx, px + 15, py + 15, 2, 2, W)
    r(ctx, px + 17, py + 17, 2, 2, W)
    r(ctx, px + 19, py + 19, 2, 2, W)
  },

  telephone: (ctx, px, py) => {
    // 1×1 (24×24px) — 유선 전화기
    const BG = '#C0C0C0', HI = '#E0E0E0', SH = '#888888', DK = '#505050', BTN = '#484848'
    // 메인 바디
    r3(ctx, px + 1, py + 3, 22, 17, BG, HI, SH)
    // 수화기 좌우 돌출
    r3(ctx, px + 1, py + 1, 7, 7, HI, '#F0F0F0', BG)
    r3(ctx, px + 16, py + 1, 7, 7, HI, '#F0F0F0', BG)
    r(ctx,  px + 8, py + 2, 8, 4, BG)   // 수화기 사이 홈
    // 3×4 버튼 그리드 (x=8, y=8)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        r(ctx, px + 8 + col * 4, py + 8 + row * 3, 3, 2, BTN)
        r(ctx, px + 8 + col * 4, py + 8 + row * 3, 3, 1, '#686868')
      }
    }
    // 하단 베이스
    r3(ctx, px + 3, py + 20, 18, 3, SH, BG, DK)
    ol(ctx, px + 1, py + 3, 22, 17, DK)
  },

  mobilePhone: (ctx, px, py) => {
    // 1×1 (24×24px) — 스마트폰
    const BODY = '#1a1a2a', BEZEL = '#2a2a3c', SCR = '#1030b0', SCRL = '#2848d0', HI = '#6080e0'
    // 본체
    r3(ctx, px + 4, py + 1, 16, 22, BEZEL, '#3a3a4e', BODY)
    // 화면
    r3(ctx, px + 6, py + 3, 12, 15, SCR, SCRL, '#0820a0')
    r(ctx,  px + 7, py + 4, 5, 3, HI)   // 화면 반사
    // 상단 카메라 + 스피커
    r(ctx, px + 9, py + 2, 6, 1, '#404050')   // 스피커 슬롯
    r(ctx, px + 16, py + 2, 2, 2, '#303040')  // 카메라 점
    // 하단 홈 바
    r(ctx, px + 9, py + 19, 6, 2, '#3a3a50')
    ol(ctx, px + 4, py + 1, 16, 22, BODY)
  },

  videoCam: (ctx, px, py) => {
    // 1×1 (24×24px) — 비디오 카메라
    const BODY = '#383830', HI = '#504f45', SH = '#202018', DK = '#181810'
    // 손잡이/그립 (상단)
    r3(ctx, px + 10, py + 2, 12, 6, '#484840', '#585850', SH)
    // 메인 바디
    r3(ctx, px + 1,  py + 7, 19, 13, BODY, HI, SH)
    // 렌즈 외곽
    ctx.fillStyle = DK
    ctx.beginPath(); ctx.arc(px + 7, py + 13, 5, 0, Math.PI * 2); ctx.fill()
    // 렌즈 유리
    ctx.fillStyle = '#1840a8'
    ctx.beginPath(); ctx.arc(px + 7, py + 13, 3, 0, Math.PI * 2); ctx.fill()
    // 렌즈 반사
    r(ctx, px + 6, py + 11, 2, 1, '#70a0e0')
    // 뷰파인더 (우측 돌출)
    r3(ctx, px + 19, py + 9, 4, 6, '#303028', '#484840', DK)
    // 녹화 버튼 (빨간)
    r(ctx, px + 14, py + 9, 3, 3, '#cc2020')
    r(ctx, px + 15, py + 9, 1, 1, '#ee4040')
    ol(ctx, px + 1, py + 7, 19, 13, DK)
  },

  projector: (ctx, px, py) => {
    // 1×1 (24×24px) — 프로젝트 빔 (필름 릴 + 재생 버튼)
    const BG = '#111118', FR = '#2a2a2a', FRD = '#181818'
    // 배경
    r(ctx, px, py, 24, 24, BG)
    // 필름 프레임 (외곽 필름 스트립 — 위)
    r(ctx, px + 1, py + 1, 22, 4, FR)
    r(ctx, px + 3, py + 2, 3, 2, BG)   // 퍼포레이션 1
    r(ctx, px + 9, py + 2, 3, 2, BG)   // 퍼포레이션 2
    r(ctx, px + 15, py + 2, 3, 2, BG)  // 퍼포레이션 3
    r(ctx, px + 21, py + 2, 2, 2, BG)  // 퍼포레이션 4
    // 필름 프레임 (외곽 필름 스트립 — 아래)
    r(ctx, px + 1, py + 19, 22, 4, FR)
    r(ctx, px + 3, py + 20, 3, 2, BG)
    r(ctx, px + 9, py + 20, 3, 2, BG)
    r(ctx, px + 15, py + 20, 3, 2, BG)
    r(ctx, px + 21, py + 20, 2, 2, BG)
    // 중앙 영역 (화면)
    r(ctx, px + 1, py + 5, 22, 14, FRD)
    // 재생 버튼 (삼각형)
    ctx.fillStyle = '#e8e8e0'
    ctx.beginPath()
    ctx.moveTo(px + 8, py + 8)
    ctx.lineTo(px + 8, py + 16)
    ctx.lineTo(px + 17, py + 12)
    ctx.closePath()
    ctx.fill()
    // 삼각형 하이라이트
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(px + 8, py + 8)
    ctx.lineTo(px + 8, py + 10)
    ctx.lineTo(px + 13, py + 12)
    ctx.closePath()
    ctx.fill()
    ol(ctx, px + 1, py + 1, 22, 22, FRD)
  },

  headset: (ctx, px, py) => {
    // 1×1 (24×24px) — 헤드셋
    const DK = '#181818', MD = '#282828', HI = '#404040'
    // 헤드밴드 아크 (굵은 반원)
    ctx.strokeStyle = DK
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(px + 12, py + 12, 9, Math.PI, 0)
    ctx.stroke()
    ctx.lineWidth = 1
    // 왼쪽 이어컵
    r3(ctx, px + 1, py + 12, 7, 9, MD, HI, DK)
    r(ctx,  px + 2, py + 13, 5, 7, DK)    // 이어컵 내부
    r(ctx,  px + 3, py + 14, 3, 5, MD)    // 쿠션 부분
    // 오른쪽 이어컵
    r3(ctx, px + 16, py + 12, 7, 9, MD, HI, DK)
    r(ctx,  px + 17, py + 13, 5, 7, DK)
    r(ctx,  px + 18, py + 14, 3, 5, MD)
    // 밴드 끝 연결부 (왼쪽)
    r(ctx, px + 2, py + 11, 4, 3, DK)
    // 밴드 끝 연결부 (오른쪽)
    r(ctx, px + 18, py + 11, 4, 3, DK)
  },

  monitor: (ctx, px, py) => {
    // 1×1 (24×24px) — 모니터 (화면 + 재생 원 + 스탠드)
    const FR = '#444444', SCR = '#e8e8e8', DK = '#2a2a2a', HI = '#585858'
    // 모니터 외곽 프레임
    r3(ctx, px + 1, py + 1, 22, 15, FR, HI, DK)
    // 화면
    r(ctx, px + 3, py + 3, 18, 11, SCR)
    // 재생 원 테두리
    ctx.strokeStyle = FR
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(px + 12, py + 8, 4, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = 1
    // 재생 삼각형
    ctx.fillStyle = FR
    ctx.beginPath()
    ctx.moveTo(px + 10, py + 6)
    ctx.lineTo(px + 10, py + 10)
    ctx.lineTo(px + 15, py + 8)
    ctx.closePath()
    ctx.fill()
    // 모니터 하단 버튼 (작은 원)
    ctx.fillStyle = SCR
    ctx.beginPath(); ctx.arc(px + 12, py + 17, 1, 0, Math.PI * 2); ctx.fill()
    // 스탠드 넥
    r(ctx, px + 10, py + 18, 4, 3, FR)
    // 스탠드 베이스
    r3(ctx, px + 7, py + 21, 10, 2, FR, HI, DK)
  },

  // ── BATHROOM ─────────────────────────────────

  toilet: (ctx, px, py) => {
    // 1×2 (24×48px) — 변기 (탑뷰 픽셀아트)
    const W = T, H = 2 * T
    const WH = '#f8f8f8', WM = '#e0e4e8', WS = '#b8c0c8', WD = '#8898a0'
    // 수조 (탱크)
    r3(ctx, px + 1, py + 1, W - 2, 15, WM, WH, WS)
    r(ctx, px + 3, py + 3, W - 6, 11, '#d8dce0')
    r(ctx, px + 4, py + 4, W - 8, 4, '#c8ccd0')   // 탱크 뚜껑
    r(ctx, px + W/2 - 3, py + 8, 6, 2, WS)          // 레버
    // 연결부
    r3(ctx, px + 3, py + 16, W - 6, 4, WS, WM, WD)
    // 변기 본체
    r3(ctx, px + 1, py + 20, W - 2, H - 22, WM, WH, WS)
    // 변기 내부 (시트 안)
    ctx.fillStyle = '#c8d0d8'
    ctx.beginPath()
    ctx.ellipse(px + W / 2, py + 33, 7, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#9ab0b8'
    ctx.beginPath()
    ctx.ellipse(px + W / 2, py + 33, 5, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    // 변기 시트 테두리
    ctx.strokeStyle = WS; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(px + W / 2, py + 33, 8, 10, 0, 0, Math.PI * 2)
    ctx.stroke(); ctx.lineWidth = 1
    ol(ctx, px + 1, py + 1, W - 2, H - 2, WD)
  },

  sink: (ctx, px, py) => {
    // 1×1 (24×24px) — 세면대 (탑뷰 픽셀아트)
    const W = T, H = T
    const WH = '#f8f8f8', WM = '#dce4ea', WS = '#a8b8c4', WD = '#607888'
    // 세면대 본체
    r3(ctx, px, py + 3, W, H - 4, WM, WH, WS)
    r(ctx, px + 1, py + 3, W - 2, 1, WH)
    // 세면대 볼 (타원형)
    ctx.fillStyle = '#b8c8d4'
    ctx.beginPath()
    ctx.ellipse(px + W / 2, py + 13, 7, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ccdae4'
    ctx.beginPath()
    ctx.ellipse(px + W / 2 - 1, py + 12, 5, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    // 수도꼭지 (상단 중앙)
    r3(ctx, px + W/2 - 3, py, 6, 5, WS, WH, WD)
    r(ctx, px + W/2 - 1, py + 3, 2, 4, WS)          // 수도꼭지 목
    // 배수구
    ctx.fillStyle = WD
    ctx.beginPath()
    ctx.arc(px + W / 2, py + 16, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ol(ctx, px, py + 3, W, H - 4, WD)
  },

  bathtub: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    r3(ctx, px, py, W, H, C.FW, '#ffffff', C.FL)
    r(ctx, px + 5, py + 9, W - 10, H - 17, '#b0c8d8')
    r(ctx, px + 5, py + 9, W - 10, 3, '#c8e4f0')   // 물 반사
    r3(ctx, px + 2, py + 2, 10, 6, C.FL, C.FW, C.FM)   // 수도꼭지
    r(ctx, px + 5, py + 4, 4, 2, '#a8b8c0')
    ol(ctx, px, py, W, H, '#606878')
  },

  mirror: (ctx, px, py) => {
    const W = 2 * T
    r3(ctx, px, py, W, T, C.FM, C.FL, C.FD)
    r(ctx, px + 3, py + 3, W - 6, T - 6, '#c8d4dc')
    r(ctx, px + 5, py + 5, 8, T - 12, '#d8e4ec')
    ol(ctx, px, py, W, T)
  },

  mirrorS: (ctx, px, py) => {
    // 1×1 (24×24px) — 거울 소 (정사각)
    const W = T, H = T
    const FR = '#707880', FRH = '#9098a0', FRD = '#484e54'
    // 프레임
    r3(ctx, px, py, W, H, FR, FRH, FRD)
    // 거울 면
    r(ctx, px + 2, py + 2, W - 4, H - 4, '#b8ccd8')
    // 반사광 (좌상단 대각선)
    r(ctx, px + 3, py + 3, W - 10, 2, '#ddeef8')
    r(ctx, px + 3, py + 5, 2, H - 10, '#d0e4f0')
    r(ctx, px + 5, py + 3, 4, 1, '#e8f4fc')   // 상단 하이라이트
    ol(ctx, px, py, W, H, FRD)
  },

  mirrorL: (ctx, px, py) => {
    // 1×2 (24×48px) — 거울 대 (세로 직사각)
    const W = T, H = 2 * T
    const FR = '#707880', FRH = '#9098a0', FRD = '#484e54'
    // 프레임
    r3(ctx, px, py, W, H, FR, FRH, FRD)
    // 거울 면
    r(ctx, px + 2, py + 2, W - 4, H - 4, '#b8ccd8')
    // 반사광 (좌상단)
    r(ctx, px + 3, py + 3, W - 10, 3, '#ddeef8')
    r(ctx, px + 3, py + 6, 2, H - 14, '#d0e4f0')
    r(ctx, px + 5, py + 3, 4, 1, '#e8f4fc')
    r(ctx, px + 5, py + 5, 3, 6, '#cce0ec')   // 중간 반사
    // 하단 반사 (바닥 비침)
    r(ctx, px + 3, py + H - 6, W - 8, 2, '#c0d4e0')
    ol(ctx, px, py, W, H, FRD)
  },

  urinal: (ctx, px, py) => {
    r3(ctx, px + 2, py, T - 4, 6, C.FL, C.FW, C.FM)
    r3(ctx, px + 3, py + 6, T - 6, T - 8, C.FW, '#ffffff', C.FL)
    r(ctx, px + 6, py + 10, T - 12, T - 16, '#b8ccd4')
    ol(ctx, px + 2, py, T - 4, T)
  },

  // ── MEDICAL ──────────────────────────────────

  hBed: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    // 프레임 (흰 병원용)
    r3(ctx, px, py, W, H, '#d8dce0', '#eef2f6', '#b0b8c0')
    // 매트리스
    r3(ctx, px + 2, py + 9, W - 4, H - 17, C.BED, '#f8f4ee', C.BEDD)
    // 베개
    r3(ctx, px + 4, py + 11, W - 8, 8, C.BED, '#fefcfa', C.BEDD)
    // 헤드/풋 레일 (파란 금속)
    r(ctx, px + 1, py + 1, W - 2, 7, '#88aac8')
    r(ctx, px + 1, py + H - 8, W - 2, 7, '#88aac8')
    ol(ctx, px, py, W, H, '#606878')
  },

  ivStand: (ctx, px, py) => {
    const H = 2 * T
    r3(ctx, px + 6, py + H - 6, T - 12, 5, C.FM, C.FL, C.FD)
    r(ctx, px + T / 2 - 1, py + 8, 2, H - 13, C.FM)
    r3(ctx, px + T / 2 - 6, py + 4, 12, 5, C.FL, C.FW, C.FM)
    r3(ctx, px + T / 2 - 5, py + 4, 10, 14, '#a8c8e0', '#b8d8f0', '#88a8c0')
    r(ctx, px + T / 2, py + 18, 1, H - 26, '#a0b8c0')
    ol(ctx, px + T / 2 - 6, py + 4, 12, H - 10)
  },

  medCab: (ctx, px, py) => {
    const H = 2 * T
    r3(ctx, px, py, T, H, '#dce8f0', '#eaf4fc', '#b0c0cc')
    r(ctx, px + T / 2 - 5, py + H / 2 - 2, 10, 4, '#c03838')
    r(ctx, px + T / 2 - 2, py + H / 2 - 5, 4, 10, '#c03838')
    r3(ctx, px + 2, py + 2, T - 4, H / 2 - 3, '#e8f4fc', '#f0faff', '#c0d4dc')
    r3(ctx, px + 2, py + H / 2 + 1, T - 4, H / 2 - 3, '#e8f4fc', '#f0faff', '#c0d4dc')
    ol(ctx, px, py, T, H)
  },

  opBed: (ctx, px, py) => {
    const W = 2 * T, H = 2 * T
    // 받침 프레임 (금속)
    r3(ctx, px + 3, py, W - 6, H, '#7090a0', '#90aab8', '#506070')
    // 수술 상판 (밝은 은색)
    r3(ctx, px, py + 5, W, H - 10, '#c0ccd4', '#d8e8f0', '#8898a8')
    r(ctx, px + 2, py + 7, W - 4, 3, '#e0f0f8')   // 반사
    // 헤드 패드
    r3(ctx, px + 3, py + 6, W - 6, 8, C.BED, '#f0ede8', C.BEDD)
    ol(ctx, px, py + 5, W, H - 10, '#506070')
  },

  // ── DOORS ──────────────────────────────────────

  // 외문 (single swing door, 1×1) — 건축 도식 스타일
  doorS: (ctx, px, py) => {
    const S = T  // 24px
    // Opening void
    r(ctx, px, py, S, S, '#1a1814')
    // Door panel — thin bold line from bottom-left hinge to bottom-right
    ctx.strokeStyle = '#f0ece4'; ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(px + 1, py + S - 1)
    ctx.lineTo(px + S - 1, py + S - 1)
    ctx.stroke()
    // Swing arc — quarter circle from bottom-right to top-left
    ctx.strokeStyle = '#90a0b8'; ctx.lineWidth = 1
    ctx.setLineDash([3, 2])
    ctx.beginPath()
    ctx.arc(px + 1, py + S - 1, S - 2, -Math.PI / 2, 0)
    ctx.stroke()
    ctx.setLineDash([])
    // Hinge dot
    ctx.fillStyle = '#d0c898'
    ctx.beginPath(); ctx.arc(px + 1, py + S - 1, 2, 0, Math.PI * 2); ctx.fill()
    // Handle dot
    ctx.fillStyle = '#d0c898'
    ctx.beginPath(); ctx.arc(px + S - 3, py + S - 3, 1.5, 0, Math.PI * 2); ctx.fill()
  },

  // 양문 (double swing door, 2×1) — 건축 도식 스타일
  doorD: (ctx, px, py) => {
    const W = 2 * T, H = T
    // Opening void
    r(ctx, px, py, W, H, '#1a1814')
    // Left door panel (hinge at left, free end at center)
    ctx.strokeStyle = '#f0ece4'; ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(px + 1, py + H - 1)
    ctx.lineTo(px + W / 2, py + H - 1)
    ctx.stroke()
    // Right door panel (hinge at right, free end at center)
    ctx.beginPath()
    ctx.moveTo(px + W - 1, py + H - 1)
    ctx.lineTo(px + W / 2, py + H - 1)
    ctx.stroke()
    // Left swing arc
    ctx.strokeStyle = '#90a0b8'; ctx.lineWidth = 1
    ctx.setLineDash([3, 2])
    ctx.beginPath()
    ctx.arc(px + 1, py + H - 1, W / 2 - 1, -Math.PI / 2, 0)
    ctx.stroke()
    // Right swing arc
    ctx.beginPath()
    ctx.arc(px + W - 1, py + H - 1, W / 2 - 1, Math.PI, -Math.PI / 2)
    ctx.stroke()
    ctx.setLineDash([])
    // Center seam
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(px + W / 2, py + H - 1); ctx.lineTo(px + W / 2, py + H - 6)
    ctx.stroke()
    // Hinge & handle dots
    ctx.fillStyle = '#d0c898'
    ctx.beginPath(); ctx.arc(px + 1, py + H - 1, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(px + W - 1, py + H - 1, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(px + W / 2 - 3, py + H - 3, 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(px + W / 2 + 3, py + H - 3, 1.5, 0, Math.PI * 2); ctx.fill()
  },

  // 슬라이드문 (sliding door, 2×1) — 건축 도식 스타일
  doorSl: (ctx, px, py) => {
    const W = 2 * T, H = T
    // Opening void
    r(ctx, px, py, W, H, '#1a1814')
    // Front door panel (right half, slightly offset up for depth)
    ctx.strokeStyle = '#f0ece4'; ctx.lineWidth = 2.5
    ctx.strokeRect(px + W / 2 - 1, py + 2, W / 2 - 2, H - 4)
    // Back door panel (left half, slightly offset)
    ctx.strokeStyle = '#b0a898'; ctx.lineWidth = 1.5
    ctx.strokeRect(px + 2, py + 3, W / 2 - 2, H - 6)
    // Overlap line
    ctx.strokeStyle = '#606058'; ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(px + W / 2, py + 2); ctx.lineTo(px + W / 2, py + H - 2)
    ctx.stroke()
    ctx.setLineDash([])
    // Arrow indicator (slide direction →)
    ctx.strokeStyle = '#90a0b8'; ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px + 5, py + H / 2)
    ctx.lineTo(px + W / 2 - 5, py + H / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(px + W / 2 - 9, py + H / 2 - 3)
    ctx.lineTo(px + W / 2 - 5, py + H / 2)
    ctx.lineTo(px + W / 2 - 9, py + H / 2 + 3)
    ctx.stroke()
    // Handle dots
    ctx.fillStyle = '#d0c898'
    ctx.beginPath(); ctx.arc(px + W / 2 + 4, py + H / 2, 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(px + W / 2 - 4, py + H / 2, 1.5, 0, Math.PI * 2); ctx.fill()
  },
}

// ── Character drawing ──────────────────────────────────────────
function drawCharacter(ctx: Ctx, cx: number, cy: number, dir: Dir, frame: number) {
  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(cx + CHW / 2, cy + CHH - 1, 6, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Legs
  ctx.fillStyle = '#506090'
  if (dir === 'left' || dir === 'right') {
    ctx.fillRect(cx + 4, cy + 14 + (frame === 0 ? 2 : 0), 4, 7)
    ctx.fillRect(cx + 9, cy + 14 + (frame === 1 ? 2 : 0), 4, 7)
  } else {
    ctx.fillRect(cx + 3, cy + 14, 5, 6 + (frame === 0 ? 1 : 0))
    ctx.fillRect(cx + 9, cy + 14, 5, 6 + (frame === 1 ? 1 : 0))
  }

  // Body (shirt)
  ctx.fillStyle = '#a05048'
  ctx.fillRect(cx + 3, cy + 8, CHW - 6, 8)
  ctx.fillStyle = '#804038'
  ctx.fillRect(cx + 3, cy + 14, CHW - 6, 2)
  // Outline body
  ctx.strokeStyle = '#18100a'; ctx.lineWidth = 1
  ctx.strokeRect(cx + 3.5, cy + 8.5, CHW - 7, 7)

  // Arms (side view only)
  if (dir === 'down' || dir === 'up') {
    ctx.fillStyle = '#f0c890'
    ctx.fillRect(cx + 1, cy + 9, 2, 5)
    ctx.fillRect(cx + CHW - 3, cy + 9, 2, 5)
  }

  // Head
  ctx.fillStyle = '#f0c890'
  ctx.fillRect(cx + 3, cy + 1, CHW - 6, 9)

  // Hair
  ctx.fillStyle = '#2e1808'
  ctx.fillRect(cx + 3, cy + 1, CHW - 6, 4)
  if (dir === 'left') ctx.fillRect(cx + 3, cy + 1, 3, 9)
  else if (dir === 'right') ctx.fillRect(cx + CHW - 6, cy + 1, 3, 9)
  ctx.strokeStyle = '#18100a'
  ctx.strokeRect(cx + 3.5, cy + 1.5, CHW - 7, 8)

  // Eyes & mouth
  ctx.fillStyle = '#200e06'
  if (dir === 'down') {
    ctx.fillRect(cx + 5, cy + 6, 2, 2)
    ctx.fillRect(cx + CHW - 7, cy + 6, 2, 2)
    ctx.fillStyle = '#c07060'; ctx.fillRect(cx + 6, cy + 8, 4, 1)
  } else if (dir === 'left') {
    ctx.fillRect(cx + 4, cy + 6, 2, 2)
  } else if (dir === 'right') {
    ctx.fillRect(cx + CHW - 8, cy + 6, 2, 2)
  }
}

// ── Main Component ─────────────────────────────────────────────
interface MetaStudioProps {
  gameFlowSheet?: GameFlowSheet | null
  showEmbeddedSaveHistory?: boolean
}

export function MetaStudio({ gameFlowSheet, showEmbeddedSaveHistory = true }: MetaStudioProps = {}) {
  const { id: projectId } = useParams<{ id: string }>()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Save / History state ──
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    projectId ? loadHistory(projectId) : []
  )
  const [showHistory, setShowHistory] = useState(false)

  const [mode, setMode] = useState<Mode>('edit')
  const [tool, setTool] = useState<Tool | null>(null)
  const [eraseMode, setEraseMode] = useState(false)
  const [floorType, setFloorType] = useState(1)
  const [wallType, setWallType] = useState(5)
  const wallTypeRef = useRef(5)
  const [hoveredSwatch, setHoveredSwatch] = useState<string | null>(null)
  const [selItem, setSelItem] = useState<string | null>(null)
  const [selCat, setSelCat] = useState<Cat>('tables')
  const [selGroup, setSelGroup] = useState<'product' | 'lock' | 'mark'>('product')
  const [marks, setMarks] = useState<PMark[]>([])
  const marksRef = useRef<PMark[]>([])
  const [selMarkUid, setSelMarkUid] = useState<string | null>(null)
  const selMarkUidRef = useRef<string | null>(null)
  const [selMarkId, setSelMarkId] = useState<MarkId>('runPerson')
  const [shapeSides, setShapeSides] = useState(6)
  const [shapeColor, setShapeColor] = useState('#3b82f6')
  const [shapeFontSize, setShapeFontSize] = useState(13)
  const [numMarkColor, setNumMarkColor] = useState('#e8e020')
  const [numMarkFontSize, setNumMarkFontSize] = useState(22)
  type MarkAction =
    | { type: 'moving';   uid: string; sx: number; sy: number; ox: number; oy: number }
    | { type: 'resizing'; uid: string; corner: 'tl'|'tr'|'bl'|'br'; sx: number; sy: number; orig: PMark }
  const markActionRef = useRef<MarkAction | null>(null)
  const [doorType, setDoorType] = useState<DoorType>('doorS')
  const [rotation, setRotation] = useState<0|1|2|3>(0)
  const [flipped, setFlipped] = useState(false)
  const flippedRef = useRef(false)
  const [placedItems, setPlacedItems] = useState<PItem[]>([])
  const [selPlacedUid, setSelPlacedUid] = useState<string | null>(null)
  const selPlacedUidRef = useRef<string | null>(null)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [devItems, setDevItems] = useState<DevItem[]>([])
  const [devSubtype, setDevSubtype] = useState<DevType>('trigger')
  const [devLightColor, setDevLightColor] = useState<LightColor>('yellow')
  const [devTriggerType, setDevTriggerType] = useState<TriggerType>('button')
  const [devRules, setDevRules] = useState<DevRule[]>([])
  const [firedRules, setFiredRules] = useState<Set<string>>(new Set())
  const [buildingRule, setBuildingRule] = useState<BuildingRule | null>(null)
  const [canvasViewW, setCanvasViewW] = useState<number | null>(null)
  const [canvasViewH, setCanvasViewH] = useState(580)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [gridTheme, setGridTheme] = useState<'dark' | 'light'>('light')
  const [flowSketchSections, setFlowSketchSections] = useState<FlowSketchSection[]>([])
  const [flowSketchPins, setFlowSketchPins] = useState<FlowSketchPin[]>([])
  const [flowSketchArrows, setFlowSketchArrows] = useState<FlowSketchArrow[]>([])
  const [flowSketchVisible, setFlowSketchVisible] = useState(true)
  const gridThemeRef = useRef<'dark' | 'light'>('light')
  const rotRef = useRef<0|1|2|3>(0)
  const devRef = useRef<DevItem[]>([])
  const devRulesRef = useRef<DevRule[]>([])
  const firedRef = useRef<Set<string>>(new Set())
  const touchedInputUidsRef = useRef<Set<string>>(new Set())
  const dragRuleUidRef = useRef<string | null>(null)
  const [dragOverRuleUid, setDragOverRuleUid] = useState<string | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map())

  const tilesRef = useRef<number[][]>(
    Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
  )
  const placedRef = useRef<PItem[]>([])
  const charRef = useRef({ x: 200, y: 200, dir: 'down' as Dir, frame: 0, tick: 0 })
  const keysRef = useRef<Set<string>>(new Set())
  const paintingRef = useRef(false)
  const movingRef = useRef<string | null>(null)
  const animRef = useRef(0)

  function parseCellKey(key: string) {
    const [xs, ys] = key.split(',')
    return { x: Number(xs), y: Number(ys) }
  }

  const SKETCH_DEFAULT_MAP_BOXES = [
    { x: 2, y: 3, w: 12, h: 11 },
    { x: 15, y: 2, w: 13, h: 12 },
    { x: 29, y: 3, w: 12, h: 11 },
    { x: 2, y: 18, w: 20, h: 13 },
    { x: 24, y: 18, w: 22, h: 13 },
  ]

  function getSectionCellSet(section: GameFlowSection, index: number): Set<string> {
    if (section.mapCells && section.mapCells.length > 0) return new Set(section.mapCells)
    const box = section.mapBox ?? SKETCH_DEFAULT_MAP_BOXES[index % SKETCH_DEFAULT_MAP_BOXES.length]
    if (!box) return new Set<string>()
    const set = new Set<string>()
    const bx = Math.max(0, Math.min(COLS - 1, box.x))
    const by = Math.max(0, Math.min(ROWS - 1, box.y))
    const bw = Math.max(1, Math.min(COLS - bx, box.w))
    const bh = Math.max(1, Math.min(ROWS - by, box.h))
    for (let x = bx; x < bx + bw; x += 1) {
      for (let y = by; y < by + bh; y += 1) set.add(`${x},${y}`)
    }
    return set
  }

  function getSectionCenter(cells: Set<string>) {
    if (cells.size === 0) return { x: 0, y: 0 }
    let sx = 0
    let sy = 0
    cells.forEach(k => {
      const p = parseCellKey(k)
      sx += p.x + 0.5
      sy += p.y + 0.5
    })
    return { x: sx / cells.size, y: sy / cells.size }
  }

  function getArrowDirection(from: { x: number; y: number }, to: { x: number; y: number }): FlowArrowDirection {
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west'
    return dy >= 0 ? 'south' : 'north'
  }

  function getArrowGlyph(dir: FlowArrowDirection) {
    if (dir === 'east') return '→'
    if (dir === 'west') return '←'
    if (dir === 'south') return '↓'
    return '↑'
  }

  function getStepGroupId(step: GameStep) {
    return step.stepGroup ?? step.id
  }

  function buildFlowSketchSections(sheet: GameFlowSheet): FlowSketchSection[] {
    return sheet.sections.map((section, index) => {
      const cells: Array<{ x: number; y: number }> = []
      const set = getSectionCellSet(section, index)
      set.forEach(key => {
        const p = parseCellKey(key)
        if (Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS) {
          cells.push({ x: p.x, y: p.y })
        }
      })
      return {
        id: section.id,
        title: section.title,
        alpha: getSectionAlphaLabel(index),
        color: FLOW_SKETCH_COLORS[index % FLOW_SKETCH_COLORS.length],
        cells,
      }
    }).filter(section => section.cells.length > 0)
  }

  function buildFlowSketchPins(sheet: GameFlowSheet): FlowSketchPin[] {
    const pins: FlowSketchPin[] = []
    sheet.sections.forEach((section, sectionIndex) => {
      let localIndex = 0
      for (let i = 0; i < section.steps.length;) {
        const first = section.steps[i]
        const groupId = getStepGroupId(first)
        let j = i + 1
        while (j < section.steps.length && getStepGroupId(section.steps[j]) === groupId) j += 1
        const group = section.steps.slice(i, j)
        const pinSource = group.find(step => step.pinX !== undefined && step.pinY !== undefined) ?? group[0]
        localIndex += 1
        if (pinSource.pinX !== undefined && pinSource.pinY !== undefined) {
          pins.push({
            x: (pinSource.pinX / 100) * COLS,
            y: (pinSource.pinY / 100) * ROWS,
            label: String(localIndex),
            color: FLOW_SKETCH_COLORS[sectionIndex % FLOW_SKETCH_COLORS.length],
          })
        }
        i = j
      }
    })
    return pins
  }

  function buildFlowSketchArrows(sheet: GameFlowSheet): FlowSketchArrow[] {
    const arrows: FlowSketchArrow[] = []
    for (let i = 0; i < sheet.sections.length - 1; i += 1) {
      const current = sheet.sections[i]
      const next = sheet.sections[i + 1]
      const currentCells = getSectionCellSet(current, i)
      const nextCells = getSectionCellSet(next, i + 1)
      const nextCenter = getSectionCenter(nextCells)
      currentCells.forEach(key => {
        if (!nextCells.has(key)) return
        const p = parseCellKey(key)
        arrows.push({
          x: p.x + 0.5,
          y: p.y + 0.5,
          direction: getArrowDirection({ x: p.x + 0.5, y: p.y + 0.5 }, nextCenter),
          color: FLOW_SKETCH_COLORS[i % FLOW_SKETCH_COLORS.length],
        })
      })
    }
    return arrows
  }

  function applyGameFlowSketchOverlay(): boolean {
    let sheet = gameFlowSheet ?? null
    if (!sheet && projectId) {
      const project = getProjects().find(p => p.id === projectId)
      const latestVersion = project?.versions[project.versions.length - 1]
      sheet = latestVersion?.gameFlow ?? null
    }
    if (!sheet) return false
    setFlowSketchSections(buildFlowSketchSections(sheet))
    setFlowSketchPins(buildFlowSketchPins(sheet))
    setFlowSketchArrows(buildFlowSketchArrows(sheet))
    return true
  }

  function toggleFlowSketch() {
    if (flowSketchVisible) {
      setFlowSketchVisible(false)
      return
    }
    const ok = applyGameFlowSketchOverlay()
    if (ok) setFlowSketchVisible(true)
  }

  useEffect(() => { placedRef.current = placedItems }, [placedItems])
  useEffect(() => { wallTypeRef.current = wallType }, [wallType])
  useEffect(() => { selPlacedUidRef.current = selPlacedUid }, [selPlacedUid])
  useEffect(() => { rotRef.current = rotation }, [rotation])
  useEffect(() => { flippedRef.current = flipped }, [flipped])
  useEffect(() => { marksRef.current = marks }, [marks])
  useEffect(() => { selMarkUidRef.current = selMarkUid }, [selMarkUid])
  useEffect(() => { gridThemeRef.current = gridTheme }, [gridTheme])
  useEffect(() => { devRef.current = devItems }, [devItems])
  useEffect(() => { devRulesRef.current = devRules }, [devRules])
  useEffect(() => { firedRef.current = firedRules }, [firedRules])

  useEffect(() => {
    if (!flowSketchVisible) return
    applyGameFlowSketchOverlay()
  }, [flowSketchVisible, gameFlowSheet, projectId])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const dx = e.clientX - resizeStartRef.current.x
      const dy = e.clientY - resizeStartRef.current.y
      const newW = Math.max(240, resizeStartRef.current.w + dx)
      // Below 760px threshold: reset to flex:1 (canvas fills available space, palette stays to the right)
      setCanvasViewW(newW > 760 ? newW : null)
      setCanvasViewH(Math.max(160, resizeStartRef.current.h + dy))
    }
    function onUp() {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Load saved map on mount ──
  useEffect(() => {
    if (!projectId) return
    const snap = loadMapSnapshot(projectId)
    if (!snap) return
    tilesRef.current = snap.tiles
    setPlacedItems(snap.placedItems)
    setMarks(snap.marks)
    setDevItems(snap.devItems)
    setDevRules(snap.devRules)
    setGridTheme(snap.gridTheme)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── Save handler ──
  function handleSave() {
    if (!projectId) return
    const snap: MapSnapshot = {
      tiles: tilesRef.current.map(row => [...row]),
      placedItems,
      marks,
      devItems,
      devRules,
      gridTheme,
    }
    const next = persistSnapshot(projectId, snap, history)
    setHistory(next)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1800)
  }

  // ── Restore from history ──
  function handleRestore(entry: HistoryEntry) {
    const snap = entry.snapshot
    tilesRef.current = snap.tiles
    setPlacedItems(snap.placedItems)
    setMarks(snap.marks)
    setDevItems(snap.devItems)
    setDevRules(snap.devRules)
    setGridTheme(snap.gridTheme)
    setShowHistory(false)
  }

  function fireDevRules(inputUid: string) {
    const currentDevs = devRef.current
    const rules = devRulesRef.current.filter(r => r.inputUids.includes(inputUid))
    if (rules.length === 0) return
    // AND logic: only fire rules where all other inputs are already active
    const activeRules = rules.filter(r =>
      r.inputUids.every(uid => uid === inputUid || (currentDevs.find(d => d.uid === uid)?.active ?? false))
    )
    if (activeRules.length === 0) return

    for (const rule of activeRules) {
      const allOutputsOn = rule.outputUids.every(uid => currentDevs.find(d => d.uid === uid)?.active ?? false)

      if (allOutputsOn) {
        // RESET: all outputs → OFF immediately
        setDevItems(prev => prev.map(d => {
          if (!rule.outputUids.includes(d.uid)) return d
          if (d.type === 'video') {
            const el = videoEls.current.get(d.uid)
            if (el) { el.pause(); el.currentTime = 0 }
          }
          return { ...d, active: false }
        }))
      } else {
        // FIRE: each output → ON after its configured delay
        for (const outputUid of rule.outputUids) {
          const delayMs = ((rule.outputDelays?.[outputUid] ?? 0)) * 1000
          const applyOn = () => setDevItems(prev => prev.map(d => {
            if (d.uid !== outputUid) return d
            if (d.type === 'sound' && d.audioUrl && !d.active) new Audio(d.audioUrl).play().catch(() => {})
            if (d.type === 'video' && d.videoUrl && !d.active) {
              const el = videoEls.current.get(d.uid)
              if (el) { el.currentTime = 0; el.play().catch(() => {}) }
            }
            return { ...d, active: true }
          }))
          if (delayMs <= 0) applyOn()
          else setTimeout(applyOn, delayMs)
        }
      }

      // Flash animation
      setFiredRules(prev => new Set([...prev, rule.uid]))
      setTimeout(() => setFiredRules(prev => { const n = new Set(prev); n.delete(rule.uid); return n }), 700)
    }
  }

  // R key → rotate, F key → flip in edit mode
  useEffect(() => {
    if (mode !== 'edit') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEraseMode(false)
      if ((e.key === 'r' || e.key === 'R') && tool === 'place') {
        setRotation(r => ((r + 1) % 4) as 0|1|2|3)
      }
      if ((e.key === 'f' || e.key === 'F') && tool === 'place') {
        setFlipped(f => !f)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, tool])

  useEffect(() => {
    if (mode === 'play') setEraseMode(false)
  }, [mode])

  // ── Render ──
  const renderAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Tiles
    const isLightGrid = gridThemeRef.current === 'light'
    for (let gy = 0; gy < ROWS; gy++)
      for (let gx = 0; gx < COLS; gx++)
        drawTile(ctx, gx, gy, tilesRef.current[gy][gx], isLightGrid)

    // Game Flow sketch overlay (preview)
    if (flowSketchVisible && flowSketchSections.length > 0) {
      for (const section of flowSketchSections) {
        ctx.save()
        ctx.fillStyle = `${section.color}22`
        ctx.strokeStyle = `${section.color}aa`
        ctx.lineWidth = 1
        for (const c of section.cells) {
          const px = c.x * TILE
          const py = c.y * TILE
          ctx.fillRect(px, py, TILE, TILE)
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1)
        }
        let labelX = Number.MAX_SAFE_INTEGER
        let labelY = Number.MAX_SAFE_INTEGER
        for (const c of section.cells) {
          if (c.y < labelY || (c.y === labelY && c.x < labelX)) {
            labelX = c.x
            labelY = c.y
          }
        }
        if (labelX !== Number.MAX_SAFE_INTEGER) {
          ctx.fillStyle = section.color
          ctx.font = 'bold 11px ui-sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(section.alpha, labelX * TILE + 4, labelY * TILE + 3)
        }
        ctx.restore()
      }
      if (flowSketchArrows.length > 0) {
        for (const arrow of flowSketchArrows) {
          ctx.save()
          ctx.fillStyle = arrow.color
          ctx.font = 'bold 14px ui-sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.shadowColor = `${arrow.color}99`
          ctx.shadowBlur = 6
          ctx.fillText(getArrowGlyph(arrow.direction), arrow.x * TILE, arrow.y * TILE)
          ctx.restore()
        }
      }
      if (flowSketchPins.length > 0) {
        for (const pin of flowSketchPins) {
          const px = pin.x * TILE
          const py = pin.y * TILE
          ctx.save()
          ctx.fillStyle = `${pin.color}2e`
          ctx.strokeStyle = pin.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(px, py, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = pin.color
          ctx.font = 'bold 10px ui-sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(pin.label, px, py)
          ctx.restore()
        }
      }
    }

    // Items sorted by y (simple depth)
    const sorted = [...placedRef.current].sort((a, b) => a.y - b.y)
    // Active EML doors set
    const activeEMLDoors = new Set(
      devRef.current.filter(d => d.type === 'eml' && d.active && d.linkedDoorUid).map(d => d.linkedDoorUid!)
    )
    for (const pi of sorted) {
      const item = ITEMS.find(i => i.id === pi.itemId)
      if (item) drawItemRot(ctx, pi.x * TILE, pi.y * TILE, item, pi.rot, pi.flip)
      // EML door open overlay
      if (item?.cat === 'door' && activeEMLDoors.has(pi.uid)) {
        drawEMLOpenOverlay(ctx, pi.x * TILE, pi.y * TILE, item, pi.rot)
      }
      // Selected item highlight
      if (pi.uid === selPlacedUidRef.current && item) {
        const { w: ew, h: eh } = effDims(item, pi.rot)
        ctx.save()
        ctx.strokeStyle = '#4af'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.strokeRect(pi.x * TILE + 1, pi.y * TILE + 1, ew * TILE - 2, eh * TILE - 2)
        ctx.setLineDash([])
        ctx.restore()
      }
    }

    // Dev items overlay (lights, sounds, buttons)
    for (const dev of devRef.current) {
      const px = dev.x * TILE, py = dev.y * TILE
      if (dev.type === 'light') drawDevLight(ctx, px, py, dev.lightColor ?? 'yellow', dev.active)
      else if (dev.type === 'sound') drawDevSound(ctx, px, py, dev.active)
      else if (dev.type === 'video') drawDevVideo(ctx, px, py, dev.active)
      else if (dev.type === 'trigger') drawDevTrigger(ctx, px, py, dev.triggerType ?? 'button', dev.active)
    }

    // Connection lines (dev mode only)
    if (tool === 'dev' || mode === 'play') {
      drawConnectionLines(ctx, devRef.current, devRulesRef.current, firedRef.current)
    }

    // Crime scene marks
    for (const m of marksRef.current) {
      drawMark(ctx, m.markId, m.x, m.y, m.w, m.h, m.sides, m.color, m.label, m.fontSize)
      drawMarkHandles(ctx, m, m.uid === selMarkUidRef.current)
    }

    // Hover previews (edit mode)
    if (mode === 'edit' && hoverCell) {
      if (eraseMode) {
        ctx.fillStyle = 'rgba(255,60,60,0.3)'
        ctx.fillRect(hoverCell.x * TILE, hoverCell.y * TILE, TILE, TILE)
      } else if (tool === 'door') {
        const item = ITEMS.find(i => i.id === doorType)
        if (item) {
          const rot = rotRef.current
          const { w: ew, h: eh } = effDims(item, rot)
          const tiles = tilesRef.current
          const canPlace = [-1, 0, 1, 0].some((dx, i) => {
            const dy = [0, -1, 0, 1][i]
            return (tiles[hoverCell.y + dy]?.[hoverCell.x + dx] ?? 0) === 5
          })
          ctx.save(); ctx.globalAlpha = 0.5
          drawItemRot(ctx, hoverCell.x * TILE, hoverCell.y * TILE, item, rot, flippedRef.current)
          ctx.restore()
          if (!canPlace) {
            ctx.save(); ctx.globalAlpha = 0.25
            ctx.fillStyle = '#ff3333'
            ctx.fillRect(hoverCell.x * TILE, hoverCell.y * TILE, ew * TILE, eh * TILE)
            ctx.restore()
          }
          if (rot !== 0) {
            ctx.save(); ctx.fillStyle = 'rgba(120,200,255,0.85)'; ctx.font = 'bold 9px monospace'
            ctx.fillText(`${rot * 90}°`, hoverCell.x * TILE + 2, hoverCell.y * TILE + 10)
            ctx.restore()
          }
        }
      } else if (tool === 'place' && selItem) {
        const item = ITEMS.find(i => i.id === selItem)
        if (item) {
          const rot = rotRef.current
          const isDoor = item.cat === 'door'
          const { w: ew, h: eh } = effDims(item, rot)
          // Door adjacency check — tint red if invalid
          let canPlace = true
          if (isDoor) {
            const tiles = tilesRef.current
            canPlace = [-1,0,1,0].some((dx, i) => {
              const dy = [0,-1,0,1][i]
              return (tiles[hoverCell.y + dy]?.[hoverCell.x + dx] ?? 0) === 5
            })
          }
          ctx.save()
          ctx.globalAlpha = 0.5
          if (!canPlace) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.35 }
          drawItemRot(ctx, hoverCell.x * TILE, hoverCell.y * TILE, item, rot, flippedRef.current)
          ctx.restore()
          // Red tint overlay when invalid
          if (isDoor && !canPlace) {
            ctx.save(); ctx.globalAlpha = 0.25
            ctx.fillStyle = '#ff3333'
            ctx.fillRect(hoverCell.x * TILE, hoverCell.y * TILE, ew * TILE, eh * TILE)
            ctx.restore()
          }
          // Rotation indicator
          if (rot !== 0) {
            ctx.save()
            ctx.fillStyle = 'rgba(120,200,255,0.85)'
            ctx.font = 'bold 9px monospace'
            ctx.fillText(`${rot * 90}°`, hoverCell.x * TILE + 2, hoverCell.y * TILE + 10)
            ctx.restore()
          }
        }
      } else if (tool && tool !== 'place' && tool !== 'move') {
        ctx.fillStyle = eraseMode ? 'rgba(255,60,60,0.3)' : 'rgba(255,255,255,0.18)'
        ctx.fillRect(hoverCell.x * TILE, hoverCell.y * TILE, TILE, TILE)
      }
    }

    // Character (play mode)
    if (mode === 'play') {
      const { x, y, dir, frame } = charRef.current
      drawCharacter(ctx, x, y, dir, frame)
    }
  }, [mode, tool, selItem, doorType, hoverCell, rotation, devItems, devRules, firedRules, eraseMode, flowSketchVisible, flowSketchSections, flowSketchPins, flowSketchArrows])

  // ── Game loop (play mode) ──
  useEffect(() => {
    if (mode !== 'play') {
      renderAll()
      return
    }
    canvasRef.current?.focus()

    function canWalk(px: number, py: number): boolean {
      const corners = [
        [px + 2, py + 14], [px + CHW - 2, py + 14],
        [px + 2, py + CHH - 2], [px + CHW - 2, py + CHH - 2],
      ]
      for (const [cx, cy] of corners) {
        const gx = Math.floor(cx / TILE)
        const gy = Math.floor(cy / TILE)
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return false
        const t = tilesRef.current[gy][gx]
        if (t === 0 || t === 5) return false
        for (const pi of placedRef.current) {
          const item = ITEMS.find(i => i.id === pi.itemId)
          if (!item || item.cat === 'door') continue  // doors are passable
          const { w: ew, h: eh } = effDims(item, pi.rot)
          if (cx >= pi.x * TILE && cx < (pi.x + ew) * TILE &&
            cy >= pi.y * TILE && cy < (pi.y + eh) * TILE) return false
        }
      }
      return true
    }

    function getTouchedInputUids(px: number, py: number) {
      const charLeft = px + 2
      const charTop = py + 14
      const charRight = px + CHW - 2
      const charBottom = py + CHH - 2
      const touched = new Set<string>()

      for (const dev of devRef.current) {
        if (dev.type !== 'trigger' && dev.type !== 'eml') continue

        let left = dev.x * TILE
        let top = dev.y * TILE
        let width = TILE
        let height = TILE

        if (dev.type === 'eml' && dev.linkedDoorUid) {
          const door = placedRef.current.find(pi => pi.uid === dev.linkedDoorUid)
          const doorItem = door ? ITEMS.find(i => i.id === door.itemId) : null
          if (door && doorItem) {
            const dims = effDims(doorItem, door.rot)
            left = door.x * TILE
            top = door.y * TILE
            width = dims.w * TILE
            height = dims.h * TILE
          }
        }

        const overlaps = charLeft < left + width &&
          charRight > left &&
          charTop < top + height &&
          charBottom > top

        if (overlaps) touched.add(dev.uid)
      }

      return touched
    }

    function syncPlayInputs(px: number, py: number) {
      const touched = getTouchedInputUids(px, py)
      const prevTouched = touchedInputUidsRef.current

      if (touched.size === prevTouched.size && [...touched].every(uid => prevTouched.has(uid))) return

      touchedInputUidsRef.current = touched
      setDevItems(prev => prev.map(dev => {
        if (dev.type !== 'trigger' && dev.type !== 'eml') return dev
        return { ...dev, active: touched.has(dev.uid) }
      }))

      for (const uid of touched) {
        if (!prevTouched.has(uid)) fireDevRules(uid)
      }
    }

    function update() {
      const char = charRef.current
      const keys = keysRef.current
      let dx = 0, dy = 0
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) { dy = -SPD; char.dir = 'up' }
      else if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) { dy = SPD; char.dir = 'down' }
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) { dx = -SPD; char.dir = 'left' }
      else if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) { dx = SPD; char.dir = 'right' }

      if (dx !== 0 || dy !== 0) {
        const nx = Math.max(0, Math.min(W - CHW, char.x + dx))
        const ny = Math.max(0, Math.min(H - CHH, char.y + dy))
        if (canWalk(nx, char.y)) char.x = nx
        if (canWalk(char.x, ny)) char.y = ny
        char.tick++
        if (char.tick >= FRAME_TICKS) { char.tick = 0; char.frame = 1 - char.frame }
      } else { char.frame = 0; char.tick = 0 }

      syncPlayInputs(char.x, char.y)
    }

    function loop() {
      update(); renderAll()
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animRef.current)
      touchedInputUidsRef.current = new Set()
      setDevItems(prev => prev.map(dev =>
        dev.type === 'trigger' || dev.type === 'eml'
          ? { ...dev, active: false }
          : dev
      ))
    }
  }, [mode, renderAll])

  useEffect(() => {
    if (mode !== 'play') return
    const onDown = (e: KeyboardEvent) => { keysRef.current.add(e.key); e.preventDefault() }
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [mode])

  useEffect(() => { if (mode === 'edit') renderAll() }, [mode, renderAll, hoverCell, placedItems, gridTheme, marks, selMarkUid, selPlacedUid])

  // ── Mouse ──
  function getCell(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const gx = Math.floor((e.clientX - rect.left) / (TILE * canvasZoom))
    const gy = Math.floor((e.clientY - rect.top) / (TILE * canvasZoom))
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return null
    return { x: gx, y: gy }
  }

  function applyTile(gx: number, gy: number) {
    if (tool === 'door') return
    const rows = tilesRef.current.map(row => [...row])
    rows[gy][gx] = eraseMode ? 0 : tool === 'wall' ? wallTypeRef.current : floorType
    tilesRef.current = rows
    renderAll()
  }

  function placeDoor(cell: { x: number; y: number }) {
    const tiles = tilesRef.current
    const adjacent = [-1, 0, 1, 0].some((dx, i) => {
      const dy = [0, -1, 0, 1][i]
      return (tiles[cell.y + dy]?.[cell.x + dx] ?? 0) === 5
    })
    if (!adjacent) return
    const rot = rotRef.current
    const item = ITEMS.find(i => i.id === doorType)
    if (!item) return
    const { w: ew, h: eh } = effDims(item, rot)
    if (cell.x + ew <= COLS && cell.y + eh <= ROWS)
      setPlacedItems(prev => [...prev, { uid: crypto.randomUUID(), itemId: doorType, x: cell.x, y: cell.y, rot, flip: flippedRef.current }])
  }

  function getPixelPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / canvasZoom, y: (e.clientY - rect.top) / canvasZoom }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode === 'play') return

    // ── Mark mode ── (map-editing tools take priority)
    if (selGroup === 'mark' && tool !== null && tool !== 'floor' && tool !== 'wall' && tool !== 'door' && tool !== 'dev' && !eraseMode) {
      const { x: px, y: py } = getPixelPos(e)
      const cur = selMarkUidRef.current
      // Check resize handle first (on selected mark)
      if (cur) {
        const m = marksRef.current.find(m => m.uid === cur)
        if (m) {
          const corner = getMarkHandleAt(m, px, py)
          if (corner) {
            markActionRef.current = { type: 'resizing', uid: cur, corner, sx: px, sy: py, orig: { ...m } }
            return
          }
        }
      }
      // Check if clicking inside any mark → select & start move
      const hit = [...marksRef.current].reverse().find(m =>
        px >= m.x && px < m.x + m.w && py >= m.y && py < m.y + m.h)
      if (hit) {
        setSelMarkUid(hit.uid)
        markActionRef.current = { type: 'moving', uid: hit.uid, sx: px, sy: py, ox: hit.x, oy: hit.y }
        return
      }
      // Click on empty space → place new mark
      const defSize = TILE * 3
      const uid = crypto.randomUUID()
      const newMark: PMark = {
        uid, markId: selMarkId,
        x: px - defSize / 2, y: py - defSize / 2, w: defSize, h: defSize,
        ...(selMarkId === 'polygon' ? { sides: shapeSides, color: shapeColor, label: String(shapeSides), fontSize: shapeFontSize } : {}),
        ...(selMarkId === 'numMark' ? (() => {
          const existing = marksRef.current.filter(m => m.markId === 'numMark')
          const nextNum = existing.length + 1
          return { color: numMarkColor, fontSize: numMarkFontSize, label: String(nextNum) }
        })() : {}),
      }
      setMarks(prev => [...prev, newMark])
      setSelMarkUid(uid)
      return
    }

    const cell = getCell(e)
    if (!cell) return
    const { x: px, y: py } = getPixelPos(e)

    if (eraseMode) {
      paintingRef.current = true
      eraseAt(cell, px, py)
      return
    }

    if (!tool) return

    if (tool === 'dev') {
      if (devSubtype === 'eml') {
        // Click on a placed door to link EML
        const door = [...placedItems].reverse().find(pi => {
          const item = ITEMS.find(i => i.id === pi.itemId)
          if (!item || item.cat !== 'door') return false
          const { w: ew, h: eh } = effDims(item, pi.rot)
          return cell.x >= pi.x && cell.x < pi.x + ew && cell.y >= pi.y && cell.y < pi.y + eh
        })
        if (!door) return
        // If already has EML, toggle and fire rules
        const existing = devRef.current.find(d => d.type === 'eml' && d.linkedDoorUid === door.uid)
        if (existing) {
          const newActive = !existing.active
          setDevItems(prev => prev.map(d => d.uid === existing.uid ? { ...d, active: newActive } : d))
          if (newActive) fireDevRules(existing.uid)
        } else {
          const doorItem = ITEMS.find(i => i.id === door.itemId)
          setDevItems(prev => [...prev, {
            uid: crypto.randomUUID(), type: 'eml',
            x: door.x, y: door.y,
            name: `EML-${doorItem?.name ?? '문'}`,
            active: false, linkedDoorUid: door.uid,
          }])
        }
      } else if (devSubtype === 'trigger') {
        // Click existing trigger → fire its rules; click empty → place trigger
        const existingTrig = devRef.current.find(d => d.type === 'trigger' && d.x === cell.x && d.y === cell.y)
        if (existingTrig) {
          const newActive = !existingTrig.active
          setDevItems(prev => prev.map(d => d.uid === existingTrig.uid ? { ...d, active: newActive } : d))
          fireDevRules(existingTrig.uid)
        } else {
          const ttype = devTriggerType
          const n = devRef.current.filter(d => d.type === 'trigger' && d.triggerType === ttype).length + 1
          const label = TRIGGER_TYPES[ttype].label
          setDevItems(prev => [...prev, {
            uid: crypto.randomUUID(), type: 'trigger',
            x: cell.x, y: cell.y,
            name: `${label}-${n}`, active: false,
            triggerType: ttype,
          }])
        }
      } else if (devSubtype === 'light') {
        setDevItems(prev => [...prev, {
          uid: crypto.randomUUID(), type: 'light',
          x: cell.x, y: cell.y,
          name: `조명-${LIGHT_COLORS[devLightColor].label}`,
          active: false, lightColor: devLightColor,
        }])
      } else if (devSubtype === 'sound') {
        setDevItems(prev => [...prev, {
          uid: crypto.randomUUID(), type: 'sound',
          x: cell.x, y: cell.y,
          name: `효과음-${prev.filter(d => d.type === 'sound').length + 1}`,
          active: false,
        }])
      } else if (devSubtype === 'video') {
        setDevItems(prev => [...prev, {
          uid: crypto.randomUUID(), type: 'video',
          x: cell.x, y: cell.y,
          name: `영상-${prev.filter(d => d.type === 'video').length + 1}`,
          active: false,
        }])
      }
      return
    }

    if (tool === 'door') { placeDoor(cell); return }

    if (tool === 'place' && selItem) {
      const item = ITEMS.find(i => i.id === selItem)
      if (item) {
        const rot = rotRef.current
        const { w: ew, h: eh } = effDims(item, rot)
        if (cell.x + ew <= COLS && cell.y + eh <= ROWS)
          setPlacedItems(prev => [...prev, { uid: crypto.randomUUID(), itemId: selItem, x: cell.x, y: cell.y, rot, flip: flippedRef.current }])
      }
      return
    }
    if (tool === 'move') {
      const found = [...placedItems].reverse().find(pi => {
        const item = ITEMS.find(i => i.id === pi.itemId)
        return item && cell.x >= pi.x && cell.x < pi.x + item.w && cell.y >= pi.y && cell.y < pi.y + item.h
      })
      if (found) {
        movingRef.current = found.uid
        setSelPlacedUid(found.uid)
        selPlacedUidRef.current = found.uid
      } else {
        setSelPlacedUid(null)
        selPlacedUidRef.current = null
      }
      return
    }
    paintingRef.current = true
    applyTile(cell.x, cell.y)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mode === 'play') return

    // Mark drag
    if (markActionRef.current) {
      const { x: px, y: py } = getPixelPos(e)
      const act = markActionRef.current
      if (act.type === 'moving') {
        const dx = px - act.sx, dy = py - act.sy
        setMarks(prev => prev.map(m => m.uid === act.uid ? { ...m, x: act.ox + dx, y: act.oy + dy } : m))
      } else if (act.type === 'resizing') {
        const { orig, corner, sx, sy } = act
        const dx = px - sx, dy = py - sy
        const MIN = TILE
        let { x, y, w, h } = orig
        if (corner === 'tl')      { x = orig.x + dx; y = orig.y + dy; w = orig.w - dx; h = orig.h - dy }
        else if (corner === 'tr') { y = orig.y + dy; w = orig.w + dx; h = orig.h - dy }
        else if (corner === 'bl') { x = orig.x + dx; w = orig.w - dx; h = orig.h + dy }
        else                      { w = orig.w + dx; h = orig.h + dy }
        if (w < MIN) { if (corner === 'tl' || corner === 'bl') x = orig.x + orig.w - MIN; w = MIN }
        if (h < MIN) { if (corner === 'tl' || corner === 'tr') y = orig.y + orig.h - MIN; h = MIN }
        setMarks(prev => prev.map(m => m.uid === act.uid ? { ...m, x, y, w, h } : m))
      }
      return
    }

    const cell = getCell(e)
    setHoverCell(cell)
    if (paintingRef.current && eraseMode && cell) {
      const { x: px, y: py } = getPixelPos(e)
      eraseAt(cell, px, py)
      return
    }
    if (paintingRef.current && cell && (tool === 'floor' || tool === 'wall')) applyTile(cell.x, cell.y)
    if (movingRef.current && cell)
      setPlacedItems(prev => prev.map(pi => pi.uid === movingRef.current ? { ...pi, x: cell.x, y: cell.y } : pi))
  }

  function handleMouseUp() {
    markActionRef.current = null
    paintingRef.current = false
    movingRef.current = null
  }

  // ── UI ──
  const catItems = selGroup === 'lock'
    ? ITEMS.filter(i => i.cat === 'lock')
    : ITEMS.filter(i => i.cat === selCat)
  const CAT_LABELS: Partial<Record<Cat, ReactNode>> = {
    storage: <><FurnCabinetIcon width={11} height={11} /> Storage</>,
    tables: <><FurnDeskIcon width={11} height={11} /> Tables</>,
    chairs: <><FurnChairIcon width={11} height={11} /> Chairs</>,
    appliances: <><FurnTvIcon width={11} height={11} /> Appliances</>,
    decor: <><FurnPlantIcon width={11} height={11} /> Decor</>,
    bathroom: <><FurnSinkIcon width={11} height={11} /> Bathroom</>,
    kitchen: <><FurnFridgeIcon width={11} height={11} /> Kitchen</>,
    lock: <><LockIcon width={11} height={11} /> Lock</>,
  }
  const ITEM_ICONS: Record<string, ReactNode> = {
    wardrobeD: <FurnWardrobeIcon width={18} height={18} />,
    steelCab: <FurnCabinetIcon width={18} height={18} />,
    vanitySink: <FurnSinkIcon width={18} height={18} />,
    bookshelf: <FurnShelfIcon width={18} height={18} />,
    fridge: <FurnFridgeIcon width={18} height={18} />,
    washer: <FurnFridgeIcon width={18} height={18} />,
    wallClock: <FurnClockIcon width={18} height={18} />,
    hangDress: <FurnItemIcon width={18} height={18} />,
    itemShoes: <FurnItemIcon width={18} height={18} />,
    itemBag: <FurnItemIcon width={18} height={18} />,
    itemBackpack: <FurnItemIcon width={18} height={18} />,
    itemGlasses: <FurnItemIcon width={18} height={18} />,
    itemBook: <FurnItemIcon width={18} height={18} />,
    itemNote: <FurnItemIcon width={18} height={18} />,
    itemPencil: <FurnItemIcon width={18} height={18} />,
    easel: <FurnBoardIcon width={18} height={18} />,
    bed: <FurnBedIcon width={18} height={18} />,
    sofa: <FurnSofaIcon width={18} height={18} />,
    wardrobe: <FurnWardrobeIcon width={18} height={18} />,
    dresser: <FurnDresserIcon width={18} height={18} />,
    plant: <FurnPlantIcon width={18} height={18} />,
    tv: <FurnTvIcon width={18} height={18} />,
    lamp: <FurnLampIcon width={18} height={18} />,
    oDesk: <FurnDeskIcon width={18} height={18} />,
    cabinet: <FurnCabinetIcon width={18} height={18} />,
    printer: <FurnPrinterIcon width={18} height={18} />,
    cTable: <FurnDeskIcon width={18} height={18} />,
    shelf: <FurnShelfIcon width={18} height={18} />,
    sDesk: <FurnDeskIcon width={18} height={18} />,
    sDeskOnly: <FurnDeskIcon width={18} height={18} />,
    computerDesk: <FurnDeskIcon width={18} height={18} />,
    readingDesk: <FurnDeskIcon width={18} height={18} />,
    sChair: <FurnChairIcon width={18} height={18} />,
    chairFront: <FurnChairIcon width={18} height={18} />,
    chairLeft: <FurnChairIcon width={18} height={18} />,
    chairBack: <FurnChairIcon width={18} height={18} />,
    tDesk: <FurnDeskIcon width={18} height={18} />,
    board: <FurnBoardIcon width={18} height={18} />,
    locker: <FurnLockerIcon width={18} height={18} />,
    lockKey: <LockIcon width={18} height={18} />,
    lockDir: <MoveArrowsIcon width={18} height={18} />,
    lockNum: <HashIcon width={18} height={18} />,
    lockAlpha: <FurnItemIcon width={18} height={18} />,
    lockPad: <ButtonPressIcon width={18} height={18} />,
    keyItem: <KeyTriggerIcon width={18} height={18} />,
    magnifier: <SearchIcon width={18} height={18} />,
    telephone: <FurnPhoneIcon width={18} height={18} />,
    mobilePhone: <FurnPhoneIcon width={18} height={18} />,
    videoCam: <FurnCamIcon width={18} height={18} />,
    projector: <FilmIcon width={18} height={18} />,
    headset: <MusicNoteIcon width={18} height={18} />,
    monitor: <FurnTvIcon width={18} height={18} />,
    toilet: <FurnToiletIcon width={18} height={18} />,
    sink: <FurnSinkIcon width={18} height={18} />,
    bathtub: <FurnBathIcon width={18} height={18} />,
    mirror: <FurnMirrorIcon width={18} height={18} />,
    urinal: <FurnToiletIcon width={18} height={18} />,
    mirrorS: <FurnMirrorIcon width={18} height={18} />,
    mirrorL: <FurnMirrorIcon width={18} height={18} />,
    hBed: <FurnBedIcon width={18} height={18} />,
    ivStand: <FurnIvStandIcon width={18} height={18} />,
    medCab: <FurnMedCabIcon width={18} height={18} />,
    opBed: <FurnBedIcon width={18} height={18} />,
  }
  const FLOOR_OPTIONS = [
    { t: 1,  label: '온기',     color: C.F1_BASE },
    { t: 2,  label: '원목',     color: C.F2_BASE },
    { t: 3,  label: '쿨그레이', color: C.F3_BASE },
    { t: 4,  label: '체크',     color: '#c4c0bc' },
    { t: 6,  label: '마블체커', color: '#dedad4' },
    { t: 7,  label: '석재',     color: '#c4bba8' },
    { t: 8,  label: '자갈',     color: '#b89858' },
    { t: 9,  label: '잔디',     color: '#6a8c28' },
    { t: 10, label: '초록타일', color: '#4a8055' },
    { t: 11, label: '나무',     color: '#c07840' },
    { t: 12, label: '꽃밭',     color: '#4a9a1a' },
    { t: 13, label: '시멘트',   color: '#b0b0b4' },
  ]
  const WALL_OPTIONS = [
    { t: 5,  label: '회벽',     color: '#6a6462' },
    { t: 15, label: '벽돌',     color: '#b84828' },
    { t: 16, label: '흰벽',     color: '#e8e4de' },
    { t: 17, label: '암석',     color: '#3a3830' },
    { t: 18, label: '나무',     color: C.WP2    },
    { t: 19, label: '콘크리트', color: '#8a8c90' },
  ]

  // ── Canvas resize ───────────────────────────────────────────────
  function startCanvasResize(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const el = canvasWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    resizingRef.current = true
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: rect.width, h: canvasViewH }
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
  }

  function handleCanvasWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const next = Math.max(0.5, Math.min(2.5, canvasZoom + (e.deltaY < 0 ? 0.1 : -0.1)))
    setCanvasZoom(Math.round(next * 10) / 10)
  }
  // When canvas viewport is wide enough that side panels get cramped → move panel below canvas
  const panelBelow = canvasViewW !== null && canvasViewW > 760
  const bottomPanelTool = tool === 'place' || tool === 'dev'
  const stackPanels = panelBelow || bottomPanelTool
  const widePalette = panelBelow || tool === 'place'

  // ── Dev panel helpers ───────────────────────────────────────────
  const getTypeColor = (dev: DevItem) =>
    dev.type === 'eml'     ? '#40ee80' :
    dev.type === 'trigger' ? TRIGGER_TYPES[dev.triggerType ?? 'button'].color :
    dev.type === 'light'   ? LIGHT_COLORS[dev.lightColor ?? 'yellow'].on :
    dev.type === 'video'   ? '#ee8844' : '#50e080'

  const getDevIcon = (dev: DevItem): ReactNode =>
    dev.type === 'eml'     ? <LockIcon      width={10} height={10} /> :
    dev.type === 'trigger' ? TRIGGER_TYPES[dev.triggerType ?? 'button'].icon :
    dev.type === 'light'   ? <LightBulbIcon width={10} height={10} /> :
    dev.type === 'video'   ? <FilmIcon      width={10} height={10} /> :
                             <MusicNoteIcon  width={10} height={10} />

  const isValidTarget = (dev: DevItem) => {
    if (!buildingRule) return false
    if (buildingRule.step === 'inputs') return dev.type === 'eml' || dev.type === 'trigger'
    if (buildingRule.step === 'outputs') return (dev.type === 'light' || dev.type === 'sound' || dev.type === 'video' || dev.type === 'eml') && !buildingRule.inputUids.includes(dev.uid)
    return false
  }

  const deleteDevice = (uid: string) => {
    setDevItems(prev => prev.filter(d => d.uid !== uid))
    setDevRules(prev => prev.filter(r => !r.inputUids.includes(uid) && !r.outputUids.includes(uid)))
  }

  const deletePlacedItem = (uid: string) => {
    setPlacedItems(prev => prev.filter(pi => pi.uid !== uid))
    setSelPlacedUid(prev => (prev === uid ? null : prev))
    if (selPlacedUidRef.current === uid) selPlacedUidRef.current = null
    const linkedDevUids = devRef.current.filter(d => d.linkedDoorUid === uid).map(d => d.uid)
    if (linkedDevUids.length > 0) {
      setDevItems(prev => prev.filter(d => d.linkedDoorUid !== uid))
      setDevRules(prev => prev.filter(r =>
        !linkedDevUids.some(devUid => r.inputUids.includes(devUid) || r.outputUids.includes(devUid))
      ))
    }
  }

  const eraseAt = (cell: { x: number; y: number }, px: number, py: number) => {
    if (selGroup === 'mark') {
      const hitMark = [...marksRef.current].reverse().find(m =>
        px >= m.x && px < m.x + m.w && py >= m.y && py < m.y + m.h
      )
      if (hitMark) {
        setMarks(prev => prev.filter(m => m.uid !== hitMark.uid))
        setSelMarkUid(prev => (prev === hitMark.uid ? null : prev))
        if (selMarkUidRef.current === hitMark.uid) selMarkUidRef.current = null
      }
      return
    }

    if (tool === 'dev') {
      const hitDev = [...devRef.current].reverse().find(d => d.x === cell.x && d.y === cell.y)
      if (hitDev) deleteDevice(hitDev.uid)
      return
    }

    if (tool === 'door') {
      const hitDoor = [...placedRef.current].reverse().find(pi => {
        const item = ITEMS.find(i => i.id === pi.itemId)
        if (!item || item.cat !== 'door') return false
        const { w: ew, h: eh } = effDims(item, pi.rot)
        return cell.x >= pi.x && cell.x < pi.x + ew && cell.y >= pi.y && cell.y < pi.y + eh
      })
      if (hitDoor) deletePlacedItem(hitDoor.uid)
      return
    }

    if (tool === 'place' || tool === 'move') {
      const hitItem = [...placedRef.current].reverse().find(pi => {
        const item = ITEMS.find(i => i.id === pi.itemId)
        if (!item) return false
        const { w: ew, h: eh } = effDims(item, pi.rot)
        return cell.x >= pi.x && cell.x < pi.x + ew && cell.y >= pi.y && cell.y < pi.y + eh
      })
      if (hitItem) deletePlacedItem(hitItem.uid)
      return
    }

    const rows = tilesRef.current.map(row => [...row])
    rows[cell.y][cell.x] = 0
    tilesRef.current = rows
    renderAll()
  }

  const handleDeviceClick = (dev: DevItem) => {
    if (!buildingRule || !isValidTarget(dev)) return
    setBuildingRule(prev => {
      if (!prev) return prev
      if (prev.step === 'inputs') {
        const already = prev.inputUids.includes(dev.uid)
        return { ...prev, inputUids: already ? prev.inputUids.filter(u => u !== dev.uid) : [...prev.inputUids, dev.uid] }
      } else {
        const already = prev.outputUids.includes(dev.uid)
        return { ...prev, outputUids: already ? prev.outputUids.filter(u => u !== dev.uid) : [...prev.outputUids, dev.uid] }
      }
    })
  }

  const finishBuildingRule = () => {
    if (!buildingRule || buildingRule.inputUids.length === 0 || buildingRule.outputUids.length === 0) return
    const existing = devRulesRef.current.find(r => r.uid === buildingRule.uid)
    if (existing) {
      // Edit existing: preserve name & delays, update uids
      setDevRules(prev => prev.map(r => r.uid === buildingRule.uid
        ? { ...r, inputUids: buildingRule.inputUids, outputUids: buildingRule.outputUids }
        : r))
    } else {
      const ruleNum = devRulesRef.current.length + 1
      setDevRules(prev => [...prev, {
        uid: buildingRule.uid,
        name: `규칙 ${ruleNum}`,
        inputUids: buildingRule.inputUids,
        outputUids: buildingRule.outputUids,
        outputDelays: {},
      }])
    }
    setBuildingRule(null)
  }

  // Derived state for unified panel
  const connectedUids = new Set(devRules.flatMap(r => [...r.inputUids, ...r.outputUids]))
  const standaloneDevices = devItems.filter(d => !connectedUids.has(d.uid))
  const devGroups = devRules.flatMap(rule => {
    const inps = rule.inputUids.map(uid => devItems.find(d => d.uid === uid)).filter(Boolean) as DevItem[]
    const outs = rule.outputUids.map(uid => devItems.find(d => d.uid === uid)).filter(Boolean) as DevItem[]
    if (inps.length === 0 || outs.length === 0) return []
    return [{ rule, inps, outs, fired: firedRules.has(rule.uid) }]
  })
  const isSelecting = buildingRule !== null

  // ── Tab toolbar helpers ─────────────────────────────────────────
  const TAB_TOOLS = [
    { id: 'floor' as Tool, icon: <FloorTileIcon width={15} height={15} />, label: '바닥' },
    { id: 'wall'  as Tool, icon: <WallBrickIcon width={15} height={15} />, label: '벽' },
    { id: 'door'  as Tool, icon: <DoorPanelIcon width={15} height={15} />, label: '문' },
    { id: 'place' as Tool, icon: <BoxIcon width={15} height={15} />, label: '배치' },
    { id: 'move'  as Tool, icon: <MoveArrowsIcon width={15} height={15} />,  label: '이동' },
    { id: 'dev'   as Tool, icon: <GearIcon width={15} height={15} />,  label: 'Dev' },
  ]
  const hasSubtool = tool === 'floor' || tool === 'wall' || tool === 'door' || tool === 'dev' || (tool === 'place' && !!selItem)
  const DEV_SUBTYPES: { id: DevType; icon: ReactNode; label: string; tag: string }[] = [
    { id: 'trigger', icon: <ButtonPressIcon width={11} height={11} />, label: '트리거', tag: 'INPUT' },
    { id: 'eml',     icon: <LockIcon        width={11} height={11} />, label: 'EML',    tag: 'INPUT' },
    { id: 'light',   icon: <LightBulbIcon   width={11} height={11} />, label: '조명',   tag: 'OUTPUT' },
    { id: 'sound',   icon: <MusicNoteIcon   width={11} height={11} />, label: '효과음', tag: 'OUTPUT' },
    { id: 'video',   icon: <FilmIcon        width={11} height={11} />, label: '영상',   tag: 'OUTPUT' },
  ]
  const devHint: Record<DevType, string> = {
    trigger: '타일 클릭 배치 · 발동 (Input)',
    eml: '문 클릭 → EML 연결 (Input)',
    light: '타일 클릭으로 조명 배치',
    sound: '배치 후 패널에서 MP3 업로드',
    video: '배치 후 패널에서 MP4 업로드',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: gridTheme === 'light' ? '#d4cfc8' : '#727780',
      backgroundImage: `repeating-linear-gradient(to right, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 0px, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 1px, transparent 1px, transparent ${TILE}px), repeating-linear-gradient(to bottom, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 0px, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 1px, transparent 1px, transparent ${TILE}px)`,
      backgroundSize: `${TILE}px ${TILE}px`,
      borderRadius: 12, padding: 8,
    }}>

      {/* ── Toolbar ── */}
      {mode === 'edit' ? (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          overflow: 'visible',
          position: 'relative',
        }}>

          {/* ── Tab row ── */}
          <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: hasSubtool ? '1px solid var(--border)' : 'none' }}>
            {TAB_TOOLS.map(({ id, icon, label }) => {
              const active = tool === id
              return (
                <button key={id} onClick={() => {
                  if (tool === id) {
                    setTool(null)
                    if (id === 'place') setSelItem(null)
                    return
                  }
                  setTool(id)
                  if (id !== 'place') setSelItem(null)
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 3, padding: '9px 16px',
                    background: active ? 'var(--bg-secondary)' : 'transparent',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'background 0.1s, color 0.1s',
                    marginBottom: -1, minWidth: 58, flexShrink: 0,
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>{icon}</span>
                  <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: 0.3 }}>{label}</span>
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
              <button
                onClick={() => setEraseMode(v => !v)}
                title={eraseMode ? '지우개 끄기 (Esc)' : '지우개 켜기'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  border: eraseMode ? '1px solid #ff6b6b' : '1px solid var(--border)',
                  background: eraseMode ? 'rgba(255,107,107,0.12)' : 'var(--bg-secondary)',
                  color: eraseMode ? '#ff8585' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 700, transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><EraserIcon width={13} height={13} /></span>
                <span>{eraseMode ? '지우개 ON' : '지우개'}</span>
              </button>
              <button
                onClick={toggleFlowSketch}
                title={flowSketchVisible ? '게임 플로우 스케치 숨기기' : '게임 플로우 스케치 켜고 Pass Map 반영'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  border: flowSketchVisible ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: flowSketchVisible ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  color: flowSketchVisible ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 700,
                }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><FolderOpenIcon width={13} height={13} /></span>
                <span>{flowSketchVisible ? '스케치 ON' : '스케치 OFF'}</span>
              </button>
              <span style={{
                fontSize: 10, color: 'var(--text-muted)', padding: '0 2px',
                minWidth: 42, textAlign: 'center',
              }}>
                {Math.round(canvasZoom * 100)}%
              </span>
              {/* 저장 + 히스토리 */}
              {showEmbeddedSaveHistory && (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={handleSave}
                      title="현재 맵 저장"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, padding: 0, borderRadius: 7, cursor: 'pointer',
                        border: '1px solid var(--border)',
                        background: saveStatus === 'saved' ? '#1a4a2a' : 'var(--bg-secondary)',
                        color: saveStatus === 'saved' ? '#4ade80' : 'var(--text-muted)',
                        fontSize: 11, fontWeight: 600, transition: 'background 0.2s, color 0.2s',
                      }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        {saveStatus === 'saved' ? <CheckIcon width={13} height={13} /> : <SaveDiskIcon width={13} height={13} />}
                      </span>
                    </button>
                    {history.length > 0 && (
                      <button
                        onClick={() => setShowHistory(h => !h)}
                        title="저장 히스토리"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                          border: showHistory ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: showHistory ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                          color: showHistory ? 'var(--accent)' : 'var(--text-muted)',
                          fontSize: 11, fontWeight: 600,
                        }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}><HistoryIcon width={12} height={12} /></span>
                        <span>{history.length}</span>
                      </button>
                    )}
                  </div>
                  {/* History dropdown */}
                  {showHistory && history.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 200,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      minWidth: 220, overflow: 'hidden',
                    }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                        저장 히스토리 ({history.length}/{MAX_HISTORY})
                      </div>
                      {history.map((entry, i) => {
                        const d = new Date(entry.savedAt)
                        const label = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
                        return (
                          <button key={entry.id} onClick={() => handleRestore(entry)} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', border: 'none', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                            background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <span style={{
                              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                              border: i === 0 ? '1px solid #4da6ff' : '1px solid var(--border)',
                              background: i === 0 ? '#4da6ff' : 'transparent',
                              opacity: 0.85,
                            }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '최신 저장' : `저장 ${history.length - i}`}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>복원</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Grid theme toggle */}
              <button
                onClick={() => setGridTheme(g => g === 'dark' ? 'light' : 'dark')}
                title={gridTheme === 'dark' ? '라이트 배경으로 전환' : '다크 배경으로 전환'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, padding: 0, borderRadius: 7, cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: gridTheme === 'light' ? '#e8e4de' : 'var(--bg-secondary)',
                  color: gridTheme === 'light' ? '#444' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 600, transition: 'background 0.15s',
                }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {gridTheme === 'dark' ? <SunIcon width={13} height={13} /> : <MoonIcon width={13} height={13} />}
                </span>
              </button>
              <button onClick={() => {
                let sx = -1, sy = -1
                outer: for (let gy = 0; gy < ROWS; gy++) {
                  for (let gx = 0; gx < COLS; gx++) {
                    const t = tilesRef.current[gy][gx]
                    if (t > 0 && t < 5) { sx = gx * TILE + 4; sy = gy * TILE + 4; break outer }
                  }
                }
                charRef.current = { x: sx >= 0 ? sx : 200, y: sy >= 0 ? sy : 200, dir: 'down', frame: 0, tick: 0 }
                setEraseMode(false)
                setMode('play')
              }} title="플레이 모드 시작" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, padding: 0, borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #3fb950, #2d9e40)',
                color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(63,185,80,0.28)',
              }}>
                <AgentIconPd width={14} height={14} />
              </button>
            </div>
          </div>

          {/* ── Subtool row ── */}
          {hasSubtool && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap',
              padding: '7px 16px', background: 'var(--bg-secondary)', minHeight: 42,
              overflowX: 'auto', scrollbarWidth: 'none',
            }}>

              {/* Floor swatches */}
              {tool === 'floor' && FLOOR_OPTIONS.map(fp => (
                <button key={fp.t} onClick={() => setFloorType(fp.t)}
                  onMouseEnter={() => setHoveredSwatch(fp.label)}
                  onMouseLeave={() => setHoveredSwatch(null)}
                  style={{
                    width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
                    background: fp.color,
                    border: floorType === fp.t ? '2px solid var(--accent)' : '1px solid transparent',
                    boxShadow: floorType === fp.t ? `0 0 0 1px var(--accent)` : 'none',
                    transition: 'box-shadow 0.1s',
                  }} />
              ))}

              {/* Wall swatches */}
              {tool === 'wall' && WALL_OPTIONS.map(wp => (
                <button key={wp.t} onClick={() => { setWallType(wp.t); wallTypeRef.current = wp.t }}
                  onMouseEnter={() => setHoveredSwatch(wp.label)}
                  onMouseLeave={() => setHoveredSwatch(null)}
                  style={{
                    width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
                    background: wp.color,
                    border: wallType === wp.t ? '2px solid var(--accent)' : '1px solid transparent',
                    boxShadow: wallType === wp.t ? `0 0 0 1px var(--accent)` : 'none',
                    transition: 'box-shadow 0.1s',
                  }} />
              ))}

              {/* Hovered swatch label */}
              {hoveredSwatch && (tool === 'floor' || tool === 'wall') && (
                <span style={{
                  marginLeft: 4, fontSize: 11, color: 'var(--text-secondary)',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 7px', pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>{hoveredSwatch}</span>
              )}

              {/* Door types + rotation */}
              {tool === 'door' && (
                <>
                  {([
                    { id: 'doorS' as DoorType, label: '외문', sub: '1×1' },
                    { id: 'doorD' as DoorType, label: '양문', sub: '2×1' },
                    { id: 'doorSl' as DoorType, label: '슬라이드', sub: '2×1' },
                  ]).map(d => (
                    <button key={d.id} onClick={() => setDoorType(d.id)} style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      border: doorType === d.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: doorType === d.id ? 'var(--accent-dim)' : 'transparent',
                      color: doorType === d.id ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: doorType === d.id ? 700 : 400,
                    }}>{d.label} <span style={{ fontSize: 9, opacity: 0.5 }}>{d.sub}</span></button>
                  ))}
                  <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
                  <button onClick={() => setRotation(r => ((r + 1) % 4) as 0|1|2|3)} style={{
                    padding: '3px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                    border: '1px solid var(--border)',
                    background: rotation !== 0 ? 'var(--accent-dim)' : 'transparent',
                    color: rotation !== 0 ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{['↑','→','↓','←'][rotation]} {rotation * 90}°
                    <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, opacity: 0.5 }}>R</span>
                  </button>
                  <button onClick={() => setFlipped(f => !f)} style={{
                    padding: '3px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                    border: '1px solid var(--border)',
                    background: flipped ? 'var(--accent-dim)' : 'transparent',
                    color: flipped ? 'var(--accent)' : 'var(--text-muted)',
                  }}>⇄ 반전</button>
                  <span style={{ fontSize: 10, color: '#556677', marginLeft: 4 }}>벽 인접 타일에만 배치</span>
                </>
              )}

              {/* Place rotation + flip */}
              {tool === 'place' && selItem && (
                <>
                  <button onClick={() => setRotation(r => ((r + 1) % 4) as 0|1|2|3)} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                    border: '1px solid var(--border)',
                    background: rotation !== 0 ? 'var(--accent-dim)' : 'transparent',
                    color: rotation !== 0 ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{['↑','→','↓','←'][rotation]} {rotation * 90}°
                    <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, opacity: 0.5 }}>R키</span>
                  </button>
                  <button onClick={() => setFlipped(f => !f)} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                    border: '1px solid var(--border)',
                    background: flipped ? 'var(--accent-dim)' : 'transparent',
                    color: flipped ? 'var(--accent)' : 'var(--text-muted)',
                  }}>⇄ 반전
                    <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, opacity: 0.5 }}>F키</span>
                  </button>
                  {ITEMS.find(i => i.id === selItem)?.cat === 'door' && (
                    <span style={{ fontSize: 10, color: '#556677', marginLeft: 4 }}>벽 인접 타일에만 배치</span>
                  )}
                </>
              )}

              {/* Dev subtypes */}
              {tool === 'dev' && (
                <>
                  {DEV_SUBTYPES.map(d => (
                    <button key={d.id} onClick={() => setDevSubtype(d.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      padding: '3px 11px 3px 8px', borderRadius: 20, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                      border: devSubtype === d.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: devSubtype === d.id ? 'var(--accent-dim)' : 'transparent',
                      color: devSubtype === d.id ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: devSubtype === d.id ? 600 : 400,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}>{d.icon}</span>
                      <span>{d.label}</span>
                      <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginLeft: 2, opacity: 0.6 }}>{d.tag}</span>
                    </button>
                  ))}


                  {/* Light color swatches */}
                  {devSubtype === 'light' && (
                    <>
                      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
                      {(Object.entries(LIGHT_COLORS) as [LightColor, { on: string; label: string }][]).map(([k, v]) => (
                        <button key={k} onClick={() => setDevLightColor(k)} title={v.label} style={{
                          width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                          background: v.on,
                          border: devLightColor === k ? '2px solid white' : '2px solid transparent',
                          boxShadow: devLightColor === k ? `0 0 8px ${v.on}88, 0 0 0 1px ${v.on}44` : 'none',
                          transition: 'box-shadow 0.15s',
                        }} />
                      ))}
                    </>
                  )}

                  {/* Hint */}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#445566', fontStyle: 'italic' }}>
                    {devHint[devSubtype]}
                  </span>
                </>
              )}

            </div>
          )}

          {/* Trigger subtypes row — shown below subtool bar */}
          {tool === 'dev' && devSubtype === 'trigger' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              padding: '6px 16px', background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginRight: 2 }}>트리거 종류</span>
              {(Object.entries(TRIGGER_TYPES) as [TriggerType, { icon: ReactNode; label: string; color: string }][]).map(([k, v]) => (
                <button key={k} onClick={() => setDevTriggerType(k)} title={v.label} style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap',
                  padding: '3px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  border: devTriggerType === k ? `1px solid ${v.color}88` : '1px solid var(--border)',
                  background: devTriggerType === k ? v.color + '20' : 'transparent',
                  color: devTriggerType === k ? v.color : 'var(--text-muted)',
                  fontWeight: devTriggerType === k ? 700 : 400,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>{v.icon}</span>
                  <span style={{ fontSize: 10 }}>{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      ) : (
        /* ── Play mode bar ── */
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px',
          background: 'linear-gradient(135deg, #0e1510 0%, #0e1214 100%)',
          borderRadius: 12,
          border: '1px solid #3fb95028',
          boxShadow: '0 0 24px rgba(63,185,80,0.07)',
        }}>
          <button onClick={() => { setMode('edit'); cancelAnimationFrame(animRef.current) }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}>◀ 편집</button>
          <div style={{ width: 1, height: 16, background: '#3fb95028' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#3fb950', letterSpacing: 0.4 }}>
            <AgentIconPd width={13} height={13} />
            플레이 모드
          </span>
          <span style={{ fontSize: 11, color: '#445', marginLeft: 4 }}>WASD / 화살표</span>
          <span style={{ fontSize: 10, color: '#334', marginLeft: 'auto' }}>바닥 타일 위 이동 · 가구 충돌</span>
        </div>
      )}

      {/* ── Canvas + Palette ── */}
      <div style={{ display: 'flex', flexDirection: stackPanels ? 'column' : 'row', gap: 10, alignItems: 'flex-start' }}>
        {/* Canvas */}
        <div
          ref={canvasWrapRef}
          onWheel={handleCanvasWheel}
          style={{
            position: 'relative',
            flex: 'none',
            width: canvasViewW ?? (stackPanels ? '100%' : W * canvasZoom),
            overflow: 'auto',
            border: 'none',
            borderRadius: 12,
            background: gridTheme === 'light' ? '#d4cfc8' : '#727780',
            backgroundImage: `repeating-linear-gradient(to right, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 0px, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 1px, transparent 1px, transparent ${TILE * canvasZoom}px), repeating-linear-gradient(to bottom, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 0px, ${gridTheme === 'light' ? 'rgba(175,168,160,0.55)' : 'rgba(100,106,114,0.6)'} 1px, transparent 1px, transparent ${TILE * canvasZoom}px)`,
            backgroundSize: `${TILE * canvasZoom}px ${TILE * canvasZoom}px`,
            maxHeight: canvasViewH,
            boxSizing: 'border-box',
            boxShadow: '0 0 0 1px var(--border), 0 8px 32px rgba(0,0,0,0.45)',
          }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            tabIndex={0}
            style={{
              display: 'block',
              imageRendering: 'pixelated',
              width: W * canvasZoom,
              height: H * canvasZoom,
              cursor: eraseMode ? ERASER_CURSOR : tool === 'move' ? 'grab' : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setHoverCell(null); paintingRef.current = false }}
          />
          {/* ── Resize handle (bottom-right corner) ── */}
          <div
            onMouseDown={startCanvasResize}
            title="드래그로 크기 조절"
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 20, height: 20,
              cursor: 'nwse-resize',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
              padding: '3px',
              zIndex: 10,
            }}>
            <svg width="11" height="11" viewBox="0 0 11 11" style={{ opacity: 0.45 }}>
              <line x1="2" y1="11" x2="11" y2="2" stroke="#88aacc" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="5.5" y1="11" x2="11" y2="5.5" stroke="#88aacc" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="9" y1="11" x2="11" y2="9" stroke="#88aacc" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Dev panel */}
        {mode === 'edit' && tool === 'dev' && (
          <div style={{ order: -1, width: stackPanels ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', boxSizing: 'border-box' }}>

            {/* Header */}
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.3 }}>
                <GearIcon width={12} height={12} />
                Dev 시뮬레이터
              </span>
              {devItems.length > 0 && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {devItems.length}개
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: stackPanels ? 300 : 520, padding: '10px 10px', display: 'flex', flexDirection: stackPanels ? 'row' : 'column', flexWrap: stackPanels ? 'wrap' : 'nowrap', gap: 10 }}>

              {/* ── Empty state ── */}
              {devItems.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '20px 8px', textAlign: 'center', lineHeight: 2 }}>
                  <div style={{ marginBottom: 8, opacity: 0.25, display: 'flex', justifyContent: 'center' }}>
                    <GearIcon width={22} height={22} />
                  </div>
                  <div style={{ marginBottom: 6, color: '#555' }}>장치 없음</div>
                  <div style={{ fontSize: 10, color: '#444', lineHeight: 1.9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <LockIcon width={10} height={10} /> EML: 문 클릭으로 연결
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <ButtonPressIcon width={10} height={10} /> 트리거: 타일 클릭 배치
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <LightBulbIcon width={10} height={10} /> 조명 / <MusicNoteIcon width={10} height={10} /> 효과음: 타일 클릭 배치
                    </div>
                  </div>
                </div>
              )}

              {/* ── Group cards (connected devices) ── */}
              {devGroups.map(({ rule, inps, outs, fired }, ruleIdx) => {
                const isEditingThis = isSelecting && buildingRule?.uid === rule.uid
                const allOutputsOn = outs.every(o => o.active)
                const isDragOver = dragOverRuleUid === rule.uid
                return (
                  <div key={rule.uid}
                    draggable={!isSelecting}
                    onDragStart={() => { dragRuleUidRef.current = rule.uid }}
                    onDragEnd={() => { dragRuleUidRef.current = null; setDragOverRuleUid(null) }}
                    onDragOver={e => { e.preventDefault(); if (dragRuleUidRef.current !== rule.uid) setDragOverRuleUid(rule.uid) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverRuleUid(null) }}
                    onDrop={e => {
                      e.preventDefault()
                      const fromUid = dragRuleUidRef.current
                      if (!fromUid || fromUid === rule.uid) { setDragOverRuleUid(null); return }
                      setDevRules(prev => {
                        const fromIdx = prev.findIndex(r => r.uid === fromUid)
                        const toIdx = prev.findIndex(r => r.uid === rule.uid)
                        if (fromIdx < 0 || toIdx < 0) return prev
                        const next = [...prev]
                        const [item] = next.splice(fromIdx, 1)
                        next.splice(toIdx, 0, item)
                        return next
                      })
                      dragRuleUidRef.current = null
                      setDragOverRuleUid(null)
                    }}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${isDragOver ? '#88ddff' : fired ? '#ffcc44' : isEditingThis ? '#88ddff66' : isSelecting ? 'var(--border)' : '#2a3340'}`,
                      background: isDragOver ? '#88ddff0a' : fired ? '#ffcc4410' : isEditingThis ? '#88ddff08' : 'var(--bg-secondary)',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s, background 0.15s',
                      boxShadow: fired ? '0 0 8px #ffcc4430' : isDragOver ? '0 0 0 1px #88ddff44' : 'none',
                      cursor: isSelecting ? 'default' : 'grab',
                    }}>
                    {/* ── Rule name row ── */}
                    {!isSelecting && (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px 2px 8px', gap: 4, borderBottom: '1px solid #1a2230' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#445566', flexShrink: 0, userSelect: 'none', minWidth: 16, textAlign: 'right' }}>
                          {ruleIdx + 1}.
                        </span>
                        <input
                          value={rule.name ?? ''}
                          onChange={e => setDevRules(prev => prev.map(r => r.uid === rule.uid ? { ...r, name: e.target.value } : r))}
                          placeholder={`규칙 ${ruleIdx + 1}`}
                          onMouseDown={e => e.stopPropagation()}
                          style={{
                            flex: 1, background: 'transparent', border: 'none',
                            color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600,
                            outline: 'none', padding: '0 2px', cursor: 'text',
                          }}
                        />
                        {allOutputsOn && (
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#ffcc4418', color: '#ffcc44', fontWeight: 700, border: '1px solid #ffcc4433', flexShrink: 0 }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                    )}
                    {/* ── Chip columns: [inputs col] → [outputs col]  × ── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, padding: '6px 7px 4px 7px' }}>
                      {/* Inputs column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                        {inps.map(inp => {
                          const inpColor = getTypeColor(inp)
                          const isInBuilding = buildingRule?.inputUids.includes(inp.uid) ?? false
                          const inpIsValid = isSelecting && isValidTarget(inp)
                          const inpIsDimmed = isSelecting && !inpIsValid && !isInBuilding
                          return (
                            <div key={inp.uid}
                              onClick={isSelecting && (inpIsValid || isInBuilding) ? () => handleDeviceClick(inp) : undefined}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '3px 6px', borderRadius: 5,
                                border: isInBuilding ? '1px solid #40ee80'
                                  : inpIsValid ? '1px dashed #88ddff88'
                                  : `1px solid ${inpColor}33`,
                                borderLeft: `3px solid ${inpColor}`,
                                background: isInBuilding ? '#40ee8014' : inp.active ? inpColor + '0d' : 'transparent',
                                opacity: inpIsDimmed ? 0.28 : 1,
                                cursor: isSelecting && (inpIsValid || isInBuilding) ? 'pointer' : 'default',
                                transition: 'border-color 0.15s, opacity 0.15s',
                              }}>
                              <span style={{ fontSize: 10, flexShrink: 0 }}>{getDevIcon(inp)}</span>
                              <span style={{
                                fontSize: 10, flex: 1, fontWeight: inp.active ? 600 : 400,
                                color: isInBuilding ? '#40ee80' : inp.active ? inpColor : 'var(--text-secondary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{inp.name}</span>
                              {isSelecting && isInBuilding && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 3px', borderRadius: 3, background: '#40ee8022', color: '#40ee80', fontWeight: 700, flexShrink: 0 }}>
                                  <CheckIcon width={8} height={8} />
                                </span>
                              )}
                              {isSelecting && inpIsValid && !isInBuilding && <span style={{ fontSize: 8, padding: '1px 3px', borderRadius: 3, background: '#88ddff18', color: '#88ddff', fontWeight: 700, flexShrink: 0 }}>⊕</span>}
                            </div>
                          )
                        })}
                        {/* Add input to existing rule */}
                        {!isSelecting && (
                          <button onClick={() => setBuildingRule({ uid: rule.uid, inputUids: rule.inputUids, outputUids: rule.outputUids, step: 'inputs' })}
                            style={{ padding: '2px 5px', borderRadius: 4, border: '1px dashed #334', background: 'transparent', color: '#446', fontSize: 9, cursor: 'pointer' }}>+ In</button>
                        )}
                      </div>
                      {/* Arrow */}
                      <span style={{ fontSize: 11, color: fired ? '#ffcc44' : '#2a3a4a', flexShrink: 0, paddingTop: 4, transition: 'color 0.3s' }}>→</span>
                      {/* Outputs column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                        {outs.map(out => {
                          const outColor = getTypeColor(out)
                          const isInBuilding = buildingRule?.outputUids.includes(out.uid) ?? false
                          const outIsValid = isSelecting && isValidTarget(out)
                          const outIsDimmed = isSelecting && !outIsValid && !isInBuilding
                          const delay = rule.outputDelays?.[out.uid] ?? 0
                          return (
                            <div key={out.uid}
                              onClick={isSelecting && (outIsValid || isInBuilding) ? () => handleDeviceClick(out) : undefined}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '3px 6px', borderRadius: 5,
                                border: isInBuilding ? '1px solid #88ddff'
                                  : outIsValid ? '1px dashed #88ddff88'
                                  : `1px solid ${outColor}33`,
                                borderLeft: `3px solid ${outColor}`,
                                background: isInBuilding ? '#88ddff10' : out.active ? outColor + '0d' : 'transparent',
                                opacity: outIsDimmed ? 0.28 : 1,
                                cursor: isSelecting && (outIsValid || isInBuilding) ? 'pointer' : 'default',
                                transition: 'border-color 0.15s, opacity 0.15s',
                              }}>
                              <span style={{ fontSize: 10, flexShrink: 0 }}>{getDevIcon(out)}</span>
                              <span style={{
                                fontSize: 10, flex: 1, fontWeight: out.active ? 600 : 400,
                                color: out.active ? outColor : 'var(--text-secondary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{out.name}</span>
                              {/* Delay input (non-selecting mode only) */}
                              {!isSelecting && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                                  <input
                                    type="number" min={0} max={300} step={0.5}
                                    value={delay}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => setDevRules(prev => prev.map(r => r.uid === rule.uid
                                      ? { ...r, outputDelays: { ...r.outputDelays, [out.uid]: Math.max(0, parseFloat(e.target.value) || 0) } }
                                      : r))}
                                    style={{
                                      width: 28, background: delay > 0 ? '#ffaa4418' : 'transparent',
                                      border: `1px solid ${delay > 0 ? '#ffaa4444' : '#2a3a4a'}`,
                                      borderRadius: 3, color: delay > 0 ? '#ffaa44' : '#445',
                                      fontSize: 8, padding: '1px 2px', textAlign: 'center', outline: 'none',
                                    }}
                                  />
                                  <span style={{ fontSize: 7, color: delay > 0 ? '#ffaa4488' : '#334' }}>s</span>
                                </div>
                              )}
                              {out.type === 'light' && !isSelecting && (
                                <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: outColor, boxShadow: out.active ? `0 0 4px ${outColor}` : 'none' }} />
                              )}
                              {isSelecting && isInBuilding && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 3px', borderRadius: 3, background: '#88ddff18', color: '#88ddff', fontWeight: 700, flexShrink: 0 }}>
                                  <CheckIcon width={8} height={8} />
                                </span>
                              )}
                              {isSelecting && outIsValid && !isInBuilding && <span style={{ fontSize: 8, padding: '1px 3px', borderRadius: 3, background: '#88ddff18', color: '#88ddff', fontWeight: 700, flexShrink: 0 }}>⊕</span>}
                            </div>
                          )
                        })}
                        {/* Add output to existing rule */}
                      {!isSelecting && (
                        <button onClick={() => setBuildingRule({ uid: rule.uid, inputUids: rule.inputUids, outputUids: rule.outputUids, step: 'outputs' })}
                          style={{ padding: '2px 5px', borderRadius: 4, border: '1px dashed #334', background: 'transparent', color: '#446', fontSize: 9, cursor: 'pointer' }}>+ Out</button>
                        )}
                      </div>
                    </div>

                    {/* ── Bottom simulation controls (all inputs + all outputs) ── */}
                    {!isSelecting && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '2px 8px 6px 8px' }}>
                        {/* Input controls row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {inps.map(inp => {
                            const inpColor = getTypeColor(inp)
                            return (
                              <button key={inp.uid} onClick={e => { e.stopPropagation()
                                if (allOutputsOn) {
                                  // Reset: turn input + all outputs OFF in one shot
                                  setDevItems(prev => prev.map(d =>
                                    d.uid === inp.uid || rule.outputUids.includes(d.uid)
                                      ? { ...d, active: false }
                                      : d
                                  ))
                                } else {
                                  const next = !inp.active
                                  setDevItems(prev => prev.map(d => d.uid === inp.uid ? { ...d, active: next } : d))
                                  if (next) fireDevRules(inp.uid)
                                }
                              }} style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 9,
                                border: `1px solid ${allOutputsOn ? '#ffaa4444' : inpColor + '44'}`,
                                background: allOutputsOn ? '#ffaa4418' : inp.active ? inpColor + '22' : 'transparent',
                                color: allOutputsOn ? '#ffaa44' : inp.active ? inpColor : '#888',
                                cursor: 'pointer', fontWeight: 600,
                              }}>
                                {allOutputsOn ? '↺ 리셋' : inp.type === 'trigger' ? '▶ 발동' : inp.active ? '잠금' : '열기'} <span style={{ opacity: 0.7 }}>{inp.name}</span>
                              </button>
                            )
                          })}
                          <div style={{ flex: 1 }} />
                          {/* Output status badges */}
                          {outs.map(out => {
                            const outColor = getTypeColor(out)
                            if (out.type === 'eml' || out.type === 'light') return (
                              <span key={out.uid} style={{
                                fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                                background: out.active ? outColor + '22' : '#22222288',
                                color: out.active ? outColor : '#555',
                              }}>
                                {out.type === 'eml' ? (out.active ? 'OPEN' : 'LOCK') : (out.active ? 'ON' : 'OFF')}
                              </span>
                            )
                            return null
                          })}
                        </div>
                        {/* Output controls row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {outs.map(out => {
                            const outColor = getTypeColor(out)
                            if (out.type === 'light') return (
                              <button key={out.uid} onClick={e => { e.stopPropagation()
                                setDevItems(prev => prev.map(d => d.uid === out.uid ? { ...d, active: !d.active } : d))
                              }} style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: 9,
                                border: `1px solid ${outColor}44`,
                                background: out.active ? outColor + '22' : 'transparent',
                                color: out.active ? outColor : '#888',
                                cursor: 'pointer', fontWeight: 600,
                              }}>{out.active ? 'OFF' : 'ON'} <span style={{ opacity: 0.7 }}>{out.name}</span></button>
                            )
                            if (out.type === 'eml') return (
                              <button key={out.uid} onClick={e => { e.stopPropagation()
                                setDevItems(prev => prev.map(d => d.uid === out.uid ? { ...d, active: !d.active } : d))
                              }} style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: 9,
                                border: `1px solid ${outColor}44`,
                                background: out.active ? outColor + '22' : 'transparent',
                                color: out.active ? outColor : '#888',
                                cursor: 'pointer', fontWeight: 600,
                              }}>{out.active ? '잠금' : '열기'} <span style={{ opacity: 0.7 }}>{out.name}</span></button>
                            )
                            if (out.type === 'sound') return (
                              <button key={out.uid} onClick={e => { e.stopPropagation()
                                if (!out.audioUrl) return
                                setDevItems(prev => prev.map(d => d.uid === out.uid ? { ...d, active: !d.active } : d))
                                if (!out.active) new Audio(out.audioUrl).play().catch(() => {})
                              }} style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: 9,
                                border: `1px solid ${outColor}44`,
                                background: out.active ? outColor + '22' : 'transparent',
                                color: out.active ? outColor : out.audioUrl ? '#888' : '#3a3a3a',
                                cursor: out.audioUrl ? 'pointer' : 'not-allowed', fontWeight: 600,
                                opacity: out.audioUrl ? 1 : 0.5,
                              }}>{out.active ? '⏹' : '▶'} <span style={{ opacity: 0.7 }}>{out.name}</span></button>
                            )
                            if (out.type === 'video') return (
                              <button key={out.uid} onClick={e => { e.stopPropagation()
                                if (!out.videoUrl) return
                                const next = !out.active
                                setDevItems(prev => prev.map(d => d.uid === out.uid ? { ...d, active: next } : d))
                                const el = videoEls.current.get(out.uid)
                                if (el) { if (next) { el.currentTime = 0; el.play().catch(() => {}) } else { el.pause(); el.currentTime = 0 } }
                              }} style={{
                                padding: '2px 7px', borderRadius: 4, fontSize: 9,
                                border: `1px solid ${outColor}44`,
                                background: out.active ? outColor + '22' : 'transparent',
                                color: out.active ? outColor : out.videoUrl ? '#888' : '#3a3a3a',
                                cursor: out.videoUrl ? 'pointer' : 'not-allowed', fontWeight: 600,
                                opacity: out.videoUrl ? 1 : 0.5,
                              }}>{out.active ? '⏹' : '▶'} <span style={{ opacity: 0.7 }}>{out.name}</span></button>
                            )
                            return null
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Sound MP3 sub-rows ── */}
                    {!isSelecting && outs.filter(o => o.type === 'sound').map(out => (
                      <div key={out.uid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 6px 28px' }}>
                        <label style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                          border: '1px solid var(--border)',
                          background: out.audioUrl ? '#50e08018' : 'var(--bg-card)',
                          color: out.audioUrl ? '#50e080' : '#555', flexShrink: 0,
                        }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {out.audioUrl ? <CheckIcon width={10} height={10} /> : <UploadIcon width={10} height={10} />}
                            {out.audioUrl ? 'MP3' : '업로드'}
                          </span>
                          <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => {
                            const file = e.target.files?.[0]; if (!file) return
                            const url = URL.createObjectURL(file)
                            const baseName = file.name.replace(/\.[^.]+$/, '')
                            setDevItems(prev => prev.map(d => d.uid === out.uid ? { ...d, audioUrl: url, audioName: baseName, name: d.name.startsWith('효과음') ? baseName : d.name } : d))
                          }} />
                        </label>
                        <span style={{ fontSize: 9, color: out.audioUrl ? '#50e08066' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {out.audioUrl ? (out.audioName ?? out.name) : 'MP3 없음'}
                        </span>
                      </div>
                    ))}
                    {/* ── Video MP4 sub-rows ── */}
                    {!isSelecting && outs.filter(o => o.type === 'video').map(out => (
                      <div key={out.uid} style={{ padding: '0 8px 8px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: out.active && out.videoUrl ? 6 : 0 }}>
                          <label style={{
                            fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                            border: '1px solid var(--border)',
                            background: out.videoUrl ? '#ee884418' : 'var(--bg-card)',
                            color: out.videoUrl ? '#ee8844' : '#555', flexShrink: 0,
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {out.videoUrl ? <CheckIcon width={10} height={10} /> : <UploadIcon width={10} height={10} />}
                              {out.videoUrl ? 'MP4' : 'MP4 업로드'}
                            </span>
                            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => {
                              const file = e.target.files?.[0]; if (!file) return
                              const url = URL.createObjectURL(file)
                              const baseName = file.name.replace(/\.[^.]+$/, '')
                              setDevItems(prev => prev.map(d => d.uid === out.uid ? { ...d, videoUrl: url, videoName: baseName, name: d.name.startsWith('영상') ? baseName : d.name } : d))
                            }} />
                          </label>
                          <span style={{ fontSize: 9, color: out.videoUrl ? '#ee884466' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {out.videoUrl ? (out.videoName ?? out.name) : 'MP4 없음'}
                          </span>
                        </div>
                        {out.videoUrl && (
                          <video
                            ref={el => { if (el) videoEls.current.set(out.uid, el) }}
                            src={out.videoUrl}
                            controls
                            style={{ width: '100%', borderRadius: 6, display: out.active ? 'block' : 'none', background: '#000' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* ── Standalone devices (not in any rule) ── */}
              {standaloneDevices.map(dev => {
                const typeColor = getTypeColor(dev)
                const isActive = dev.active
                const isInBuildingInputs = buildingRule?.inputUids.includes(dev.uid) ?? false
                const isInBuildingOutputs = buildingRule?.outputUids.includes(dev.uid) ?? false
                const isInBuilding = isInBuildingInputs || isInBuildingOutputs
                const devIsValid = isValidTarget(dev)
                const isDimmed = isSelecting && !devIsValid && !isInBuilding
                return (
                  <div key={dev.uid}
                    onClick={isSelecting && (devIsValid || isInBuilding) ? () => handleDeviceClick(dev) : undefined}
                    style={{
                      borderRadius: 7,
                      border: isInBuildingInputs ? '1px solid #40ee80'
                        : isInBuildingOutputs ? '1px solid #88ddff'
                        : isSelecting && devIsValid ? '1px dashed #88ddff88'
                        : `1px solid ${isActive ? typeColor + '55' : 'var(--border)'}`,
                      borderLeft: isInBuildingInputs ? '3px solid #40ee80' : isInBuildingOutputs ? '3px solid #88ddff' : `3px solid ${typeColor}`,
                      background: isInBuildingInputs ? '#40ee8014' : isInBuildingOutputs ? '#88ddff10' : isActive ? typeColor + '0d' : 'var(--bg-secondary)',
                      opacity: isDimmed ? 0.28 : 1,
                      cursor: isSelecting && (devIsValid || isInBuilding) ? 'pointer' : 'default',
                      transition: 'border-color 0.15s, background 0.15s, opacity 0.15s',
                      overflow: 'hidden',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
                      <span style={{ fontSize: 12, flexShrink: 0, lineHeight: 1 }}>
                        {getDevIcon(dev)}
                      </span>
                      <span style={{
                        flex: 1, fontSize: 11, fontWeight: isActive ? 600 : 400,
                        color: isInBuildingInputs ? '#40ee80' : isInBuildingOutputs ? '#88ddff' : isActive ? typeColor : 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{dev.name}</span>
                      {dev.type === 'light' && !isSelecting && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: typeColor, boxShadow: isActive ? `0 0 5px ${typeColor}` : 'none' }} />
                      )}
                      {isSelecting ? (
                        isInBuildingInputs
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#40ee8022', color: '#40ee80', fontWeight: 700, flexShrink: 0 }}><CheckIcon width={9} height={9} /> IN</span>
                          : isInBuildingOutputs
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#88ddff18', color: '#88ddff', fontWeight: 700, flexShrink: 0 }}><CheckIcon width={9} height={9} /> OUT</span>
                            : devIsValid
                              ? <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#88ddff18', color: '#88ddff', fontWeight: 700, flexShrink: 0 }}>{buildingRule?.step === 'inputs' ? '⊕ IN' : '⊕ OUT'}</span>
                              : null
                      ) : (
                        <>
                          {(dev.type === 'eml' || dev.type === 'light') && (
                            <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, flexShrink: 0, fontWeight: 700, letterSpacing: 0.5, background: isActive ? typeColor + '22' : '#22222288', color: isActive ? typeColor : '#555' }}>
                              {dev.type === 'eml' ? (isActive ? 'OPEN' : 'LOCK') : (isActive ? 'ON' : 'OFF')}
                            </span>
                          )}
                          {dev.type === 'eml' && (
                            <button onClick={e => { e.stopPropagation()
                              const next = !dev.active
                              setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, active: next } : d))
                              if (next) fireDevRules(dev.uid)
                            }} style={{ padding: '2px 8px', borderRadius: 4, flexShrink: 0, border: `1px solid ${typeColor}44`, background: isActive ? typeColor + '22' : 'transparent', color: isActive ? typeColor : '#888', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{isActive ? '잠금' : '열기'}</button>
                          )}
                          {dev.type === 'trigger' && (
                            <button onClick={e => { e.stopPropagation()
                              const next = !dev.active
                              setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, active: next } : d))
                              if (next) fireDevRules(dev.uid)
                            }} style={{ padding: '2px 8px', borderRadius: 4, flexShrink: 0, border: `1px solid ${typeColor}44`, background: isActive ? typeColor + '22' : 'transparent', color: isActive ? typeColor : '#888', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>▶ 발동</button>
                          )}
                          {dev.type === 'light' && (
                            <button onClick={e => { e.stopPropagation()
                              setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, active: !d.active } : d))
                            }} style={{ padding: '2px 8px', borderRadius: 4, flexShrink: 0, border: `1px solid ${typeColor}44`, background: isActive ? typeColor + '22' : 'transparent', color: isActive ? typeColor : '#888', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{isActive ? 'OFF' : 'ON'}</button>
                          )}
                          {dev.type === 'sound' && (
                            <button onClick={e => { e.stopPropagation()
                              if (!dev.audioUrl) return
                              setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, active: !d.active } : d))
                              if (!dev.active) new Audio(dev.audioUrl).play().catch(() => {})
                            }} style={{ padding: '2px 8px', borderRadius: 4, flexShrink: 0, border: `1px solid ${typeColor}44`, background: isActive ? typeColor + '22' : 'transparent', color: isActive ? typeColor : dev.audioUrl ? '#888' : '#3a3a3a', fontSize: 10, cursor: dev.audioUrl ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: dev.audioUrl ? 1 : 0.5 }}>{isActive ? '⏹' : '▶'}</button>
                          )}
                          {dev.type === 'video' && (
                            <button onClick={e => { e.stopPropagation()
                              if (!dev.videoUrl) return
                              const next = !dev.active
                              setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, active: next } : d))
                              const el = videoEls.current.get(dev.uid)
                              if (el) { if (next) { el.currentTime = 0; el.play().catch(() => {}) } else { el.pause(); el.currentTime = 0 } }
                            }} style={{ padding: '2px 8px', borderRadius: 4, flexShrink: 0, border: `1px solid ${typeColor}44`, background: isActive ? typeColor + '22' : 'transparent', color: isActive ? typeColor : dev.videoUrl ? '#888' : '#3a3a3a', fontSize: 10, cursor: dev.videoUrl ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: dev.videoUrl ? 1 : 0.5 }}>{isActive ? '⏹' : '▶'}</button>
                          )}
                        </>
                      )}
                    </div>
                    {dev.type === 'sound' && !isSelecting && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 6px 30px' }}>
                        <label style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)', background: dev.audioUrl ? '#50e08018' : 'var(--bg-card)', color: dev.audioUrl ? '#50e080' : '#555', flexShrink: 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {dev.audioUrl ? <CheckIcon width={10} height={10} /> : <UploadIcon width={10} height={10} />}
                            {dev.audioUrl ? 'MP3' : '업로드'}
                          </span>
                          <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => {
                            const file = e.target.files?.[0]; if (!file) return
                            const url = URL.createObjectURL(file)
                            const baseName = file.name.replace(/\.[^.]+$/, '')
                            setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, audioUrl: url, audioName: baseName, name: d.name.startsWith('효과음') ? baseName : d.name } : d))
                          }} />
                        </label>
                        <span style={{ fontSize: 9, color: dev.audioUrl ? '#50e08066' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dev.audioUrl ? (dev.audioName ?? dev.name) : 'MP3 없음'}
                        </span>
                      </div>
                    )}
                    {dev.type === 'video' && !isSelecting && (
                      <div style={{ padding: '0 8px 8px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isActive && dev.videoUrl ? 6 : 0 }}>
                          <label style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)', background: dev.videoUrl ? '#ee884418' : 'var(--bg-card)', color: dev.videoUrl ? '#ee8844' : '#555', flexShrink: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {dev.videoUrl ? <CheckIcon width={10} height={10} /> : <UploadIcon width={10} height={10} />}
                              {dev.videoUrl ? 'MP4' : 'MP4 업로드'}
                            </span>
                            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => {
                              const file = e.target.files?.[0]; if (!file) return
                              const url = URL.createObjectURL(file)
                              const baseName = file.name.replace(/\.[^.]+$/, '')
                              setDevItems(prev => prev.map(d => d.uid === dev.uid ? { ...d, videoUrl: url, videoName: baseName, name: d.name.startsWith('영상') ? baseName : d.name } : d))
                            }} />
                          </label>
                          <span style={{ fontSize: 9, color: dev.videoUrl ? '#ee884466' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {dev.videoUrl ? (dev.videoName ?? dev.name) : 'MP4 없음'}
                          </span>
                        </div>
                        {dev.videoUrl && (
                          <video
                            ref={el => { if (el) videoEls.current.set(dev.uid, el) }}
                            src={dev.videoUrl}
                            controls
                            style={{ width: '100%', borderRadius: 6, display: isActive ? 'block' : 'none', background: '#000' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* ── Rule-creation controls ── */}
              {devItems.length > 0 && (
                <div style={{ borderTop: '1px solid #1a2230', paddingTop: 8 }}>
                  {buildingRule === null ? (
                    <button onClick={() => setBuildingRule({ uid: crypto.randomUUID(), inputUids: [], outputUids: [], step: 'inputs' })} style={{
                      width: '100%', padding: '5px', borderRadius: 5,
                      border: '1px dashed #334455', background: 'transparent',
                      color: '#556677', fontSize: 10, cursor: 'pointer', fontWeight: 600,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#88ddff'; e.currentTarget.style.borderColor = '#88ddff66' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#556677'; e.currentTarget.style.borderColor = '#334455' }}>
                      + 규칙 추가
                    </button>
                  ) : (
                    <div style={{ borderRadius: 6, background: '#88ddff0a', border: '1px dashed #88ddff44', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {/* Step indicator + cancel */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: buildingRule.step === 'inputs' ? '#40ee80' : '#88ddff', fontWeight: 700, flex: 1 }}>
                          {buildingRule.step === 'inputs' ? '① Input 장치 선택 (다중가능)' : '② Output 장치 선택 (다중가능)'}
                        </span>
                        <button onClick={() => setBuildingRule(null)} style={{ background: 'none', border: 'none', color: '#556677', fontSize: 11, cursor: 'pointer', padding: '0 2px' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ff6666')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#556677')}>
                          <CloseIcon width={11} height={11} />
                        </button>
                      </div>
                      {/* Selected inputs preview */}
                      {buildingRule.inputUids.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: '#40ee8088' }}>IN:</span>
                          {buildingRule.inputUids.map(uid => {
                            const d = devItems.find(x => x.uid === uid)
                            return d ? <span key={uid} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#40ee8018', color: '#40ee80', border: '1px solid #40ee8033' }}>{getDevIcon(d)} {d.name}</span> : null
                          })}
                        </div>
                      )}
                      {/* Selected outputs preview */}
                      {buildingRule.outputUids.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, color: '#88ddff88' }}>OUT:</span>
                          {buildingRule.outputUids.map(uid => {
                            const d = devItems.find(x => x.uid === uid)
                            return d ? <span key={uid} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#88ddff18', color: '#88ddff', border: '1px solid #88ddff33' }}>{getDevIcon(d)} {d.name}</span> : null
                          })}
                        </div>
                      )}
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        {buildingRule.step === 'inputs' && (
                          <button
                            disabled={buildingRule.inputUids.length === 0}
                            onClick={() => setBuildingRule(prev => prev ? { ...prev, step: 'outputs' } : prev)}
                            style={{
                              flex: 1, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: buildingRule.inputUids.length > 0 ? 'pointer' : 'not-allowed',
                              border: '1px solid #88ddff44', background: buildingRule.inputUids.length > 0 ? '#88ddff18' : 'transparent',
                              color: buildingRule.inputUids.length > 0 ? '#88ddff' : '#334',
                              opacity: buildingRule.inputUids.length > 0 ? 1 : 0.5,
                            }}>→ Output 단계</button>
                        )}
                        {buildingRule.step === 'outputs' && (
                          <>
                            <button onClick={() => setBuildingRule(prev => prev ? { ...prev, step: 'inputs' } : prev)}
                              style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: '1px solid #40ee8033', background: 'transparent', color: '#40ee8088', fontWeight: 600 }}>← Input</button>
                            <button
                              disabled={buildingRule.outputUids.length === 0}
                              onClick={finishBuildingRule}
                              style={{
                                flex: 1, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: buildingRule.outputUids.length > 0 ? 'pointer' : 'not-allowed',
                                border: '1px solid #40ee8044', background: buildingRule.outputUids.length > 0 ? '#40ee8018' : 'transparent',
                                color: buildingRule.outputUids.length > 0 ? '#40ee80' : '#334',
                                opacity: buildingRule.outputUids.length > 0 ? 1 : 0.5,
                              }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckIcon width={10} height={10} />
                                완료
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Place palette panel (edit mode only) */}
        {mode === 'edit' && tool === 'place' && (
          <div style={{
            width: widePalette ? '100%' : 196, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0,
            background: 'var(--bg-card)', borderRadius: 12,
            border: '1px solid var(--border)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}>
            {/* Panel header — 제품 / Lock 그룹 탭 */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              {(['product', 'lock', 'mark'] as const).map(g => {
                const active = selGroup === g
                const label = g === 'product' ? 'Clue' : g === 'lock' ? 'Lock' : 'Mark'
                return (
                  <button key={g} onClick={() => { setSelGroup(g); setSelItem(null) }} style={{
                    flex: 1, padding: '9px 8px', border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: active ? 700 : 500,
                    background: active ? 'var(--bg-card)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1, transition: 'color 0.1s, background 0.1s',
                  }}>{label}</button>
                )
              })}
            </div>

            {/* Mark 팔레트 */}
            {selGroup === 'mark' && (<>
              <div style={{ display: 'grid', gridTemplateColumns: widePalette ? 'repeat(auto-fill, minmax(80px, 1fr))' : '1fr 1fr', gap: 6, padding: 10, maxHeight: widePalette ? 160 : (selMarkId === 'polygon' ? 260 : 360), overflowY: 'auto' }}>
                {MARKS.map(mk => {
                  const active = selMarkId === mk.id
                  return (
                    <button key={mk.id} onClick={() => setSelMarkId(mk.id as MarkId)} style={{
                      padding: '10px 6px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}>{mk.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{mk.name}</span>
                    </button>
                  )
                })}
              </div>

              {/* 번호판 컨트롤 — numMark 선택 시 표시 */}
              {selMarkId === 'numMark' && (
                <div style={{ padding: '10px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 폰트 크기 조절 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>글자 크기</span>
                    <button onClick={() => setNumMarkFontSize(s => Math.max(8, s - 2))} style={{
                      width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>−</button>
                    <span style={{ width: 32, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{numMarkFontSize}</span>
                    <button onClick={() => setNumMarkFontSize(s => Math.min(40, s + 2))} style={{
                      width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>+</button>
                  </div>
                  {/* 색상 선택 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%' }}>배경색</span>
                    {['#e8e020','#ef4444','#f97316','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f8fafc','#334155'].map(c => (
                      <button key={c} onClick={() => setNumMarkColor(c)} style={{
                        width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                        background: c, border: numMarkColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: numMarkColor === c ? '0 0 0 2px var(--accent)' : 'none',
                        transition: 'box-shadow 0.1s',
                      }} />
                    ))}
                  </div>
                  {/* 선택된 numMark 텍스트 + 폰트 크기 편집 */}
                  {(() => {
                    const sn = selMarkUid ? marks.find(m => m.uid === selMarkUid && m.markId === 'numMark') : null
                    if (!sn) return null
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>번호판 텍스트</span>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input
                            type="text"
                            value={sn.label ?? ''}
                            maxLength={6}
                            onChange={e => setMarks(prev => prev.map(m =>
                              m.uid === sn.uid ? { ...m, label: e.target.value } : m
                            ))}
                            placeholder="번호 또는 텍스트"
                            style={{
                              flex: 1, padding: '5px 8px', borderRadius: 5,
                              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => setMarks(prev => prev.map(m =>
                              m.uid === sn.uid ? { ...m, label: '' } : m
                            ))}
                            title="텍스트 지우기"
                            style={{
                              padding: '0 8px', borderRadius: 5, border: '1px solid var(--border)',
                              background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                              fontSize: 13, cursor: 'pointer',
                            }}>
                              <CloseIcon width={11} height={11} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>이 번호판 글자 크기</span>
                          <button onClick={() => setMarks(prev => prev.map(m =>
                            m.uid === sn.uid ? { ...m, fontSize: Math.max(8, (m.fontSize ?? 22) - 2) } : m
                          ))} style={{
                            width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                          }}>−</button>
                          <span style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{sn.fontSize ?? 22}</span>
                          <button onClick={() => setMarks(prev => prev.map(m =>
                            m.uid === sn.uid ? { ...m, fontSize: Math.min(40, (m.fontSize ?? 22) + 2) } : m
                          ))} style={{
                            width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                          }}>+</button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* 도형 제작 컨트롤 — polygon 선택 시 표시 */}
              {selMarkId === 'polygon' && (
                <div style={{ padding: '10px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 각도 수 선택 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>꼭짓점 수</span>
                    <button onClick={() => setShapeSides(s => Math.max(3, s - 1))} style={{
                      width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>−</button>
                    <span style={{
                      width: 32, textAlign: 'center', fontSize: 15, fontWeight: 700,
                      color: 'var(--accent)',
                    }}>{shapeSides}</span>
                    <button onClick={() => setShapeSides(s => Math.min(10, s + 1))} style={{
                      width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>+</button>
                  </div>
                  {/* 빠른 선택 버튼 3~10 */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => setShapeSides(n)} style={{
                        width: 28, height: 22, borderRadius: 4, fontSize: 10, fontWeight: shapeSides === n ? 700 : 400,
                        cursor: 'pointer',
                        border: shapeSides === n ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: shapeSides === n ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                        color: shapeSides === n ? 'var(--accent)' : 'var(--text-muted)',
                      }}>{n}</button>
                    ))}
                  </div>
                  {/* 색상 선택 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%' }}>색상</span>
                    {['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f8fafc','#334155'].map(c => (
                      <button key={c} onClick={() => setShapeColor(c)} style={{
                        width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                        background: c, border: shapeColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                        boxShadow: shapeColor === c ? '0 0 0 2px var(--accent)' : 'none',
                        transition: 'box-shadow 0.1s',
                      }} />
                    ))}
                  </div>

                  {/* 글자 크기 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>글자 크기</span>
                    <button onClick={() => setShapeFontSize(s => Math.max(6, s - 1))} style={{
                      width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>−</button>
                    <span style={{ width: 32, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{shapeFontSize}</span>
                    <button onClick={() => setShapeFontSize(s => Math.min(40, s + 1))} style={{
                      width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                    }}>+</button>
                  </div>

                  {/* 선택된 polygon 텍스트 편집 */}
                  {(() => {
                    const sp = selMarkUid ? marks.find(m => m.uid === selMarkUid && m.markId === 'polygon') : null
                    if (!sp) return null
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>도형 내 텍스트</span>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input
                            type="text"
                            value={sp.label ?? String(sp.sides ?? 6)}
                            maxLength={6}
                            onChange={e => setMarks(prev => prev.map(m =>
                              m.uid === sp.uid ? { ...m, label: e.target.value } : m
                            ))}
                            placeholder="비워두면 텍스트 없음"
                            style={{
                              flex: 1, padding: '5px 8px', borderRadius: 5,
                              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => setMarks(prev => prev.map(m =>
                              m.uid === sp.uid ? { ...m, label: '' } : m
                            ))}
                            title="텍스트 지우기"
                            style={{
                              padding: '0 8px', borderRadius: 5, border: '1px solid var(--border)',
                              background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                              fontSize: 13, cursor: 'pointer',
                            }}>
                              <CloseIcon width={11} height={11} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>이 도형 글자 크기</span>
                          <button onClick={() => setMarks(prev => prev.map(m =>
                            m.uid === sp.uid ? { ...m, fontSize: Math.max(6, (m.fontSize ?? shapeFontSize) - 1) } : m
                          ))} style={{
                            width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                          }}>−</button>
                          <span style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{sp.fontSize ?? shapeFontSize}</span>
                          <button onClick={() => setMarks(prev => prev.map(m =>
                            m.uid === sp.uid ? { ...m, fontSize: Math.min(40, (m.fontSize ?? shapeFontSize) + 1) } : m
                          ))} style={{
                            width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                          }}>+</button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: 9, color: '#334455', lineHeight: 1.8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <PlaceCursorIcon width={10} height={10} /> 캔버스 클릭으로 배치 (3×3 기본)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MoveArrowsIcon width={10} height={10} /> 모서리 드래그로 크기 조절
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MoveArrowsIcon width={10} height={10} /> 마크 드래그로 이동
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: eraseMode ? '#ff8585' : '#556677' }}>
                    <EraserIcon width={10} height={10} /> 지우개 모드에서만 삭제
                  </div>
                </div>
              </div>
            </>)}

            {/* 제품 카테고리 서브 탭 */}
            {selGroup === 'product' && (
              <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
                {(Object.entries(CAT_LABELS) as [Cat, string][]).filter(([cat]) => cat !== 'door' && cat !== 'lock').map(([cat, label]) => {
                  const active = selCat === cat
                  return (
                    <button key={cat} onClick={() => { setSelCat(cat); setSelItem(null) }} style={{
                      flexShrink: 0, padding: '7px 10px', border: 'none', fontSize: 10, cursor: 'pointer',
                      background: 'transparent',
                      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: active ? 700 : 400, marginBottom: -1,
                      transition: 'color 0.1s',
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Item grid */}
            {selGroup !== 'mark' && <div style={{ display: 'grid', gridTemplateColumns: widePalette ? 'repeat(auto-fill, minmax(80px, 1fr))' : '1fr 1fr', gap: 6, padding: '10px', maxHeight: widePalette ? 180 : 420, overflowY: 'auto' }}>
              {catItems.map(item => {
                const active = selItem === item.id
                return (
                  <button key={item.id}
                    onClick={() => { setSelItem(item.id === selItem ? null : item.id); setTool('place'); setRotation(0) }}
                    style={{
                      padding: '10px 6px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'border-color 0.1s, background 0.1s',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--accent)44'; e.currentTarget.style.background = '#1a2030' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' } }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 20, lineHeight: 1 }}>
                      {ITEM_ICONS[item.id] ?? <BoxIcon width={18} height={18} />}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, lineHeight: 1.2 }}>{item.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>{item.w}×{item.h}</span>
                  </button>
                )
              })}
            </div>}

            {/* Footer — product/lock mode only */}
            {selGroup !== 'mark' && <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: widePalette ? 'row' : 'column', flexWrap: 'wrap', gap: 6, alignItems: widePalette ? 'center' : 'stretch' }}>
              {/* Action row */}
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>
                  {placedItems.length > 0 ? `${placedItems.length}개 배치됨` : '배치 없음'}
                </span>
              </div>
              {/* Hint row */}
              <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#445566' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PlaceCursorIcon width={10} height={10} /> 배치</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MoveArrowsIcon width={10} height={10} /> 이동·선택</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: eraseMode ? '#ff8585' : '#556677' }}><EraserIcon width={10} height={10} /> 지우개 모드에서 삭제</span>
              </div>
            </div>}
          </div>
        )}
      </div>
    </div>
  )
}
