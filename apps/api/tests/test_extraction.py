import io

import pytest
from docx import Document as DocxDocument

from app.demo_fixtures import MOTOR_2024
from app.extraction import chunk_sections, extract

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def make_pdf(pages: list[list[str]]) -> bytes:
    """A minimal valid PDF with one text line per list item, so tests need no PDF-writing library."""
    objects: list[bytes] = []
    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(len(pages)))
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    font_id = 3 + 2 * len(pages)
    for i, lines in enumerate(pages):
        content_id = 4 + 2 * i
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_id} 0 R "
                       f"/Resources << /Font << /F1 {font_id} 0 R >> >> >>".encode())
        stream = "BT /F1 12 Tf 72 720 Td 16 TL " + " ".join(f"({line}) Tj T*" for line in lines) + " ET"
        objects.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream".encode())
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    out, offsets = b"%PDF-1.4\n", []
    for n, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{n} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


def test_text_sections_keep_headings_and_section_labels():
    sections = extract("text/plain", MOTOR_2024.encode()).sections
    by_label = {s.label: s for s in sections if s.label}
    assert by_label["4.1"].heading == "Flood damage"
    assert "covered under the comprehensive motor policy" in by_label["4.1"].text
    assert by_label["5.1"].heading == "Reporting" and "within 7 days" in by_label["5.1"].text
    assert by_label["5.2"].heading == "Documents"


def test_the_demo_banner_is_not_indexed_as_content():
    sections = extract("text/plain", MOTOR_2024.encode()).sections
    assert not any("FICTIONAL DEMO FIXTURE" in s.text for s in sections)


def test_step_headings_are_recognised():
    text = "Claims SOP\n\nStep 1. Register the claim\nRecord the loss date.\n\nStep 2. Collect documents\nCollect the claim form.\n"
    sections = extract("text/plain", text.encode()).sections
    assert [(s.label, s.heading) for s in sections if s.label] == [("Step 1", "Register the claim"), ("Step 2", "Collect documents")]


def test_body_lines_that_start_with_numbers_are_not_headings():
    text = "1. Scope\nThis applies to claims.\n10 working days are allowed for settlement and review of the file.\n"
    sections = extract("text/plain", text.encode()).sections
    assert len([s for s in sections if s.label]) == 1


def test_pdf_pages_are_preserved():
    pdf = make_pdf([["1. Scope", "Page one text about flood cover."], ["2. Claims", "Page two text about reporting."]])
    result = extract("application/pdf", pdf)
    labelled = {s.label: s for s in result.sections if s.label}
    assert labelled["1"].page_start == 1 and labelled["2"].page_start == 2
    assert "flood cover" in labelled["1"].text and "reporting" in labelled["2"].text
    assert result.warnings == []


def test_pdf_page_without_text_is_flagged_not_hidden():
    result = extract("application/pdf", make_pdf([["1. Scope", "Some text."], []]))
    assert any("page 2" in w and "OCR" in w for w in result.warnings)


def test_docx_headings_and_tables_are_read():
    doc = DocxDocument()
    doc.add_heading("Loan eligibility", level=1)
    doc.add_paragraph("Applicants must be salaried.")
    table = doc.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text, table.rows[0].cells[1].text = "Tenure", "20 years"
    buffer = io.BytesIO()
    doc.save(buffer)
    sections = extract(DOCX_MIME, buffer.getvalue()).sections
    assert sections[0].heading == "Loan eligibility"
    assert "salaried" in sections[0].text and "Tenure | 20 years" in sections[0].text


def test_corrupt_files_raise_a_clear_error():
    with pytest.raises(ValueError, match="could not be read"):
        extract("application/pdf", b"%PDF-1.4 this is not really a pdf")


def test_long_sections_are_split_with_overlap_and_keep_metadata():
    body = "\n".join(f"Sentence number {n} describes a rule about claims handling and documents." for n in range(40))
    sections = extract("text/plain", f"4. Long section\n{body}\n".encode()).sections
    chunks = chunk_sections(sections, max_chars=400)
    assert len(chunks) > 2
    assert all(c.section_label == "4" and c.heading == "Long section" for c in chunks)
    assert all(len(c.text) <= 600 for c in chunks)
    first_lines = [c.text.splitlines()[0] for c in chunks[1:]]
    assert any(line in chunks[0].text or line in chunks[1].text for line in first_lines)  # overlap
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))


def test_short_sections_become_single_chunks_with_offsets():
    chunks = chunk_sections(extract("text/plain", MOTOR_2024.encode()).sections)
    flood = next(c for c in chunks if c.section_label == "4.1")
    assert flood.char_start is not None and flood.char_end > flood.char_start
    assert MOTOR_2024[flood.char_start:flood.char_end].strip().startswith("Flood damage is treated")


def test_markdown_style_headings_in_text_become_sections():
    text = "# Claims Checklist\n\n## Document Checklist - Motor Insurance Claim\n- Claim intimation form.\n- Driver licence copy.\n\n## Third Party Damage\n- Demand letter.\n"
    sections = extract("text/plain", text.encode()).sections
    assert [(s.heading, s.label) for s in sections] == [("Document Checklist - Motor Insurance Claim", None), ("Third Party Damage", None)]
    assert "Driver licence copy." in sections[0].text and sections[1].text == "- Demand letter."
