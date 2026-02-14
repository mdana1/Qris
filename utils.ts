
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Calculates CRC16-CCITT as used in EMVCo QR codes.
 * Polynomial: 0x1021, Initial: 0xFFFF
 */
const crc16 = (data: string): string => {
  let crc = 0xFFFF;
  const poly = 0x1021;

  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ poly;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Converts a static QRIS payload to a dynamic one by inserting the amount tag (54).
 * QRIS Payload format: [Tag 2][Length 2][Value]
 */
export const generateDynamicQris = (staticPayload: string, amount: string): string => {
  // 1. Clean up payload (remove trailing CRC if present)
  let base = staticPayload.trim();
  if (base.slice(-8, -4) === '6304') {
    base = base.slice(0, -4);
  } else if (base.includes('6304')) {
    // If CRC tag is not at the end (rare), find it
    const index = base.indexOf('6304');
    base = base.slice(0, index + 4);
  } else if (!base.includes('6304')) {
    base = base + '6304';
  }

  // 2. Prepare Amount Tag (54)
  const amountStr = amount.toString();
  const tag54 = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;

  // 3. Insert Tag 54 before Tag 58 (Country Code) or at the end (before CRC)
  // Standard dynamic QRIS usually has 54 after 53 or before 58.
  let dynamicBase = '';
  if (base.includes('5802ID')) {
    const parts = base.split('5802ID');
    dynamicBase = parts[0] + tag54 + '5802ID' + parts[1];
  } else {
    // Fallback: insert before Tag 63
    const parts = base.split('6304');
    dynamicBase = parts[0] + tag54 + '6304';
  }

  // 4. Recalculate CRC
  const newCrc = crc16(dynamicBase);
  return dynamicBase + newCrc;
};

export const cleanBase64 = (data: string): string => {
  return data.replace(/^data:.*,/, '');
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
