import type { Agent, GameSystemType } from '../types'

// 기본 6 에이전트 (항상 실행)
// 서라운드 게임: sound 에이전트 추가
// 크라임씬 게임: xfiler 에이전트 추가

export const AGENT_GAME_SYSTEM: Partial<Record<string, GameSystemType>> = {
  sound: 'surround',
  xfiler: 'crimescene',
}

export const AGENTS: Agent[] = [
  {
    id: 'ceo',
    name: '크리에이티브 디렉터',
    role: 'CD · 기획 총괄',
    description: '전체 테마의 창작 방향과 핵심 콘셉트를 정의합니다',
    color: '#9b6dff',
    emoji: '👑',
    skills: [],
  },
  {
    id: 'concept',
    name: '스토리 아키텍트',
    role: 'SA · 세계관·서사',
    description: '테마의 세계관, 인물 서사, 스토리 흐름을 설계합니다',
    color: '#ff6b9d',
    emoji: '🎭',
    skills: [],
  },
  {
    id: 'pd',
    name: '게임 디렉터',
    role: 'GD · 게임구성·밸런스',
    description: '플레이어 경험과 게임 전체 흐름·밸런스를 기획합니다',
    color: '#4da6ff',
    emoji: '🎬',
    skills: [],
  },
  {
    id: 'puzzle',
    name: '퍼즐 마스터',
    role: 'PM · 퍼즐·단서설계',
    description: '퍼즐, 잠금장치, 단서 배치를 구체적으로 설계합니다',
    color: '#00d4aa',
    emoji: '🧩',
    skills: [],
  },
  {
    id: 'space',
    name: '스페이스 디자이너',
    role: 'SD · 공간·연출',
    description: '도면 기반 공간 배치, 동선, 몰입형 연출을 설계합니다',
    color: '#ffaa00',
    emoji: '🏛️',
    skills: [],
  },
  {
    id: 'ops',
    name: '오퍼레이션 매니저',
    role: 'OM · 운영·GM가이드',
    description: '게임 마스터 가이드와 실제 구현 계획을 수립합니다',
    color: '#ff7043',
    emoji: '📋',
    skills: [],
  },
  // ── 확장 에이전트 (게임 시스템 타입에 따라 활성화) ──────────
  {
    id: 'sound',
    name: '음향술사',
    role: 'SA · 서라운드·오디오',
    description: '헤드셋 기반 서라운드 오디오 스크립트와 3D 사운드 배치를 설계합니다',
    color: '#8b5cf6',
    emoji: '🎧',
    skills: [],
  },
  {
    id: 'xfiler',
    name: '엑스파일러',
    role: 'XF · 크라임씬·수사',
    description: 'CSI형 증거 배치, 수사 흐름, 범인 검거 메커니즘을 설계합니다',
    color: '#ef4444',
    emoji: '🔍',
    skills: [],
  },
]
