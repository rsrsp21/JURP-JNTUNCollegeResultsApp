import { NextResponse } from 'next/server';
import { envValue } from '@/lib/env';
import { getGeminiModel } from '@/lib/ai';
import { setStudentName } from '@/lib/results-data';
import { isR2Configured, r2PutObject } from '@/lib/r2';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ROLL_PATTERN = /^[0-9]{2}[0-9A-Z]{3}A[0-9A-Z]{4}$/;
const NAME_PATTERN = /^[A-Z][A-Z .]{1,58}[A-Z.]$/;

const extractionPrompt = `
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

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const studentId = String(body.studentId || '').trim().toUpperCase();
  const mimeType = String(body.mimeType || '').toLowerCase();
  const imageBase64 = String(body.imageBase64 || '');

  if (!ROLL_PATTERN.test(studentId)) {
    return NextResponse.json({ error: 'Enter a valid roll number before uploading your ID.' }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Upload a JPG, PNG, or WEBP image.' }, { status: 400 });
  }
  if (!imageBase64 || imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image is missing or larger than 4 MB.' }, { status: 400 });
  }

  const apiKey = envValue('GEMINI_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'ID verification is not configured on the server.' }, { status: 503 });
  }

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
              { text: extractionPrompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } }
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
    return NextResponse.json(
      { error: data.error?.message || 'ID verification service failed. Try again later.' },
      { status: 502 }
    );
  }

  const rawText = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
  let verdict;
  try {
    verdict = JSON.parse(rawText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  } catch {
    console.error('verify-id: unparseable Gemini response:', rawText.slice(0, 500));
    return NextResponse.json({ error: 'Could not verify the image. Try a clearer photo.' }, { status: 422 });
  }

  if (!verdict.accepted) {
    return NextResponse.json(
      {
        error:
          verdict.rejection_reason ||
          'Image rejected. Upload your ID card with the mobile number cropped out — Name, Branch, and Roll No must be clearly readable.'
      },
      { status: 422 }
    );
  }

  const extractedRoll = String(verdict.roll_number || '').replace(/\s+/g, '').toUpperCase();
  const extractedName = String(verdict.name || '').replace(/\s+/g, ' ').trim().toUpperCase();

  if (!ROLL_PATTERN.test(extractedRoll)) {
    return NextResponse.json({ error: 'Could not read a valid roll number from the image.' }, { status: 422 });
  }
  if (extractedRoll !== studentId) {
    return NextResponse.json(
      { error: `The roll number on the ID (${extractedRoll}) does not match the searched roll number (${studentId}).` },
      { status: 422 }
    );
  }
  if (!NAME_PATTERN.test(extractedName)) {
    return NextResponse.json({ error: 'Could not read a valid name from the image.' }, { status: 422 });
  }

  const result = await setStudentName(studentId, extractedName);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Archive the verified crop in R2 so admins can audit/reject it later.
  let archivedKey = null;
  if (isR2Configured()) {
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    try {
      archivedKey = await r2PutObject(
        `idsImages/${studentId}.${extension}`,
        Buffer.from(imageBase64, 'base64'),
        mimeType
      );
    } catch (error) {
      console.error('Failed to archive ID image to R2:', error);
    }
  }

  return NextResponse.json({
    name: extractedName,
    rollNumber: extractedRoll,
    branch: String(verdict.branch || ''),
    archivedKey
  });
}
