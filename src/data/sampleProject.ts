import type { Project } from '../types'
import { saveProject } from '../lib/storage'

const SAMPLE_PROJECT_ID = 'xynaps-sample-project-2024'

const sampleProject: Project = {
  id: SAMPLE_PROJECT_ID,
  name: '[예시] 사묘실 — 죽음의 병동',
  theme: '1950년대 폐쇄된 정신병원. 원인 불명의 환자 연쇄 사망 사건을 수사하는 형사 테마.',
  branches: ['GDXC', 'NWXC'],
  createdAt: '2024-11-01T09:00:00.000Z',
  updatedAt: '2024-11-15T18:30:00.000Z',
  attachments: [],
  crimeConfig: {
    genres: ['미스터리', '호러', '추리'],
    motives: ['광기', '복수', '은폐'],
    crimeTypes: ['연쇄 살인', '의문사'],
    clues: ['혈흔', '일기장', '의료기록'],
    methods: ['심리 분석', '문서 추적', '물증 대조'],
    location: '정신병원 4층 특수 병동',
    characters: [
      { id: 'char-1', role: '가해자', name: '원장 박동현', background: '실험을 은폐하려는 수석 의사' },
      { id: 'char-2', role: '피해자', name: '환자 이순옥', background: '진실을 알고 있던 마지막 생존자' },
      { id: 'char-3', role: '목격자', name: '간호사 최미영', background: '야간 근무 중 이상한 장면을 목격' },
      { id: 'char-4', role: '주변인물', name: '청소부 김씨', background: '오래된 병원의 비밀을 알고 있다' },
    ],
    relations: [
      { id: 'rel-1', fromId: 'char-1', toId: 'char-2', relationType: '피해', description: '실험 대상으로 이용' },
      { id: 'rel-2', fromId: 'char-3', toId: 'char-1', relationType: '피고용', description: '명령을 따르는 부하' },
      { id: 'rel-3', fromId: 'char-3', toId: 'char-2', relationType: '친구', description: '비밀을 공유한 관계' },
      { id: 'rel-4', fromId: 'char-4', toId: 'char-1', relationType: '원한', description: '과거의 앙금' },
    ],
    storyFlow: [
      { stage: '기', description: '형사로서 병원에 진입, 첫 번째 시신 발견', roomName: '입구·로비' },
      { stage: '승', description: '간호사 일지와 환자 파일을 통해 사건 구조 파악', roomName: '간호사실' },
      { stage: '전', description: '지하 의무실에서 불법 실험 기록 발견', roomName: '지하 의무실' },
      { stage: '반전', description: '간호사 최미영이 사실은 공범이었음이 드러남', roomName: '특수 병동 4호실' },
      { stage: '결', description: '원장실에서 최종 증거를 찾아 사건 종결', roomName: '원장실' },
    ],
  },
  versions: [
    {
      id: 'version-sample-completed',
      versionName: 'v1.0',
      createdAt: '2024-11-10T10:00:00.000Z',
      status: 'completed',
      agentReports: [
        {
          agentId: 'ceo',
          agentName: '크리에이티브 디렉터',
          summary: '1950년대 한국 정신병원 배경의 호러-미스터리 테마. 핵심 감성 키워드: 공포·압박·불신. 황색·갈색 톤의 빛바랜 병원 분위기로 시각 정체성 확립.',
          detail: `[요약]
1950년대 폐쇄된 정신병원을 배경으로 하는 다크 미스터리 테마입니다.
핵심 감성 키워드는 "공포, 압박, 불신"으로 설정합니다.

[상세]
<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #9b6dff44;border-radius:12px;padding:18px;margin-bottom:12px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#9b6dff;margin-bottom:6px">THEME IDENTITY</div>
    <div style="font-size:20px;font-weight:800;margin-bottom:4px">사묘실 — 죽음의 병동</div>
    <div style="font-size:12px;color:#94a3b8">1950년대 폐쇄 정신병원 · 연쇄 의문사 수사 · 형사 테마</div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">호러</span>
    <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">미스터리</span>
    <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">심리 스릴러</span>
    <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">역사·시대극</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#64748b;margin-bottom:8px">MOOD KEYWORDS</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:6px;padding:2px 8px;font-size:11px">공포</span>
        <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:6px;padding:2px 8px;font-size:11px">압박</span>
        <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:6px;padding:2px 8px;font-size:11px">불신</span>
        <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:6px;padding:2px 8px;font-size:11px">진실 추구</span>
        <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:6px;padding:2px 8px;font-size:11px">소름</span>
      </div>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#64748b;margin-bottom:8px">VISUAL DIRECTION</div>
      <div style="font-size:12px;color:#cbd5e1;line-height:2">🎨 황색·갈색 — 빛바랜 병원 톤<br>💡 깜빡이는 형광등 / 강렬한 명암<br>🏥 낡은 의료기기 · 타일 · 녹슨 철</div>
    </div>
  </div>
  <div style="background:#1e293b;border-left:3px solid #9b6dff;border-radius:0 10px 10px 0;padding:12px 16px">
    <div style="font-size:10px;font-weight:700;color:#9b6dff;letter-spacing:0.1em;margin-bottom:5px">CORE CONCEPT</div>
    <div style="font-size:13px;color:#e2e8f0;line-height:1.6">플레이어는 <strong style="color:#a78bfa">형사</strong>로서 폐쇄된 정신병원에 진입, 연쇄 사망의 진실을 추적합니다.<br>단순 탈출이 아닌 <strong style="color:#a78bfa">사건 해결</strong>이라는 목표로 몰입도 극대화.</div>
  </div>
</div>`,
          status: 'done',
        },
        {
          agentId: 'concept',
          agentName: '스토리 아키텍트',
          summary: '원장 박동현의 불법 인체 실험이 핵심 비밀. 5단계 기승전반전결 구조. 간호사 최미영의 공범 반전이 클라이맥스.',
          detail: `[요약]
원장 박동현의 불법 인체 실험을 중심으로 한 5막 구조 스토리.
간호사 최미영의 공범 반전이 핵심 클라이맥스입니다.

[상세]
<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#ff6b9d;margin-bottom:8px">CHARACTERS</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="background:#1e293b;border:1px solid #ef444422;border-radius:10px;padding:10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="background:#ef444422;border:1px solid #ef4444;color:#f87171;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">가해자</span>
        <span style="font-weight:700;font-size:13px">원장 박동현</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.5">실험을 은폐하려는 수석 의사. 병원의 모든 비밀 통제.</div>
    </div>
    <div style="background:#1e293b;border:1px solid #f9731622;border-radius:10px;padding:10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="background:#f9731622;border:1px solid #f97316;color:#fb923c;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">피해자</span>
        <span style="font-weight:700;font-size:13px">환자 이순옥</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.5">진실을 알고 있던 마지막 생존자. 기록을 남겨두었다.</div>
    </div>
    <div style="background:#1e293b;border:1px solid #10b98122;border-radius:10px;padding:10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="background:#10b98122;border:1px solid #10b981;color:#34d399;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">목격자</span>
        <span style="font-weight:700;font-size:13px">간호사 최미영</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.5">야간 근무 중 목격 — <strong style="color:#fbbf24">반전: 실제론 공범</strong></div>
    </div>
    <div style="background:#1e293b;border:1px solid #6b728022;border-radius:10px;padding:10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="background:#6b728022;border:1px solid #6b7280;color:#9ca3af;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">주변인물</span>
        <span style="font-weight:700;font-size:13px">청소부 김씨</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.5">오래된 병원의 숨겨진 비밀을 알고 있다.</div>
    </div>
  </div>
  <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#ff6b9d;margin-bottom:8px">STORY TIMELINE</div>
  <div style="display:flex;flex-direction:column;gap:2px">
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #1e293b">
      <div style="background:#ff6b9d22;border:1px solid #ff6b9d;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;color:#ff6b9d;white-space:nowrap;flex-shrink:0">기 · 발단</div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.5"><strong style="color:#e2e8f0">📍 입구·로비</strong> — 형사 진입, 첫 시신 발견, 탐색 시작</div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #1e293b">
      <div style="background:#ff6b9d11;border:1px solid #ff6b9d44;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;color:#ff6b9d;white-space:nowrap;flex-shrink:0">승 · 전개</div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.5"><strong style="color:#e2e8f0">📍 간호사실</strong> — 일지·파일로 연쇄 사망 패턴 파악</div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #1e293b">
      <div style="background:#ff6b9d11;border:1px solid #ff6b9d44;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;color:#ff6b9d;white-space:nowrap;flex-shrink:0">전 · 절정</div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.5"><strong style="color:#e2e8f0">📍 지하 의무실</strong> — 불법 실험 기록 발견, 원장 용의자 부상</div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-bottom:1px solid #2d2000;background:#1c1500;border-radius:8px;margin:2px 0">
      <div style="background:#fbbf2422;border:1px solid #fbbf24;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;color:#fbbf24;white-space:nowrap;flex-shrink:0">⚡ 반전</div>
      <div style="font-size:12px;color:#fde68a;line-height:1.5"><strong>📍 특수 병동 4호실</strong> — 간호사 최미영이 <strong>공범</strong>임이 드러남</div>
    </div>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0">
      <div style="background:#10b98122;border:1px solid #10b981;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;color:#10b981;white-space:nowrap;flex-shrink:0">결 · 결말</div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.5"><strong style="color:#e2e8f0">📍 원장실</strong> — 최종 증거 확보, 사건 해결</div>
    </div>
  </div>
</div>`,
          status: 'done',
        },
        {
          agentId: 'pd',
          agentName: '게임 디렉터',
          summary: '60분 기준 5섹션 설계. 전체 퍼즐 12개, 섹션당 2-3개. 초반 쉬움→중반 복합→반전→엔딩 난이도 곡선.',
          detail: `[요약]
60분 기준 5개 섹션, 전체 퍼즐 12개.
초반 쉬움→중반 복합→반전→엔딩의 난이도 곡선 설계.

[상세]
<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:#4da6ff">60</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">분 플레이</div>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:#4da6ff">5</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">섹션 (방)</div>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:#4da6ff">12</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">총 퍼즐</div>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:#f59e0b">★★★</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">난이도</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
    <thead>
      <tr style="background:#1e293b">
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600;font-size:10px;letter-spacing:0.08em;border-bottom:1px solid #334155">공간</th>
        <th style="padding:8px 10px;text-align:center;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">시간</th>
        <th style="padding:8px 10px;text-align:center;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">퍼즐</th>
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">난이도</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 10px;font-weight:600">📍 입구·로비</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">8분</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">2</td><td style="padding:8px 10px"><span style="background:#22c55e22;color:#4ade80;border-radius:4px;padding:2px 7px;font-size:11px">쉬움</span></td></tr>
      <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 10px;font-weight:600">📍 간호사실</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">15분</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">3</td><td style="padding:8px 10px"><span style="background:#f59e0b22;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">보통</span></td></tr>
      <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 10px;font-weight:600">📍 지하 의무실</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">15분</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">3</td><td style="padding:8px 10px"><span style="background:#ef444422;color:#f87171;border-radius:4px;padding:2px 7px;font-size:11px">어려움</span></td></tr>
      <tr style="border-bottom:1px solid #1e293b;background:#1c1500"><td style="padding:8px 10px;font-weight:600">⚡ 특수 병동 4호실</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">12분</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">3</td><td style="padding:8px 10px"><span style="background:#fbbf2422;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">반전 포함</span></td></tr>
      <tr><td style="padding:8px 10px;font-weight:600">📍 원장실</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">10분</td><td style="padding:8px 10px;text-align:center;color:#94a3b8">2</td><td style="padding:8px 10px"><span style="background:#f59e0b22;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">보통</span></td></tr>
    </tbody>
  </table>
  <div style="background:#1e293b;border-left:3px solid #4da6ff;border-radius:0 10px 10px 0;padding:10px 14px">
    <div style="font-size:10px;font-weight:700;color:#4da6ff;letter-spacing:0.1em;margin-bottom:4px">ENDING CONDITION</div>
    <div style="font-size:12px;color:#cbd5e1;line-height:1.6">원장실 금고에서 <strong style="color:#e2e8f0">실험 최종 보고서</strong> 입수 → X-KIT 최종 코드 입력 → 탈출 성공</div>
  </div>
</div>`,
          status: 'done',
        },
        {
          agentId: 'puzzle',
          agentName: '퍼즐 마스터',
          summary: '12개 퍼즐: Xkit 5개, Key 6개, Dev 3개. 평면(날짜 암호·일기·의료기록) + 입체(금고·자물쇠·회로) + 공간(협동방) 혼합.',
          detail: `[요약]
12개 퍼즐: Xkit 5, Key 6, Dev 3.
평면(날짜 암호·일기) + 입체(금고·자물쇠·회로) + 공간(협동) 혼합 설계.

[상세]
<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><div style="width:10px;height:10px;border-radius:3px;background:#EEEDFE;border:0.5px solid #AFA9EC"></div>오브젝트</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><div style="width:10px;height:10px;border-radius:3px;background:#E1F5EE;border:0.5px solid #5DCAA5"></div>획득 단서</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><div style="width:10px;height:10px;border-radius:3px;background:#FAEEDA;border:0.5px solid #EF9F27"></div>퍼즐 조건</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><div style="width:10px;height:10px;border-radius:3px;background:#FAECE7;border:0.5px solid #F0997B"></div>잠금 해제</div>
    <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><div style="width:10px;height:10px;border-radius:3px;background:#dbeafe;border:0.5px solid #3b82f6"></div>X-KIT</div>
  </div>
  <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.1em;margin-bottom:6px">PHASE 1 — 입구·로비 (0~8분)</div>
  <div style="background:#111827;border:1px solid #1e293b;border-radius:10px;padding:10px;margin-bottom:8px">
    <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid #1e293b">
      <div><span style="display:inline-block;background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">사건개요 X-KIT</span></div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="display:inline-flex;background:#dbeafe;color:#1e40af;border:0.5px solid #3b82f6;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">X-KIT: 수사 코드 "1953"</span>
        <span style="font-size:11px;color:#f59e0b">→ 수납장 다이얼 해제 가능</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0">
      <div><span style="display:inline-block;background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">로비 수납장</span><div style="font-size:10px;color:#64748b;margin-top:2px">4자리 날짜 다이얼</div></div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="display:inline-flex;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">단서: 열쇠 1번 획득</span>
        <span style="font-size:11px;color:#f59e0b">→ 간호사실 잠금 해제</span>
      </div>
    </div>
  </div>
  <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.1em;margin-bottom:6px">PHASE 2 — 간호사실·지하 의무실 (8~38분)</div>
  <div style="background:#111827;border:1px solid #1e293b;border-radius:10px;padding:10px;margin-bottom:8px">
    <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid #1e293b">
      <div><span style="display:inline-block;background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">혈액형 분류기</span><div style="font-size:10px;color:#64748b;margin-top:2px">아두이노 전자장치</div></div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="display:inline-flex;background:#FAEEDA;color:#633806;border:0.5px solid #EF9F27;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">조건: O→A→B→AB 순서</span>
        <span style="display:inline-flex;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">단서: 냉동고 해제 코드</span>
        <span style="font-size:11px;color:#f59e0b">→ 냉동고 온도 잠금 해제</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0">
      <div><span style="display:inline-block;background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">UV 실험 기록</span><div style="font-size:10px;color:#64748b;margin-top:2px">자외선 조명 필요</div></div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="display:inline-flex;background:#FAEEDA;color:#633806;border:0.5px solid #EF9F27;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">조건: UV 조명 비추기</span>
        <span style="display:inline-flex;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">단서: 은닉 코드 "0509"</span>
      </div>
    </div>
  </div>
  <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.1em;margin-bottom:6px">PHASE 3 — 4호실·원장실 (38~60분)</div>
  <div style="background:#111827;border:1px solid #fbbf2422;border-radius:10px;padding:10px;margin-bottom:10px">
    <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid #1e293b">
      <div><span style="display:inline-block;background:#FAEEDA;color:#633806;border:0.5px solid #EF9F27;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">⚡ 간호사 비밀 일기</span><div style="font-size:10px;color:#64748b;margin-top:2px">반전 핵심 X-KIT</div></div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="display:inline-flex;background:#dbeafe;color:#1e40af;border:0.5px solid #3b82f6;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">X-KIT: "최미영" 입력</span>
        <span style="display:inline-flex;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">단서: 공범 증거 확인</span>
        <span style="font-size:11px;color:#fbbf24;font-weight:600">→ 반전 확인 (간호사 실체)</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0">
      <div><span style="display:inline-block;background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600">원장실 금고</span><div style="font-size:10px;color:#64748b;margin-top:2px">6자리 코드</div></div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="display:inline-flex;background:#FAEEDA;color:#633806;border:0.5px solid #EF9F27;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">조건: 실험 날짜 역순 "905010"</span>
        <span style="display:inline-flex;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5;border-radius:4px;padding:2px 7px;font-size:11px;width:fit-content">단서: 최종 보고서 획득</span>
        <span style="font-size:11px;color:#f59e0b">→ 🎉 탈출 성공</span>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    <div style="background:#3a2a00;border:1px solid #f59e0b44;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#f59e0b">5</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">X Xkit 퍼즐</div></div>
    <div style="background:#1a3a2a;border:1px solid #10b98144;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#10b981">6</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">K 잠금장치</div></div>
    <div style="background:#1e3a5f;border:1px solid #4da6ff44;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#4da6ff">3</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">D 전자장치</div></div>
  </div>
</div>`,
          status: 'done',
        },
        {
          agentId: 'space',
          agentName: '스페이스 디자이너',
          summary: '5개 섹션 순차 동선. 로비→간호사실→지하(계단)→4호실→원장실. 각 방 낡은 의료 소품 + 깜빡이는 형광등 + 묵직한 BGM.',
          detail: `[요약]
5개 섹션 순차 동선 설계.
로비→간호사실→지하(계단)→4호실→원장실.
낡은 의료 소품 + 형광등 + 묵직한 BGM.

[상세]
<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;display:flex;flex-direction:column;gap:8px">
  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;border-left:3px solid #9b6dff">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><div style="font-weight:700;font-size:13px;color:#a78bfa">📍 입구·로비</div><span style="background:#1e1b4b;color:#a78bfa;border-radius:4px;padding:1px 7px;font-size:10px">8m²</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">낡은 접수 데스크</span>
      <span style="background:#dbeafe44;border:1px solid #3b82f6;color:#93c5fd;border-radius:4px;padding:2px 7px;font-size:11px">X-KIT 모니터</span>
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">퇴색 환자 사진</span>
      <span style="background:#1a3a2a44;border:1px solid #10b981;color:#34d399;border-radius:4px;padding:2px 7px;font-size:11px">열쇠 수납장</span>
    </div>
    <div style="font-size:11px;color:#64748b">💡 깜빡이는 형광등 · 저조도</div>
  </div>
  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;border-left:3px solid #4da6ff">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><div style="font-weight:700;font-size:13px;color:#60a5fa">📍 간호사실</div><span style="background:#1e3a5f;color:#60a5fa;border-radius:4px;padding:1px 7px;font-size:10px">10m²</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">의료기록 선반</span>
      <span style="background:#1a3a2a44;border:1px solid #10b981;color:#34d399;border-radius:4px;padding:2px 7px;font-size:11px">약품 보관함 (잠금)</span>
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">간호 일지 더미</span>
      <span style="background:#dbeafe44;border:1px solid #3b82f6;color:#93c5fd;border-radius:4px;padding:2px 7px;font-size:11px">X-KIT 환자 조회</span>
    </div>
    <div style="font-size:11px;color:#64748b">🎭 검은 커튼 · UV 패널 설치</div>
  </div>
  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;border-left:3px solid #00d4aa">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><div style="font-weight:700;font-size:13px;color:#2dd4bf">📍 지하 의무실</div><span style="background:#1a3a2a;color:#2dd4bf;border-radius:4px;padding:1px 7px;font-size:10px">15m²</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">수술대 (소품)</span>
      <span style="background:#1a3a2a44;border:1px solid #10b981;color:#34d399;border-radius:4px;padding:2px 7px;font-size:11px">냉동고 (전자잠금)</span>
      <span style="background:#1a3a5f44;border:1px solid #4da6ff;color:#60a5fa;border-radius:4px;padding:2px 7px;font-size:11px">혈액형 분류기 (DEV)</span>
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">실험 차트 벽면</span>
    </div>
    <div style="font-size:11px;color:#64748b">🔊 저주파 드론 BGM · UV 패널</div>
  </div>
  <div style="background:#1c1500;border:1px solid #fbbf2422;border-radius:10px;padding:12px;border-left:3px solid #f59e0b">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><div style="font-weight:700;font-size:13px;color:#fbbf24">⚡ 특수 병동 4호실</div><span style="background:#3a2a00;color:#fbbf24;border-radius:4px;padding:1px 7px;font-size:10px">12m²</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">
      <span style="background:#3a2a00;border:1px solid #f59e0b44;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">침대 2개 (구속대)</span>
      <span style="background:#dbeafe44;border:1px solid #3b82f6;color:#93c5fd;border-radius:4px;padding:2px 7px;font-size:11px">X-KIT 2대 (협동)</span>
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">벽면 낙서 단서</span>
      <span style="background:#1a3a5f44;border:1px solid #4da6ff;color:#60a5fa;border-radius:4px;padding:2px 7px;font-size:11px">양쪽 스위치 패널</span>
    </div>
    <div style="font-size:11px;color:#64748b">🔴 붉은 보조 조명 · 긴장 연출</div>
  </div>
  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px;border-left:3px solid #ff6b9d">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><div style="font-weight:700;font-size:13px;color:#f472b6">📍 원장실</div><span style="background:#1f1b2e;color:#f472b6;border-radius:4px;padding:1px 7px;font-size:10px">10m²</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">원장 책상</span>
      <span style="background:#1a3a2a44;border:1px solid #10b981;color:#34d399;border-radius:4px;padding:2px 7px;font-size:11px">금고 (6자리)</span>
      <span style="background:#dbeafe44;border:1px solid #3b82f6;color:#93c5fd;border-radius:4px;padding:2px 7px;font-size:11px">X-KIT 최종 신고</span>
      <span style="background:#1f2937;border:1px solid #374151;color:#9ca3af;border-radius:4px;padding:2px 7px;font-size:11px">외부 전화기 (소품)</span>
    </div>
    <div style="font-size:11px;color:#64748b">✨ 엔딩: 조명 밝아짐 + 문 자동 개방</div>
  </div>
</div>`,
          status: 'done',
        },
        {
          agentId: 'ops',
          agentName: '오퍼레이션 매니저',
          summary: 'GM 대본 5단계 구성. 힌트 타이밍: 5분 경과 시 첫 힌트, 3분 간격으로 최대 3회. 소품 12종 + X-KIT 3대 + 자물쇠 6개.',
          detail: `[요약]
GM 대본 5단계, 힌트 5분+3분 간격 최대 3회.
소품 12종, X-KIT 3대, 자물쇠 6개, 예산 약 180만원.

[상세]
<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;display:flex;flex-direction:column;gap:10px">
  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px;border-left:3px solid #f59e0b">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#f59e0b;margin-bottom:8px">GM 브리핑 대본</div>
    <div style="background:#111827;border:1px solid #1e293b;border-radius:8px;padding:12px;font-size:12px;color:#cbd5e1;line-height:1.8;font-style:italic">
      "1953년 오늘, 국립 정신병원에서 연쇄 의문사 신고가 접수되었습니다.<br>
      여러분은 사건을 해결하기 위해 파견된 <strong style="color:#fbbf24">형사팀</strong>입니다.<br>
      단 60분 안에 진실을 밝혀내세요. 시간이 다 되면 진실은 영원히 묻힙니다."
    </div>
    <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">
      <span style="background:#3a2a00;border:1px solid #f59e0b44;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">시작 시 조명 점점 어두워짐</span>
      <span style="background:#3a2a00;border:1px solid #f59e0b44;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">카운트다운 타이머 ON</span>
      <span style="background:#3a2a00;border:1px solid #f59e0b44;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">환자복 복장 권장</span>
    </div>
  </div>

  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#4da6ff;margin-bottom:8px">힌트 프로토콜</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div style="background:#111827;border:1px solid #1e3a5f;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:#4da6ff">5분</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">첫 힌트 가능 시점</div>
      </div>
      <div style="background:#111827;border:1px solid #1e3a5f;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:#4da6ff">3분</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">추가 힌트 간격</div>
      </div>
      <div style="background:#111827;border:1px solid #1e3a5f;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:#4da6ff">3회</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">퍼즐당 최대</div>
      </div>
    </div>
    <div style="margin-top:8px;font-size:11px;color:#64748b;line-height:1.7">최종(3회 소진) → 정답 직접 공개 / X-KIT 힌트 채팅 우선 사용 권장</div>
  </div>

  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#10b981;margin-bottom:8px">소품 & 장치 리스트</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#111827">
          <th style="padding:7px 10px;text-align:left;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">소품·장치</th>
          <th style="padding:7px 10px;text-align:center;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">수량</th>
          <th style="padding:7px 10px;text-align:left;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">배치 섹션</th>
          <th style="padding:7px 10px;text-align:left;color:#64748b;font-weight:600;font-size:10px;border-bottom:1px solid #334155">비고</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px"><span style="background:#dbeafe44;border:1px solid #3b82f6;color:#93c5fd;border-radius:4px;padding:1px 6px;font-size:10px;margin-right:5px">X</span>X-KIT 모니터</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">3대</td><td style="padding:7px 10px;color:#94a3b8">로비·간호사실·4호실</td><td style="padding:7px 10px;color:#64748b">섹션 1·2·4</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px"><span style="background:#1a3a2a44;border:1px solid #10b981;color:#34d399;border-radius:4px;padding:1px 6px;font-size:10px;margin-right:5px">K</span>다이얼 자물쇠</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">4개</td><td style="padding:7px 10px;color:#94a3b8">수납장·약품함·금고</td><td style="padding:7px 10px;color:#64748b">4·6자리 혼합</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px"><span style="background:#1a3a2a44;border:1px solid #10b981;color:#34d399;border-radius:4px;padding:1px 6px;font-size:10px;margin-right:5px">K</span>번호 자물쇠</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">2개</td><td style="padding:7px 10px;color:#94a3b8">4호실 문·냉동고</td><td style="padding:7px 10px;color:#64748b">전자 연동</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px"><span style="background:#1a3a5f44;border:1px solid #4da6ff;color:#60a5fa;border-radius:4px;padding:1px 6px;font-size:10px;margin-right:5px">D</span>혈액형 분류기</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">1대</td><td style="padding:7px 10px;color:#94a3b8">지하 의무실</td><td style="padding:7px 10px;color:#64748b">아두이노 구동</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px"><span style="background:#1a3a5f44;border:1px solid #4da6ff;color:#60a5fa;border-radius:4px;padding:1px 6px;font-size:10px;margin-right:5px">D</span>냉동고 전자 잠금</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">1대</td><td style="padding:7px 10px;color:#94a3b8">지하 의무실</td><td style="padding:7px 10px;color:#64748b">온도 센서 연동</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:7px 10px;color:#94a3b8">낡은 일기장 (소품)</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">3권</td><td style="padding:7px 10px;color:#94a3b8">전 섹션</td><td style="padding:7px 10px;color:#64748b">실마리 포함</td></tr>
        <tr><td style="padding:7px 10px;color:#94a3b8">의료기록 파일 (인쇄)</td><td style="padding:7px 10px;text-align:center;color:#94a3b8">10부</td><td style="padding:7px 10px;color:#94a3b8">간호사실·의무실</td><td style="padding:7px 10px;color:#64748b">UV 내용 포함 2부</td></tr>
      </tbody>
    </table>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#f472b6;margin-bottom:8px">예산 추정</div>
      <div style="font-size:12px;color:#cbd5e1;line-height:2">
        X-KIT 3대 &nbsp;&nbsp;&nbsp;<strong style="color:#e2e8f0">90만원</strong><br>
        전자장치 제작 &nbsp;<strong style="color:#e2e8f0">45만원</strong><br>
        소품·인테리어 &nbsp;<strong style="color:#e2e8f0">45만원</strong>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #334155;font-size:13px;font-weight:700;color:#f472b6">합계 약 180만원</div>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#f472b6;margin-bottom:8px">안전 체크리스트</div>
      <div style="font-size:11px;color:#94a3b8;line-height:2">
        ✓ 비상구 위치 사전 안내<br>
        ✓ 전자장치 접지 확인<br>
        ✓ 협동 퍼즐 신체 무리 없음<br>
        ✓ GM 모니터 화면 실시간 감시
      </div>
    </div>
  </div>
</div>`,
          status: 'done',
        },
      ],
      finalReport: {
        summary: `[사묘실 — 죽음의 병동] 최종 기획 요약

1950년대 폐쇄 정신병원을 배경으로 한 60분 호러-미스터리 테마.
5개 섹션(입구→간호사실→지하의무실→4호실→원장실), 퍼즐 12개,
X-KIT 3대·자물쇠 6개·전자장치 2대 구성. 예산 약 180만원.
간호사 공범 반전이 핵심 클라이맥스. 협동 퍼즐로 팀플레이 강화.`,
        detail: `<!--XYNAPS_HTML-->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;max-width:800px">

  <!-- 표지 -->
  <div style="background:linear-gradient(135deg,#0d1117,#1a1a2e,#16213e);border:1px solid #9b6dff44;border-radius:14px;padding:28px 24px;margin-bottom:16px;text-align:center">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;color:#9b6dff;margin-bottom:10px">ESCAPE ROOM DESIGN DOCUMENT · v1.0</div>
    <div style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin-bottom:6px">사묘실</div>
    <div style="font-size:16px;font-weight:400;color:#94a3b8;margin-bottom:16px">死猫室 — 죽음의 병동</div>
    <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600">호러</span>
      <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600">미스터리</span>
      <span style="background:#1e1b4b;border:1px solid #4f46e5;color:#a78bfa;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600">심리 스릴러</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:400px;margin:0 auto">
      <div><div style="font-size:20px;font-weight:800;color:#fff">60</div><div style="font-size:10px;color:#64748b">분</div></div>
      <div><div style="font-size:20px;font-weight:800;color:#fff">5</div><div style="font-size:10px;color:#64748b">섹션</div></div>
      <div><div style="font-size:20px;font-weight:800;color:#fff">12</div><div style="font-size:10px;color:#64748b">퍼즐</div></div>
      <div><div style="font-size:20px;font-weight:800;color:#f59e0b">★★★</div><div style="font-size:10px;color:#64748b">난이도</div></div>
    </div>
  </div>

  <!-- 1. 세계관·배경 -->
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#9b6dff;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#9b6dff33"></span>01 세계관 · 배경<span style="flex:1;height:1px;background:#9b6dff33"></span>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px">
      <div style="font-size:13px;color:#cbd5e1;line-height:1.9">
        1953년 대한민국. 전쟁의 상흔이 아직 채 가시지 않은 시대, 외딴 산중에 위치한 <strong style="color:#a78bfa">국립 사묘 정신병원</strong>에서 환자들이 연이어 사망하는 사건이 발생한다.<br><br>
        공식 사인은 모두 <em style="color:#f87171">심장마비</em>였지만, 익명의 제보자로부터 "원장이 환자를 대상으로 불법 실험을 진행해왔다"는 내부 고발이 접수된다. 플레이어는 이 사건을 수사하기 위해 파견된 <strong style="color:#e2e8f0">형사팀</strong>으로서 폐쇄된 병원에 진입한다.
      </div>
    </div>
  </div>

  <!-- 2. 등장인물 -->
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#ff6b9d;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#ff6b9d33"></span>02 등장인물<span style="flex:1;height:1px;background:#ff6b9d33"></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:#1e293b;border:1px solid #ef444422;border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="background:#ef444422;border:1px solid #ef4444;color:#f87171;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">가해자</span>
          <span style="font-weight:700;font-size:14px">원장 박동현</span>
        </div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6">의과대학 수석 졸업 엘리트. 전쟁 중 군부의 비밀 의뢰를 받아 인체 실험을 시작. 병원 전체를 장악하며 진실 은폐에 혈안.</div>
      </div>
      <div style="background:#1e293b;border:1px solid #f9731622;border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="background:#f9731622;border:1px solid #f97316;color:#fb923c;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">피해자</span>
          <span style="font-weight:700;font-size:14px">환자 이순옥</span>
        </div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6">실험 대상이 된 마지막 생존자. 사망 전 일기와 암호 기록을 병원 곳곳에 숨겨뒀다. 플레이어가 되살려야 할 목소리.</div>
      </div>
      <div style="background:#1e293b;border:1px solid #10b98122;border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="background:#10b98122;border:1px solid #10b981;color:#34d399;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">반전 공범</span>
          <span style="font-weight:700;font-size:14px">간호사 최미영</span>
        </div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6">선량한 목격자처럼 보이지만 실제로는 원장의 실험에 가담한 공범. <strong style="color:#fbbf24">핵심 반전의 주인공.</strong></div>
      </div>
      <div style="background:#1e293b;border:1px solid #6b728022;border-radius:10px;padding:12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="background:#6b728022;border:1px solid #6b7280;color:#9ca3af;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">주변인물</span>
          <span style="font-weight:700;font-size:14px">청소부 김씨</span>
        </div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6">오래된 병원의 비밀을 알고 있는 유일한 생존 목격자. 남겨진 낙서와 흔적으로 플레이어를 안내.</div>
      </div>
    </div>
  </div>

  <!-- 3. 스토리 타임라인 -->
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#4da6ff;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#4da6ff33"></span>03 스토리 타임라인<span style="flex:1;height:1px;background:#4da6ff33"></span>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden">
      <div style="display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid #1e293b">
        <div style="padding:12px;background:#111827;font-size:11px;font-weight:700;color:#4da6ff">기 · 발단</div>
        <div style="padding:12px;font-size:12px;color:#cbd5e1;line-height:1.6"><strong style="color:#e2e8f0">📍 입구·로비</strong> — 형사로 진입. 로비에서 첫 번째 시신 발견. X-KIT으로 수사 코드 "1953" 획득 후 탐색 시작.</div>
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid #1e293b">
        <div style="padding:12px;background:#111827;font-size:11px;font-weight:700;color:#4da6ff">승 · 전개</div>
        <div style="padding:12px;font-size:12px;color:#cbd5e1;line-height:1.6"><strong style="color:#e2e8f0">📍 간호사실</strong> — 간호 일지와 환자 파일로 연쇄 사망 패턴 확인. 원장 박동현이 주요 담당의임을 포착.</div>
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid #1e293b">
        <div style="padding:12px;background:#111827;font-size:11px;font-weight:700;color:#4da6ff">전 · 절정</div>
        <div style="padding:12px;font-size:12px;color:#cbd5e1;line-height:1.6"><strong style="color:#e2e8f0">📍 지하 의무실</strong> — UV 조명으로 은닉된 실험 기록 확인. 혈액형 분류 장치로 냉동고 해제, 최종 실험 보고서 획득.</div>
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid #1e293b;background:#1c1500">
        <div style="padding:12px;background:#2d2000;font-size:11px;font-weight:700;color:#fbbf24">⚡ 반전</div>
        <div style="padding:12px;font-size:12px;color:#fde68a;line-height:1.6"><strong>📍 특수 병동 4호실</strong> — X-KIT에 "최미영" 입력 시 간호사의 비밀 일기 해독. <strong>선량한 목격자 최미영이 공범</strong>이었음이 드러남.</div>
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr">
        <div style="padding:12px;background:#111827;font-size:11px;font-weight:700;color:#10b981">결 · 결말</div>
        <div style="padding:12px;font-size:12px;color:#cbd5e1;line-height:1.6"><strong style="color:#e2e8f0">📍 원장실</strong> — 금고 코드 "905010" 해제, 원장 서명 최종 보고서 획득. X-KIT 코드 "TRUTH-1953" 입력으로 탈출 성공.</div>
      </div>
    </div>
  </div>

  <!-- 4. 게임 구조 -->
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#10b981;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#10b98133"></span>04 게임 구조<span style="flex:1;height:1px;background:#10b98133"></span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;background:#1e293b;border-radius:10px;overflow:hidden">
      <thead>
        <tr style="background:#111827">
          <th style="padding:9px 12px;text-align:left;color:#64748b;font-weight:600;font-size:10px;letter-spacing:0.08em">공간</th>
          <th style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;font-size:10px">시간</th>
          <th style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;font-size:10px">퍼즐</th>
          <th style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;font-size:10px">X</th>
          <th style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;font-size:10px">K</th>
          <th style="padding:9px 12px;text-align:center;color:#64748b;font-weight:600;font-size:10px">D</th>
          <th style="padding:9px 12px;text-align:left;color:#64748b;font-weight:600;font-size:10px">난이도</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-top:1px solid #334155"><td style="padding:9px 12px;font-weight:600;color:#a78bfa">입구·로비</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">8분</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">2</td><td style="padding:9px 12px;text-align:center;color:#fbbf24">1</td><td style="padding:9px 12px;text-align:center;color:#10b981">1</td><td style="padding:9px 12px;text-align:center;color:#64748b">—</td><td style="padding:9px 12px"><span style="background:#22c55e22;color:#4ade80;border-radius:4px;padding:2px 7px;font-size:11px">쉬움</span></td></tr>
        <tr style="border-top:1px solid #334155"><td style="padding:9px 12px;font-weight:600;color:#60a5fa">간호사실</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">15분</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">3</td><td style="padding:9px 12px;text-align:center;color:#fbbf24">1</td><td style="padding:9px 12px;text-align:center;color:#10b981">1</td><td style="padding:9px 12px;text-align:center;color:#64748b">—</td><td style="padding:9px 12px"><span style="background:#f59e0b22;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">보통</span></td></tr>
        <tr style="border-top:1px solid #334155"><td style="padding:9px 12px;font-weight:600;color:#2dd4bf">지하 의무실</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">15분</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">3</td><td style="padding:9px 12px;text-align:center;color:#64748b">—</td><td style="padding:9px 12px;text-align:center;color:#10b981">1</td><td style="padding:9px 12px;text-align:center;color:#4da6ff">2</td><td style="padding:9px 12px"><span style="background:#ef444422;color:#f87171;border-radius:4px;padding:2px 7px;font-size:11px">어려움</span></td></tr>
        <tr style="border-top:1px solid #334155;background:#1c1500"><td style="padding:9px 12px;font-weight:600;color:#fbbf24">⚡ 특수 병동 4호실</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">12분</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">3</td><td style="padding:9px 12px;text-align:center;color:#fbbf24">2</td><td style="padding:9px 12px;text-align:center;color:#64748b">—</td><td style="padding:9px 12px;text-align:center;color:#4da6ff">1</td><td style="padding:9px 12px"><span style="background:#fbbf2422;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">반전 포함</span></td></tr>
        <tr style="border-top:1px solid #334155"><td style="padding:9px 12px;font-weight:600;color:#f472b6">원장실</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">10분</td><td style="padding:9px 12px;text-align:center;color:#94a3b8">2</td><td style="padding:9px 12px;text-align:center;color:#fbbf24">1</td><td style="padding:9px 12px;text-align:center;color:#10b981">1</td><td style="padding:9px 12px;text-align:center;color:#64748b">—</td><td style="padding:9px 12px"><span style="background:#f59e0b22;color:#fbbf24;border-radius:4px;padding:2px 7px;font-size:11px">보통</span></td></tr>
      </tbody>
    </table>
    <div style="display:flex;gap:8px;margin-top:8px">
      <div style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#fbbf24">5</div><div style="font-size:10px;color:#64748b;margin-top:2px">X Xkit</div></div>
      <div style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#10b981">6</div><div style="font-size:10px;color:#64748b;margin-top:2px">K 자물쇠</div></div>
      <div style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#4da6ff">3</div><div style="font-size:10px;color:#64748b;margin-top:2px">D 전자장치</div></div>
      <div style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;text-align:center"><div style="font-size:18px;font-weight:800;color:#f59e0b">★★★</div><div style="font-size:10px;color:#64748b;margin-top:2px">난이도</div></div>
    </div>
  </div>

  <!-- 5. 핵심 퍼즐 흐름 -->
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#f59e0b;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#f59e0b33"></span>05 핵심 퍼즐 흐름<span style="flex:1;height:1px;background:#f59e0b33"></span>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:grid;grid-template-columns:160px auto 1fr;gap:8px;align-items:center">
        <span style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;text-align:center">사건 개요 X-KIT</span>
        <span style="color:#64748b;font-size:14px">→</span>
        <span style="font-size:12px;color:#cbd5e1">코드 "1953" 획득 → 로비 수납장 4자리 해제 → 열쇠 1번 획득</span>
      </div>
      <div style="display:grid;grid-template-columns:160px auto 1fr;gap:8px;align-items:center">
        <span style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;text-align:center">간호 일지</span>
        <span style="color:#64748b;font-size:14px">→</span>
        <span style="font-size:12px;color:#cbd5e1">텍스트 암호 해독 → 약품함 색상 코드 → 혈액형 카드 획득</span>
      </div>
      <div style="display:grid;grid-template-columns:160px auto 1fr;gap:8px;align-items:center">
        <span style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;text-align:center">혈액형 분류기</span>
        <span style="color:#64748b;font-size:14px">→</span>
        <span style="font-size:12px;color:#cbd5e1">O→A→B→AB 입력(DEV) → 냉동고 해제 → 실험 보고서 획득</span>
      </div>
      <div style="display:grid;grid-template-columns:160px auto 1fr;gap:8px;align-items:center;padding:6px 8px;background:#1c1500;border-radius:8px">
        <span style="background:#fbbf2422;color:#fbbf24;border:0.5px solid #fbbf24;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;text-align:center">⚡ 간호사 일기</span>
        <span style="color:#64748b;font-size:14px">→</span>
        <span style="font-size:12px;color:#fde68a"><strong>X-KIT "최미영" 입력 → 반전 공개</strong> → 협동 스위치 → 원장실 개방</span>
      </div>
      <div style="display:grid;grid-template-columns:160px auto 1fr;gap:8px;align-items:center">
        <span style="background:#EEEDFE;color:#3C3489;border:0.5px solid #AFA9EC;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;text-align:center">원장실 금고</span>
        <span style="color:#64748b;font-size:14px">→</span>
        <span style="font-size:12px;color:#cbd5e1">코드 "905010" 입력 → 최종 보고서 → X-KIT "TRUTH-1953" → 🎉 탈출</span>
      </div>
    </div>
  </div>

  <!-- 6. 공간 연출 -->
  <div style="margin-bottom:14px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#2dd4bf;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#2dd4bf33"></span>06 공간 · 연출<span style="flex:1;height:1px;background:#2dd4bf33"></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;border-left:3px solid #9b6dff"><div style="font-weight:700;font-size:12px;color:#a78bfa;margin-bottom:4px">입구·로비</div><div style="font-size:11px;color:#94a3b8">황색 조명·퇴색 사진·낡은 데스크·깜빡이는 형광등</div></div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;border-left:3px solid #4da6ff"><div style="font-weight:700;font-size:12px;color:#60a5fa;margin-bottom:4px">간호사실</div><div style="font-size:11px;color:#94a3b8">검은 커튼·UV 패널·의료기록 선반·약품 보관함</div></div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px;border-left:3px solid #2dd4bf"><div style="font-weight:700;font-size:12px;color:#2dd4bf;margin-bottom:4px">지하 의무실</div><div style="font-size:11px;color:#94a3b8">수술대·냉동고·혈액형 분류기·저주파 드론 BGM</div></div>
      <div style="background:#1c1500;border:1px solid #fbbf2422;border-radius:8px;padding:10px;border-left:3px solid #f59e0b"><div style="font-weight:700;font-size:12px;color:#fbbf24;margin-bottom:4px">⚡ 특수 병동 4호실</div><div style="font-size:11px;color:#94a3b8">붉은 보조 조명·구속대·X-KIT 2대 협동·긴장 연출</div></div>
    </div>
  </div>

  <!-- 7. 운영 & 예산 -->
  <div style="margin-bottom:6px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;color:#f472b6;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="flex:1;height:1px;background:#f472b633"></span>07 운영 · 예산<span style="flex:1;height:1px;background:#f472b633"></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#f472b6;margin-bottom:8px">힌트 프로토콜</div>
        <div style="font-size:11px;color:#94a3b8;line-height:2">첫 힌트 가능: <strong style="color:#e2e8f0">5분 경과 후</strong><br>추가 간격: <strong style="color:#e2e8f0">3분</strong><br>최대 횟수: <strong style="color:#e2e8f0">3회 / 퍼즐</strong><br>최종 소진 시: <strong style="color:#e2e8f0">정답 직접 공개</strong></div>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px">
        <div style="font-size:10px;font-weight:700;color:#f472b6;margin-bottom:8px">예산 추정</div>
        <div style="font-size:11px;color:#94a3b8;line-height:2">X-KIT 3대: <strong style="color:#e2e8f0">90만원</strong><br>전자장치: <strong style="color:#e2e8f0">45만원</strong><br>소품·인테리어: <strong style="color:#e2e8f0">45만원</strong></div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155;font-size:13px;font-weight:700;color:#f472b6">합계 약 180만원</div>
      </div>
    </div>
  </div>

</div>`,
        createdAt: '2024-11-10T18:00:00.000Z',
      },
      gameFlow: {
        generatedAt: '2024-11-10T18:30:00.000Z',
        sections: [
          {
            id: 'section-1',
            title: '입구·로비 입장',
            steps: [
              {
                id: 'step-1-1',
                step: 1,
                clue: '사건 개요',
                input: 'X-KIT 브리핑 확인',
                xkit: true,
                key: false,
                dev: false,
                output: '수사 시작 코드 "1953" 획득',
                auto: false,
                problemType: '평면',
                note: '시작 연출용 X-KIT',
                pinX: 12, pinY: 32,
              },
              {
                id: 'step-1-2',
                step: 2,
                clue: '로비 수납장',
                input: '날짜 암호 (벽보 단서)',
                xkit: false,
                key: true,
                dev: false,
                output: '열쇠 1번 획득',
                auto: false,
                problemType: '입체',
                pinX: 20, pinY: 40,
              },
            ],
          },
          {
            id: 'section-2',
            title: '간호사실 진입',
            steps: [
              {
                id: 'step-2-1',
                step: 1,
                clue: '간호 일지',
                input: '텍스트 암호 해독',
                xkit: false,
                key: false,
                dev: false,
                output: '서랍 번호 "3번" 확인',
                auto: false,
                problemType: '평면',
                pinX: 45, pinY: 18,
              },
              {
                id: 'step-2-2',
                step: 2,
                clue: '약품 보관함',
                input: '색상 순서 입력 (빨·파·노)',
                xkit: false,
                key: true,
                dev: false,
                output: '혈액형 카드 세트 획득',
                auto: false,
                problemType: '입체',
                pinX: 55, pinY: 14,
              },
              {
                id: 'step-2-3',
                step: 3,
                clue: '환자 조회 X-KIT',
                input: '환자 ID "A-1953-07" 입력',
                xkit: true,
                key: false,
                dev: false,
                output: '담당의 이름 "박동현" 출력',
                auto: false,
                problemType: '평면',
                pinX: 62, pinY: 22,
              },
            ],
          },
          {
            id: 'section-3',
            title: '지하 의무실 진입',
            steps: [
              {
                id: 'step-3-1',
                step: 1,
                clue: '혈액형 분류기',
                input: 'O→A→B→AB 순서 입력',
                xkit: false,
                key: false,
                dev: true,
                output: '냉동고 잠금 해제 코드',
                auto: false,
                problemType: '입체',
                note: '아두이노 자동 판별 장치',
                pinX: 78, pinY: 18,
              },
              {
                id: 'step-3-2',
                step: 2,
                clue: 'UV 실험 기록',
                input: 'UV 조명 비추기',
                xkit: false,
                key: false,
                dev: false,
                output: '은닉 코드 "0509" 확인',
                auto: false,
                problemType: '평면',
                pinX: 85, pinY: 26,
              },
              {
                id: 'step-3-3',
                step: 3,
                clue: '냉동고',
                input: '온도 다이얼 −4°C + 코드 입력',
                xkit: false,
                key: true,
                dev: true,
                output: '최종 실험 보고서 획득',
                auto: false,
                problemType: '입체',
                note: '온도 센서 연동 전자 잠금',
                pinX: 88, pinY: 36,
              },
            ],
          },
          {
            id: 'section-4',
            title: '특수 병동 4호실',
            steps: [
              {
                id: 'step-4-0',
                step: 0,
                clue: '문 자동 개방',
                input: '(AUTO)',
                xkit: false,
                key: false,
                dev: true,
                output: '4호실 문 열림',
                auto: true,
                problemType: '',
                note: '전자 자물쇠 자동 트리거',
                pinX: 15, pinY: 58,
              },
              {
                id: 'step-4-1',
                step: 1,
                clue: '간호사 비밀 일기',
                input: 'X-KIT 비밀번호 "최미영" 입력',
                xkit: true,
                key: false,
                dev: false,
                output: '공범 증거 일기 해독 완료',
                auto: false,
                problemType: '평면',
                note: '스토리 반전 핵심 퍼즐',
                pinX: 22, pinY: 68,
              },
              {
                id: 'step-4-2',
                step: 2,
                clue: '탈출 협동 스위치',
                input: '두 플레이어 동시에 양쪽 스위치 누르기',
                xkit: false,
                key: false,
                dev: true,
                output: '원장실 문 잠금 해제',
                auto: false,
                problemType: '공간',
                note: '협동 퍼즐 — 동시 입력 필요',
                pinX: 30, pinY: 76,
              },
            ],
          },
          {
            id: 'section-5',
            title: '원장실 최종 수사',
            steps: [
              {
                id: 'step-5-1',
                step: 1,
                clue: '원장실 금고',
                input: '실험 날짜 역순 "905010" 입력',
                xkit: false,
                key: true,
                dev: false,
                output: '원장 서명 최종 보고서 획득',
                auto: false,
                problemType: '입체',
                pinX: 60, pinY: 64,
              },
              {
                id: 'step-5-2',
                step: 2,
                clue: 'X-KIT 최종 신고',
                input: '증거 코드 "TRUTH-1953" 입력',
                xkit: true,
                key: false,
                dev: false,
                output: '🎉 탈출 성공 — 사건 해결!',
                auto: false,
                problemType: '평면',
                note: '엔딩 연출: 조명 밝아짐 + 문 자동 개방',
                pinX: 70, pinY: 76,
              },
            ],
          },
        ],
      },
    },
  ],
}

export function seedSampleProject() {
  // Always overwrite the sample project so pin coordinates and updates stay fresh
  saveProject(sampleProject)
}
