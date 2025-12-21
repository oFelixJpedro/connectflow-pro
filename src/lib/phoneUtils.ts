/**
 * Brazilian phone number normalization utilities
 * Standardizes phone numbers to the API format: 5517999999999
 */

// Valid Brazilian DDDs
const VALID_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99', // MA
]);

/**
 * Validates if a DDD is valid for Brazil
 */
export function isValidDDD(ddd: string): boolean {
  return VALID_DDDS.has(ddd);
}

/**
 * Normalizes a phone number to the Brazilian API standard format
 * 
 * Rules applied:
 * 1. Removes all non-digit characters
 * 2. Removes leading zeros from DDD (017 → 17)
 * 3. Adds country code 55 if not present
 * 4. Validates DDD (2 digits, valid Brazilian DDD)
 * 5. Validates number length (8-9 digits after DDD)
 * 
 * @param phone - User input phone number
 * @returns Normalized phone (e.g., "5517999999999") or null if invalid
 * 
 * @example
 * normalizePhoneNumber("(017) 99999-9999") // "5517999999999"
 * normalizePhoneNumber("17999999999") // "5517999999999"
 * normalizePhoneNumber("+55 17 99999-9999") // "5517999999999"
 * normalizePhoneNumber("99999-9999") // null (no DDD)
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length < 10) return null; // Minimum: DDD (2) + number (8)
  
  // Remove leading zeros (e.g., 017 → 17, 0017 → 17)
  while (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  // If too short after removing zeros, invalid
  if (digits.length < 10) return null;
  
  // Add country code 55 if not present
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  // Validate final length: 55 + DDD(2) + number(8-9) = 12-13 digits
  if (digits.length < 12 || digits.length > 13) return null;
  
  // Validate DDD (positions 2-3 after 55)
  const ddd = digits.slice(2, 4);
  if (!isValidDDD(ddd)) return null;
  
  return digits;
}

/**
 * Formats a phone number for display
 * 
 * @param phone - Phone number (any format)
 * @returns Formatted phone (e.g., "+55 (17) 99999-9999") or original if can't normalize
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone; // Return original if can't normalize
  
  // +55 (DDD) XXXXX-XXXX for mobile (13 digits)
  // +55 (DDD) XXXX-XXXX for landline (12 digits)
  if (normalized.length === 13) {
    return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 9)}-${normalized.slice(9)}`;
  }
  return `+${normalized.slice(0, 2)} (${normalized.slice(2, 4)}) ${normalized.slice(4, 8)}-${normalized.slice(8)}`;
}

/**
 * Validates if a phone number can be normalized
 * 
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidBrazilianPhone(phone: string): boolean {
  return normalizePhoneNumber(phone) !== null;
}
