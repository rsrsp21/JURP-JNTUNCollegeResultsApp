import 'server-only';

import {
  getStudentResults,
  getToppersRagData,
  latestNotificationText
} from './results-data';
import { envValue } from './env';

const rollPattern = /(?<![A-Z0-9])\d{5}A[A-Z0-9]{4}(?![A-Z0-9])/gi;
const academicKeywords = new Set('result results semester sem sgpa cgpa grade grades credit credits backlog backlogs fail failed supply supplementary performance subject subjects download pdf toppers topper rank branch batch regulation improve best weak attention honors minor roll number marks academic history portal compare comparison vs versus notification notifications released feature features'.split(' '));
const greetings = new Set(['hi', 'hello', 'hey', 'help']);

export function extractAllRollNumbers(text = '') {
  return Array.from(new Set((text.match(rollPattern) || []).map((item) => item.toUpperCase())));
}

export function isRelevantAcademicMessage(message = '') {
  const words = new Set((message.toLowerCase().match(/[a-zA-Z]+/g) || []));
  const hasRoll = extractAllRollNumbers(message).length > 0;
  const hasKeyword = [...words].some((word) => academicKeywords.has(word));
  const shortGreeting = words.size <= 3 && [...words].some((word) => greetings.has(word));
  return hasRoll || hasKeyword || shortGreeting;
}

export function needsStudentResultContext(message = '') {
  const words = new Set((message.toLowerCase().match(/[a-zA-Z]+/g) || []));
  const studentWords = new Set('cgpa sgpa grade grades credit credits backlog backlogs fail failed supply performance subject subjects semester sem best weak attention improve honors minor compare comparison vs versus'.split(' '));
  const generalWords = new Set('toppers topper download pdf portal help how where notification notifications released feature features'.split(' '));
  const hasGeneral = [...words].some((word) => generalWords.has(word));
  const hasStudent = [...words].some((word) => studentWords.has(word));
  if (hasGeneral && !hasStudent) return false;
  return hasStudent;
}

export function isComparisonMessage(message = '') {
  return /\b(compare|comparison|vs|versus)\b/i.test(message);
}

export async function buildStudentContext(studentId, question) {
  const [result, currentNotification] = await Promise.all([
    getStudentResults(studentId),
    latestNotificationText()
  ]);
  if (!result.cgpaData && !Object.keys(result.semesterData || {}).length) return null;

  const semesterRecords = semesterRecordsForAi(result.semesterData || {});
  const { failedSubjects, lowGradeSubjects } = deriveSignals(semesterRecords);
  const cgpaData = result.cgpaData || {};

  const context = {
    retrievalBasis: 'Retrieved from Cloudflare D1 by exact roll number match',
    question,
    portal: { currentNotification },
    student: {
      rollNumber: studentId,
      batch: cgpaData.Batch || null,
      regulation: cgpaData.Regulation || null,
      cgpa: cgpaData.CGPA || null,
      totalCredits: cgpaData['Total Credits'] || null,
      supplementaryAppearances: cgpaData['Supplementary Appearances'] || null,
      academicSummary: cgpaData.academicSummary || null
    },
    semesterSgpaAndCredits: Object.fromEntries(
      Object.entries(cgpaData).filter(([key]) => !['ID', 'Batch', 'Regulation', 'Supplementary Appearances', 'academicSummary'].includes(key))
    ),
    retrievedSemesters: semesterRecords,
    derivedSignals: {
      failedSubjects,
      lowGradeSubjects,
      failedSubjectCount: failedSubjects.length,
      lowGradeSubjectCount: lowGradeSubjects.length
    }
  };

  if (mentionsToppers(question)) context.toppersData = await getToppersRagData();
  return context;
}

