export type AgentId = 'ceo' | 'concept' | 'pd' | 'puzzle' | 'space' | 'ops' | 'sound' | 'xfiler'

export interface AppUser {
  id: string
  email: string
  displayName: string
}
export type GameSystemType = 'escape' | 'surround' | 'crimescene'
export type BranchCode = 'GDXC' | 'GDXR' | 'NWXC' | 'GNXC' | 'SWXC' | 'XYNP'
export type CharacterRole = '가해자' | '피해자' | '목격자' | '주변인물' | '공범' | '의뢰인'
export type RelationType = '원한' | '연인' | '가족' | '친구' | '동료' | '공모자' | '피고용' | '피해' | '모르는 사이' | '기타'
export type StoryStageKey = '기' | '승' | '전' | '반전' | '결'

export interface Character {
  id: string
  role: CharacterRole
  name: string
  background: string
}
export interface CharacterRelation {
  id: string
  fromId: string
  relationType: string
  toId: string
  description: string
}
export interface StoryStage {
  stage: StoryStageKey
  description: string
  roomName: string
  floorPlan?: SkillFile
}
export interface Agent {
  id: AgentId
  name: string
  role: string
  description: string
  color: string
  emoji: string
  skills: SkillFile[]
}
export interface SkillFile {
  id: string
  name: string
  type: 'pdf' | 'image' | 'text' | 'markdown'
  url?: string
  relativePath?: string
  base64?: string
  mediaType?: string
  uploadedAt: string
  knowledgeSummary?: string
  enabled?: boolean
  guidePrompt?: string
}
export interface CrimeConfig {
  motives: string[]
  crimeTypes: string[]
  clues: string[]
  methods: string[]
  location: string
  characters: Character[]
  relations: CharacterRelation[]
  genres: string[]
  storyFlow: StoryStage[]
  combinationSummary?: string
}
export interface BriefingData {
  messages: ChatMessage[]
  completedAt?: string
}
export type CollaborationPhase = 'running' | 'finalizing'
export interface CollaborationStatus {
  active: boolean
  startedAt: string
  currentAgentId?: AgentId
  completedAgentIds?: AgentId[]
  phase: CollaborationPhase
  versionId?: string
  versionName?: string
}
export interface MeetingMinutes {
  id: string
  order: number
  createdAt: string
  summary: string
  messages: ChatMessage[]
}
export interface Project {
  id: string
  name: string
  theme: string
  branches: BranchCode[]
  sourceDriveLink?: string
  sourceDriveFolderId?: string
  gameSystemTypes?: GameSystemType[]
  crimeConfig?: CrimeConfig
  attachments?: SkillFile[]
  briefings?: Partial<Record<AgentId, BriefingData>>
  meetingMinutes?: MeetingMinutes[]
  collaborationStatus?: CollaborationStatus
  storyNote?: StoryNote   // 스토리 작업노트 (기본 정보 > 스토리 노트)
  createdAt: string
  updatedAt: string
  versions: ProjectVersion[]
  ownerId?: string       // Supabase user id
  ownerName?: string     // display name of creator
  sharedWith?: string[]  // Supabase user ids
}
export type WorkshopTopicType = 'puzzle-fun' | 'twist-logic' | 'flow-natural' | 'custom'

export interface WorkshopDecision {
  id: string
  content: string
  accepted: boolean
  affectedAgents: AgentId[]
  affectedGameFlow: boolean
  applied: boolean
}

export interface WorkshopMessage {
  id: string
  role: 'user' | 'agents'
  content: string
  createdAt: string
}

export interface WorkshopSession {
  id: string
  type: WorkshopTopicType
  title: string
  participants: AgentId[]
  messages: WorkshopMessage[]
  decisions: WorkshopDecision[]
  status: 'open' | 'closed'
  applied: boolean
  createdAt: string
  closedAt?: string
}

