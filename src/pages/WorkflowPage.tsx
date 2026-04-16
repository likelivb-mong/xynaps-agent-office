import { useNavigate } from 'react-router-dom'
import { AGENTS } from '../data/agents'
import type { AgentId } from '../types'
import { AgentIcon } from '../components/ui/AgentIcon'
import { RefreshIcon, DownloadIcon } from '../components/ui/Icon'

const AGENT_TASKS: Record<AgentId, string[]> = {
  ceo: ['테마 정체성·감성 방향 설정', '장르 전략 및 핵심 콘셉트 정의', '도면·첨부파일 초기 분석'],
  concept: ['세계관 구축 및 시대·배경 설정', '등장인물 동기·배경·관계 개발', '사건 타임라인 및 반전 구조 설계'],
  pd: ['전체 플레이 타임라인 설계', '단계별 플레이어 행동 흐름 정의', '난이도 밸런스 및 엔딩 조건 설정'],
  puzzle: ['퍼즐 유형 설계 (평면/입체/공간/감각)', 'X-KIT·자물쇠·전자장치 활용 기획', '단서 배치 및 힌트 체계 설계'],
  space: ['도면 기반 방별 소품 배치', '동선 및 공간 서사 설계', '조명·사운드·분위기 연출 기획'],
  ops: ['게임 마스터(GM) 대본 및 힌트 프로토콜', '플레이어 브리핑·디브리핑 절차', '소품 조달·예산·안전 체크리스트'],
  sound: ['배경음·효과음 큐시트 설계', '상황별 오디오 트리거·볼륨 밸런스 튜닝', '몰입감 강화 사운드 연출 시나리오 작성'],
  xfiler: ['포렌식·현장수사 단서 시나리오 설계', '증거 수집/분석 UX 흐름 정의', '수사 리포트·판정 규칙 및 실패 분기 설계'],
}

export function WorkflowPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        padding: '16px 32px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
          fontSize: 12, cursor: 'pointer', padding: '5px 10px', borderRadius: 7,
        }}>← 홈</button>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>협업 파이프라인</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          AI 에이전트가 어떻게 함께 작업하는지 확인하세요
        </span>
      </header>

      <main style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* 파이프라인 전체 구조 */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>파이프라인 구조</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            각 에이전트는 이전 에이전트의 보고서를 누적하여 받은 뒤 자신의 전문 영역을 분석합니다
          </p>

          {/* 파이프라인 단계 시각화 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {/* 입력 */}
            <PipelineNode
              icon={<DownloadIcon width={20} height={20} />}
              label="프로젝트 입력"
              sublabel="테마·장르·사건설정"
              color="var(--text-muted)"
              isFirst
            />

            {/* 에이전트 */}
            {AGENTS.map((agent, i) => (
              <PipelineNode
                key={agent.id}
                icon={<AgentIcon agentId={agent.id} width={20} height={20} />}
                label={agent.name}
                sublabel={agent.role}
                color={agent.color}
                index={i + 1}
              />
            ))}

            {/* 컴파일러 */}
            <PipelineNode
              icon={<RefreshIcon width={20} height={20} />}
              label="GameFlow Compiler"
              sublabel="보고서 → JSON 구조화"
              color="var(--accent)"
              isLast
            />

            {/* 출력 */}
            <PipelineNode
              icon={<span style={{ fontSize: 11, fontWeight: 700 }}>GF</span>}
              label="게임 플로우 시트"
              sublabel="편집 가능한 테이블"
              color="var(--puzzle)"
              isOutput
            />
          </div>
        </div>

        {/* 에이전트 카드 그리드 */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>에이전트 담당 영역</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            각 에이전트의 전문 영역과 구체적인 작업 내용
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {AGENTS.map((agent, i) => (
              <AgentTaskCard
                key={agent.id}
                agent={agent}
                tasks={AGENT_TASKS[agent.id] ?? []}
                index={i + 1}
              />
            ))}
          </div>
        </div>

        {/* 컴파일러 설명 */}
        <div style={{
          marginTop: 24,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid var(--accent)',
          borderRadius: 16, padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: 'var(--accent-dim)', border: '1px solid var(--border-bright)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <RefreshIcon width={16} height={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>GameFlow Compiler</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>6개 보고서 → 구조화된 게임 플로우 시트</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'X (Xkit)', color: '#fef3c7', textColor: '#92400e', desc: '엑스키트 디지털 인터페이스 — 정보확인·단서해석·정답입력 시스템' },
              { label: 'K (Key)', color: '#d1fae5', textColor: '#065f46', desc: '오프라인 자물쇠·잠금장치 — 서랍·상자·가방·함·키패드 등' },
              { label: 'D (Dev)', color: '#dbeafe', textColor: '#1e40af', desc: '전자장치 — 입력값→출력값이 명확한 센서·자동장치' },
            ].map(item => (
              <div key={item.label} style={{
                background: item.color + '22', border: `1px solid ${item.color}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: item.color, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>문제 유형 분류:</strong>{' '}
            <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>평면</span>
            텍스트·영상·x-kit·UV ·{' '}
            <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>입체</span>
            물품·장치 ·{' '}
            <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>공간</span>
            배치·협동 ·{' '}
            <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px' }}>감각</span>
            시각·청각·후각·미각·촉각
          </div>
        </div>
      </main>
    </div>
  )
}

interface PipelineNodeProps {
  icon: React.ReactNode
  label: string
  sublabel: string
  color: string
  index?: number
  isFirst?: boolean
  isLast?: boolean
  isOutput?: boolean
}

function PipelineNode({ icon, label, sublabel, color, index, isFirst, isLast, isOutput }: PipelineNodeProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {!isFirst && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          color: 'var(--text-muted)', fontSize: 11, minWidth: 36,
        }}>
          <div style={{ color: 'var(--border-bright)', fontSize: 14 }}>›</div>
          {isLast && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: 2 }}>
              누적
            </div>
          )}
        </div>
      )}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: 100, textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: isOutput ? 12 : '50%',
          background: 'var(--bg-card)',
          border: `1.5px solid ${isLast || isOutput ? color : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color, marginBottom: 8,
        }}>
          {icon}
        </div>
        {index && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: color,
            background: `${color}22`, borderRadius: 6,
            padding: '1px 5px', marginBottom: 4, letterSpacing: '0.5px',
          }}>STEP {index}</div>
        )}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{sublabel}</div>
      </div>
    </div>
  )
}

interface AgentTaskCardProps {
  agent: { id: AgentId; name: string; role: string; description: string; color: string }
  tasks: string[]
  index: number
}

function AgentTaskCard({ agent, tasks, index }: AgentTaskCardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: agent.color + '15',
          border: `1px solid ${agent.color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: agent.color, flexShrink: 0,
        }}>
          <AgentIcon agentId={agent.id} width={16} height={16} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: agent.color,
              background: `${agent.color}22`, borderRadius: 4, padding: '1px 5px',
            }}>STEP {index}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agent.role}</div>
        </div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {tasks.map((task, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            <span style={{ color: agent.color, marginTop: 2, flexShrink: 0 }}>▸</span>
            <span>{task}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