export async function buildMultiStudentContext(studentIds, question) {
  const [students, currentNotification] = await Promise.all([
    Promise.all(studentIds.map(async (studentId) => {
      const result = await getStudentResults(studentId);
      if (!result.cgpaData && !Object.keys(result.semesterData || {}).length) {
        return { rollNumber: studentId, error: 'No data found' };
      }
      const semesterRecords = semesterRecordsForAi(result.semesterData || {});
      const { failedSubjects, lowGradeSubjects } = deriveSignals(semesterRecords);
      const cgpaData = result.cgpaData || {};
      return {
        rollNumber: studentId,
        batch: cgpaData.Batch || null,
        regulation: cgpaData.Regulation || null,
        cgpa: cgpaData.CGPA || null,
        totalCredits: cgpaData['Total Credits'] || null,
        supplementaryAppearances: cgpaData['Supplementary Appearances'] || null,
        academicSummary: cgpaData.academicSummary || null,
        semesterSgpaAndCredits: Object.fromEntries(
          Object.entries(cgpaData).filter(([key]) => !['ID', 'Batch', 'Regulation', 'Supplementary Appearances', 'academicSummary'].includes(key))
        ),
        retrievedSemesters: semesterRecords,
        derivedSignals: {
          failedSubjects,
          lowGradeSubjects,
          failedSubjectCount: failedSubjects.length,
          lowGradeSubjectCount: lowGradeSubjects.length
        }
      };
    })),
    latestNotificationText()
  ]);

  const context = {
    retrievalBasis: `Comparison context for ${studentIds.length} students retrieved from Cloudflare D1`,
    question,
    portal: { currentNotification },
    students
  };
  if (mentionsToppers(question)) context.toppersData = await getToppersRagData();
  return context;
}

export async function buildGeneralContext(question) {
  const context = {
    retrievalBasis: 'General portal context; no student roll number was required or supplied',
    question,
    portal: {
      name: 'JNTUK UCEN Results Portal',
      availablePages: [
        { name: 'CGPA', path: '/cgpa', purpose: 'Check overall CGPA and credits by roll number' },
        { name: 'Semester-wise Results', path: '/semester_results', purpose: 'View semester grades, SGPA, credits, and download PDFs' },
        { name: 'Toppers', path: '/toppers', purpose: 'View branch-wise and overall toppers' }
      ],
      chatScope: 'Only answer questions about results, CGPA, SGPA, credits, backlogs, toppers, downloads, and portal navigation.',
      currentNotification: await latestNotificationText()
    }
  };
  if (mentionsToppers(question)) context.toppersData = await getToppersRagData();
  return context;
}

export function buildDirectComparisonAnswer(context) {
  const students = (context?.students || []).filter((student) => !student.error);
  if (students.length < 2) return '';

  const headers = ['Metric', ...students.map((student) => student.rollNumber)];
  const summaryRows = [
    ['CGPA', ...students.map((student) => valueOrNa(student.cgpa))],
    ['Percentage', ...students.map((student) => valueOrNa(student.academicSummary?.percentage))],
    ['Division', ...students.map((student) => valueOrNa(student.academicSummary?.division))],
    ['Total Credits', ...students.map((student) => valueOrNa(student.totalCredits))],
    ['Regulation', ...students.map((student) => valueOrNa(student.regulation))],
    ['Supplementary Count', ...students.map((student) => valueOrNa(student.academicSummary?.supplementaryCount))],
    ['Backlog Count', ...students.map((student) => valueOrNa(student.derivedSignals?.failedSubjectCount))],
    ['Low Grade Count (D/E)', ...students.map((student) => valueOrNa(student.derivedSignals?.lowGradeSubjectCount))]
  ];

  const semesterKeys = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'];
  const semesterRows = semesterKeys.map((semester) => [
    semester,
    ...students.map((student) => valueOrNa(student.semesterSgpaAndCredits?.[semester]))
  ]);

  const notableRows = students.flatMap((student) => {
    const failed = student.derivedSignals?.failedSubjects || [];
    const lowGrades = student.derivedSignals?.lowGradeSubjects || [];
    return [...failed, ...lowGrades].map((subject) => [
      student.rollNumber,
      subject.semester,
      subject.subjectCode,
      subject.subjectName,
      subject.grade,
      subject.credits
    ]);
  });

  const cgpaValues = students
    .map((student) => ({ rollNumber: student.rollNumber, cgpa: Number(student.cgpa) }))
    .filter((student) => Number.isFinite(student.cgpa))
    .sort((a, b) => b.cgpa - a.cgpa);
  const leader = cgpaValues[0];
  const conclusion = leader
    ? `${leader.rollNumber} leads on CGPA among the compared students.`
    : 'The available records were compared from the retrieved D1 result data.';

  return [
    '## Overall academic summary',
    markdownTable(headers, summaryRows),
    '## Semester-wise SGPA comparison',
    markdownTable(['Semester', ...students.map((student) => `${student.rollNumber} SGPA`)], semesterRows),
    notableRows.length
      ? [
          '## Notable low-grade or backlog subjects',
          markdownTable(['Roll Number', 'Semester', 'Subject Code', 'Subject Name', 'Grade', 'Credits'], notableRows)
        ].join('\n\n')
      : '## Notable low-grade or backlog subjects\n\nNo low-grade or backlog subjects were found in the retrieved records.',
    `## Summary\n\n${conclusion}`
  ].join('\n\n');
}

