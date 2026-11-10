"""Turn an uploaded file into sections (heading, section label, page, offsets) and then chunks.

Pure functions, no database. Supports TXT, PDF (text layer) and DOCX. Scanned PDFs are reported, not silently
skipped: OCR is not enabled (docs/decisions.md).
"""

import io
import re
from dataclasses import dataclass, field

from .demo_fixtures import BANNER

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# "4.1 Flood damage" / "1. Scope" / "Step 2. Collect documents". The title must start with a capital and not end
# with a full stop, so body sentences such as "10 working days are allowed..." are not mistaken for headings.
_HEADING = re.compile(
    r"^(?:(?P<num>\d+(?:\.\d+)*)\.?\s+(?P<t1>[A-Z][^\n]{1,80}?)|(?P<step>Step\s+\d+)\.\s*(?P<t2>[^\n]{1,80}?))$"
)


@dataclass
class Line:
    text: str
    page: int | None
    start: int | None  # character offset in the source text (text files only)
    end: int | None
    is_heading: bool = False  # set by the format reader when the file itself marks a heading (DOCX styles)


@dataclass
class Section:
    heading: str | None
    label: str | None
    lines: list[Line] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n".join(line.text for line in self.lines)

    @property
    def page_start(self) -> int | None:
        pages = [line.page for line in self.lines if line.page is not None]
        return min(pages) if pages else None

    @property
    def page_end(self) -> int | None:
        pages = [line.page for line in self.lines if line.page is not None]
        return max(pages) if pages else None

    @property
    def char_start(self) -> int | None:
        return next((line.start for line in self.lines if line.start is not None), None)

    @property
    def char_end(self) -> int | None:
        return next((line.end for line in reversed(self.lines) if line.end is not None), None)


@dataclass
class Extraction:
    sections: list[Section]
    warnings: list[str]


@dataclass
class ChunkData:
    ordinal: int
    text: str
    page_start: int | None
    page_end: int | None
    heading: str | None
    section_label: str | None
    char_start: int | None
    char_end: int | None
    quality: str = "ok"  # "ok" | "needs_review"


_MARKDOWN_HEADING = re.compile(r"^#{1,4}\s+(\S.{0,119})$")


def _match_heading(text: str) -> tuple[str | None, str] | None:
    """Return (label, title) if the line looks like a heading: '## Title', '4.1 Title', '1. Title' or 'Step 2. Title'."""
    stripped = text.strip()
    markdown = _MARKDOWN_HEADING.match(stripped)
    if markdown:  # used for text copies of web pages, where headings are marked with '#'
        return None, markdown.group(1).strip()
    if len(stripped) > 100 or stripped.endswith("."):
        return None
    match = _HEADING.match(stripped)
    if not match:
        return None
    if match.group("num"):
        return match.group("num"), match.group("t1").strip()
    return match.group("step"), match.group("t2").strip()


def _sectionise(lines: list[Line]) -> list[Section]:
    sections: list[Section] = []
    current = Section(heading=None, label=None)
    title_candidate: str | None = None
    seen_content = False
    for line in lines:
        text = line.text.strip()
        if not text:
            continue
        matched = _match_heading(text)
        if matched or line.is_heading:
            if current.lines:
                sections.append(current)
            label, title = matched if matched else (None, text)
            current = Section(heading=title, label=label)
            title_candidate = None
            seen_content = True
            continue
        if not seen_content and title_candidate is None and current.heading is None:
            title_candidate = text  # first line of the file, usually the document title
            current.heading = text
            seen_content = True
            continue
        current.lines.append(Line(text, line.page, line.start, line.end))
    if current.lines:
        sections.append(current)
    return sections


# ---------------------------------------------------------------- readers

def _read_text(data: bytes) -> tuple[list[Line], list[str]]:
    text = data.decode("utf-8", errors="replace")
    lines, offset = [], 0
    for raw in text.splitlines(keepends=True):
        stripped = raw.rstrip("\r\n")
        if stripped.strip() and not stripped.strip().startswith(BANNER):
            lines.append(Line(stripped, None, offset, offset + len(stripped)))
        offset += len(raw)
    return lines, []


def _read_pdf(data: bytes) -> tuple[list[Line], list[str]]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        page_texts = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:
        raise ValueError(f"The PDF could not be read ({type(exc).__name__})") from exc
    lines: list[Line] = []
    warnings: list[str] = []
    for number, page_text in enumerate(page_texts, start=1):
        if not page_text.strip():
            warnings.append(f"page {number} has no extractable text; it may be a scan (OCR is not enabled)")
            continue
        for raw in page_text.splitlines():
            if raw.strip():
                lines.append(Line(raw.strip(), number, None, None))
    return lines, warnings


def _read_docx(data: bytes) -> tuple[list[Line], list[str]]:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document = Document(io.BytesIO(data))
    except Exception as exc:
        raise ValueError(f"The DOCX file could not be read ({type(exc).__name__})") from exc
    lines: list[Line] = []
    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            paragraph = Paragraph(child, document)
            style = (paragraph.style.name or "") if paragraph.style is not None else ""
            if paragraph.text.strip():
                lines.append(Line(paragraph.text.strip(), None, None, None, is_heading=style.startswith(("Heading", "Title"))))
        elif child.tag.endswith("}tbl"):
            for row in Table(child, document).rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    lines.append(Line(" | ".join(cells), None, None, None))
    return lines, []


def extract(mime_type: str, data: bytes) -> Extraction:
    if mime_type == "text/plain":
        lines, warnings = _read_text(data)
    elif mime_type == "application/pdf":
        lines, warnings = _read_pdf(data)
    elif mime_type == DOCX_MIME:
        lines, warnings = _read_docx(data)
    else:
        raise ValueError(f"Unsupported file type for extraction: {mime_type}")
    return Extraction(sections=_sectionise(lines), warnings=warnings)


# ---------------------------------------------------------------- chunking

def chunk_sections(sections: list[Section], max_chars: int = 1000) -> list[ChunkData]:
    """One chunk per section when it fits; longer sections are packed by line with a one-line overlap."""
    chunks: list[ChunkData] = []

    def emit(section: Section, group: list[Line]) -> None:
        pages = [line.page for line in group if line.page is not None]
        starts = [line.start for line in group if line.start is not None]
        ends = [line.end for line in group if line.end is not None]
        chunks.append(ChunkData(
            ordinal=len(chunks), text="\n".join(line.text for line in group),
            page_start=min(pages) if pages else None, page_end=max(pages) if pages else None,
            heading=section.heading, section_label=section.label,
            char_start=starts[0] if starts else None, char_end=ends[-1] if ends else None,
        ))

    for section in sections:
        group: list[Line] = []
        size = 0
        for line in section.lines:
            if group and size + len(line.text) + 1 > max_chars:
                emit(section, group)
                group = [group[-1]] if len(group) > 1 else []  # overlap: carry the last line forward
                size = sum(len(x.text) + 1 for x in group)
            group.append(line)
            size += len(line.text) + 1
        if group:
            emit(section, group)
    return chunks