export interface ProjectVersion {
  id: string
  versionName: string
  createdAt: string
  agentReports: AgentReport[]
  finalReport?: FinalReport
  storyBeats?: StoryBeatsSheet
  gameFlow?: GameFlowSheet
  audioScript?: AudioScript
  workshopSessions?: WorkshopSession[]
  status: 'draft' | 'in-progress' | 'completed'
}
export interface DetailVersion {
  id: string
  summary: string
  detail: string
  createdAt: string
  label: string
}
export interface AgentReport {
  agentId: AgentId
  agentName: string
  summary: string
  detail: string
  feedback?: string
  status: 'pending' | 'running' | 'done'
  chatHistory?: ChatMessage[]
  detailVersions?: DetailVersion[]
  activeVersionId?: string
}
export interface FinalReport {
  summary: string
  detail: string
  createdAt: string
}
export type ProblemType = '평면' | '입체' | '공간' | '감각' | ''
export interface GameStep {
  id: string
  step: number
  stepGroup?: string
  clue: string
  story?: string
  input: string
  inputTags?: string[]   // IN PUT 분류 태그 (공용 태그 옵션 사용)
  xkit: boolean
  key: boolean
  dev: boolean
  output: string
  outputTags?: string[]  // OUT PUT 분류 태그 (X-kit/Device/Keypad… 프리셋 + 커스텀)
  auto: boolean
  problemType: ProblemType
  note?: string
  pinX?: number
  pinY?: number
}
export interface GameFlowSection {
  id: string
  title: string
  steps: GameStep[]
  mapBox?: {
    x: number
    y: number
    w: number
    h: number
  }
  mapCells?: string[]
}
export interface UserFlowScreen {
  id: string
  title: string
  caption?: string
  linkedStepId?: string
  imageDataUrl?: string
  imageName?: string
  sourceNodeId?: string
  screenKind?: 'manual' | 'xkit' | 'xkit-answer'
  xkitSubtype?: UserJourneyFileType
  statusMode?: 'default' | 'answer'
  answerChainCount?: number
  answerText?: string
  nextScreenId?: string
}
export interface UserFlowLinkNode {
  id: string
  title: string
}

export type UserJourneyNodeType = 'theme' | 'room' | 'step' | 'file' | 'xkit' | 'dev'
export type UserJourneyFileType = 'Clues' | 'Audio' | 'Video'
export type UserJourneyStepChildType = 'file' | 'xkit' | 'dev'
export type UserJourneyDevTriggerType = 'button' | 'open' | 'close' | 'puton' | 'remove' | 'key'

export interface UserJourneyNodeStyle {
  color?: string
  status?: 'default' | 'active' | 'warning' | 'done'
  icon?: string
}

export interface UserJourneyNode {
  id: string
  title: string
  description?: string
  pageUrl?: string
  type: UserJourneyNodeType
  stepChildType?: UserJourneyStepChildType
  fileType?: UserJourneyFileType
  devTriggerType?: UserJourneyDevTriggerType
  roomName?: string
  stepOrder?: number
  stepLabel?: string
  x: number
  y: number
  style?: UserJourneyNodeStyle
  sourceStepId?: string
}

export interface UserJourneyEdge {
  id: string
  source: string
  target: string
  label?: string
  type?: 'flow' | 'branch' | 'result'
}

export interface UserJourneyViewport {
  x: number
  y: number
  zoom: number
}

export interface UserJourneyGraph {
  nodes: UserJourneyNode[]
  edges: UserJourneyEdge[]
  viewport: UserJourneyViewport
  theme?: 'dark' | 'light'
  layoutDirection?: 'horizontal' | 'vertical'
}
export interface UserFlowConfig {
  title: string
  description: string
  branchTitles?: Record<string, string>
  stepTitles?: Record<string, string>
  stepLinks?: Record<string, UserFlowLinkNode[]>
  tableSyncKey?: string
  graph?: UserJourneyGraph
  theme?: 'dark' | 'light'
  screens: UserFlowScreen[]
}
export interface GameFlowSheet {
  sections: GameFlowSection[]
  generatedAt: string
  userFlow?: UserFlowConfig
}

// 게임 플로우 전 단계 — 시드 필드 3막 구조 기반 스토리 비트 시트 (초안)
export interface StoryBeat {
  id: string
  room: string        // 공간 이름 (예: "ROOM 1 — 출입금지실 앞") — 연속 동일 공간은 셀 병합 표시
  roomTag?: string    // 막 라벨 (예: "1막 · 셋업")
  beat: string        // 비트 제목 (예: "셋업 (설정)")
  beatSub?: string    // 비트 부제 (예: "책상방 · 완전 어둠 오프닝")
  content: string     // 비트 내용
}
export interface StoryBeatsSheet {
  beats: StoryBeat[]
  generatedAt: string
  updatedAt?: string  // 수동 편집 시각 — Step Table 재반영 필요 여부 판단용
}

export type AudioChannel = 'L' | 'R' | 'C' | 'L+R' | 'SFX' | '전환'
export type AudioRowKind = 'line' | 'cue'

export interface AudioScriptRow {
  id: string
  kind: AudioRowKind
  channel?: AudioChannel
  content: string
}

