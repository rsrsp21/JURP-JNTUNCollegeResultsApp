import 'server-only';

import { clearD1QueryCache, d1Query } from './d1';

export const batchConfig = {
  '2021': { batchLabel: '2021-25', regulation: 'R20', prefixes: ['21031A', '22035A'] },
  '2022': { batchLabel: '2022-26', regulation: 'R20', prefixes: ['22031A', '23035A'] },
  '2023': { batchLabel: '2023-27', regulation: 'R23', prefixes: ['23031A', '24035A'] },
  '2024': { batchLabel: '2024-28', regulation: 'R23', prefixes: ['24031A', '25035A'] },
  '2025': { batchLabel: '2025-29', regulation: 'R23', prefixes: ['25031A', '26035A'] }
};

const semesterDbToApi = {
  sgpa_1_1: '1-1',
  credits_1_1: 'Credits_1-1',
  sgpa_1_2: '1-2',
  credits_1_2: 'Credits_1-2',
  sgpa_2_1: '2-1',
  credits_2_1: 'Credits_2-1',
  sgpa_2_2: '2-2',
  credits_2_2: 'Credits_2-2',
  sgpa_3_1: '3-1',
  credits_3_1: 'Credits_3-1',
  sgpa_3_2: '3-2',
  credits_3_2: 'Credits_3-2',
  sgpa_4_1: '4-1',
  credits_4_1: 'Credits_4-1',
  sgpa_4_2: '4-2',
  credits_4_2: 'Credits_4-2'
};

const cgpaSelectColumns = `
  c.student_id,
  c.name,
  c.name_status,
  c.email,
  c.pending_email,
  c.name_edit_used,
  c.email_edit_used,
  c.grade_card_name,
  c.batch_label,
  c.regulation,
  c.sgpa_1_1,
  c.credits_1_1,
  c.sgpa_1_2,
  c.credits_1_2,
  c.sgpa_2_1,
  c.credits_2_1,
  c.sgpa_2_2,
  c.credits_2_2,
  c.sgpa_3_1,
  c.credits_3_1,
  c.sgpa_3_2,
  c.credits_3_2,
  c.sgpa_4_1,
  c.credits_4_1,
  c.sgpa_4_2,
  c.credits_4_2,
  c.total_credits,
  c.cgpa,
  c.supplementary_appearances,
  s.percentage AS summary_percentage,
  s.percentage_value AS summary_percentage_value,
  s.division AS summary_division,
  s.division_class AS summary_division_class,
  s.progress_percentage AS summary_progress_percentage,
  s.progress_class AS summary_progress_class,
  s.supplementary_count AS summary_supplementary_count
`;

export function batchYearFromStudentId(studentId = '') {
  const value = studentId.trim().toUpperCase();
  return Object.entries(batchConfig).find(([, config]) => config.prefixes.some((prefix) => value.startsWith(prefix)))?.[0] || null;
}

export async function getStudentCgpa(studentId) {
  const rows = await d1Query(
    `
    SELECT ${cgpaSelectColumns}
    FROM student_cgpa c
    LEFT JOIN student_academic_summary s ON s.student_id = c.student_id
    WHERE c.student_id = ?
    LIMIT 1
    `,
    [studentId.trim().toUpperCase()],
    { noCache: true }
  );
  return rows[0] ? cgpaRowToApi(rows[0], academicSummaryFromJoinedRow(rows[0])) : null;
}

export async function setStudentName(studentId, name, gradeCardName = null) {
  const normalized = studentId.trim().toUpperCase();
  const rows = await d1Query('SELECT student_id, name_status FROM student_cgpa WHERE student_id = ? LIMIT 1', [normalized]);
  if (!rows.length) return { success: false, error: 'No student record found for this roll number.' };

  if (rows[0].name_status === 'approved') {
    return { success: false, error: 'Your name has already been verified and approved. Use the edit option to request a name correction.' };
  }

  const finalName = (gradeCardName || name).trim();
  if (gradeCardName) {
    await d1Query('UPDATE student_cgpa SET name = ?, grade_card_name = ?, name_status = NULL WHERE student_id = ?', [finalName, gradeCardName.trim(), normalized]);
  } else {
    await d1Query('UPDATE student_cgpa SET name = ?, name_status = NULL WHERE student_id = ?', [finalName, normalized]);
  }
  clearD1QueryCache();
  return { success: true };
}

export async function setStudentNameEdit(studentId, newName) {
  const normalized = studentId.trim().toUpperCase();
  const rows = await d1Query('SELECT student_id, name, name_edit_used FROM student_cgpa WHERE student_id = ? LIMIT 1', [normalized], { noCache: true });
  if (!rows.length) return { success: false, error: 'No student record found for this roll number.' };

  if (rows[0].name_edit_used) {
    return { success: false, error: 'You have already used your one-time name edit. Contact an administrator for further changes.' };
  }

  await d1Query('UPDATE student_cgpa SET name = ?, grade_card_name = ?, name_status = NULL, name_edit_used = 1 WHERE student_id = ?', [newName.trim(), newName.trim(), normalized]);
  clearD1QueryCache();
  return { success: true };
}