export async function callGemini(question, context, history = [], maxTokens = 2000) {
  const apiKey = envValue('GEMINI_API_KEY');
  if (!apiKey) return { error: 'GEMINI_API_KEY is not configured' };

  const model = getGeminiModel();
  const systemInstruction = `
You are "Results AI" for JNTUK UCEN.
Only answer questions about academic results, grades, CGPA, SGPA, credits, backlogs, toppers, downloads, portal navigation, and academic performance.
Use the retrieved context as the source of truth. Do not invent roll numbers, grades, notifications, or rankings.
When presenting semester rows, subjects, or comparisons, use clear Markdown tables.
Return valid GitHub Flavored Markdown.
Use headings like "## Overall academic summary" for sections.
Put a blank line before and after every table.
Every table row must be on its own line, and every row in a table must have the same number of columns.
Do not wrap tables in code fences.
For comparisons, keep the answer in this order: overall summary table, semester SGPA table, notable low-grade/backlog table if available, short conclusion.
For off-topic questions, reply exactly: "I only answer questions regarding academic results, grades, backlogs, and toppers."
If data is missing, state that briefly.

Retrieved context:
${JSON.stringify(context)}
`.trim();

  const contents = [
    ...history.slice(-16).map((turn) => ({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(turn.text || '') }]
    })),
    { role: 'user', parts: [{ text: question }] }
  ];

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.1, topP: 0.95, maxOutputTokens: maxTokens }
    }),
    cache: 'no-store'
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: data.error?.message || `Gemini API request failed: HTTP ${response.status}` };
  }
  const answer = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n').trim();
  return answer ? { answer, model } : { error: 'Gemini returned an empty response' };
}

export function getGeminiModel() {
  const configured = envValue('GEMINI_MODEL') || 'gemini-2.5-flash';
  return configured === 'gemini-3-flash' ? 'gemini-2.5-flash' : configured;
}

function semesterRecordsForAi(semesterData) {
  const result = {};
  for (const [semester, rows] of Object.entries(semesterData)) {
    result[semester] = {
      label: semester === '9' ? 'Honors/Minor' : `${Math.ceil(Number(semester) / 2)}-${Number(semester) % 2 === 0 ? 2 : 1}`,
      subjects: rows.map((row) => ({
        subjectCode: row['Subject Code'] || '',
        subjectName: row['Subject Name'] || '',
        grade: row.Grade || '',
        credits: row.Credits || ''
      }))
    };
  }
  return result;
}

function deriveSignals(semesterRecords) {
  const failedSubjects = [];
  const lowGradeSubjects = [];
  for (const semester of Object.values(semesterRecords)) {
    for (const subject of semester.subjects) {
      const grade = String(subject.grade || '').toUpperCase();
      const record = { semester: semester.label, ...subject };
      if (['F', 'ABSENT', 'AB'].includes(grade)) failedSubjects.push(record);
      else if (['D', 'E'].includes(grade)) lowGradeSubjects.push(record);
    }
  }
  return { failedSubjects, lowGradeSubjects };
}

function mentionsToppers(text = '') {
  const lower = text.toLowerCase();
  return lower.includes('topper') || lower.includes('rank') || lower.includes('best');
}

function valueOrNa(value) {
  if (value === null || typeof value === 'undefined' || value === '') return 'N/A';
  return String(value);
}

function markdownTable(headers, rows) {
  const escapedHeaders = headers.map(markdownCell);
  const body = rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`);
  return [
    `| ${escapedHeaders.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...body
  ].join('\n');
}

function markdownCell(value) {
  return valueOrNa(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
