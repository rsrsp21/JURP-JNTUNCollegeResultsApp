export async function downloadCgpaPdf(student) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF();
  const summary = student.academicSummary || {};

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('JNTUK UCEN', 105, 18, { align: 'center' });
  doc.setFontSize(14);
  doc.text('Student Academic Record', 105, 28, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`Roll Number: ${student.ID || 'N/A'}`, 18, 48);
  doc.text(`Batch: ${student.Batch || 'N/A'}`, 18, 58);
  doc.text(`Regulation: ${student.Regulation || 'N/A'}`, 18, 68);
  doc.text(`CGPA: ${student.CGPA || 'N/A'}`, 118, 48);
  doc.text(`Percentage: ${summary.percentage || 'N/A'}`, 118, 58);
  doc.text(`Division: ${summary.division || 'N/A'}`, 118, 68);
  doc.text(`Total Credits: ${student['Total Credits'] || 'N/A'}`, 118, 78);

  const rows = semesterRows(student).map((item) => [item.label, item.sgpa, item.credits]);
  doc.autoTable({
    startY: 94,
    head: [['Semester', 'SGPA', 'Credits']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [8, 127, 112] }
  });

  footer(doc);
  doc.save(`${student.ID || 'student'}_cgpa.pdf`);
}

export async function downloadSemesterPdf({ studentId, cgpaData, semester, summary, rows }) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF();
  const semesterLabel = semester === '9' ? 'Honors/Minor' : `${Math.ceil(Number(semester) / 2)}-${Number(semester) % 2 === 0 ? 2 : 1}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('JNTUK UCEN', 105, 18, { align: 'center' });
  doc.setFontSize(14);
  doc.text('Semester Results', 105, 28, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`Roll Number: ${studentId}`, 18, 48);
  doc.text(`Batch: ${cgpaData?.Batch || 'N/A'}`, 18, 58);
  doc.text(`Regulation: ${cgpaData?.Regulation || 'N/A'}`, 18, 68);
  doc.text(`Semester: ${semesterLabel}`, 118, 48);
  doc.text(`SGPA: ${summary?.sgpa || 'N/A'}`, 118, 58);
  doc.text(`Credits: ${summary?.credits || 'N/A'}`, 118, 68);

  doc.autoTable({
    startY: 86,
    head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
    body: rows.map((row) => [row['Subject Code'], row['Subject Name'], row.Grade, row.Credits]),
    theme: 'grid',
    headStyles: { fillColor: [8, 127, 112] },
    columnStyles: { 1: { cellWidth: 92 } }
  });

  footer(doc);
  doc.save(`${studentId}_semester_${semesterLabel}.pdf`);
}

export async function downloadAllSemestersPdf({ studentId, cgpaData, semesterData, semesterSummaries, includeHonors = false }) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('JNTUK UCEN', 105, 18, { align: 'center' });
  doc.setFontSize(14);
  doc.text('Complete Academic Record', 105, 28, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Roll Number: ${studentId}`, 18, 48);
  doc.text(`Batch: ${cgpaData?.Batch || 'N/A'}`, 18, 58);
  doc.text(`Regulation: ${cgpaData?.Regulation || 'N/A'}`, 18, 68);
  doc.text(`CGPA: ${cgpaData?.CGPA || 'N/A'}`, 118, 48);
  doc.text(`Total Credits: ${cgpaData?.['Total Credits'] || 'N/A'}`, 118, 58);

  let y = 86;
  const keys = Object.keys(semesterData || {}).filter((key) => includeHonors || key !== '9').sort((a, b) => Number(a) - Number(b));
  for (const key of keys) {
    if (y > 245) {
      doc.addPage();
      y = 18;
    }
    const label = key === '9' ? 'Honors/Minor' : `${Math.ceil(Number(key) / 2)}-${Number(key) % 2 === 0 ? 2 : 1}`;
    const summary = semesterSummaries?.[key] || {};
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}   SGPA: ${summary.sgpa || 'N/A'}   Credits: ${summary.credits || 'N/A'}`, 18, y);
    doc.autoTable({
      startY: y + 6,
      head: [['Subject Code', 'Subject Name', 'Grade', 'Credits']],
      body: (semesterData[key] || []).map((row) => [row['Subject Code'], row['Subject Name'], row.Grade, row.Credits]),
      theme: 'grid',
      headStyles: { fillColor: [8, 127, 112], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { cellWidth: 92 } }
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  footer(doc);
  doc.save(`${studentId}_all_semesters${includeHonors ? '_with_honors' : ''}.pdf`);
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

function footer(doc) {
  const date = new Date().toLocaleDateString('en-GB');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('This is a computer-generated document.', 105, doc.internal.pageSize.height - 10, { align: 'center' });
  doc.text(`Generated on: ${date}`, 105, doc.internal.pageSize.height - 5, { align: 'center' });
}