export async function setStudentEmail(studentId, email) {
  const normalized = studentId.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();
  const rows = await d1Query('SELECT student_id, email, email_edit_used FROM student_cgpa WHERE student_id = ? LIMIT 1', [normalized], { noCache: true });
  if (!rows.length) return null;

  const currentEmail = (rows[0].email || '').trim();
  if (currentEmail && currentEmail !== cleanEmail) {
    if (rows[0].email_edit_used) {
      return { status: 'blocked', error: 'You have already changed your email once. Contact an administrator for further changes.' };
    }
    await d1Query('UPDATE student_cgpa SET pending_email = ?, email_edit_used = 1 WHERE student_id = ?', [cleanEmail, normalized]);
    clearD1QueryCache();
    return { status: 'pending', email: currentEmail, pendingEmail: cleanEmail };
  }

  await d1Query('UPDATE student_cgpa SET email = ?, pending_email = NULL WHERE student_id = ?', [cleanEmail, normalized]);
  clearD1QueryCache();
  return { status: 'saved', email: cleanEmail, pendingEmail: '' };
}

export async function getStudentResults(studentId) {
  const normalized = studentId.trim().toUpperCase();
  const [cgpaData, semesterRows] = await Promise.all([
    getStudentCgpa(normalized),
    d1Query(
      `
      SELECT id, student_id, semester_number, subject_code, subject_name, grade, credits, row_order
      FROM semester_results
      WHERE student_id = ?
      ORDER BY semester_number, row_order, id
      `,
      [normalized]
    )
  ]);

  const grouped = groupSemesterRows(semesterRows);
  return {
    studentId: normalized,
    cgpaData,
    semesterData: Object.fromEntries(
      Object.entries(grouped).map(([semester, rows]) => [semester, rows.map(semesterRowToApi)])
    ),
    semesterSummaries: semesterSummariesFromCgpa(cgpaData, honorsCreditsFromRows(grouped))
  };
}

export async function getBatchData(batchYear) {
  const cgpaRows = await d1Query(
    `
    SELECT ${cgpaSelectColumns}
    FROM student_cgpa c
    LEFT JOIN student_academic_summary s ON s.student_id = c.student_id
    WHERE c.batch_year = ?
    ORDER BY c.student_id
    `,
    [String(batchYear)]
  );
  if (!cgpaRows.length) return [];

  const semesterRows = await d1Query(
    `
    SELECT id, student_id, semester_number, subject_code, subject_name, grade, credits, row_order
    FROM semester_results
    WHERE batch_year = ?
    ORDER BY student_id, semester_number, row_order, id
    `,
    [String(batchYear)]
  );

  const rowsByStudent = new Map();
  for (const row of semesterRows) {
    const student = row.student_id;
    if (!rowsByStudent.has(student)) rowsByStudent.set(student, []);
    rowsByStudent.get(student).push(row);
  }

  return cgpaRows.map((row) => {
    const cgpaData = cgpaRowToApi(row, academicSummaryFromJoinedRow(row));
    const grouped = groupSemesterRows(rowsByStudent.get(row.student_id) || []);
    return {
      studentId: row.student_id,
      cgpaData,
      allSemesterData: Object.fromEntries(
        Object.entries(grouped).map(([semester, rows]) => [semester, rows.map(semesterRowToApi)])
      ),
      semesterSummaries: semesterSummariesFromCgpa(cgpaData, honorsCreditsFromRows(grouped))
    };
  });
}

