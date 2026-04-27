import { useEffect, useState, useMemo, useRef } from 'react'
import { Renderer, Marked } from 'marked'
import type { AgentReport, ChatMessage, DetailVersion } from '../../types'
import { AGENTS } from '../../data/agents'
import { AgentChatPanel } from './AgentChatPanel'
import { ChatIcon, EyeIcon, ChevronLeftIcon, ChevronRightIcon, Spinner, RefreshIcon, PlayIcon } from '../ui/Icon'
import { AgentIcon } from '../ui/AgentIcon'

interface Props {
  report: AgentReport
  onNewVersion: (agentId: string, chatHistory: ChatMessage[], newVersion: DetailVersion) => void
  onChatSave: (agentId: string, chatHistory: ChatMessage[]) => void
  onDeleteVersion?: (agentId: string, versionId: string) => void
  onSetActiveVersion?: (agentId: string, versionId: string) => void
  projectContext: string
  previousReports: AgentReport[]
  isRunning?: boolean
  queuePosition?: number
  showRetryFromHere?: boolean
  onRetryFromHere?: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

function isMarkdown(text: string): boolean {
  return /^#{1,6}\s|^\s*[-*]\s|\*\*[^*]+\*\*|^\s*>\s|^\|.+\||\n#{1,6}\s/m.test(text)
}

function parseMarkdownToStyledHtml(text: string, accentColor: string): string {
  let sectionIdx = 0
  const renderer = new Renderer()

  renderer.heading = function ({ depth, text: t }: { depth: number; text: string }) {
    if (depth === 1) {
      return `<div style="padding:14px 18px 16px;background:rgba(255,255,255,0.04);border-left:4px solid ${accentColor};border-radius:0 12px 12px 0;margin-bottom:18px"><div style="font-size:18px;font-weight:800;color:#f0f0f2;line-height:1.3">${t}</div></div>`
    }
    if (depth === 2) {
      sectionIdx++
      const num = String(sectionIdx).padStart(2, '0')
      return `<div style="background:#1a2235;border:1px solid #2a3350;border-radius:10px;padding:12px 16px;margin:18px 0 8px"><div style="font-size:9px;font-weight:800;letter-spacing:0.15em;color:${accentColor};margin-bottom:5px">${num} ·</div><div style="font-size:13px;font-weight:700;color:#e2e8f0">${t}</div></div>`
    }
    if (depth === 3) {
      return `<div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#64748b;text-transform:uppercase;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #1e293b">${t}</div>`
    }
    return `<div style="font-size:12px;font-weight:700;color:#94a3b8;margin:8px 0 4px">${t}</div>`
  } as never

  ;(renderer as unknown as { blockquote: (t: { tokens: object[] }) => string }).blockquote = function (token) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (this as any).parser.parse(token.tokens) as string
    return `<div style="border-left:3px solid ${accentColor};background:rgba(255,255,255,0.04);border-radius:0 8px 8px 0;padding:10px 14px;margin:10px 0;color:#e2e8f0">${body}</div>`
  }

  ;(renderer as unknown as { hr: () => string }).hr = function () {
    return `<hr style="border:none;border-top:1px solid #1e293b;margin:16px 0">`
  }

