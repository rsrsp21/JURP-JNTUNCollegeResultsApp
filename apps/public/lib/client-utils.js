export const semesters = [
  { number: 1, key: '1-1', creditsKey: 'Credits_1-1', label: '1-1' },
  { number: 2, key: '1-2', creditsKey: 'Credits_1-2', label: '1-2' },
  { number: 3, key: '2-1', creditsKey: 'Credits_2-1', label: '2-1' },
  { number: 4, key: '2-2', creditsKey: 'Credits_2-2', label: '2-2' },
  { number: 5, key: '3-1', creditsKey: 'Credits_3-1', label: '3-1' },
  { number: 6, key: '3-2', creditsKey: 'Credits_3-2', label: '3-2' },
  { number: 7, key: '4-1', creditsKey: 'Credits_4-1', label: '4-1' },
  { number: 8, key: '4-2', creditsKey: 'Credits_4-2', label: '4-2' },
  { number: 9, key: 'Honors/Minor', creditsKey: null, label: 'Honors/Minor' }
];

export const branches = {
  '1': 'Civil Engineering',
  '2': 'Electrical and Electronics Engineering',
  '3': 'Mechanical Engineering',
  '4': 'Electronics and Communication Engineering',
  '5': 'Computer Science and Engineering'
};

export function branchFromRoll(rollNumber = '') {
  return branches[String(rollNumber).trim().toUpperCase().charAt(7)] || 'Unknown Branch';
}

export function isValidRollNumber(value = '') {
  return /^[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}$/i.test(value.trim());
}

export function normalizeRollNumber(value = '') {
  return value.trim().toUpperCase();
}

export function displayValue(value, fallback = 'N/A') {
  if (value === null || typeof value === 'undefined' || value === '') return fallback;
  return String(value);
}

export function batchDisplay(batch = '') {
  if (/^\d{4}-\d{2}$/.test(batch)) {
    return `${batch.slice(0, 4)}-20${batch.slice(-2)}`;
  }
  return batch || 'N/A';
}

export function classForGrade(grade = '') {
  const value = String(grade).toUpperCase();
  if (value === 'F' || value === 'ABSENT' || value === 'AB') return 'grade-fail';
  if (value === 'S' || value === 'A+' || value === 'A') return 'grade-best';
  if (value === 'B' || value === 'C') return 'grade-good';
  return 'grade-neutral';
}
