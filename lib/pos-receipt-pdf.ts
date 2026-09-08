import { jsPDF } from "jspdf";

export interface PosReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface PosReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  receiptFooterText?: string | null;
  receiptNumber: string;
  dateTime: string;
  customerName: string;
  items: PosReceiptItem[];
  itemCount?: number;
  unitCount?: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  paymentMode?: string;
  currency?: string;
}

export function formatPakistanDateTime(
  dateInput?: Date | string | null,
): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const money = (value: number, _currency = "PKR") =>
  `Rs${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const WIDTH = 80;
const MARGIN = 5;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;

interface RenderedFooterImage {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

export async function ensureUrduFont(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;

  try {
    if (document.fonts.check('16px "Noto Naskh Arabic"')) return;

    const font = new FontFace(
      "Noto Naskh Arabic",
      "url(/fonts/NotoNaskhArabic-Regular.woff2)",
      { style: "normal", weight: "400" },
    );
    const loaded = await font.load();
    document.fonts.add(loaded);
    await document.fonts.ready;
  } catch (err) {
    console.warn("Noto Naskh Arabic font preloading error:", err);
  }
}

function renderUrduFooterCanvas(
  text: string,
  maxAllowedMmWidth: number,
): RenderedFooterImage | null {
  if (typeof document === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // High resolution scaling: 10 pixels per millimeter (~254 DPI)
    const scale = 10;
    const maxPxWidth = maxAllowedMmWidth * scale;

    // Start with a readable font size and shrink in a loop until it fits within maxPxWidth
    let fontSizePx = 28;
    const minFontSizePx = 11;

    ctx.font = `${fontSizePx}px "Noto Naskh Arabic", "Noto Nastaliq Urdu", sans-serif`;
    while (
      fontSizePx > minFontSizePx &&
      ctx.measureText(text).width > maxPxWidth
    ) {
      fontSizePx -= 1;
      ctx.font = `${fontSizePx}px "Noto Naskh Arabic", "Noto Nastaliq Urdu", sans-serif`;
    }

    const metrics = ctx.measureText(text);
    const textWidthPx = Math.min(metrics.width, maxPxWidth);
    const canvasHeightPx = Math.ceil(fontSizePx * 1.8);
    const canvasWidthPx = Math.ceil(textWidthPx + 8);

    canvas.width = canvasWidthPx;
    canvas.height = canvasHeightPx;

    // Reset context attributes after canvas dimension assignment
    ctx.font = `${fontSizePx}px "Noto Naskh Arabic", "Noto Nastaliq Urdu", sans-serif`;
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5a5a5a"; // rgb(90, 90, 90) muted receipt text

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      widthMm: canvas.width / scale,
      heightMm: canvas.height / scale,
    };
  } catch (err) {
    console.error("Error rendering Urdu footer to canvas:", err);
    return null;
  }
}

/**
 * Draws the full receipt onto a given jsPDF document and returns the
 * final Y position reached. Used twice: once on a tall "probe" page to
 * measure the required height, then again on a page sized to fit.
 */
function drawReceipt(
  doc: jsPDF,
  receipt: PosReceiptData,
  footerImg?: RenderedFooterImage | null,
): number {
  let y = 8;

  // --- Shop header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(receipt.shopName || "Perfect Traders", WIDTH / 2, y, {
    align: "center",
  });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);

  if (receipt.shopAddress) {
    const addressLines = doc.splitTextToSize(
      receipt.shopAddress,
      CONTENT_WIDTH,
    );
    const lines = Array.isArray(addressLines) ? addressLines : [addressLines];
    for (const line of lines) {
      doc.text(line, WIDTH / 2, y, { align: "center" });
      y += 3.8;
    }
  }

  if (receipt.shopPhone) {
    const phoneText = receipt.shopPhone.startsWith("Phone:")
      ? receipt.shopPhone
      : `Phone: ${receipt.shopPhone}`;
    const phoneLines = doc.splitTextToSize(phoneText, CONTENT_WIDTH);
    const lines = Array.isArray(phoneLines) ? phoneLines : [phoneLines];
    for (const line of lines) {
      doc.text(line, WIDTH / 2, y, { align: "center" });
      y += 3.8;
    }
  }

  doc.setTextColor(0, 0, 0);
  y += 2;

  // divider
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  y += 6;

  // --- Receipt metadata ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Receipt #", MARGIN, y);
  doc.text(receipt.receiptNumber, WIDTH - MARGIN, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text("Date", MARGIN, y);
  doc.text(receipt.dateTime, WIDTH - MARGIN, y, { align: "right" });
  y += 5;

  doc.text("Customer", MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.customerName, WIDTH - MARGIN, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 6;

  // divider
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  y += 6;

  // --- Summary strip ---
  const infoColPMode = MARGIN;
  const infoColI = MARGIN + 28;
  const infoColU = MARGIN + 40;
  const infoColAmount = WIDTH - MARGIN;

  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("P.Mode", infoColPMode, y);
  doc.text("Items", infoColI, y, { align: "center" });
  doc.text("Units", infoColU, y, { align: "center" });
  doc.text("Amount", infoColAmount, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(receipt.paymentMode || receipt.paymentStatus || "", infoColPMode, y);
  doc.text(String(receipt.itemCount || 0), infoColI, y, { align: "center" });
  doc.text(String(receipt.unitCount || 0), infoColU, y, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(money(receipt.grandTotal, receipt.currency), infoColAmount, y, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  y += 9;

  // --- Items table: Name | Price | Qty | Total ---
  const colName = MARGIN;
  const colPrice = MARGIN + 34;
  const colQty = MARGIN + 46;
  const colTotal = WIDTH - MARGIN;

  const colGap = colPrice - colName;
  const maxPriceTextWidth = 14;
  const priceSafetyMargin = 4;
  const nameWrapWidth = colGap - maxPriceTextWidth - priceSafetyMargin;

  doc.setFillColor(236, 236, 236);
  doc.rect(MARGIN - 1, y - 3.6, CONTENT_WIDTH + 2, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Name", colName, y);
  doc.text("Price", colPrice, y, { align: "right" });
  doc.text("Qty", colQty, y, { align: "center" });
  doc.text("Total", colTotal, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const item of receipt.items) {
    const nameLines = doc.splitTextToSize(item.name, nameWrapWidth);

    doc.text(nameLines, colName, y);
    doc.text(money(item.unit_price, receipt.currency), colPrice, y, {
      align: "right",
    });
    doc.text(String(item.quantity), colQty, y, { align: "center" });
    doc.text(money(item.line_total, receipt.currency), colTotal, y, {
      align: "right",
    });

    const rowHeight = Math.max(6, nameLines.length * 4.5);
    y += rowHeight;
  }

  // divider
  y += 1;
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  y += 6;

  // --- Totals ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Subtotal", MARGIN, y);
  doc.text(money(receipt.grandTotal, receipt.currency), WIDTH - MARGIN, y, {
    align: "right",
  });
  y += 6;

  if (receipt.remainingAmount > 0 && receipt.paidAmount > 0) {
    doc.text("Paid", MARGIN, y);
    doc.text(money(receipt.paidAmount, receipt.currency), WIDTH - MARGIN, y, {
      align: "right",
    });
    y += 6;

    doc.text("Remaining", MARGIN, y);
    doc.text(
      money(receipt.remainingAmount, receipt.currency),
      WIDTH - MARGIN,
      y,
      { align: "right" },
    );
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Grand Total", MARGIN, y);
  doc.text(money(receipt.grandTotal, receipt.currency), WIDTH - MARGIN, y, {
    align: "right",
  });
  y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  y += 6;

  if (footerImg) {
    const imgX = (WIDTH - footerImg.widthMm) / 2;
    doc.addImage(
      footerImg.dataUrl,
      "PNG",
      imgX,
      y,
      footerImg.widthMm,
      footerImg.heightMm,
    );
    y += footerImg.heightMm + 4;
  } else {
    // Fallback if footer message is empty or canvas unavailable
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text("Thank you!", WIDTH / 2, y, { align: "center" });
    y += 4;
  }

  return y;
}

export function buildPosReceiptDoc(receipt: PosReceiptData): jsPDF {
  const footerText = receipt.receiptFooterText?.trim();
  let footerImg: RenderedFooterImage | null = null;

  if (footerText) {
    footerImg = renderUrduFooterCanvas(footerText, CONTENT_WIDTH);
  }

  // Pass 1: draw on a generously tall probe page just to measure the
  // real content height (avoids guessing and leaving blank space).
  const probe = new jsPDF({ unit: "mm", format: [WIDTH, 400] });
  const finalY = drawReceipt(probe, receipt, footerImg);

  // Pass 2: render for real on a page sized to fit exactly.
  const doc = new jsPDF({ unit: "mm", format: [WIDTH, finalY] });
  drawReceipt(doc, receipt, footerImg);

  return doc;
}

export function downloadPosReceiptPDF(
  receipt: PosReceiptData,
  targetWindow?: Window | null,
): jsPDF {
  const doc = buildPosReceiptDoc(receipt);
  const fileName = `${receipt.receiptNumber || "receipt"}.pdf`;
  doc.save(fileName);

  if (typeof window !== "undefined") {
    const blobUrl = String(doc.output("bloburl"));
    if (targetWindow && !targetWindow.closed) {
      try {
        targetWindow.location.href = blobUrl;
      } catch {
        window.open(blobUrl, "_blank");
      }
    } else {
      window.open(blobUrl, "_blank");
    }
  }

  return doc;
}

export function printPosReceiptPDF(
  receipt: PosReceiptData,
  targetIframe?: HTMLIFrameElement | null,
): jsPDF {
  const doc = buildPosReceiptDoc(receipt);
  const fileName = `${receipt.receiptNumber || "receipt"}.pdf`;
  doc.save(fileName);

  if (typeof document !== "undefined") {
    const blobUrl = String(doc.output("bloburl"));
    const iframe = targetIframe || document.createElement("iframe");

    if (!targetIframe) {
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Failed to trigger print on iframe:", err);
      }
      setTimeout(() => {
        try {
          iframe.remove();
        } catch {}
      }, 60000);
    };

    iframe.src = blobUrl;
  }

  return doc;
}

export async function generatePosReceiptPDF(
  receipt: PosReceiptData,
): Promise<void> {
  await ensureUrduFont();
  const doc = buildPosReceiptDoc(receipt);
  doc.save(`${receipt.receiptNumber || "receipt"}.pdf`);
}

// Background preload Urdu font when loaded in browser
if (typeof window !== "undefined") {
  ensureUrduFont().catch(() => {});
}
