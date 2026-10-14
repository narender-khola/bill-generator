// Reimbursement-claim sheet: one row per bill, in the column layout of the
// claim template (the trailing comma is part of that template's header).
const HEADER = "BillNumber,BillDated,BillAmount,Password/ Any other info,";

const pad2 = (n) => String(n).padStart(2, "0");

// DD/MM/YYYY
export const claimDate = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// rows: [{ billNumber, billDated, billAmount, info }]
export const downloadClaimCsv = (rows) => {
  const lines = [HEADER, ...rows.map((r) =>
    [r.billNumber, r.billDated, Number(r.billAmount).toFixed(2), r.info].map(cell).join(",") + ","
  )];
  const now = new Date();
  const filename = `${pad2(now.getDate())}_${pad2(now.getMonth() + 1)}_${now.getFullYear()}.csv`;
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
