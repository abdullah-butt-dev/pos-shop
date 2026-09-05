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

/**
 * Draws the full receipt onto a given jsPDF document and returns the
 * final Y position reached. Used twice: once on a tall "probe" page to
 * measure the required height, then again on a page sized to fit.
 */
function drawReceipt(doc: jsPDF, receipt: PosReceiptData): number {
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
    doc.text(receipt.shopAddress, WIDTH / 2, y, { align: "center" });
    y += 4;
  }

  if (receipt.shopPhone) {
    doc.text(receipt.shopPhone, WIDTH / 2, y, { align: "center" });
    y += 4;
  }

  doc.setTextColor(0, 0, 0);
  y += 3;

  // --- Receipt # and date, centered and prominent ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Receipt# ${receipt.receiptNumber}`, WIDTH / 2, y, {
    align: "center",
  });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Date : ${receipt.dateTime}`, WIDTH / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 5;

  if (receipt.customerName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 15, 15);
    doc.text(`Customer: ${receipt.customerName}`, WIDTH / 2, y, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    y += 6;
  } else {
    y += 2;
  }

  // --- Info table: P Mode | I# | U# | Amount ---
  const infoColPMode = MARGIN;
  const infoColI = MARGIN + 30;
  const infoColU = MARGIN + 44;
  const infoColAmount = WIDTH - MARGIN;

  doc.setFillColor(236, 236, 236);
  doc.rect(MARGIN - 1, y - 3.6, CONTENT_WIDTH + 2, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("P Mode", infoColPMode, y);
  doc.text("I#", infoColI, y, { align: "center" });
  doc.text("U#", infoColU, y, { align: "center" });
  doc.text("Amount", infoColAmount, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
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
  const nameWrapWidth = 28;

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

  // Only show Paid/Remaining when the sale is actually split (partial payment)
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("Thank you!", WIDTH / 2, y, { align: "center" });
  y += 4;

  return y;
}

export function generatePosReceiptPDF(receipt: PosReceiptData): void {
  // Pass 1: draw on a generously tall probe page just to measure the
  // real content height (avoids guessing and leaving blank space).
  const probe = new jsPDF({ unit: "mm", format: [WIDTH, 400] });
  const finalY = drawReceipt(probe, receipt);

  // Pass 2: render for real on a page sized to fit exactly.
  const doc = new jsPDF({ unit: "mm", format: [WIDTH, finalY] });
  drawReceipt(doc, receipt);

  doc.save(`${receipt.receiptNumber || "receipt"}.pdf`);
}
