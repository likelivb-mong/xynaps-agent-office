import type { BranchCode } from '../types'

export const BRANCH_CODES: BranchCode[] = ['GDXC', 'GDXR', 'NWXC', 'GNXC', 'SWXC', 'XYNP']

export const DIVERSITY_MAJOR = [
  { label: '평면', color: '#d4a017' },
  { label: '입체', color: '#4285f4' },
  { label: '공간', color: '#34a853' },
  { label: '감각', color: '#888' },
] as const

export const DIVERSITY_MINOR = ['1 ~ 10', '가 ~ 사', 'a ~ b', '시각 ~ 촉각'] as const

export const DIVERSITY_TYPES = ['추리', '관찰', '수리', '협동', '활동', '오감'] as const

export const PLAUSIBILITY = [
  '스토리의 흐름이 매끄러운가?',
  '복선이 잘 활용되었는가?',
  '문제가 스토리와 연관되는가?',
] as const

export const STAGING = ['인테리어', '공간구획', '조명활용', '소품활용', 'bgm'] as const

// 평면 Plane
export const PLANE_TEXT = ['1. 종이, 보드', '2. 벽, 선반'] as const
export const PLANE_VIDEO = ['3. 시니어즈', '4. 빔'] as const
export const PLANE_XKIT = ['5. JPG', '6. GIF', '7. MP3', '8. AVI'] as const
export const PLANE_UV = ['9. 글', '10. 이미지'] as const

// 입체 Solid — 물품
export const SOLID_ITEMS = ['가. 원형', '나. 변형', '다. 제작'] as const

// 입체 Solid — 장치 (그룹 + 서브항목)
export const SOLID_DEVICE_GROUPS = [
  {
    group: '회로',
    items: [] as string[],
  },
  {
    group: '라. 일반회로',
    items: [
      '접촉: IC, 자석, 금속',
      '빛 (동작감지)',
      '무게',
      '데시벨',
      '모스부호',
      '전화장치',
      '터치',
      '쉐이커',
    ],
  },
  {
    group: '마. 키트장치',
    items: ['가구키트', '리뉴얼', '제작키트'],
  },
  {
    group: '바. 기계',
    items: ['돌니돌리기 (아마존)'],
  },
  {
    group: '사. 기계제어',
    items: ['엘리베이터 (서이름)'],
  },
] as const

// 공간 Space
export const SPACE_LAYOUT = [
  'a. 공간배치',
  '벽타일 누르는 문제 (다이스룸)',
  '공간착시 (아나모픽)',
] as const

export const SPACE_COOPERATION = [
  'b. 협동',
  '손에손잡고 (제물의밤)',
  '한명씩 각 방에 (알카트라즈)',
] as const

// 감각 Sense
export const SENSE = ['시각', '청각', '후각', '미각', '촉각'] as const

// 게임 플로우 시트용 문제 유형
export const PROBLEM_TYPES = ['평면', '입체', '공간', '감각'] as const

export const PROBLEM_SUBTYPES: Record<string, string[]> = {
  평면: ['텍스트', '영상', 'x-kit', 'UV'],
  입체: ['물품(원형)', '물품(변형)', '물품(제작)', '장치(회로)', '장치(키트)', '장치(기계)', '장치(기계제어)'],
  공간: ['공간배치', '협동'],
  감각: ['시각', '청각', '후각', '미각', '촉각'],
}

export const XKIT_DEFINITION = `X-KIT은 플레이어가 정보를 확인하고, 단서를 해석하고, 정답을 입력하여 게임을 진행하는 디지털 인터페이스 시스템이다.
- 정보 출력: 스토리 텍스트, 상황 설명, 메시지, 힌트
- 단서 해석: NFC 태그, QR 코드, 특정 입력값 처리
- 정답 입력 및 진행 제어: 숫자/문자/키워드 → 정답 판별 → 다음 스텝 활성화
X-KIT에 포함되지 않는 것: 오디오 몰입, 공간 연출, 물리 퍼즐, 전자 장치`
