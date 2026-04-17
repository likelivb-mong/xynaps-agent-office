import { useState, useRef } from 'react'
import type { AgentReport, AgentId } from '../types'
import { AGENTS } from '../data/agents'
import { ReportCard } from '../components/reports/ReportCard'

const BASE_AGENTS: AgentId[] = ['ceo', 'concept', 'pd', 'puzzle', 'space', 'ops']

const MOCK_SUMMARY: Record<AgentId, string> = {
  ceo: '사묘실은 "공포의 옷을 입은 진혼곡"입니다. 감정 곡선은 서늘함→의심·불쾌→먹먹함·자책 3단 전환이며, 장르는 심리 서스펜스 × 학원 괴담 × 진혼 드라마의 3종 하이브리드입니다.',
  concept: '엑스파일러(Xkit)가 1994년과 2026을 교차 체험하는 시간 이중화 구조를 서사의 축으로 삼습니다. 플레이어는 억울한 피해자의 기록을 따라가다 마지막 방관자 최서윤의 죄책감 발신이라는 반전으로 귀결됩니다.',
  pd: '1인 솔로 우선·2~4인 확장 가능한 60분 오디오 몰입형 방탈출로 설계하며, 초반 10분 완전 암흑 바이노럴 구간 이후 UV 랜턴·휴대 조명을 통한 제한적 시야+서라운드 오디오 이중 층위로 전환합니다.',
  puzzle: '석고상 7개·가면 7개·죄악 7개의 7의 구조를 밸런스 척도로 활용해 단서 난이도를 3·2·2로 분배합니다. Xkit 단서를 통해 시간 교차 체험을 구현합니다.',
  space: '폐교 지하 미술실을 세 구역으로 나눠 서사 흐름에 맞게 설계합니다. 완전 암흑 → 제한 시야 → 진실의 방 순서로 공간을 전환하며 몰입도를 높입니다.',
  ops: '회차 운영 체크리스트, 안전 관리 동선, 플레이어 브리핑/디브리핑 절차를 구체화합니다. 1인 운영 기준 최소 2회차 연속 진행 가능한 리셋 절차를 포함합니다.',
  sound: '헤드셋 기반 3D 서라운드 오디오 스크립트를 작성합니다.',
  xfiler: 'CSI형 증거 배치 및 수사 흐름을 설계합니다.',
}

const MOCK_DETAIL: Record<AgentId, string> = {
  ceo: '## 크리에이티브 디렉터 보고서\n\n### 테마 정체성\n사묘실은 공포의 옷을 입은 진혼곡입니다.\n\n### 감성 방향\n- 서늘함(0~15분)\n- 의심·불쾌(15~40분)\n- 먹먹함·자책(40~60분)',
  concept: '## 스토리 아키텍트 보고서\n\n### 세계관\n1994년 폐교 지하 미술실에서 실종된 소녀의 진실.\n\n### 등장인물\n- 영은: 억울한 피해자\n- 최서윤: 마지막 방관자',
  pd: '## 게임 디렉터 보고서\n\n### 플레이 타임라인\n- 0~10분: 완전 암흑 바이노럴\n- 10~40분: 제한 시야\n- 40~60분: 진실의 방',
  puzzle: '## 퍼즐 마스터 보고서\n\n### 퍼즐 구조\n- 석고상 7개 (죄악 대응)\n- Xkit 시간 교차 단서\n- UV 숨김 텍스트',
  space: '## 스페이스 디자이너 보고서\n\n### 공간 구성\n1. 입구 복도: 완전 암흑\n2. 미술실 본관: 제한 시야\n3. 암실: 진실의 방',
  ops: '## 오퍼레이션 매니저 보고서\n\n### 운영 체크리스트\n- 브리핑: 5분\n- 진행: 60분\n- 디브리핑: 10분',
  sound: '## 사운드 보고서\n\n헤드셋 기반 사운드 스크립트.',
  xfiler: '## 엑스파일러 보고서\n\nCSI형 증거 배치.',
}

type AgentState = 'idle' | 'running' | 'done' | 'error'

interface SimConfig {
  agentId: AgentId
  shouldFail: boolean
  delayMs: number
}

function makeReport(agentId: AgentId, state: AgentState, errorMsg?: string): AgentReport {
  const agent = AGENTS.find(a => a.id === agentId)!
  if (state === 'error') {
    return { agentId, agentName: agent.name, summary: '오류가 발생했습니다', detail: errorMsg ?? '알 수 없는 오류', status: 'done' }
  }
  if (state === 'idle' || state === 'running') {
    return { agentId, agentName: agent.name, summary: '', detail: '', status: state === 'running' ? 'running' : 'pending' }
  }
  return { agentId, agentName: agent.name, summary: MOCK_SUMMARY[agentId], detail: MOCK_DETAIL[agentId], status: 'done' }
}

const ERROR_OPTIONS = [
  '응답 시간이 너무 오래 걸려 자동 중단되었습니다. 다시 시도해주세요.',
  'Anthropic API 크레딧이 부족합니다. Plans & Billing에서 크레딧을 충전한 뒤 다시 시도해주세요.',
  'AI 응답 형식을 정리하지 못했습니다. 다시 시도해주세요.',
  '네트워크 또는 API 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
]

