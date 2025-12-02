/**
 * NDEF (NFC Data Exchange Format) URL 레코드 직렬화 유틸리티
 *
 * NDEF Message 구조:
 * - NDEF Message = 1개 이상의 NDEF Record
 * - NDEF Record = Header + Type + ID + Payload
 */

export class NdefUrlRecord {
  /**
   * URL을 NDEF URL 레코드로 직렬화
   * @param url 전체 URL (예: https://example.com/receipt/123)
   * @returns NDEF 메시지 바이트 배열
   */
  static encode(url: string): Buffer {
    // URL 프로토콜 프리픽스 매핑
    const prefixes: { [key: string]: number } = {
      'http://www.': 0x01,
      'https://www.': 0x02,
      'http://': 0x03,
      'https://': 0x04,
      'tel:': 0x05,
      'mailto:': 0x06,
      'ftp://anonymous:anonymous@': 0x07,
      'ftp://ftp.': 0x08,
      'ftps://': 0x09,
      'sftp://': 0x0a,
      'smb://': 0x0b,
      'nfs://': 0x0c,
      'ftp://': 0x0d,
      'dav://': 0x0e,
      'news:': 0x0f,
      'telnet://': 0x10,
      'imap:': 0x11,
      'rtsp://': 0x12,
      'urn:': 0x13,
      'pop:': 0x14,
      'sip:': 0x15,
      'sips:': 0x16,
      'tftp:': 0x17,
      'btspp://': 0x18,
      'btl2cap://': 0x19,
      'btgoep://': 0x1a,
      'tcpobex://': 0x1b,
      'irdaobex://': 0x1c,
      'file://': 0x1d,
      'urn:epc:id:': 0x1e,
      'urn:epc:tag:': 0x1f,
      'urn:epc:pat:': 0x20,
      'urn:epc:raw:': 0x21,
      'urn:epc:': 0x22,
      'urn:nfc:': 0x23,
    };

    // URL에서 매칭되는 프리픽스 찾기
    let prefixCode = 0x00; // 프리픽스 없음
    let urlWithoutPrefix = url;

    for (const [prefix, code] of Object.entries(prefixes)) {
      if (url.startsWith(prefix)) {
        prefixCode = code;
        urlWithoutPrefix = url.substring(prefix.length);
        break;
      }
    }

    // Payload: prefix code + URL (without prefix)
    const urlBytes = Buffer.from(urlWithoutPrefix, 'utf-8');
    const payloadLength = 1 + urlBytes.length;
    const payload = Buffer.alloc(payloadLength);
    payload[0] = prefixCode;
    urlBytes.copy(payload, 1);

    // NDEF Record Header
    // MB (Message Begin) = 1
    // ME (Message End) = 1
    // CF (Chunk Flag) = 0
    // SR (Short Record) = 1
    // IL (ID Length present) = 0
    // TNF (Type Name Format) = 0x01 (NFC Forum well-known type)
    const tnf = 0x01;
    const flags = 0xD0 | tnf; // 11010001 = MB | ME | SR | TNF

    // Type: "U" for URL
    const typeLength = 1;
    const type = Buffer.from('U', 'utf-8');

    // NDEF Record = [Flags, Type Length, Payload Length, Type, Payload]
    const record = Buffer.alloc(3 + typeLength + payloadLength);
    let offset = 0;

    record[offset++] = flags;
    record[offset++] = typeLength;
    record[offset++] = payloadLength;
    type.copy(record, offset);
    offset += typeLength;
    payload.copy(record, offset);

    return record;
  }

  /**
   * NDEF 레코드를 URL로 디코딩 (디버깅/테스트용)
   */
  static decode(buffer: Buffer): string | null {
    try {
      if (buffer.length < 3) return null;

      const flags = buffer[0];
      const typeLength = buffer[1];
      const payloadLength = buffer[2];

      if (buffer.length < 3 + typeLength + payloadLength) return null;

      const type = buffer.slice(3, 3 + typeLength).toString('utf-8');
      if (type !== 'U') return null;

      const payload = buffer.slice(3 + typeLength, 3 + typeLength + payloadLength);
      const prefixCode = payload[0];
      const urlPart = payload.slice(1).toString('utf-8');

      const prefixMap: { [key: number]: string } = {
        0x00: '',
        0x01: 'http://www.',
        0x02: 'https://www.',
        0x03: 'http://',
        0x04: 'https://',
      };

      const prefix = prefixMap[prefixCode] || '';
      return prefix + urlPart;
    } catch (error) {
      console.error('NDEF decode error:', error);
      return null;
    }
  }

  /**
   * 주문 정보를 포함한 영수증 URL 생성
   */
  static createReceiptUrl(
    baseUrl: string,
    orderId: string,
    includeReceipt: boolean
  ): string {
    const url = new URL(baseUrl);
    url.searchParams.set('orderId', orderId);
    url.searchParams.set('receipt', includeReceipt ? 'true' : 'false');
    return url.toString();
  }
}

/**
 * NDEF 메시지 검증
 */
export function validateNdefMessage(buffer: Buffer): boolean {
  try {
    if (buffer.length < 3) return false;

    const flags = buffer[0];
    const typeLength = buffer[1];
    const payloadLength = buffer[2];

    // MB (Message Begin) 비트 체크
    const mb = (flags & 0x80) !== 0;
    // ME (Message End) 비트 체크
    const me = (flags & 0x40) !== 0;

    if (!mb || !me) return false;

    const expectedLength = 3 + typeLength + payloadLength;
    return buffer.length >= expectedLength;
  } catch {
    return false;
  }
}
