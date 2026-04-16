// Minimal SVG icon set — Apple-style, 14×14 default, currentColor stroke

type IconProps = React.SVGProps<SVGSVGElement>

const base = (d: string, extra?: string) =>
  (props: IconProps) => (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      {...props}>
      <path d={d} />
      {extra && <path d={extra} />}
    </svg>
  )

export const PaperclipIcon = base(
  'M13.5 7.5l-6 6a4 4 0 01-5.66-5.66l6-6a2.5 2.5 0 013.54 3.54l-6.01 6a1 1 0 01-1.41-1.42L10 3.5'
)

export const DownloadIcon = base(
  'M8 2v9M4 8l4 4 4-4', 'M2 14h12'
)

export const UploadIcon = base(
  'M8 14V5M4 8l4-4 4 4', 'M2 2h12'
)

export const ChatIcon = base(
  'M14 10a2 2 0 01-2 2H5l-3 3V4a2 2 0 012-2h8a2 2 0 012 2v6z'
)

export const DatabaseIcon = (props: IconProps) => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
    {...props}>
    <ellipse cx="8" cy="4" rx="6" ry="2.2" />
    <path d="M2 4v4c0 1.2 2.7 2.2 6 2.2S14 9.2 14 8V4" />
    <path d="M2 8v4c0 1.2 2.7 2.2 6 2.2S14 13.2 14 12V8" />
  </svg>
)

export const PlusIcon = base('M8 2v12M2 8h12')

export const TrashIcon = base(
  'M3 4h10M6 4V2h4v2M5 4l1 10h4l1-10'
)

export const CopyIcon = base(
  'M11 2H5a1 1 0 00-1 1v9a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z',
  'M13 5h1a1 1 0 011 1v7a1 1 0 01-1 1H8a1 1 0 01-1-1v-1'
)

export const RefreshIcon = base(
  'M13 8a5 5 0 11-1.45-3.55M13 8V4.5M13 8h-3.5'
)

export const BoxIcon = base(
  'M2 5.5L8 2l6 3.5v5L8 14l-6-3.5v-5z',
  'M8 2v12M2 5.5l6 3.5 6-3.5'
)

export const ChevronDownIcon = base('M4 6l4 4 4-4')
export const ChevronRightIcon = base('M6 4l4 4-4 4')
export const ChevronLeftIcon = base('M10 4l-4 4 4 4')
export const ChevronUpIcon = base('M4 10l4-4 4 4')

export const CheckIcon = base('M3 8l3.5 3.5L13 4')

export const CloseIcon = base('M3 3l10 10M13 3L3 13')

export const ExportIcon = base(
  'M10 2h4v4M14 2L8 8', 'M7 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9'
)

export const SaveDiskIcon = base(
  'M3 2.5h8.5L14 5v8.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z',
  'M5 2.5v4h5v-4M5 13v-3.5h6V13'
)

export const EyeIcon = base(
  'M1 8S3.5 3 8 3s7 5 7 5-2.5 5-7 5S1 8 1 8z',
  'M10 8a2 2 0 11-4 0 2 2 0 014 0'
)

export const ListIcon = base('M3 4h10M3 8h10M3 12h10')

export const HistoryIcon = base(
  'M1 8a7 7 0 1014 0A7 7 0 001 8z', 'M8 5v4l2.5 2.5'
)

export const SunIcon = base(
  'M8 3.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z',
  'M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1'
)

export const MoonIcon = base(
  'M10.8 2.3A5.8 5.8 0 108 13.8a6 6 0 01-5.8-6 6 6 0 018.6-5.5z'
)

export const WorkflowIcon = base(
  'M2 8h3M11 8h3M5 8a3 3 0 106 0 3 3 0 00-6 0'
)

export const ScissorsIcon = base(
  'M7.5 8.5L13.5 2.5M7.5 7.5l6 6',
  'M4.5 6.5a2 2 0 110-4 2 2 0 010 4zM4.5 14a2 2 0 110-4 2 2 0 010 4z'
)

export const WriteIcon = base(
  'M11 2l3 3-8 8H3v-3L11 2z'
)

export const PinIcon = base(
  'M12 2a4 4 0 00-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 00-4-4z',
  'M12 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3'
)

// ── Agent pictogram icons ─────────────────────────────────────────────────────

// CEO / Creative Director — Crown
export function AgentIconCeo(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12h12M3 12l1.5-5 3.5 3 3.5-3 1.5 5" />
      <circle cx="3" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="4.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Story Architect — Open book
export function AgentIconConcept(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 14V4" />
      <path d="M8 4a3 3 0 00-3-2H2v10h3a3 3 0 013 2" />
      <path d="M8 4a3 3 0 013-2h3v10h-3a3 3 0 00-3 2" />
    </svg>
  )
}

