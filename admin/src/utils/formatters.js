/**
 * Speed Setu Logistics Admin Formatters
 */

/**
 * Format a number as Indian Currency (INR ₹)
 * Example: 1240000 -> ₹12,40,000
 */
export const formatINR = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format a standard number with Indian comma separation
 * Example: 12400 -> 12,400
 */
export const formatNumber = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
};

/**
 * Format date string into readable logistics format
 * Example: '2026-02-19' -> '19 Feb 2026'
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

/**
 * Capitalize first letter of string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Natural numeric comparator for Company Codes (Ascending Order: lowest to highest)
 * Handles variable length digits, alphanumeric prefixes, and symbols.
 * Examples: CC9 < CC10 < CC99 < CC100 < CC101 < CC102 < CC109 < CC110
 */
export const compareCompanyCodes = (codeA, codeB) => {
  const strA = String(codeA || '').trim();
  const strB = String(codeB || '').trim();
  if (!strA && !strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  const regex = /^([a-zA-Z_\-\s]*?)(\d+)(.*)$/;
  const matchA = strA.match(regex);
  const matchB = strB.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefixB = matchB[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (prefixA === prefixB) {
      const numA = parseInt(matchA[2], 10);
      const numB = parseInt(matchB[2], 10);
      if (numA !== numB) {
        return numA - numB;
      }
      if (matchA[3] || matchB[3]) {
        return matchA[3].localeCompare(matchB[3], undefined, { numeric: true, sensitivity: 'base' });
      }
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    }
  }

  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
};

