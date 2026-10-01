"""PDF rasterisation for the Document Reader Agent.

OpenRouter's OpenAI-compatible endpoint accepts only images inside an `image_url`
content part, so a PDF cannot be handed to the vision model as a PDF. Each page is
rendered to PNG and sent as an image instead, which is also what makes the reader
layout-agnostic: the model sees the page as a clinician would, so a report laid
out as a grid, as key/value pairs, in two columns, or as running prose all read
the same way. No fixed field order or column order is ever assumed.

`pypdfium2` is used rather than PyMuPDF because it is a thin binding over PDFium
(BSD-3) with no system dependencies, and it does not pull PyMuPDF's AGPL terms
into the project.
"""

from __future__ import annotations

import io
import logging

log = logging.getLogger(__name__)

# Enough pages to cover a multi-page report, few enough that one upload cannot
# blow the request size or the model's per-request image count.
MAX_PDF_PAGES = 8
# 72 dpi * 2 = 144 dpi. Lab reference ranges are small print, so this is the
# lowest scale that still reads reliably; raising it costs tokens linearly.
PDF_RENDER_SCALE = 2.0


class PdfUnreadableError(ValueError):
    """The bytes claim to be a PDF but no page could be rendered from them."""


def render_pdf_pages(
    data: bytes,
    *,
    max_pages: int = MAX_PDF_PAGES,
    scale: float = PDF_RENDER_SCALE,
) -> list[bytes]:
    """Render each page of a PDF to a PNG.

    Raises PdfUnreadableError for encrypted, truncated or non-PDF input, so the
    caller can report that clearly instead of surfacing a library traceback.
    """
    import pypdfium2 as pdfium

    try:
        pdf = pdfium.PdfDocument(data)
    except Exception as exc:  # noqa: BLE001 - pdfium raises a bare PdfiumError
        raise PdfUnreadableError("this file is not a readable PDF") from exc

    try:
        total = len(pdf)
        if total == 0:
            raise PdfUnreadableError("this PDF has no pages")

        pages: list[bytes] = []
        for index in range(min(total, max_pages)):
            try:
                bitmap = pdf[index].render(scale=scale)
                image = bitmap.to_pil()
            except Exception as exc:  # noqa: BLE001
                raise PdfUnreadableError(f"page {index + 1} of the PDF could not be rendered") from exc
            buffer = io.BytesIO()
            image.save(buffer, format="PNG", optimize=True)
            pages.append(buffer.getvalue())

        if total > max_pages:
            log.info("pdf truncated for vision: rendered %d of %d pages", max_pages, total)
        return pages
    finally:
        pdf.close()
