import React, { useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";

// Lazy-load html2canvas only when needed
const useHtml2Canvas = () =>
  React.useCallback(async () => {
    const mod = await import("html2canvas");
    return mod.default;
  }, []);

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  quotation: any | null;
}

const GenerateQuotationModal: React.FC<InvoiceModalProps> = ({ open, onClose, quotation }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const getHtml2Canvas = useHtml2Canvas();

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatCurrency = (n: number) =>
    n?.toLocaleString(undefined, { minimumFractionDigits: 2 });

  // Ensure Roboto font is loaded on the page (used for html2canvas and normal rendering)
  useEffect(() => {
    const id = "mietubl-roboto-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printContents = invoiceRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=1200");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Quotation</title>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
            <style>
              @media print {
                @page {
                  margin: 12mm;
                  size: A4;
                }
                body {
                  -webkit-print-color-adjust: exact !important;
                  color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                /* Hide any browser artifacts */
                header, nav, .no-print {
                  display: none !important;
                }
                
                /* Force two-column header layout in print */
                .invoice-header {
                  display: flex !important;
                  flex-direction: row !important;
                  justify-content: space-between !important;
                  align-items: flex-start !important;
                  page-break-inside: avoid !important;
                }
                
                .invoice-company {
                  display: flex !important;
                  align-items: center !important;
                  flex: 0 0 auto !important;
                  margin-left: -10px!important;
                }
                
                .invoice-meta {
                  text-align: right !important;
                  margin-left: auto !important;
                  white-space: nowrap !important;
                  min-width: 200px !important;
                  flex: 0 0 auto !important;
                  padding-right: 40px!important;
                  padding-top: 10px!important;
                }
                
                /* Prevent page breaks in critical sections */
                .invoice-header, .table, .invoice-container {
                  page-break-inside: avoid !important;
                }
              }
              
              @media screen {
                body {
                  background: #f5f5f5;
                  padding: 20px;
                }
              }
              
              body { 
                margin: 0; 
                padding: 0;
                font-family: 'Roboto', Arial, sans-serif; 
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              * { 
                box-sizing: border-box; 
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              .preview { 
                width: 100%; 
                max-width: 900px; 
                margin: 0 auto; 
                padding: 24px; 
                font-family: 'Roboto', Arial, sans-serif; 
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
              }
              
              /* Company name styling */
              .company-name {
                font-weight: 900 !important;
                font-size: 18px !important;
                color: #f39c12 !important;
                letter-spacing: 1px !important;
              }
              
              /* Document number styling */
              .document-number {
                font-weight: 900 !important;
                font-size: 13px !important;
                color: red !important;
                letter-spacing: 1px !important;
                margin-top: 10px !important;
              }
              
              /* Table styling */
              .table { 
                border-collapse: collapse !important; 
                width: 100% !important; 
                margin-bottom: 8px !important;
              }
              
              .table th, .table td { 
                border: 1px solid #222 !important; 
                padding: 6px 8px !important; 
                font-size: 15px !important; 
                vertical-align: middle !important; 
              }
              
              .table th { 
                background: #f39c12 !important; 
                color: #fff !important; 
                font-weight: bold !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              /* Grand total row styling */
              .grand-total-row {
                background: #f4f6fb !important;
                font-weight: 700 !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              /* Bottom orange bar */
              .bottom-bar {
                background: #f39c12 !important;
                color: #fff !important;
                text-align: center !important;
                padding: 8px !important;
                font-weight: 700 !important;
                font-size: 15px !important;
                margin-top: 16px !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              /* Signature fields */
              .signature-field {
                font-size: 13px !important;
                font-weight: 700 !important;
                margin-bottom: 4px !important;
              }
              
              .signature-line {
                height: 20px !important;
                border-bottom: 1px solid #222 !important;
                margin-bottom: 8px !important;
              }
              
              /* Typography fixes */
              .invoice-text {
                font-family: 'Roboto', Arial, sans-serif !important;
              }
              
              /* Terms styling */
              .terms-text {
                font-weight: 500 !important;
                font-size: 14px !important;
                margin-top: 16px !important;
              }
              
              .terms-description {
                font-size: 13px !important;
                margin-top: 4px !important;
              }
              
              /* Additional fixes for consistent layout */
              .MuiTypography-root {
                font-family: 'Roboto', Arial, sans-serif !important;
              }
              
              /* Border consistency */
              .invoice-container {
                border: 1px solid #222 !important;
                padding: 16px !important;
                background: white !important;
              }
              .client-name, .store-name, .address {
                font-weight: 700 !important;
              }
              .logo {
                width: 160px;
                margin-left: 10px!important;
                margin-right: 15px!important;
              }
            </style>
          </head>
          <body>
            <div class="preview">${printContents}</div>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    const html2canvas = await getHtml2Canvas();
    html2canvas(invoiceRef.current).then((canvas: HTMLCanvasElement) => {
      const link = document.createElement("a");
      link.download = "invoice.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  const handleCopy = async () => {
    if (!invoiceRef.current) return;
    const html2canvas = await getHtml2Canvas();
    html2canvas(invoiceRef.current).then(async (canvas: HTMLCanvasElement) => {
      try {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            alert("Failed to copy image.");
            return;
          }
          // @ts-ignore
          if (navigator.clipboard && navigator.clipboard.write) {
            try {
              // @ts-ignore
              await navigator.clipboard.write([
                new window.ClipboardItem({ "image/png": blob }),
              ]);
              alert("Invoice image copied to clipboard!");
            } catch {
              alert("Failed to copy image to clipboard.");
            }
          } else {
            alert("Clipboard image copy is not supported in this browser.");
          }
        }, "image/png");
      } catch {
        alert("Failed to copy image.");
      }
    });
  };

  const grandTotal = Array.isArray(quotation?.products)
    ? quotation.products.reduce(
        (sum: number, p: any) => sum + Number(p.total || 0),
        0
      )
    : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minWidth: 900, position: "relative" } }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          right: 12,
          top: 12,
          zIndex: 10,
        }}
        aria-label="Close"
      >
        <CloseIcon />
      </IconButton>

      <DialogTitle sx={{ fontWeight: 700, fontSize: 22, pb: 1 }}>
        Quotation Preview
      </DialogTitle>

      <DialogContent dividers>
        <Box
          ref={invoiceRef}
          sx={{
            bgcolor: "#fff",
            p: 3,
            // ensure Roboto is used inside the preview
            fontFamily: `'Roboto', 'Helvetica', 'Arial', sans-serif`,
          }}
        >
          {quotation && (
            <Box
              className="invoice-container"
              sx={{ border: "1px solid #222", p: 2, bgcolor: "#fff" }}
            >
              <Box
                className="invoice-header"
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 1,
                }}
              >
                <Box
                  className="invoice-company"
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <img
                    className="logo"
                    src="/mietubl_logo.png"
                    alt="Mietubl Logo"
                    style={{ width: 100, height: "auto", marginRight: 20 }}
                  />
                  <Box>
                    <Typography
                      className="company-name"
                      sx={{
                        fontWeight: 900,
                        fontSize: 16,
                        color: "#f39c12",
                        letterSpacing: 1,
                      }}
                    >
                      MIETUBL PHILIPPINES TRADING INC.
                    </Typography>
                    <Typography fontSize={13}>
                      20 BRISTOL STREET, NORTH FAIRVIEW, QUEZON CITY
                    </Typography>
                    <Typography fontSize={13}>
                      SMART: +639177355352 / GLOBE: +639205259472
                    </Typography>
                    <Typography fontSize={13}>MIETUBL.PH@GMAIL.COM</Typography>
                  </Box>
                </Box>

                <Box
                  className="invoice-meta"
                  sx={{ textAlign: "right", marginTop: 2 }}
                >
                  <Typography
                    className="document-number"
                    sx={{
                      fontWeight: 900,
                      fontSize: 13,
                      color: "red",
                      letterSpacing: 1,
                    }}
                  >
                    QUOTATION
                  </Typography>
                  <Typography className="date" fontSize={13} sx={{ mt: 1 }}>
                    <span style={{ fontWeight: 700 }}>
                      {formatDate(quotation.quotationDate)}
                    </span>
                  </Typography>
                  {/* <Typography fontSize={13} sx={{ mt: 0.5 }}>
                    Receipt No.:{" "}
                    <span style={{ fontWeight: 700 }}>
                      {quotation.receiptNo || "-"}
                    </span>
                  </Typography> */}
                </Box>
              </Box>

              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography  fontSize={15} sx={{ fontWeight: 700 }}>
                  <span className="client-name">CLIENT NAME</span>: {`${quotation.customer?.fullName || '-'}`}
                </Typography>
                <Typography fontSize={15} sx={{ fontWeight: 700 }}>
                  <span className="store-name">STORE NAME</span>: {`${quotation.customer.storeName || '-'}`}
                </Typography>
                <Typography fontSize={15} sx={{ fontWeight: 700 }}>
                  <span className="address">ADDRESS</span>: {`${quotation.customer.address || '-'}`}
                </Typography>
                <Typography fontSize={14} sx={{ mt: 0.5 }}>
                  Greetings! We are pleased to submit our quotation on the
                  following items for your approval:
                </Typography>
              </Box>

              <table
                className="table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: 8,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                      }}
                    >
                      ITEM DESCRIPTION / NATURE OF SERVICE
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                      }}
                    >
                      QUANTITY
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                      }}
                    >
                      UNIT PRICE
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                      }}
                    >
                      DISCOUNT
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                      }}
                    >
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(quotation.products) && quotation.products.length > 0 ? (
                    quotation.products.map((p: any, idx: number) => {
                      const qty = Number(p.quantity ?? 1);
                      const unitPrice = Number(p.price ?? 0);

                      return (
                        <tr key={idx}>
                          <td
                            style={{
                              border: "1px solid #222",
                              padding: 6,
                              verticalAlign: "middle",
                            }}
                          >
                            {p.name || "-"}
                          </td>
                          <td
                            style={{
                              border: "1px solid #222",
                              padding: 6,
                              textAlign: "center",
                              verticalAlign: "middle",
                            }}
                          >
                            {qty}
                          </td>
                          <td
                            style={{
                              border: "1px solid #222",
                              padding: 6,
                              textAlign: "right",
                              verticalAlign: "middle",
                            }}
                          >
                            {formatCurrency(unitPrice)}
                          </td>
                          <td
                            style={{
                              border: "1px solid #222",
                              padding: 6,
                              textAlign: "right",
                              verticalAlign: "middle",
                            }}
                          >
                            {formatCurrency(p.discount * p.quantity)}
                          </td>
                          <td
                            style={{
                              border: "1px solid #222",
                              padding: 6,
                              textAlign: "right",
                              verticalAlign: "middle",
                            }}
                          >
                            {formatCurrency((p.price * p.quantity) - (p.discount * p.quantity))}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        style={{
                          border: "1px solid #222",
                          padding: 6,
                          verticalAlign: "middle",
                        }}
                        colSpan={5}
                      >
                        No products found.
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td
                      colSpan={4}
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "right",
                        fontWeight: 700,
                        background: "#f4f6fb",
                        verticalAlign: "middle",
                      }}
                    >
                      NET TOTAL
                    </td>
                    <td
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "right",
                        fontWeight: 700,
                        background: "#f4f6fb",
                        verticalAlign: "middle",
                      }}
                    >
                      {formatCurrency(quotation.netTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Terms of Payment (top) */}
              <Box sx={{ mb: 1 }}>
                <Typography
                  className="terms-text"
                  fontWeight={500}
                  fontSize={14}
                  sx={{ mt: 2 }}
                >
                  TERMS OF PAYMENT: {quotation.termsOfPayment || "-"}
                </Typography>
                <Typography
                  className="terms-description"
                  fontSize={13}
                  sx={{ mt: 0.5 }}
                >
                  We sincerely hope our proposal will meet your favorable
                  approval. Should you have some queries or if we can be of any
                  assistance in reaching your decision, please feel free to
                  contact us.
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    className="signature-field"
                    fontSize={13}
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    PREPARED BY:
                  </Typography>
                  <Box
                    className="signature-line"
                    style={{
                      height: 20,
                      borderBottom: "1px solid #222",
                      marginBottom: 8,
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    className="signature-field"
                    fontSize={13}
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    RECEIVED BY:
                  </Typography>
                  <Box
                    className="signature-line"
                    style={{
                      height: 20,
                      borderBottom: "1px solid #222",
                      marginBottom: 8,
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    className="signature-field"
                    fontSize={13}
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    MACHINE ID:
                  </Typography>
                  <Box
                    className="signature-line"
                    style={{
                      height: 20,
                      borderBottom: "1px solid #222",
                      marginBottom: 8,
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    className="signature-field"
                    fontSize={13}
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    DATE RECEIVED:
                  </Typography>
                  <Box
                    className="signature-line"
                    style={{
                      height: 20,
                      borderBottom: "1px solid #222",
                      marginBottom: 8,
                    }}
                  />
                </Box>
              </Box>

              <Box
                className="bottom-bar"
                sx={{
                  mt: 4,
                  bgcolor: "#f39c12",
                  color: "#fff",
                  textAlign: "center",
                  py: 1,
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                MIETUBL PHILIPPINES TRADING INC. MAKE IT EASIER TO USE. BETTER
                LIFE.
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onClose}
          sx={{ minWidth: 140 }}
        >
          Close
        </Button>

        <Stack direction="row" spacing={2}>
          <Tooltip title="Print Quotation">
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{
                bgcolor: "#1976d2",
                color: "#fff",
                minWidth: 170,
                "&:hover": { bgcolor: "#115293" },
                fontWeight: 700,
              }}
            >
              Print Quotation
            </Button>
          </Tooltip>

          <Tooltip title="Download Quotation">
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{
                bgcolor: "#222",
                color: "#fff",
                minWidth: 170,
                "&:hover": { bgcolor: "#111" },
                fontWeight: 700,
              }}
            >
              Download Quotation
            </Button>
          </Tooltip>

          <Tooltip title="Copy Quotation">
            <Button
              variant="contained"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              sx={{
                bgcolor: "#ff9800",
                color: "#fff",
                minWidth: 170,
                "&:hover": { bgcolor: "#fb8c00" },
                fontWeight: 700,
              }}
            >
              Copy Quotation
            </Button>
          </Tooltip>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateQuotationModal;