export async function getBatchSemesterCsv(batchYear, semesterNumber) {
  const rows = await d1Query(
    `
    SELECT id, student_id, semester_number, subject_code, subject_name, grade, credits, row_order
    FROM semester_results
    WHERE batch_year = ? AND semester_number = ?
    ORDER BY student_id, row_order, id
    `,
    [String(batchYear), Number(semesterNumber)]
  );
  const records = rows.map(semesterRowToApi);
  if (!records.length) return '';
  const headers = Object.keys(records[0]);
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...records.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

export async function getToppersForYear(batchYear) {
  const rows = await d1Query(
    `
    SELECT t.category, t.roll_number, t.cgpa, c.name, c.name_status
    FROM toppers t
    LEFT JOIN student_cgpa c ON c.student_id = t.roll_number
    WHERE t.batch_year = ?
    ORDER BY t.category, t.rank_order
    `,
    [String(batchYear)]
  );
  if (!rows.length) return null;
  const result = { overall: [], cse: [], ece: [], eee: [], mec: [], ce: [] };
  for (const row of rows) {
    const category = String(row.category || '').toLowerCase();
    if (!result[category]) continue;
    result[category].push({
      roll_number: row.roll_number || '',
      name: row.name || '',
      name_status: row.name_status || 'pending',
      cgpa: numberOrZero(row.cgpa)
    });
  }
  return result;
}

export async function getToppersRagData() {
  const data = {};
  for (const year of Object.keys(batchConfig)) {
    const toppers = await getToppersForYear(year);
    if (!toppers) continue;
    data[year] = {
      overall: toppers.overall.slice(0, 5).map((item) => ({ rollNumber: item.roll_number, cgpa: String(item.cgpa) })),
      branches: Object.fromEntries(
        ['cse', 'ece', 'eee', 'mec', 'ce'].map((branch) => [
          branch,
          toppers[branch].slice(0, 3).map((item) => ({ rollNumber: item.roll_number, cgpa: String(item.cgpa) }))
        ])
      )
    };
  }
  return data;
}

export async function listNotifications(limit = 3) {
  let query = 'SELECT id, text, date_text, is_new FROM notifications ORDER BY sort_order ASC, id DESC';
  if (limit > 0) {
    query += ` LIMIT ${Number(limit)}`;
  }
  const rows = await d1Query(query);
  return rows.map((row) => ({
    text: row.text || '',
    date: row.date_text || '',
    is_new: Boolean(row.is_new)
  }));
}

export async function latestNotificationText() {
  const rows = await d1Query('SELECT text FROM notifications ORDER BY sort_order ASC, id DESC LIMIT 1');
  return rows[0]?.text?.trim() || null;
}

export function cgpaRowToApi(row, academicSummary = null) {
  const result = {
    ID: row.student_id || '',
    Name: row.name || '',
    NameStatus: row.name_status || 'pending',
    Email: row.email || '',
    PendingEmail: row.pending_email || '',
    NameEditUsed: row.name_edit_used ? 1 : 0,
    EmailEditUsed: row.email_edit_used ? 1 : 0
  };
  for (const [dbColumn, apiColumn] of Object.entries(semesterDbToApi)) {
    result[apiColumn] = numberToText(row[dbColumn]);
  }
  result['Total Credits'] = numberToText(row.total_credits);
  result.CGPA = numberToText(row.cgpa);
  result['Supplementary Appearances'] = row.supplementary_appearances || '';
  result.Batch = row.batch_label || '';
  result.Regulation = row.regulation || '';
  result.academicSummary = academicSummary || {
    percentage: '0%',
    percentageValue: 0,
    division: 'Not Applicable',
    divisionClass: 'not-applicable',
    progressPercentage: 0,
    progressClass: 'pass-class',
    supplementaryCount: 0
  };
  return result;
}

export function academicSummaryFromJoinedRow(row) {
  if (row.summary_percentage == null && row.summary_division == null) return null;
  return {
    percentage: row.summary_percentage || '0%',
    percentageValue: numberOrZero(row.summary_percentage_value),
    division: row.summary_division || 'Not Applicable',
    divisionClass: row.summary_division_class || 'not-applicable',
    progressPercentage: numberOrZero(row.summary_progress_percentage),
    progressClass: row.summary_progress_class || 'pass-class',
    supplementaryCount: Math.trunc(numberOrZero(row.summary_supplementary_count))
  };
}

export function semesterRowToApi(row) {
  return {
    ID: row.student_id || '',
    'Subject Code': row.subject_code || '',
    'Subject Name': row.subject_name || '',
    Grade: row.grade || '',
    Credits: row.credits == null ? '' : String(row.credits)
  };
}

function groupSemesterRows(rows) {
  const grouped = {};
  for (const row of rows || []) {
    const key = String(row.semester_number);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  return grouped;
}

function honorsCreditsFromRows(grouped) {
  const rows = grouped['9'] || [];
  if (!rows.length) return null;
  let total = 0;
  let found = false;
  for (const row of rows) {
    const value = Number(row.credits);
    if (Number.isFinite(value)) {
      total += value;
      found = true;
    }
  }
  return found ? total : null;
}

function semesterSummariesFromCgpa(cgpaData, honorsCredits = null) {
  const summaries = {};
  const columns = {
    1: ['1-1', 'Credits_1-1'],
    2: ['1-2', 'Credits_1-2'],
    3: ['2-1', 'Credits_2-1'],
    4: ['2-2', 'Credits_2-2'],
    5: ['3-1', 'Credits_3-1'],
    6: ['3-2', 'Credits_3-2'],
    7: ['4-1', 'Credits_4-1'],
    8: ['4-2', 'Credits_4-2']
  };
  if (cgpaData) {
    for (const [semester, [sgpaKey, creditsKey]] of Object.entries(columns)) {
      const sgpa = cgpaData[sgpaKey] || '';
      const credits = cgpaData[creditsKey] || '';
      if (sgpa !== '' || credits !== '') summaries[semester] = { sgpa: sgpa || 'N/A', credits: credits || 'N/A' };
    }
  }
  if (honorsCredits !== null) summaries['9'] = { sgpa: 'N/A', credits: numberToText(honorsCredits) };
  return summaries;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberToText(value) {
  if (value === null || typeof value === 'undefined') return '';
  const number = Number(value);
  if (Number.isFinite(number) && Number.isInteger(number)) return `${number.toFixed(1)}`;
  return String(value);
}