export interface AudioScriptTrack {
  id: string
  trackNum: number
  title: string
  timeStart: string
  timeEnd: string
  rows: AudioScriptRow[]
}

export interface AudioScript {
  tracks: AudioScriptTrack[]
  generatedAt: string
}
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentId?: AgentId
  createdAt: string
}

// ── 스토리 작업노트 (소설 작업노트 → 방탈출 스토리 설계 응용) ────────────────
// 프로젝트 단위로 1개. 에이전트 프롬프트 컨텍스트에도 함께 주입된다.
export type StoryEndingType = '감' | '정' | '위' | '대'  // 감정적 감동 · 정보의 폭발 · 위기 발생 · 대치
export type ForeshadowStatus = '설치' | '회수' | '미회수' | '폐기'

export interface StoryCompass {
  logline: string        // 이 한 줄만 보고도 테마 전체가 떠올라야 한다
  coreConflict: string   // 인물이 진짜 싸우고 있는 것
  differentiator: string // 다른 테마와 다른 단 하나의 지점
  genreTone: string      // 장르·분위기·플레이 후 남아야 할 뒷맛
  freeNotes: string      // 그래도 감이 안 잡히면 — 형식 없이 아무거나
}
export interface StoryPrinciple {
  id: string
  title: string
  description: string
  checkQuestion: string  // 막힐 때 스스로 던지는 질문
  note: string           // 이 프로젝트에서의 구체적 적용 메모
}
export interface CharacterSimulation {
  id: string
  situation: string
  reaction: string
}
export interface CharacterCoreSheet {
  id: string
  characterId?: string   // crimeConfig.characters 와 연결 (있으면)
  name: string
  identity: string       // 한 줄 정체성
  lack: string           // 결핍 — 이 인물이 진짜로 원하는 것
  lie: string            // 거짓말 — 자신 또는 세상에게 하고 있는 거짓말 (알리바이·은폐 포함)
  neverDoes: string      // 절대 하지 않을 행동
  mannerisms: string     // 말투·습관의 특징 (음성·메모·단서 톤에 반영)
  simulations: CharacterSimulation[]  // 상황 → 행동 시뮬레이션
}
export interface SpaceNote {
  id: string
  roomName: string
  purpose: string        // 이 공간의 기능 — 왜 이 공간이 필요한가
  duality: string        // 이중성·대비 — 겉보기와 실제, 조명 전/후
  sensoryDetail: string  // 감각적 디테일 — 보이는 것·들리는 것·냄새·온도
  keyEvents: string      // 이 공간이 아니면 일어날 수 없는 핵심 사건·퍼즐
}
export interface RelationArc {
  id: string
  relationId?: string    // crimeConfig.relations 와 연결 (있으면)
  fromName: string
  toName: string
  closenessStart: number // 0(멀어짐) ~ 4(가까움)
  closenessMid: number
  closenessEnd: number
  howShown: string       // 이 변화를 어떤 장면(단서·연출)으로 보여줄 것인가
}
export interface PlotPart {
  stage: StoryStageKey   // 기 / 승 / 전 / 반전 / 결 = 1~5부
  title: string
  goal: string           // 목표
  turningPoint: string   // 전환점
  climax: string         // 클라이맥스
}
export interface RoomNavEntry {
  id: string
  label: string          // 방 이름 또는 구간 이름 (회차에 해당)
  event: string          // 사건 — 이 방에서 벌어지는 일
  emotion: string        // 이번 방의 감정
  playerFeels: string    // 플레이어가 느낄 것
  nextHook: string       // 다음 방 훅
  nextTeaser: string     // 다음 방 예고
  endingType?: StoryEndingType
  checkPacing: boolean       // 강약조절
  checkCharacter: boolean    // 캐릭터 일관성
  checkPlausibility: boolean // 서사 개연성
}
export interface ForeshadowItem {
  id: string
  content: string
  plantedAt: string      // 설치 위치 (방/스텝)
  payoffAt: string       // 회수 위치 (방/스텝)
  status: ForeshadowStatus
  memo: string
}
export interface StoryNote {
  compass: StoryCompass
  principles: StoryPrinciple[]
  characterSheets: CharacterCoreSheet[]
  spaceNotes: SpaceNote[]
  relationArcs: RelationArc[]
  plotParts: PlotPart[]
  roomNav: RoomNavEntry[]
  foreshadows: ForeshadowItem[]
  updatedAt: string
  generatedAt?: string   // AI 초안 생성 시각
}