  type TableToken = { header: { tokens: object[] }[]; align: (string | null)[]; rows: { tokens: object[] }[][] }
  ;(renderer as unknown as { table: (t: TableToken) => string }).table = function (token) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (this as any).parser
    const th = token.header.map((cell, i) => {
      const cellHtml = p.parseInline(cell.tokens) as string
      const align = token.align[i] ? `text-align:${token.align[i]}` : ''
      return `<th style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;border-bottom:2px solid #334155;background:#1e293b;${align}">${cellHtml}</th>`
    }).join('')
    const rows = token.rows.map(row => {
      const cells = row.map((cell, i) => {
        const cellHtml = p.parseInline(cell.tokens) as string
        const align = token.align[i] ? `text-align:${token.align[i]}` : ''
        return `<td style="padding:8px 12px;font-size:12px;color:#e2e8f0;border-bottom:1px solid #1e293b;vertical-align:top;word-break:break-word;line-height:1.55;${align}">${cellHtml}</td>`
      }).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    return `<div style="overflow-x:auto;margin:10px 0"><table style="border-collapse:collapse;width:100%;table-layout:fixed"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`
  }

  return new Marked({ renderer }).parse(text) as string
}

function extractHtml(detail: string): { html: string | null; plain: string } {
  const markerRegex = /<\s*!?--\s*XYNAPS_HTML\s*-->/i
  const match = markerRegex.exec(detail)
  if (!match || match.index === undefined) return { html: null, plain: detail }
  const markerStart = match.index
  const markerEnd = markerStart + match[0].length
  return { html: detail.slice(markerEnd).trim(), plain: detail.slice(0, markerStart).trim() }
}

function stripOperatingBudgetSectionText(input: string): string {
  if (!input) return input
  return input
    .replace(
      /(?:^|\n)\s*(?:#{1,6}\s*)?(?:0?7[\.\)\-:\s]*)?운영\s*예산[^\n]*\n[\s\S]*?(?=\n\s*(?:#{1,6}\s*)?(?:0?[1-9]|1[0-9])[\.\)\-:\s]+[^\n]*|\n\s*$)/gi,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripOperatingBudgetSectionHtml(input: string): string {
  if (!input) return input
  return input
    .replace(/<h[1-6][^>]*>[^<]*운영\s*예산[^<]*<\/h[1-6]>[\s\S]*?(?=<h[1-6][^>]*>|$)/gi, '')
    .replace(/<p[^>]*>\s*(?:0?7[\.\)\-:\s]*)?운영\s*예산[^<]*<\/p>[\s\S]*?(?=<h[1-6][^>]*>|$)/gi, '')
    .trim()
}


export function ReportCard({ report, onNewVersion, onChatSave, onDeleteVersion, onSetActiveVersion, projectContext, previousReports, isRunning, queuePosition, showRetryFromHere, onRetryFromHere, onRefresh, isRefreshing }: Props) {
  const [showDetail, setShowDetail] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingSummary, setEditingSummary] = useState('')
  const [editingDetail, setEditingDetail] = useState('')
  const [useBottomChatLayout, setUseBottomChatLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 1100 : false
  ))
  const [refreshElapsed, setRefreshElapsed] = useState(0)
  useEffect(() => {
    if (!isRefreshing) { setRefreshElapsed(0); return }
    const t = window.setInterval(() => setRefreshElapsed(s => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [isRefreshing])

  const [runningElapsed, setRunningElapsed] = useState(0)
  useEffect(() => {
    if (!isRunning) { setRunningElapsed(0); return }
    const t = window.setInterval(() => setRunningElapsed(s => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [isRunning])

  const logScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
  })

  const agentDef = AGENTS.find(a => a.id === report.agentId)!

  const versions = report.detailVersions ?? []
  const activeVersion = versions.find(v => v.id === report.activeVersionId)
  const displaySummary = stripOperatingBudgetSectionText(activeVersion?.summary ?? report.summary)
  const displayDetail = stripOperatingBudgetSectionText(activeVersion?.detail ?? report.detail)
  const activeVersionIdx = activeVersion ? versions.indexOf(activeVersion) : -1
  const normalizedSummary = (displaySummary ?? '').replace(/\n{3,}/g, '\n\n').trim()

  const { html: detailHtml, plain: detailPlain } = displayDetail
    ? extractHtml(displayDetail)
    : { html: null, plain: '' }
  const editableDetail = (detailPlain || displayDetail || '').trim()

  const markdownHtml = useMemo(() => {
    if (detailHtml) return null
    const text = detailPlain || displayDetail || ''
    if (!text || !isMarkdown(text)) return null
    try { return parseMarkdownToStyledHtml(text, agentDef.color) } catch { return null }
  }, [detailHtml, detailPlain, displayDetail, agentDef.color])

  const summaryMarkdownHtml = useMemo(() => {
    const text = normalizedSummary
    if (!text || !isMarkdown(text)) return null
    // Strip markdown syntax to show as clean plain text (like HTML agent summaries)
    const plain = text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/^\s*>\s*/gm, '')
      .replace(/\|[^\n]+\|/g, '')
      .replace(/[-|:]+\n/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return plain
  }, [normalizedSummary])

  const chatCount = Math.floor((report.chatHistory?.length ?? 0) / 2)

  useEffect(() => {
    function syncLayout() {
      setUseBottomChatLayout(window.innerWidth <= 1100)
    }
    syncLayout()
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  useEffect(() => {
    setEditingSummary(displaySummary ?? '')
    setEditingDetail(editableDetail)
    setIsEditing(false)
  }, [displaySummary, editableDetail, report.agentId, report.activeVersionId])

  function navigateVersion(dir: 1 | -1) {
    if (versions.length === 0) return
    const nextIdx = activeVersionIdx === -1
      ? (dir === 1 ? 0 : versions.length - 1)
      : Math.max(0, Math.min(versions.length - 1, activeVersionIdx + dir))
    const targetId = versions[nextIdx]?.id
    if (targetId) onSetActiveVersion?.(report.agentId, targetId)
  }

  function saveManualEdit() {
    if (isRunning) return
    const nextSummary = stripOperatingBudgetSectionText(editingSummary.trim())
    const nextDetail = stripOperatingBudgetSectionText(editingDetail.trim())
    const manualCount = (report.detailVersions?.filter(v => v.label.startsWith('수동 편집')).length ?? 0) + 1
    const newVersion: DetailVersion = {
      id: crypto.randomUUID(),
      summary: nextSummary,
      detail: nextDetail,
      createdAt: new Date().toISOString(),
      label: `수동 편집 ${manualCount}`,
    }
    onNewVersion(report.agentId, report.chatHistory ?? [], newVersion)
    setIsEditing(false)
  }

  const iconBtn = (active: boolean): React.CSSProperties => ({
    width: 30, height: 30, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--border-bright)' : 'var(--border)'}`,
    background: active ? 'var(--bg-secondary)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    flexShrink: 0,
  })

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${isRunning ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 14,
      transition: 'border-color 0.3s',
      overflow: 'visible',
      position: 'relative',
      boxShadow: showChat && showDetail ? '0 14px 28px rgba(0,0,0,0.18)' : '0 6px 16px rgba(0,0,0,0.08)',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        borderBottom: report.status === 'done' ? '1px solid var(--border)' : 'none',
        background: 'var(--bg-card)',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
      }}>
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, flexShrink: 0,
          background: 'var(--bg-secondary)',
          border: `1px solid ${agentDef.color}44`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: agentDef.color,
        }}>
          <AgentIcon agentId={agentDef.id} width={17} height={17} />
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {agentDef.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2 }}>
            {agentDef.role}
          </div>
        </div>

        {/* Status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {(isRunning || isRefreshing) && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              <Spinner size={10} color="var(--accent-text)" />
              <span style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                {isRefreshing
                  ? `재실행 중 ${refreshElapsed > 0 ? `${Math.floor(refreshElapsed / 60) > 0 ? `${Math.floor(refreshElapsed / 60)}분 ` : ''}${(refreshElapsed % 60).toString().padStart(2, '0')}초` : ''}`
                  : '작성 중'}
              </span>
            </span>
          )}
          {!isRunning && !isRefreshing && report.status === 'done' && (() => {
            const isFailed = (report.summary ?? '').includes('오류')
            return (
              <>
                {!isFailed && (
                  <>
                    <button
                      onClick={() => setShowDetail(v => !v)}
                      title={showDetail ? '요약만 보기로 전환' : '상세 보기로 전환'}
                      style={iconBtn(showDetail)}
                    >
                      <EyeIcon width={13} height={13} />
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => { if (!showDetail) return; setShowChat(v => !v) }}
                        disabled={!showDetail}
                        title={showDetail ? (showChat ? '채팅 닫기' : '전문가 채팅') : '상세 보기에서만 채팅 가능'}
                        style={{
                          ...iconBtn(showChat),
                          opacity: showDetail ? 1 : 0.35,
                          cursor: showDetail ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <ChatIcon width={13} height={13} />
                      </button>
                      {chatCount > 0 && (
                        <span style={{
                          position: 'absolute', top: -4, right: -4,
                          width: 14, height: 14, borderRadius: '50%',
                          background: 'var(--accent)', color: 'var(--accent-fg)',
                          fontSize: 8, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1.5px solid var(--bg-card)',
                          pointerEvents: 'none',
                        }}>
                          {chatCount}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    title="이 에이전트만 재실행"
                    style={iconBtn(false)}
                  >
                    <RefreshIcon width={13} height={13} />
                  </button>
                )}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  color: isFailed ? '#fca5a5' : 'var(--success)',
                  marginLeft: 2,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: isFailed ? '#ef4444' : 'var(--success)',
                    boxShadow: isFailed ? '0 0 6px rgba(239,68,68,0.5)' : 'none',
                  }} />
                  {isFailed ? '오류' : '완료'}
                </span>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── Body ── */}
      {report.status === 'done' && (
        <div style={{
          padding: '16px',
        }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 버전 네비게이터 */}
            {showDetail && versions.length > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px',
                background: 'var(--bg-secondary)',
                borderRadius: 9,
                border: '1px solid var(--border)',
              }}>
                <button
                  onClick={() => navigateVersion(-1)}
                  disabled={activeVersionIdx <= 0}
                  title="이전 버전"
                  style={{
                    width: 22, height: 22, padding: 0, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 5, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: activeVersionIdx <= 0 ? 'not-allowed' : 'pointer',
                    opacity: activeVersionIdx <= 0 ? 0.3 : 1,
                  }}
                >
                  <ChevronLeftIcon width={11} height={11} />
                </button>
                <span style={{
                  flex: 1, textAlign: 'center',
                  fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
                }}>
                  {activeVersion?.label ?? '원본'}{' '}
                  <span style={{ opacity: 0.45 }}>({activeVersionIdx + 1}/{versions.length})</span>
                </span>
                {activeVersion && activeVersion.id !== 'original' && onDeleteVersion && (
                  <button
                    onClick={() => {
                      if (window.confirm(`"${activeVersion.label}" 버전을 삭제할까요?`)) {
                        onDeleteVersion(report.agentId, activeVersion.id)
                      }
                    }}
                    title="이 버전 삭제"
                    style={{
                      width: 22, height: 22, padding: 0, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 5, border: 'none',
                      background: 'transparent', color: '#f87171',
                      cursor: 'pointer', fontSize: 14, lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
                <button
                  onClick={() => navigateVersion(1)}
                  disabled={activeVersionIdx >= versions.length - 1}
                  title="다음 버전"
                  style={{
                    width: 22, height: 22, padding: 0, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 5, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: activeVersionIdx >= versions.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: activeVersionIdx >= versions.length - 1 ? 0.3 : 1,
                  }}
                >
                  <ChevronRightIcon width={11} height={11} />
                </button>
              </div>
            )}

            {/* 내용 */}
            <div style={{
              background: showDetail ? 'var(--bg-secondary)' : 'transparent',
              border: showDetail ? '1px solid var(--border)' : 'none',
              borderRadius: showDetail ? 10 : 0,
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.72,
                whiteSpace: 'pre-wrap',
                padding: showDetail ? '14px 16px 16px' : 0,
              }}>
                {showDetail && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}>
                    요약
                  </div>
                )}
                {isEditing ? (
                  <textarea
                    value={editingSummary}
                    onChange={e => setEditingSummary(e.target.value)}
                    rows={6}
                    style={{
                      width: '100%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 11px',
                      color: 'var(--text-primary)',
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                ) : summaryMarkdownHtml ?? normalizedSummary}
                {!isEditing && (() => {
                  const isFailed = (report.summary ?? '').includes('오류')
                  return isFailed && displayDetail ? (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#fca5a5',
                      lineHeight: 1.55,
                    }}>
                      {displayDetail}
                    </div>
                  ) : null
                })()}
              </div>

              {showDetail && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '14px 16px 16px',
                  background: 'rgba(255,255,255,0.015)',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}>
                    상세
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editingDetail}
                      onChange={e => setEditingDetail(e.target.value)}
                      rows={14}
                      style={{
                        width: '100%',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '10px 11px',
                        color: 'var(--text-primary)',
                        fontSize: 12.5,
                        lineHeight: 1.65,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        outline: 'none',
                        whiteSpace: 'pre-wrap',
                      }}
                    />
                  ) : detailHtml ? (
                    <div data-report-html style={{ fontSize: 12.5, lineHeight: 1.72, color: 'var(--text-secondary)', overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: stripOperatingBudgetSectionHtml(detailHtml) }} />
                  ) : markdownHtml ? (
                    <div data-report-html style={{ fontSize: 12.5, lineHeight: 1.72, color: 'var(--text-secondary)', overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: markdownHtml }} />
                  ) : (
                    <div style={{
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.72,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {detailPlain || displayDetail}
                    </div>
                  )}
                </div>
              )}
            </div>
            {showDetail && isEditing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditingSummary(displaySummary ?? '')
                    setEditingDetail(editableDetail)
                  }}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={saveManualEdit}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--accent)',
                    background: 'var(--accent)',
                    color: 'var(--accent-fg)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            )}
          </div>

          {showDetail && showChat && (
            <div style={{
              position: useBottomChatLayout ? 'relative' : 'absolute',
              top: useBottomChatLayout ? 'auto' : 68,
              right: useBottomChatLayout ? 'auto' : -392,
              width: useBottomChatLayout ? '100%' : 380,
              zIndex: useBottomChatLayout ? 1 : 20,
              marginTop: useBottomChatLayout ? 12 : 0,
            }}>
              <AgentChatPanel
                report={report}
                projectContext={projectContext}
                previousReports={previousReports}
                onNewVersion={(chatHistory, newVersion) => {
                  onNewVersion(report.agentId, chatHistory, newVersion)
                  setShowChat(false)
                }}
                onChatSave={(chatHistory) => onChatSave(report.agentId, chatHistory)}
              />
            </div>
          )}
        </div>
      )}

      {report.status === 'pending' && !isRunning && (
        <div style={{
          padding: '12px 14px',
          fontSize: 12,
          color: 'var(--text-muted)',
          opacity: 0.72,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'rgba(148,163,184,0.7)',
            boxShadow: '0 0 0 3px rgba(148,163,184,0.08)',
          }} />
          {queuePosition ? `대기열 ${queuePosition}번` : '대기 중'}
        </div>
      )}

      {!isRunning && showRetryFromHere && onRetryFromHere && (
        <div style={{
          padding: '0 14px 14px',
        }}>
          <button
            onClick={onRetryFromHere}
            style={{
              width: '100%',
              border: '1px solid rgba(251,191,36,0.34)',
              background: 'rgba(251,191,36,0.1)',
              color: '#fcd34d',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <PlayIcon width={13} height={13} />
            여기서부터 전체 재실행
          </button>
        </div>
      )}

      {(isRunning || isRefreshing) && (() => {
        const elapsed = isRefreshing ? refreshElapsed : runningElapsed
        const fmtTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
        const progress = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 45))))
        const LOG_ENTRIES = [
          { at: 0,   msg: '프로젝트 컨텍스트 로드 완료', ok: true },
          { at: 1,   msg: '에이전트 역할 프롬프트 구성 완료', ok: true },
          { at: 3,   msg: '브리핑 문서 병합 및 정제 완료', ok: true },
          { at: 5,   msg: 'AI 모델에 요청 전송 완료', ok: true },
          { at: 8,   msg: '모델 응답 스트리밍 수신 중...', ok: false },
          { at: 30,  msg: '대용량 응답 처리 중... (정상)', ok: false },
          { at: 90,  msg: '장문 보고서 생성 중... 거의 완료', ok: false },
          { at: 180, msg: '응답 마무리 중...', ok: false },
        ]
        const visible = LOG_ENTRIES.filter(e => elapsed >= e.at)
        return (
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderTop: '1px solid var(--border)',
            padding: '14px 16px 16px',
            background: 'linear-gradient(180deg, rgba(111,255,163,0.05), rgba(111,255,163,0.015) 60%, transparent 100%)',
          }}>
            <div className="project-working-scan" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, rgba(201,255,84,0.12) 45%, transparent 100%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="project-working-led" style={{ width: 10, height: 10, borderRadius: '50%', background: '#c9ff54', boxShadow: '0 0 12px rgba(201,255,84,0.7)' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#efffb8', letterSpacing: '0.06em' }}>AI WORKING MODE</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(239,255,184,0.7)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(elapsed)}</span>
            </div>
            <div ref={logScrollRef} style={{
              background: 'rgba(0,0,0,0.35)', borderRadius: 10,
              border: '1px solid rgba(201,255,84,0.12)',
              padding: '10px 12px', marginBottom: 10,
              height: 110, overflowY: 'auto',
              fontFamily: 'monospace', fontSize: 11,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {visible.map((e, i) => (
                <div key={e.at} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', animation: 'log-fadein 0.3s ease' }}>
                  <span style={{ color: 'rgba(201,255,84,0.5)', flexShrink: 0 }}>{fmtTime(e.at)}</span>
                  <span style={{ color: e.ok ? '#c9ff54' : '#8ce8ff' }}>{e.ok ? '✓' : '›'}</span>
                  <span style={{ color: e.ok ? 'rgba(239,255,184,0.8)' : '#e2e8f0' }}>
                    {e.msg}
                    {i === visible.length - 1 && !e.ok && <span className="terminal-cursor" style={{ marginLeft: 2, display: 'inline-block', width: 7, height: '1em', background: '#8ce8ff', verticalAlign: 'text-bottom', animation: 'cursor-blink 1s step-end infinite' }} />}
                  </span>
                </div>
              ))}
              <style>{`
                @keyframes log-fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
                @keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
              `}</style>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #c9ff54 0%, #8ce8ff 100%)',
                  transition: 'width 1s ease-out',
                }} />
              </div>
              <span style={{ fontSize: 10, color: 'rgba(201,255,84,0.7)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{progress}%</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
