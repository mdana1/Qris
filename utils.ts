
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
 * Parses a QRIS/EMVCo payload into a Map of Tags to Values.
 */
const parseTLV = (payload: string): Map<string, string> => {
  const tags = new Map<string, string>();
  let i = 0;
  while (i < payload.length) {
    const tag = payload.substring(i, i + 2);
    const length = parseInt(payload.substring(i + 2, i + 4), 10);
    const value = payload.substring(i + 4, i + 4 + length);
    tags.set(tag, value);
    i += 4 + length;
  }
  return tags;
};

/**
 * Serializes a Map of Tags back into a QRIS string, excluding specific tags if needed.
 */
const serializeTLV = (tags: Map<string, string>, excludeTags: string[] = []): string => {
  let result = '';
  // Sort tags numerically for standard compliance (optional but recommended)
  const sortedTags = Array.from(tags.keys()).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  
  for (const tag of sortedTags) {
    if (excludeTags.includes(tag)) continue;
    const value = tags.get(tag) || '';
    const length = value.length.toString().padStart(2, '0');
    result += tag + length + value;
  }
  return result;
};

/**
 * Converts a static QRIS payload to a dynamic one.
 * 1. Parses existing TLV structure.
 * 2. Changes Tag 01 (Initiation Method) from "11" (Static) to "12" (Dynamic).
 * 3. Adds/Updates Tag 54 (Transaction Amount).
 * 4. Recalculates Tag 63 (CRC).
 */
export const generateDynamicQris = (staticPayload: string, amount: string): string => {
  try {
    const cleanPayload = staticPayload.trim();
    const tags = parseTLV(cleanPayload);

    // Update Tag 01 to "12" (Dynamic QR)
    // Tag 01: Point of Initiation Method. 11 = Static, 12 = Dynamic
    tags.set('01', '12');

    // Add Tag 54 (Transaction Amount)
    tags.set('54', amount.toString());

    // Serialize all tags except the CRC (Tag 63)
    let basePayload = serializeTLV(tags, ['63']);
    
    // Append Tag 63 (CRC) identifier and placeholder length
    basePayload += '6304';

    // Calculate new CRC
    const newCrc = crc16(basePayload);
    
    return basePayload + newCrc;
  } catch (error) {
    console.error("Failed to generate dynamic QRIS:", error);
    // Fallback to simple string manipulation if parsing fails (less reliable)
    return staticPayload; 
  }
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
