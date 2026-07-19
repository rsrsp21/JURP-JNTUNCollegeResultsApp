import { NextResponse } from 'next/server';
import { envValue } from '@/lib/env';
import { getGeminiModel } from '@/lib/ai';
import { setStudentName, setStudentNameEdit, getStudentCgpa } from '@/lib/results-data';
import { isR2Configured, r2PutObject } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ROLL_PATTERN = /^[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}$/;
const NAME_PATTERN = /^[A-Z][A-Z .]{1,58}[A-Z.]$/;

const idExtractionPrompt = `
You are a strict ID-card verification system for the JNTUK UCEN student results portal.

The student must upload a photo of their college ID card. TWO formats are accepted:
1. A tightly cropped strip showing only the Name, Branch, and Roll No text fields.
2. The ID card showing the college name header, the student's photo, Name, Branch, and Roll No — as long as any mobile/phone number is cropped out or not visible.

STRICT REJECTION RULES — reject the image if ANY of these are true:
1. A mobile/phone number is visible anywhere in the image (students must crop it out for privacy).
2. Other private contact fields are visible, such as home address or parent phone number.
3. The image is not a college ID card at all (screenshot, document, selfie, random photo, handwritten note).
4. The "Name" or "Roll No" fields are unreadable or missing.
5. The text appears digitally edited, overlaid, or tampered with.

Respond with ONLY a JSON object, no markdown fences:
{
  "accepted": true or false,
  "rejection_reason": "short human-readable reason when rejected, else empty string",
  "name": "the student's name exactly as printed, uppercase, empty if rejected",
  "roll_number": "the roll number exactly as printed, uppercase, empty if rejected",
  "branch": "the branch exactly as printed, empty if rejected"
}
`.trim();

const gradeCardExtractionPrompt = `
You are a strict grade-card verification system for the JNTUK UCEN student results portal.

The student must upload a photo of their official JNTUK GRADE CARD (memo). A genuine JNTUK grade card has ALL of these characteristics:
1. Header: "JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY KAKINADA" with "KAKINADA - 533 003, ANDHRA PRADESH, INDIA" below it, and the university's circular logo/emblem in the top-left area.
2. A prominent "GRADE CARD" title banner near the top.
3. A "Memo. No." field (printed like R607552) and a "Serial No." field (a long numeric string).
4. Fields on the left: "Examination" (e.g. "B.Tech II Year I Semester (R20) Reg."), "Branch", "Name", and "Aadhar No.".
5. Fields on the right: "Hall Ticket No." (e.g. 22031A0506), "Month & Year of Exams" (e.g. DECEMBER 2023), and "Institution" (e.g. UNIVERSITY COLLEGE OF ENGINEERING, NARASARAOPETA).
6. A small student photo in the top-right corner, usually with a signature under it.
7. A course table with columns: S.No, Course Code (like R2021011), Course Title, Grade Secured, Grade Points (Gi), Status, Credits Obtained (Ci).
8. A summary row: "Courses Registered", "Appeared", "Passed", "Total" credits.
9. "Semester Grade Point Average (SGPA)" with a value.
10. A circular embossed hologram/stamp in the lower-left region.
11. "CONTROLLER OF EXAMINATIONS" with a handwritten signature above it, in the lower-right.
12. "Date of Issue", "Verified by", and the legend line "MP : Mal Practice   WH : With Held   P : Pass   F : Fail   AB : Absent".
13. A security watermark background of repeated university text and a pink/red decorative border.

STRICT REJECTION RULES — reject the image if ANY of these are true:
1. The document is NOT a physical JNTUK grade card matching the layout above (e.g. a website screenshot, a marks memo from another university, a college ID card, a random document or photo).
2. The "Name" or "Hall Ticket No." fields are unreadable or missing.
3. The "GRADE CARD" banner, university header, Memo No., course table, SGPA, hologram/stamp region, or Controller of Examinations signature area cannot be seen (a heavily cropped image hiding these must be rejected).
4. The text appears digitally edited, overlaid, or tampered with.

The Aadhar number, if visible, must NOT be extracted or repeated anywhere in your output.

Respond with ONLY a JSON object, no markdown fences:
{
  "accepted": true or false,
  "rejection_reason": "short human-readable reason when rejected, else empty string",
  "name": "the student's name exactly as printed on the Name field, uppercase, empty if rejected",
  "hall_ticket_no": "the Hall Ticket No. exactly as printed, uppercase, empty if rejected",
  "branch": "the branch exactly as printed, empty if rejected",
  "memo_no": "the Memo. No. exactly as printed, empty if rejected"
}
`.trim();

