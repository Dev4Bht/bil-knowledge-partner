"""View-only renditions of stored documents.

People who are not managers never receive the original file. They get page images rendered on the server: a PDF page
is rasterised, a text or Word document is laid out into pages and drawn. The image has no text layer to select or copy,
and every page carries a watermark naming the viewer and the time, so a screenshot or a photo of the screen can be
traced back. Nothing here can stop the operating system capturing the screen; the watermark and the audit trail are
the control for that.
"""

import io
import threading
from collections import OrderedDict
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont

from ..extraction import DOCX_MIME, _read_docx

PDF_SCALE = 1.5
MAX_PAGE_WIDTH = 1400  # pixels; keeps one page image small whatever the PDF's page size
JPEG_QUALITY = 74
TEXT_PAGE = (794, 1123)  # A4 at 96 dpi
TEXT_MARGIN = 72
BODY_SIZE, HEADING_SIZE = 17, 22
MAX_TEXT_BYTES = 8_000_000


class ViewError(ValueError):
    """The document could not be turned into pages (corrupt, protected or unsupported)."""


# ---------------------------------------------------------------- watermark

def watermark_label(display_name: str, email: str, when: datetime | None = None) -> str:
    when = when or datetime.now(timezone.utc)
    return f"{display_name} · {email} · {when:%Y-%m-%d %H:%M} UTC · view only"


def apply_watermark(image: Image.Image, label: str) -> Image.Image:
    """Tile the label diagonally across the whole page, faintly enough to read through, plus a footer line."""
    image = image.convert("RGB")
    width, height = image.size
    size = max(13, width // 58)
    font = ImageFont.load_default(size=size)
    step_x = int(font.getlength(label)) + size * 3
    step_y = size * 9
    side = int((width**2 + height**2) ** 0.5) + step_x  # big enough that rotating still covers the page
    layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for row, y in enumerate(range(0, side, step_y)):
        for x in range(-step_x + (row % 2) * (step_x // 2), side, step_x):
            draw.text((x, y), label, font=font, fill=(70, 78, 110, 52))
    layer = layer.rotate(28, resample=Image.Resampling.BICUBIC)
    left, top = (side - width) // 2, (side - height) // 2
    out = Image.alpha_composite(image.convert("RGBA"), layer.crop((left, top, left + width, top + height)))
    footer = ImageDraw.Draw(out)
    foot = ImageFont.load_default(size=max(11, size - 2))
    footer.rectangle((0, height - foot.size - 10, width, height), fill=(255, 255, 255, 215))
    footer.text((12, height - foot.size - 6), label, font=foot, fill=(60, 66, 90, 255))
    return out.convert("RGB")


def _jpeg(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=JPEG_QUALITY, optimize=True)
    return buffer.getvalue()


# ---------------------------------------------------------------- text and Word layout

_layouts: "OrderedDict[str, list[list[tuple[str, int]]]]" = OrderedDict()
_layout_lock = threading.Lock()
_LAYOUT_CACHE = 24


def _plain_lines(mime_type: str, data: bytes) -> list[tuple[str, bool]]:
    if mime_type == "text/plain":
        out: list[tuple[str, bool]] = []
        for raw in data[:MAX_TEXT_BYTES].decode("utf-8", errors="replace").splitlines():
            heading = raw.lstrip().startswith("#")
            out.append((raw.lstrip("# ").rstrip() if heading else raw.rstrip(), heading))
        return out
    if mime_type == DOCX_MIME:
        try:
            lines, _ = _read_docx(data)
        except ValueError as exc:
            raise ViewError(str(exc)) from exc
        return [(line.text, bool(line.is_heading)) for line in lines]
    raise ViewError(f"This file type cannot be shown: {mime_type}")


def _wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    if not text.strip():
        return [""]
    words, lines, current = text.split(" "), [], ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if font.getlength(candidate) <= max_width:
            current = candidate
        elif not current:  # one word wider than the page: cut it
            while word and font.getlength(word) > max_width:
                cut = len(word)
                while cut > 1 and font.getlength(word[:cut]) > max_width:
                    cut -= 1
                lines.append(word[:cut])
                word = word[cut:]
            current = word
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _layout(version_id: str, mime_type: str, data: bytes) -> list[list[tuple[str, int]]]:
    with _layout_lock:
        if version_id in _layouts:
            _layouts.move_to_end(version_id)
            return _layouts[version_id]
    body, head = ImageFont.load_default(size=BODY_SIZE), ImageFont.load_default(size=HEADING_SIZE)
    width = TEXT_PAGE[0] - 2 * TEXT_MARGIN
    usable = TEXT_PAGE[1] - 2 * TEXT_MARGIN - 28
    pages: list[list[tuple[str, int]]] = [[]]
    used = 0
    for text, heading in _plain_lines(mime_type, data):
        size, font = (HEADING_SIZE, head) if heading else (BODY_SIZE, body)
        advance = int(size * 1.5)
        for piece in _wrap(text, font, width):
            extra = int(size * 0.6) if heading and not pages[-1] == [] and used else 0
            if used + advance + extra > usable and pages[-1]:
                pages.append([])
                used, extra = 0, 0
            used += advance + extra
            pages[-1].append((piece, size))
    if not any(pages[-1]) and len(pages) > 1:
        pages.pop()
    with _layout_lock:
        _layouts[version_id] = pages
        while len(_layouts) > _LAYOUT_CACHE:
            _layouts.popitem(last=False)
    return pages


def _draw_text_page(lines: list[tuple[str, int]]) -> Image.Image:
    image = Image.new("RGB", TEXT_PAGE, "white")
    draw = ImageDraw.Draw(image)
    fonts = {BODY_SIZE: ImageFont.load_default(size=BODY_SIZE), HEADING_SIZE: ImageFont.load_default(size=HEADING_SIZE)}
    y = TEXT_MARGIN
    for text, size in lines:
        if size == HEADING_SIZE:
            y += int(size * 0.6) if y > TEXT_MARGIN else 0
        draw.text((TEXT_MARGIN, y), text, font=fonts[size], fill=(30, 34, 46) if size == BODY_SIZE else (27, 42, 78))
        y += int(size * 1.5)
    return image


# ---------------------------------------------------------------- public

def is_pdf(mime_type: str) -> bool:
    return mime_type == "application/pdf"


def page_count(version_id: str, mime_type: str, data: bytes) -> int:
    if is_pdf(mime_type):
        import pypdfium2 as pdfium

        try:
            document = pdfium.PdfDocument(data)
            try:
                return len(document)
            finally:
                document.close()
        except Exception as exc:
            raise ViewError(f"The PDF could not be opened ({type(exc).__name__})") from exc
    return max(1, len(_layout(version_id, mime_type, data)))


def render_page(version_id: str, mime_type: str, data: bytes, page: int, label: str) -> bytes:
    """One watermarked JPEG. `page` is 1-based and must already be within range."""
    if is_pdf(mime_type):
        import pypdfium2 as pdfium

        try:
            document = pdfium.PdfDocument(data)
            try:
                pdf_page = document[page - 1]
                scale = min(PDF_SCALE, MAX_PAGE_WIDTH / max(pdf_page.get_width(), 1))
                image = pdf_page.render(scale=scale).to_pil()
            finally:
                document.close()
        except Exception as exc:
            raise ViewError(f"The PDF page could not be drawn ({type(exc).__name__})") from exc
    else:
        pages = _layout(version_id, mime_type, data)
        image = _draw_text_page(pages[page - 1] if page - 1 < len(pages) else [])
    return _jpeg(apply_watermark(image, label))