// Game Director — Play button
export function AgentIconPd(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6.5 5.5l4.5 2.5-4.5 2.5V5.5z" />
    </svg>
  )
}

// Puzzle Master — Puzzle piece
export function AgentIconPuzzle(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 2H3a1 1 0 00-1 1v3h2a1.5 1.5 0 110 3H2v3a1 1 0 001 1h3v-2a1.5 1.5 0 013 0v2h3a1 1 0 001-1v-3h-2a1.5 1.5 0 010-3h2V3a1 1 0 00-1-1H9V4a1.5 1.5 0 01-3 0V2z" />
    </svg>
  )
}

// Space Designer — Floor plan
export function AgentIconSpace(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <path d="M1.5 8h8M9.5 8v6M9.5 4h4" />
    </svg>
  )
}

// Operations Manager — Clipboard with check
export function AgentIconOps(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 2h4v2H6V2z" />
      <path d="M5 3H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1h-2" />
      <path d="M5 9l2 2 4-4" />
    </svg>
  )
}

// Sound Artist — Speaker with waves
export function AgentIconSound(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 3v10L5 10H2a1 1 0 01-1-1V7a1 1 0 011-1h3l4-3z" />
      <path d="M12 5.5a4.5 4.5 0 010 5" />
      <path d="M13.5 3.5a7 7 0 010 9" />
    </svg>
  )
}

// X-Filer — Magnifying glass + crosshair
export const AgentIconXfiler = base(
  'M11.5 11.5L15 15M6.5 12a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM4.5 6.5h4M6.5 4.5v4'
)

// Common Skills — Stacked layers
export const AgentIconCommon = base(
  'M8 1.5L14.5 5 8 8.5 1.5 5 8 1.5zM1.5 9.5L8 13l6.5-3.5M1.5 6.5L8 10l6.5-3.5'
)

// Folder (empty state)
export const FolderIcon = base(
  'M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z'
)

// ── GameFlow / Studio icons ───────────────────────────────────────────────────

// Search / Magnify glass (Xkit)
export const SearchIcon = base('M10.5 10.5L14 14M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9z')

// Padlock (Lock / Key col / close trigger / eml device)
export function LockIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      <path d="M5 7V5.5a3 3 0 016 0V7" />
      <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Lightning / Zap (Dev col)
export const ZapIcon = base('M9 2L3.5 9H8L6.5 14 13.5 7H8.5z')

// Grid table (empty state)
export function GridTableIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <path d="M1.5 5.5h13M5.5 5.5v9M10.5 5.5v9M1.5 10.5h13" />
    </svg>
  )
}

// Button press — circle with filled dot (trigger: button)
export function ButtonPressIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Folder open (trigger: open)
export function FolderOpenIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1.5 4a1 1 0 011-1h3.5l2 2h4.5a1 1 0 011 1v1H1.5V4z" />
      <path d="M1.5 7l1.5 7h10l1.5-7H1.5z" />
    </svg>
  )
}

// Box with down-arrow (trigger: puton)
export function BoxArrowDownIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 1.5v7M5.5 6l2.5 2.5L11 6" />
      <path d="M2 10.5l1.5-3h9l1.5 3v4H2v-4z" />
    </svg>
  )
}

// Open hand / remove (trigger: remove)
export function HandRemoveIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2v6" />
      <path d="M6 3.5V2M10 3.5V2M12 5.5V4M4 6V3.5" />
      <path d="M4 7.5C4 7.5 4 12.5 8 12.5S12 7.5 12 7.5V6.5" />
    </svg>
  )
}

// Key (trigger: key)
export function KeyTriggerIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="5.5" cy="7.5" r="3.5" />
      <path d="M8.5 9.5H14M12 9.5V12M14 9.5V11.5" />
    </svg>
  )
}

// Walking person (mark: runPerson)
export function PersonWalkIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9.5" cy="2.5" r="1.5" />
      <path d="M9.5 4.5L7 9M9.5 4.5L12 7.5M7 9L5.5 14M7 9h3.5M12 7.5L13 11" />
    </svg>
  )
}

// Arrow up — pointed (mark: arrowMark)
export const ArrowUpMarkIcon = base('M8 2v12M4 6l4-4 4 4')

// Circle (mark: circleMark)
export function CircleMarkIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  )
}

// X cross (mark: exMark) — bolder than CloseIcon
export const XMarkIcon = base('M4 4l8 8M12 4L4 12')

// Hash / number (mark: numMark)
export const HashIcon = base('M5 2l-1.5 12M12.5 2L11 14M2 6h12M1.5 10h12')

