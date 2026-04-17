import { useState, useCallback } from 'react'
import { getEstimatedCost, type CostActionType } from '../../lib/api'
import { SETTINGS_KEY } from '../../contexts/SettingsContext'

const ACTION_LABELS: Record<CostActionType, { title: string; desc: string }> = {
  'full-collaboration': {
    title: '전체 협업 실행',
    desc: '모든 에이전트가 순서대로 기획 보고서를 작성합니다.',
  },
  'rerun-from-agent': {
    title: '에이전트부터 재실행',
    desc: '선택한 에이전트부터 이후 전체를 다시 실행합니다.',
  },
  'game-flow': {
    title: '게임 플로우 생성',
    desc: '모든 에이전트 결과를 종합해 게임 플로우 시트를 생성합니다.',
  },
  'regenerate': {
    title: '보고서 업데이트',
    desc: '회의 내용을 반영해 이 에이전트의 보고서를 재작성합니다.',
  },
}

function getTierLabel() {
  try {
    const tier = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').modelTier ?? '균형'
    return tier as string
  } catch { return '균형' }
}

interface PendingAction {
  type: CostActionType
  onConfirmed: () => void
}

interface UseCostConfirmReturn {
  requireConfirm: (type: CostActionType, onConfirmed: () => void) => void
  modal: React.ReactNode
}

export function useCostConfirm(): UseCostConfirmReturn {
  const [pending, setPending] = useState<PendingAction | null>(null)

  const requireConfirm = useCallback((type: CostActionType, onConfirmed: () => void) => {
    const cost = getEstimatedCost(type)
    if (cost === null) {
      // Max구독연결 or free — skip confirmation
      onConfirmed()
      return
    }
    setPending({ type, onConfirmed })
  }, [])

  const handleConfirm = () => {
    pending?.onConfirmed()
    setPending(null)
  }

  const handleCancel = () => setPending(null)

  const modal = pending ? (
    <CostConfirmModal
      actionType={pending.type}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { requireConfirm, modal }
}

interface CostConfirmModalProps {
  actionType: CostActionType
  onConfirm: () => void
  onCancel: () => void
}

function CostConfirmModal({ actionType, onConfirm, onCancel }: CostConfirmModalProps) {
  const { title, desc } = ACTION_LABELS[actionType]
  const cost = getEstimatedCost(actionType)
  const tier = getTierLabel()

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#161920',
          border: '1px solid #2a2d36',
          borderRadius: 16,
          padding: '28px 32px',
          width: 380,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: '#f59e0b', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>⚠</span> API 크레딧 사용 확인
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{title}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
        </div>

        {/* Cost card */}
        <div style={{
          background: '#1e2330',
          border: '1px solid #2f3447',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.08em' }}>
                현재 AI 품질 설정
              </div>
              <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600, marginTop: 2 }}>{tier}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.08em' }}>
                예상 API 비용
              </div>
              <div style={{ fontSize: 16, color: '#f59e0b', fontWeight: 700, marginTop: 2 }}>{cost}</div>
            </div>
          </div>
          <div style={{
            fontSize: 11, color: '#475569', marginTop: 10, lineHeight: 1.5,
            borderTop: '1px solid #2f3447', paddingTop: 10,
          }}>
            스킬 파일 크기에 따라 비용이 달라질 수 있습니다.
            비용 없이 사용하려면 설정에서 <strong style={{ color: '#818cf8' }}>Max구독연결</strong>로 변경하세요.
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9,
              border: '1px solid #2f3447',
              background: 'transparent', color: '#94a3b8',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 9,
              border: 'none',
              background: 'linear-gradient(135deg, #6f7dff, #818cf8)',
              color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            확인하고 실행
          </button>
        </div>
      </div>
    </div>
  )
}