function validateImage(image, label) {
  if (!image || typeof image !== 'object') return `${label} image is missing.`;
  const mimeType = String(image.mimeType || '').toLowerCase();
  const data = String(image.imageBase64 || '');
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return `${label}: upload a JPG, PNG, or WEBP image.`;
  if (!data || data.length * 0.75 > MAX_IMAGE_BYTES) return `${label} image is missing or larger than 4 MB.`;
  return null;
}

async function extractWithGemini(apiKey, prompt, image) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: String(image.mimeType).toLowerCase(), data: String(image.imageBase64) } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      }),
      cache: 'no-store'
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error?.message || 'Verification service failed. Try again later.'), { status: 502 });
  }

  const rawText = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
  try {
    return JSON.parse(rawText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  } catch {
    console.error('verify-id: unparseable Gemini response:', rawText.slice(0, 500));
    throw Object.assign(new Error('Could not verify the image. Try a clearer photo.'), { status: 422 });
  }
}

function nameTokens(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// "B M SIVA SANJAY" is compatible with "BHIMANENI MOHAN SIVA SANJAY":
// every token of the shorter name must match a distinct token of the longer
// one — either exactly, or as an initial (1–2 letters) of that token — and at
// least one full token must match exactly.
function namesCompatible(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Array(longer.length).fill(false);
  let exactMatches = 0;

  for (const token of shorter) {
    let index = longer.findIndex((candidate, i) => !used[i] && candidate === token);
    if (index === -1 && token.length <= 2) {
      index = longer.findIndex((candidate, i) => !used[i] && candidate.startsWith(token));
    }
    if (index === -1 && token.length > 2) {
      index = longer.findIndex((candidate, i) => !used[i] && candidate.length <= 2 && token.startsWith(candidate));
    }
    if (index === -1) return false;
    used[index] = true;
    if (longer[index] === token) exactMatches += 1;
  }

  return exactMatches >= 1;
}

async function archiveImage(prefix, studentId, image) {
  if (!isR2Configured()) return null;
  const mimeType = String(image.mimeType).toLowerCase();
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  try {
    return await r2PutObject(
      `${prefix}/${studentId}.${extension}`,
      Buffer.from(String(image.imageBase64), 'base64'),
      mimeType
    );
  } catch (error) {
    console.error(`Failed to archive image to R2 (${prefix}):`, error);
    return null;
  }
}

async function verifyGradeCard(apiKey, studentId, gradeCardImage) {
  const verdict = await extractWithGemini(apiKey, gradeCardExtractionPrompt, gradeCardImage);
  if (!verdict.accepted) {
    throw Object.assign(
      new Error(
        verdict.rejection_reason ||
          'Grade card rejected. Upload a clear photo of your JNTUK grade card with the Name and Hall Ticket No. readable.'
      ),
      { status: 422 }
    );
  }

  const hallTicket = String(verdict.hall_ticket_no || '').replace(/\s+/g, '').toUpperCase();
  const gradeCardName = String(verdict.name || '').replace(/\s+/g, ' ').trim().toUpperCase();

  if (!ROLL_PATTERN.test(hallTicket)) {
    throw Object.assign(new Error('Could not read a valid Hall Ticket No. from the grade card.'), { status: 422 });
  }
  if (hallTicket !== studentId) {
    throw Object.assign(
      new Error(`The Hall Ticket No. on the grade card (${hallTicket}) does not match the searched roll number (${studentId}).`),
      { status: 422 }
    );
  }
  if (!NAME_PATTERN.test(gradeCardName)) {
    throw Object.assign(new Error('Could not read a valid name from the grade card.'), { status: 422 });
  }

  return { gradeCardName, hallTicket };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const studentId = String(body.studentId || '').trim().toUpperCase();
  const mode = body.mode === 'edit' ? 'edit' : 'new';

  if (!ROLL_PATTERN.test(studentId)) {
    return NextResponse.json({ error: 'Enter a valid roll number before uploading.' }, { status: 400 });
  }

  // Backwards-compatible shape: {mimeType, imageBase64} at the top level is the ID image.
  const idImage = body.idImage || (body.imageBase64 ? { mimeType: body.mimeType, imageBase64: body.imageBase64 } : null);
  const gradeCardImage = body.gradeCardImage || null;

  if (mode === 'new') {
    const idError = validateImage(idImage, 'ID card');
    if (idError) return NextResponse.json({ error: idError }, { status: 400 });
    if (gradeCardImage) {
      const gcError = validateImage(gradeCardImage, 'Grade card');
      if (gcError) return NextResponse.json({ error: gcError }, { status: 400 });
    }
  } else {
    const gcError = validateImage(gradeCardImage, 'Grade card');
    if (gcError) return NextResponse.json({ error: gcError }, { status: 400 });
  }

  const apiKey = envValue('GEMINI_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'Verification is not configured on the server.' }, { status: 503 });
  }

  try {
    if (mode === 'edit') {
      // One-time name correction: grade card only, checked against the existing name.
      const existing = await getStudentCgpa(studentId);
      if (!existing) {
        return NextResponse.json({ error: 'No student record found for this roll number.' }, { status: 404 });
      }
      const currentName = String(existing.Name || '').trim();
      if (!currentName) {
        return NextResponse.json({ error: 'You have no verified name yet. Use the ID card upload to add your name first.' }, { status: 400 });
      }
      if (existing.NameEditUsed) {
        return NextResponse.json({ error: 'You have already used your one-time name edit. Contact an administrator for further changes.' }, { status: 403 });
      }

      const { gradeCardName } = await verifyGradeCard(apiKey, studentId, gradeCardImage);

      if (gradeCardName === currentName) {
        return NextResponse.json({ error: 'The grade card shows the same name that is already on your profile — nothing to change.' }, { status: 422 });
      }
      if (!namesCompatible(currentName, gradeCardName)) {
        return NextResponse.json(
          { error: `The name on the grade card (${gradeCardName}) does not match your current profile name (${currentName}). Initials and name parts must correspond.` },
          { status: 422 }
        );
      }

      const result = await setStudentNameEdit(studentId, gradeCardName);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 422 });

      const archivedKey = await archiveImage('gradecardImages', studentId, gradeCardImage);
      return NextResponse.json({ name: gradeCardName, rollNumber: studentId, mode: 'edit', archivedKey });
    }

    // --- New-user flow: ID card mandatory, grade card optional ---
    const idVerdict = await extractWithGemini(apiKey, idExtractionPrompt, idImage);
    if (!idVerdict.accepted) {
      return NextResponse.json(
        {
          error:
            idVerdict.rejection_reason ||
            'Image rejected. Upload your ID card with the mobile number cropped out — Name, Branch, and Roll No must be clearly readable.'
        },
        { status: 422 }
      );
    }

    const extractedRoll = String(idVerdict.roll_number || '').replace(/\s+/g, '').toUpperCase();
    const idName = String(idVerdict.name || '').replace(/\s+/g, ' ').trim().toUpperCase();

    if (!ROLL_PATTERN.test(extractedRoll)) {
      return NextResponse.json({ error: 'Could not read a valid roll number from the ID image.' }, { status: 422 });
    }
    if (extractedRoll !== studentId) {
      return NextResponse.json(
        { error: `The roll number on the ID (${extractedRoll}) does not match the searched roll number (${studentId}).` },
        { status: 422 }
      );
    }
    if (!NAME_PATTERN.test(idName)) {
      return NextResponse.json({ error: 'Could not read a valid name from the ID image.' }, { status: 422 });
    }

    let gradeCardName = null;
    if (gradeCardImage) {
      const gcResult = await verifyGradeCard(apiKey, studentId, gradeCardImage);
      gradeCardName = gcResult.gradeCardName;
      if (!namesCompatible(idName, gradeCardName)) {
        return NextResponse.json(
          { error: `The name on the ID card (${idName}) and the name on the grade card (${gradeCardName}) do not match. Initials and name parts must correspond.` },
          { status: 422 }
        );
      }
    }

    // Grade card carries the fuller official name, so it wins when provided.
    const result = await setStudentName(studentId, idName, gradeCardName);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const archivedKey = await archiveImage('idsImages', studentId, idImage);
    let gradeCardKey = null;
    if (gradeCardImage) {
      gradeCardKey = await archiveImage('gradecardImages', studentId, gradeCardImage);
    }

    return NextResponse.json({
      name: gradeCardName || idName,
      rollNumber: extractedRoll,
      branch: String(idVerdict.branch || ''),
      mode: 'new',
      archivedKey,
      gradeCardKey
    });
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error('verify-id failed:', error);
    return NextResponse.json({ error: error.message || 'Verification failed. Try again.' }, { status });
  }
}
