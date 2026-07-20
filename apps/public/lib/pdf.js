import { batchDisplay, branchFromRoll } from './client-utils';

const tableHeadColor = [0, 102, 204];
const alternateRowColor = [240, 240, 240];

export async function downloadCgpaPdf(student) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF();
  const summary = student.academicSummary || {};
  const hasName = Boolean(student.Name && String(student.Name).trim());

  addHeader(doc, 'Student Academic Record');
  await addLogo(doc);

  doc.setFontSize(12);
  doc.text('Student Information', 20, 50);
  doc.setFont('helvetica', 'bold');
  let y = 60;
  if (hasName) {
    doc.text('Name:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value(student.Name), 60, y);
    doc.setFont('helvetica', 'bold');
    y += 10;
  }
  doc.text('Roll Number:', 20, y);
  doc.text('Branch:', 20, y + 10);
  doc.text('Batch:', 20, y + 20);
  doc.text('Regulation:', 20, y + 30);

  doc.setFont('helvetica', 'normal');
  doc.text(value(student.ID, 'Unknown'), 60, y);
  doc.text(branchFromRoll(student.ID), 60, y + 10);
  doc.text(batchDisplay(student.Batch), 60, y + 20);
  doc.text(value(student.Regulation), 60, y + 30);

  doc.setFont('helvetica', 'bold');
  doc.text('Academic Performance', 20, y + 50);
  doc.text('CGPA:', 20, y + 60);
  doc.text('Percentage:', 20, y + 70);
  doc.text('Division:', 20, y + 80);
  doc.text('Total Credits:', 20, y + 90);

  doc.setFont('helvetica', 'normal');
  doc.text(value(student.CGPA), 60, y + 60);
  doc.text(value(summary.percentage), 60, y + 70);
  doc.text(value(summary.division), 60, y + 80);
  doc.text(value(student['Total Credits']), 60, y + 90);

  doc.setFont('helvetica', 'bold');
  doc.text('Semester-wise Performance', 20, y + 110);

  doc.autoTable({
    startY: y + 120,
    head: [['Semester', 'SGPA', 'Credits']],
    body: semesterRows(student).map((item) => [item.label, value(item.sgpa), value(item.credits)]),
    theme: 'grid',
    headStyles: {
      fillColor: tableHeadColor,
      textColor: [255, 255, 255],
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 11,
      halign: 'center'
    },
    alternateRowStyles: { fillColor: alternateRowColor },
    margin: { top: 20 }
  });

  footer(doc);
  doc.save(`Student_Result_${student.ID || 'Unknown'}.pdf`);
}

export async function downloadSemesterPdf({ studentId, cgpaData, semester, summary, rows }) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF();
  const semesterLabel = semesterLabelFor(semester);
  const hasName = Boolean(cgpaData?.Name && String(cgpaData.Name).trim());

  await addLogo(doc);
  addHeader(doc, 'Semester Results');

  doc.setFontSize(12);
  doc.text('Student Information', 20, 50);
  doc.setFont('helvetica', 'bold');
  let y = 60;
  if (hasName) {
    doc.text('Name:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value(cgpaData.Name), 80, y);
    doc.setFont('helvetica', 'bold');
    y += 10;
  }
  doc.text('Roll Number:', 20, y);
  doc.text('Branch:', 20, y + 10);
  doc.text('Batch:', 20, y + 20);
  doc.text('Regulation:', 20, y + 30);
  doc.text('Year & Semester:', 20, y + 40);

  doc.setFont('helvetica', 'normal');
  doc.text(value(studentId), 80, y);
  doc.text(branchFromRoll(studentId), 80, y + 10);
  doc.text(batchDisplay(cgpaData?.Batch), 80, y + 20);
  doc.text(value(cgpaData?.Regulation), 80, y + 30);
  doc.text(semesterLabel, 80, y + 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Academic Performance', 20, y + 60);
  doc.text('SGPA:', 20, y + 70);
  doc.text('Credits:', 20, y + 80);
  doc.setFont('helvetica', 'normal');
  doc.text(value(summary?.sgpa), 80, y + 70);
  doc.text(value(summary?.credits), 80, y + 80);

  doc.setFont('helvetica', 'bold');
  doc.text('Subject-wise Results', 20, y + 100);

  doc.autoTable({
    startY: y + 110,
    head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
    body: (rows || []).map(subjectRow),
    theme: 'grid',
    headStyles: {
      fillColor: tableHeadColor,
      textColor: [255, 255, 255],
      halign: 'center',
      fontSize: 10
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 100 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 }
    },
    alternateRowStyles: { fillColor: alternateRowColor },
    margin: { top: 10 }
  });

  footer(doc);
  doc.save(`${studentId}_semester_${semesterLabel}.pdf`);
}

