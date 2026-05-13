import { compressToUTF16, decompressFromUTF16 } from 'lz-string'

// 압축된 값임을 표시하는 마커.
// JSON 값은 절대 SOH(\x01)로 시작하지 않으므로 충돌 불가.
const COMPRESSED_MARKER = '\x01LZ\x01'

/**
 * localStorage에 압축 저장.
 * - 256자 미만은 압축 효율 낮으므로 원본 그대로 저장
 * - 압축본이 더 큰 경우(이미 잘 압축된 데이터 등)도 원본 그대로 저장
 * - 압축한 경우만 마커가 붙음
 */
export function safeSetItem(key: string, value: string): void {
  if (value.length < 256) {
    localStorage.setItem(key, value)
    return
  }
  const compressed = compressToUTF16(value)
  const finalValue = compressed.length + COMPRESSED_MARKER.length < value.length
    ? COMPRESSED_MARKER + compressed
    : value
  localStorage.setItem(key, finalValue)
}

export function safeGetItem(key: string): string | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  if (raw.startsWith(COMPRESSED_MARKER)) {
    const data = raw.slice(COMPRESSED_MARKER.length)
    const decoded = decompressFromUTF16(data)
    if (decoded === null) {
      console.error('[storage] decompression failed for key:', key)
      return null
    }
    return decoded
  }
  // 기존 비압축 데이터: 그대로 반환 (다음 write 시 압축됨)
  return raw
}
