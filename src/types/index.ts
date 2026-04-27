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
  xkit: boolean
  key: boolean
  dev: boolean
  output: string
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