// Hexagon (mark: polygon)
export function HexagonIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 1.5l5.5 3.25v6.5L8 14.5l-5.5-3.25V4.75z" />
    </svg>
  )
}

// Light bulb (dev: light)
export function LightBulbIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5.5 12.5h5M6 14h4" />
      <path d="M8 2a5 5 0 013.9 8.1c-.6.7-.9 1.3-.9 1.9H5c0-.6-.3-1.2-.9-1.9A5 5 0 018 2z" />
    </svg>
  )
}

// Film strip (dev: video)
export function FilmIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="4" width="13" height="8" rx="1" />
      <path d="M4.5 4V12M11.5 4V12M1.5 8h13" />
    </svg>
  )
}

// Music note (dev: sound / default)
export function MusicNoteIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="5.5" cy="12" r="2" />
      <circle cx="12" cy="10" r="2" />
      <path d="M7.5 12V5L14 3.5v7" />
    </svg>
  )
}

// ── MetaStudio toolbar icons ──────────────────────────────────────────────────

// Floor tiles (2×2 grid)
export function FloorTileIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="0.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="0.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="0.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="0.5" />
    </svg>
  )
}

// Brick wall
export function WallBrickIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <path d="M1.5 6.5h13M1.5 10.5h13" />
      <path d="M5.5 2.5v4M10.5 6.5v4M5.5 10.5v3.5M10.5 2.5v4" />
    </svg>
  )
}

// Door panel
export function DoorPanelIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="1.5" width="9" height="13" rx="1" />
      <path d="M3.5 14.5H1.5M12.5 14.5H14.5" />
      <circle cx="11" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Eraser tool
export function EraserIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 13h10M9.5 2.5L14 7l-5.5 6H4L2 11l7.5-8.5z" />
      <path d="M9.5 2.5L4 9" />
    </svg>
  )
}

// Place / cursor with dot
export function PlaceCursorIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5.5" width="8.5" height="8.5" rx="1" />
      <path d="M6 5.5V2.5M10.5 6V3M6 2.5h4.5v3" />
      <circle cx="6.25" cy="9.75" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Move / 4-way arrows
export function MoveArrowsIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2v12M2 8h12" />
      <path d="M5.5 4.5L8 2l2.5 2.5M5.5 11.5L8 14l2.5-2.5M4.5 5.5L2 8l2.5 2.5M11.5 5.5L14 8l-2.5 2.5" />
    </svg>
  )
}

// Gear / settings
export function GearIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </svg>
  )
}

// ── Furniture / item icons ─────────────────────────────────────────────────────

// Bed (headboard + pillows + frame)
export function FurnBedIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="6" width="13" height="7.5" rx="1" />
      <path d="M1.5 9h13" />
      <rect x="3" y="7" width="3.5" height="2" rx="0.5" />
      <rect x="9.5" y="7" width="3.5" height="2" rx="0.5" />
      <path d="M1.5 6V4a1 1 0 011-1h2" />
    </svg>
  )
}

// Sofa (back + armrests + cushion split)
export function FurnSofaIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5h10a1 1 0 011 1.5H2A1 1 0 013 5z" />
      <rect x="3" y="6.5" width="10" height="5" rx="1" />
      <rect x="1.5" y="5.5" width="2" height="6" rx="0.5" />
      <rect x="12.5" y="5.5" width="2" height="6" rx="0.5" />
      <path d="M8 6.5v5" />
    </svg>
  )
}

// Chair (seat + backrest)
export function FurnChairIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="7" width="10" height="5" rx="1" />
      <path d="M5 12v2.5M11 12v2.5" />
      <path d="M5 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
    </svg>
  )
}

// Desk (surface + legs + drawer)
export function FurnDeskIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="4" width="13" height="3" rx="1" />
      <path d="M4 7v7M12 7v7" />
      <rect x="7.5" y="8" width="4" height="3.5" rx="0.5" />
    </svg>
  )
}

// Cabinet (box with centered handle)
export function FurnCabinetIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="2" width="11" height="12" rx="1" />
      <path d="M2.5 8h11" />
      <path d="M6.5 5.5h3M6.5 11h3" />
    </svg>
  )
}

// Shelf (box with internal rows)
export function FurnShelfIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="2" width="13" height="12" rx="1" />
      <path d="M1.5 6.5h13M1.5 11h13" />
    </svg>
  )
}

// TV / screen (monitor with stand)
export function FurnTvIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1" />
      <path d="M5.5 14h5M8 11.5v2.5" />
    </svg>
  )
}

// Lamp (shade + pole + base)
export function FurnLampIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 14h6M8 14V8.5" />
      <path d="M5 8.5h6" />
      <path d="M5.5 8.5l1-5h3l1 5" />
    </svg>
  )
}