export async function downloadAllSemestersPdf({ studentId, cgpaData, semesterData, semesterSummaries, includeHonors = false }) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF({ margin: { top: 20, bottom: 20 } });
  const hasName = Boolean(cgpaData?.Name && String(cgpaData.Name).trim());

  await addLogo(doc);
  addHeader(doc, 'Complete Academic Record');

  doc.setFontSize(12);
  doc.text('Student Information', 20, 50);
  doc.setFont('helvetica', 'bold');
  let y = 60;
  if (hasName) {
    doc.text('Name:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value(cgpaData.Name), 80, y);
    doc.setFont('helvetica', 'bold');
    y += 10;
  }
  doc.text('Roll Number:', 20, y);
  doc.text('Branch:', 20, y + 10);
  doc.text('Batch:', 20, y + 20);
  doc.text('Regulation:', 20, y + 30);
  doc.text('CGPA:', 20, y + 40);
  doc.text('Total Credits Earned*:', 20, y + 50);

  doc.setFont('helvetica', 'normal');
  doc.text(value(studentId), 80, y);
  doc.text(branchFromRoll(studentId), 80, y + 10);
  doc.text(batchDisplay(cgpaData?.Batch), 80, y + 20);
  doc.text(value(cgpaData?.Regulation), 80, y + 30);
  doc.text(value(cgpaData?.CGPA), 80, y + 40);
  doc.text(value(cgpaData?.['Total Credits']), 80, y + 50);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.text('* Honors/Minor credits excluded', 20, y + 60);

  let currentY = y + 70;
  for (let year = 1; year <= 4; year += 1) {
    if (currentY > doc.internal.pageSize.height - 100) {
      doc.addPage();
      currentY = 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Year ${year}`, 10, currentY);
    currentY += 10;

    for (let semesterIndex = 0; semesterIndex < 2; semesterIndex += 1) {
      const semester = (year - 1) * 2 + semesterIndex + 1;
      if (!hasRows(semesterData, semester)) continue;

      const labelX = semesterIndex === 0 ? 10 : 110;
      const summary = semesterSummaries?.[String(semester)] || {};

      doc.setFontSize(12);
      doc.text(`Semester ${semesterLabelFor(semester)}`, labelX, currentY);
      doc.setFontSize(10);
      doc.text(`SGPA: ${value(summary.sgpa)}    Credits: ${value(summary.credits)}`, labelX, currentY + 10);
    }

    currentY += 20;
    const tableY = currentY;
    let leftTableY = tableY;
    let rightTableY = tableY;

    for (let semesterIndex = 0; semesterIndex < 2; semesterIndex += 1) {
      const semester = (year - 1) * 2 + semesterIndex + 1;
      if (!hasRows(semesterData, semester)) continue;

      const baseX = semesterIndex === 0 ? 10 : 110;
      doc.autoTable({
        startY: tableY,
        margin: { top: tableY, left: baseX },
        head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
        body: semesterData[String(semester)].map(subjectRow),
        theme: 'grid',
        headStyles: {
          fillColor: tableHeadColor,
          textColor: [255, 255, 255],
          halign: 'center',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 8,
          halign: 'center',
          cellPadding: 1
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 45, halign: 'left', textWrap: 'wrap' },
          2: { cellWidth: 14 },
          3: { cellWidth: 15 }
        },
        alternateRowStyles: { fillColor: alternateRowColor },
        tableWidth: 'wrap'
      });

      if (semesterIndex === 0) {
        leftTableY = doc.lastAutoTable.finalY;
      } else {
        rightTableY = doc.lastAutoTable.finalY;
      }
    }

    currentY = Math.max(leftTableY, rightTableY) + 10;
  }

  if (includeHonors && hasRows(semesterData, 9)) {
    currentY = addHonorsMinorSection(doc, semesterData, semesterSummaries, currentY);
  }

  footer(doc);
  doc.save(`${studentId}_all_semesters${includeHonors ? '_with_honors' : ''}.pdf`);
}

function addHeader(doc, subtitle) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('JNTUK UCEN', 105, 20, { align: 'center' });
  doc.setFontSize(16);
  doc.text(subtitle, 105, 30, { align: 'center' });
}

async function addLogo(doc) {
  const imageData = await imageToDataUrl('/images/university_logo.png');
  if (imageData) {
    doc.addImage(imageData, 'PNG', 15, 10, 30, 30);
  }
}

async function imageToDataUrl(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addHonorsMinorSection(doc, semesterData, semesterSummaries, currentY) {
  const rows = semesterData['9'] || [];
  const tableData = rows.map(subjectRow);
  const tableHeight = estimateTableHeight(tableData.length);
  const footerBuffer = 30;
  const remainingHeight = doc.internal.pageSize.height - currentY - footerBuffer;

  if (tableHeight + 40 > remainingHeight) {
    doc.addPage();
    currentY = 20;
  }

  const summary = semesterSummaries?.['9'] || {};
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Honors/Minor', 10, currentY);
  currentY += 15;

  doc.setFontSize(10);
  doc.text(`SGPA: ${value(summary.sgpa)}    Credits: ${value(summary.credits)}`, 10, currentY);
  currentY += 10;

  doc.autoTable({
    startY: currentY,
    margin: { left: 10 },
    head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: tableHeadColor,
      textColor: [255, 255, 255],
      halign: 'center',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      cellPadding: 1
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 45, halign: 'left', textWrap: 'wrap' },
      2: { cellWidth: 14 },
      3: { cellWidth: 15 }
    },
    alternateRowStyles: { fillColor: alternateRowColor },
    tableWidth: 'wrap'
  });

  return doc.lastAutoTable.finalY + 10;
}

function estimateTableHeight(rowCount) {
  const headHeight = 8;
  const bodyRowHeight = 7;
  return headHeight + rowCount * bodyRowHeight;
}

function semesterRows(student) {
  return [
    ['1-1', 'Credits_1-1'],
    ['1-2', 'Credits_1-2'],
    ['2-1', 'Credits_2-1'],
    ['2-2', 'Credits_2-2'],
    ['3-1', 'Credits_3-1'],
    ['3-2', 'Credits_3-2'],
    ['4-1', 'Credits_4-1'],
    ['4-2', 'Credits_4-2']
  ]
    .map(([key, creditsKey]) => ({ label: key, sgpa: student[key], credits: student[creditsKey] }))
    .filter((row) => row.sgpa || row.credits);
}

function semesterLabelFor(semester) {
  const number = Number(semester);
  return number === 9 ? 'Honors/Minor' : `${Math.ceil(number / 2)}-${number % 2 === 0 ? 2 : 1}`;
}

function subjectRow(row) {
  return [
    value(row['Subject Code'], ''),
    value(row['Subject Name'], ''),
    value(row.Grade, ''),
    value(row.Credits, '')
  ];
}

function hasRows(semesterData, semester) {
  const rows = semesterData?.[String(semester)];
  return Array.isArray(rows) && rows.length > 0;
}

function value(input, fallback = 'N/A') {
  if (input === null || typeof input === 'undefined' || input === '') return fallback;
  return String(input).trim();
}

function footer(doc) {
  const date = new Date().toLocaleDateString('en-GB');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
  doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });
}