export function TestPage() {
  const [configs, setConfigs] = useState<SimConfig[]>(
    BASE_AGENTS.map(id => ({ agentId: id, shouldFail: false, delayMs: 600 }))
  )
  const [reports, setReports] = useState<AgentReport[]>(
    BASE_AGENTS.map(id => makeReport(id, 'idle'))
  )
  const [runningAgentId, setRunningAgentId] = useState<AgentId | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [errorMsg, setErrorMsg] = useState(ERROR_OPTIONS[0])
  const abortRef = useRef(false)

  function reset() {
    abortRef.current = true
    setIsRunning(false)
    setRunningAgentId(null)
    setReports(BASE_AGENTS.map(id => makeReport(id, 'idle')))
  }

  async function runFrom(startId: AgentId) {
    abortRef.current = false
    setIsRunning(true)
    const startIdx = BASE_AGENTS.indexOf(startId)

    setReports(prev => prev.map((r, i) => i < startIdx ? r : makeReport(BASE_AGENTS[i], 'idle')))

    for (let i = startIdx; i < configs.length; i++) {
      if (abortRef.current) break
      const cfg = configs[i]
      setRunningAgentId(cfg.agentId)
      setReports(prev => prev.map(r => r.agentId === cfg.agentId ? makeReport(cfg.agentId, 'running') : r))

      await new Promise(r => setTimeout(r, cfg.delayMs))
      if (abortRef.current) break

      const state: AgentState = cfg.shouldFail ? 'error' : 'done'
      setReports(prev => prev.map(r => r.agentId === cfg.agentId ? makeReport(cfg.agentId, state, errorMsg) : r))
      setRunningAgentId(null)

      if (cfg.shouldFail) break
    }

    setIsRunning(false)
    setRunningAgentId(null)
  }

  function updateConfig(agentId: AgentId, patch: Partial<SimConfig>) {
    setConfigs(prev => prev.map(c => c.agentId === agentId ? { ...c, ...patch } : c))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', padding: '32px 24px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: '#e8e8e8', fontSize: 20, fontWeight: 700, margin: 0 }}>에이전트 실행 테스트</h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 6 }}>실제 API 없이 에이전트 실행 흐름을 시뮬레이션합니다.</p>
        </div>

        {/* 설정 패널 */}
        <div style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => runFrom('ceo')}
              disabled={isRunning}
              style={{
                background: isRunning ? '#333' : '#f0c040', color: '#111', border: 'none', borderRadius: 8,
                padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              ▶ 전체 실행
            </button>
            <button
              onClick={reset}
              style={{
                background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 8,
                padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              }}
            >
              초기화
            </button>
            <select
              value={errorMsg}
              onChange={e => setErrorMsg(e.target.value)}
              style={{
                background: '#111', color: '#ccc', border: '1px solid #333', borderRadius: 8,
                padding: '7px 10px', fontSize: 12, flex: 1, minWidth: 200,
              }}
            >
              {ERROR_OPTIONS.map(o => <option key={o} value={o}>{o.slice(0, 50)}…</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {configs.map(cfg => {
              const agent = AGENTS.find(a => a.id === cfg.agentId)!
              return (
                <div key={cfg.agentId} style={{
                  background: '#111', border: `1px solid ${cfg.shouldFail ? '#7f1d1d' : '#222'}`,
                  borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>{agent.emoji}</span>
                  <span style={{ color: '#ccc', fontSize: 12, flex: 1 }}>{agent.name}</span>
                  <input
                    type="number"
                    value={cfg.delayMs}
                    min={100} max={5000} step={100}
                    onChange={e => updateConfig(cfg.agentId, { delayMs: Number(e.target.value) })}
                    style={{
                      width: 64, background: '#1a1d27', color: '#aaa', border: '1px solid #333',
                      borderRadius: 5, padding: '3px 6px', fontSize: 11, textAlign: 'right',
                    }}
                  />
                  <span style={{ color: '#555', fontSize: 10 }}>ms</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cfg.shouldFail}
                      onChange={e => updateConfig(cfg.agentId, { shouldFail: e.target.checked })}
                    />
                    <span style={{ color: cfg.shouldFail ? '#f87171' : '#555', fontSize: 11 }}>오류</span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>

        {/* 보고서 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map((report, i) => {
            const isThisRunning = runningAgentId === report.agentId
            const isQueued = isRunning && !isThisRunning && report.status === 'pending'
            const queuePos = isQueued ? reports.slice(0, i).filter(r => r.status === 'pending' || r.agentId === runningAgentId).length : undefined
            const isFailed = report.summary?.includes('오류')
            const canRetry = isFailed

            return (
              <ReportCard
                key={report.agentId}
                report={report}
                isRunning={isThisRunning}
                queuePosition={isQueued ? queuePos : undefined}
                projectContext="테스트 프로젝트 컨텍스트"
                previousReports={reports.slice(0, i)}
                showRetryFromHere={canRetry}
                onRetryFromHere={() => runFrom(report.agentId)}
                onRefresh={() => runFrom(report.agentId)}
                isRefreshing={isThisRunning}
                onNewVersion={() => {}}
                onChatSave={() => {}}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