// Plant (pot + stem + leaf)
export function FurnPlantIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5.5 14h5M8 14V9" />
      <path d="M8 11C7 11 5 10 5 7.5S7 3 8 3s3 2 3 4.5S9 11 8 11z" />
      <path d="M8 9c1 0 3-1 3-3.5" />
    </svg>
  )
}

// Toilet (tank + bowl)
export function FurnToiletIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4.5" y="1.5" width="7" height="3.5" rx="1" />
      <path d="M3 5h10a5 5 0 01-10 0z" />
      <path d="M5.5 10h5a1.5 1.5 0 011.5 1.5v2h-8v-2A1.5 1.5 0 015.5 10z" />
    </svg>
  )
}

// Bathtub (oval tub)
export function FurnBathIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1.5 7.5h13v2.5a5 5 0 01-13 0V7.5z" />
      <path d="M4 7.5V4.5a1.5 1.5 0 013 0" />
      <path d="M4.5 13.5h7" />
    </svg>
  )
}

// Sink (basin + faucet)
export function FurnSinkIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5.5h10a1 1 0 011 1v3a4 4 0 01-12 0v-3a1 1 0 011-1z" />
      <path d="M8 3.5v2" />
      <path d="M6.5 3.5h3" />
    </svg>
  )
}

// Mirror (oval in rectangular frame)
export function FurnMirrorIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="1.5" width="10" height="13" rx="3" />
      <path d="M5 4.5a2.5 2.5 0 012-1.2" />
    </svg>
  )
}

// Fridge / washing machine (tall rect + handle line)
export function FurnFridgeIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="1.5" width="9" height="13" rx="1" />
      <path d="M3.5 7h9" />
      <path d="M6.5 3.5v2M6.5 9v2.5" />
    </svg>
  )
}

// Locker (two-door locker unit)
export function FurnLockerIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <path d="M8 1.5v13" />
      <circle cx="5.5" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Wardrobe (double door with handles)
export function FurnWardrobeIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <path d="M8 1.5v13" />
      <path d="M5.5 7.5h1.5M9 7.5h1.5" />
    </svg>
  )
}

// Printer (body + paper tray)
export function FurnPrinterIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="5" width="11" height="7" rx="1" />
      <path d="M5 5V2.5h6V5" />
      <rect x="5" y="9" width="6" height="3" rx="0.5" />
      <path d="M5 7.5h2" />
    </svg>
  )
}

// Board / blackboard (rect with lines)
export function FurnBoardIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1" />
      <path d="M4 6.5h5M4 9h7" />
      <path d="M6 14.5H8M8 11.5v3" />
    </svg>
  )
}

// IV Stand (pole + wheels + bag)
export function FurnIvStandIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 13V5.5" />
      <path d="M5.5 13.5h5" />
      <path d="M5.5 4a2.5 2.5 0 005 0V2H5.5v2z" />
      <path d="M6.5 5.5v2a1.5 1.5 0 003 0V5.5" />
    </svg>
  )
}

// Medical cabinet (box with red cross symbol)
export function FurnMedCabIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="2" width="11" height="12" rx="1" />
      <path d="M8 5.5v5M5.5 8h5" />
    </svg>
  )
}

// Phone / handset
export function FurnPhoneIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2h3l1.5 3.5-2 1.2a8.5 8.5 0 004.8 4.8l1.2-2L16 11v3a1 1 0 01-1 1A13 13 0 013 3a1 1 0 011-1z" />
    </svg>
  )
}

// Camera / video cam (body + lens)
export function FurnCamIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="4.5" width="9" height="7" rx="1" />
      <path d="M10.5 6.5l4-2v7l-4-2" />
    </svg>
  )
}

// Wall clock (circle with hands)
export function FurnClockIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v3.5l2 2" />
    </svg>
  )
}

// Generic small item (book/bag/object — open rect with lines)
export function FurnItemIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3" width="9" height="10" rx="1" />
      <path d="M6 6.5h4M6 9h4M6 11.5h2.5" />
    </svg>
  )
}

// Dresser (wide low cabinet with drawer handles)
export function FurnDresserIcon(props: IconProps) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="1.5" y="4" width="13" height="10" rx="1" />
      <path d="M1.5 9h13" />
      <path d="M6.5 6.5h3M6.5 11.5h3" />
    </svg>
  )
}

// ── CSS Spinner — pure div, no emoji
export function Spinner({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', flexShrink: 0,
      width: size, height: size,
      borderRadius: '50%',
      border: `${Math.max(1.5, size * 0.13)}px solid rgba(255,255,255,0.12)`,
      borderTopColor: color,
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
