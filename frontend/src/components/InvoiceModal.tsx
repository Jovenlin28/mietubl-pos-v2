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
  TextField,
  Switch,
  FormControlLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
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

interface BoxEchoRow {
  box: string;
  echoBag: string;
}

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  sale: any | null;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ open, onClose, sale }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const getHtml2Canvas = useHtml2Canvas();
  const [withBoxEchoBag, setWithBoxEchoBag] = React.useState(false);
  const [boxEchoModalOpen, setBoxEchoModalOpen] = React.useState(false);
  const [boxEchoData, setBoxEchoData] = React.useState<Record<string, BoxEchoRow>>({});
  const [boxEchoDraft, setBoxEchoDraft] = React.useState<Record<string, BoxEchoRow>>({});

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

  useEffect(() => {
    if (!open) return;
    setWithBoxEchoBag(false);
    setBoxEchoModalOpen(false);
    setBoxEchoData({});
    setBoxEchoDraft({});
  }, [open, sale?.id]);

  const getProductKey = (p: any, index: number) =>
    String(p?.id ?? p?.product_id ?? index);

  const openBoxEchoModal = () => {
    const nextDraft: Record<string, BoxEchoRow> = {};
    if (Array.isArray(sale?.products)) {
      sale.products.forEach((p: any, idx: number) => {
        const key = getProductKey(p, idx);
        nextDraft[key] = {
          box: boxEchoData[key]?.box || "",
          echoBag: boxEchoData[key]?.echoBag || "",
        };
      });
    }
    setBoxEchoDraft(nextDraft);
    setBoxEchoModalOpen(true);
  };

  const handleToggleWithBoxEcho = (
    e: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setWithBoxEchoBag(checked);
    if (checked) {
      openBoxEchoModal();
    } else {
      // Turning off should immediately hide related UI and reset values.
      setBoxEchoModalOpen(false);
      setBoxEchoDraft({});
      setBoxEchoData({});
    }
  };

  const handleDraftChange = (
    key: string,
    field: "box" | "echoBag",
    value: string
  ) => {
    setBoxEchoDraft((prev) => ({
      ...prev,
      [key]: {
        box: prev[key]?.box || "",
        echoBag: prev[key]?.echoBag || "",
        [field]: value,
      },
    }));
  };

  const saveBoxEchoData = () => {
    setBoxEchoData(boxEchoDraft);
    setBoxEchoModalOpen(false);
  };

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printContents = invoiceRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;

    // collect existing stylesheets and <style> tags so the printed page looks the same
    const headNodes = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((n) => (n as HTMLElement).outerHTML)
      .join("\n");

    // show Terms & Agreement only for MACHINE category sales
    const shouldIncludeTerms =
      typeof sale?.category === "string" &&
      sale.category.toUpperCase().includes("MACHINE");

    const termsHtml = shouldIncludeTerms
      ? `
      <!-- Render terms inside an invoice-container so left/right alignment matches the invoice content -->
      <div class="invoice-container terms-page" style="border: none; padding: 8px 16px 0 16px;">
        <h2 style="text-align:center; font-weight:900; margin-bottom:8px; margin-top:0;">TERMS AND AGREEMENT</h2>
        <ol style="font-size:12.6px; line-height:1.38; padding-left:8px; margin-top:0;">
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              1. Cutting Codes Allocation
            </strong>
            <div style="margin-top:6px;">
              For every purchase of fifty (50) hydrogel films, you will receive fifty-five (55) cutting codes.
              One (1) cutting code is required per film cut. Cutting codes are non-transferable and non-refundable.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              2. Lifetime After-Sales Support
            </strong>
            <div style="margin-top:6px;">
              We provide lifetime after-sales support, including technical assistance and software updates, for all officially purchased products.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              3. Replacement and Warranty for Parts
            </strong>
            <div style="margin-top:6px;">
              A one (1) year warranty is provided for defective parts, subject to proper evaluation by our technical team.
              This warranty does not cover damages caused by misuse, mishandling, or unauthorized modifications.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              4. Incorrect Cuts
            </strong>
            <div style="margin-top:6px;">
              We are not liable for incorrect cuts caused by user error. Refunds or returns will not be accepted for these cases.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              5. Full Warranty Coverage
            </strong>
            <div style="margin-top:6px;">
              All machines include a one (1) year warranty covering both parts and service.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              6. Free Film Bonus
            </strong>
            <div style="margin-top:6px;">
              Every machine purchase includes complimentary hydrogel films as part of our promotional offer.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              7. Customer Support Availability
            </strong>
            <div style="margin-top:6px;">
              Our support team is available Monday to Saturday, from 10:00 AM to 6:00 PM to assist with any product concerns or inquiries.
              Ordering and recharge consumables is allowed only during working hours.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              8. Delivery Fees
            </strong>
            <div style="margin-top:6px;">
              Delivery charges are non-refundable under any circumstances.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              9. Authorized Film Purchases Only
            </strong>
            <div style="margin-top:6px;">
              Hydrogel film purchases must be made exclusively through our authorized company channels.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              10. No Minimum Order Requirement
            </strong>
            <div style="margin-top:6px;">
              Unlike other companies, we do not require a minimum order. You may purchase films in any quantity that suits your business needs.
            </div>
          </li>
          <li style="margin-bottom:8px;">
            <strong style="background: #c0392b; color:#fff; padding:2px 6px; border-radius:4px; display:inline-block;">
              11. Unauthorized Film Use & Account Termination
            </strong>
            <div style="margin-top:6px;">
              Use of unauthorized or third-party hydrogel films will result in immediate account suspension or termination.
              If an account is terminated due to breach of this clause, the machine must be returned to the company. No refunds will be issued in such cases.
            </div>
          </li>
        </ol>

        <div style="margin-top:8px; font-size:13px; line-height:1.32;">
          <p style="font-weight:700; margin-bottom:6px;">
            PLEASE TAKE THE TIME TO REVIEW THESE TERMS AND CONDITIONS.
          </p>
          <p style="margin:0;">
            FEEL FREE TO REACH OUT IF YOU HAVE ANY FURTHER QUESTIONS OR CONCERNS.
          </p>
        </div>

        <!-- Signature blocks placed near bottom of the same invoice-container so alignment matches -->
        <div class="terms-signature" style="width:100%; display:flex; gap:40px; margin-top:8px; align-items:flex-end; justify-content:center;">
          <div style="flex:1; max-width:420px; text-align:left;">
            <div style="font-weight:700; font-size:13px; margin-bottom:6px;">PREPARED BY:</div>
            <div style="border-bottom:2px solid #222; height:44px; margin-bottom:6px;"></div>
            <div style="font-size:12px; font-weight:700; text-align:center;">SIGNATURE</div>
          </div>
          <div style="flex:1; max-width:420px; text-align:left;">
            <div style="font-weight:700; font-size:13px; margin-bottom:6px;">RECEIVED BY:</div>
            <div style="border-bottom:2px solid #222; height:44px; margin-bottom:6px;"></div>
            <div style="font-size:12px; font-weight:700; text-align:center;">OVER PRINTED SIGNATURE</div>
          </div>
        </div>

      </div>
    `
      : "";

    // include base so relative URLs (images, fonts) resolve correctly
    const baseTag = `<base href="${location.origin}">`;

    const docTitle = `Purchase Order - ${
      sale?.purchaseOrderNumber || "Document"
    }`;

    win.document.write(`
       <html>
         <head>
           <title>${docTitle}</title>
           ${baseTag}
           ${headNodes}
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
                
                /* keep header together, allow table body to flow; allow the invoice container to break across pages */
                .invoice-header {
                  page-break-inside: avoid !important;
                }
                .invoice-container {
                  page-break-inside: auto !important;
                }

                /* Allow table to split across pages, but repeat the thead and avoid splitting individual rows */
                .table {
                  page-break-inside: auto !important;
                  break-inside: auto !important;
                }
                .table thead {
                  display: table-header-group !important;
                }
                .table tfoot {
                  display: table-footer-group !important;
                }
                .table tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                
                /* Keep the signature block together on a single page when possible */
                .terms-signature {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  -webkit-column-break-inside: avoid !important;
                  display: flex !important;
                  gap: 40px !important;
                  align-items: flex-end !important;
                  justify-content: center !important;
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
                margin-top: 10px !important;
                table-layout: fixed !important;
              }
              
              .table th, .table td { 
                border: 1px solid #222 !important; 
                padding: 6px 8px !important; 
                font-size: 15px !important; 
                vertical-align: middle !important; 
              }
              /* prevent numeric columns from wrapping so headers and numbers stay on one line */
              .table th:nth-child(n+2),
              .table td:nth-child(n+2) {
                white-space: nowrap !important;
              }

              .table th.box-echo-header,
              .table td.box-echo-cell {
                white-space: pre-line !important;
              }
              
              /* Grand total row styling */
              .grand-total-row {
                background: #dff0d8 !important;
                font-weight: 700 !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
                font-size: 12px !important;
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
              .greeting {
                margin-top: 10px !important;
                margin-bottom: 10px !important;
              }
              .client-name {
                margin-top: 40px!important;
              }
              .client-name, .store-name, .address {
                margin-bottom: 10px;
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
          <!-- Put terms/html inside the same preview wrapper so layouts align -->
          <div class="preview">
            ${printContents}
            ${termsHtml}
          </div>
         </body>
       </html>
     `);
    // ensure title property is also set on the window (some browsers read document.title)
    try {
      win.document.title = docTitle;
    } catch (e) {
      /* ignore */
    }
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
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

  const grandTotal = Array.isArray(sale?.products)
    ? sale.products.reduce(
        (sum: number, p: any) => sum + Number(p.total || 0),
        0
      )
    : 0;

  // totals for the products table
  const totalQuantity = Array.isArray(sale?.products)
    ? sale.products.reduce(
        (sum: number, p: any) => sum + Number(p.quantity || 0),
        0
      )
    : 0;
  const totalUnitPriceSum = Array.isArray(sale?.products)
    ? sale.products.reduce(
        (sum: number, p: any) =>
          sum + Number(p.price || 0) * Number(p.quantity || 0),
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
        Purchase Order Preview
      </DialogTitle>

      <DialogContent dividers sx={{ pb: 4 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 0, padding: "0 24px" }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={withBoxEchoBag}
                onChange={handleToggleWithBoxEcho}
                color="primary"
              />
            }
            label="With box or echo bag"
          />
          {withBoxEchoBag && (
            <Button variant="text" onClick={openBoxEchoModal}>
              Edit Box/Echo Bag
            </Button>
          )}
        </Stack>
        <Box
          ref={invoiceRef}
          sx={{
            bgcolor: "#fff",
            p: 3,
            pb: 6,
            // ensure Roboto is used inside the preview
            fontFamily: `'Roboto', 'Helvetica', 'Arial', sans-serif`,
          }}
        >
          {sale && (
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
                    {sale.purchaseOrderNumber}
                  </Typography>
                  <Typography className="date" fontSize={13} sx={{ mt: 1 }}>
                    <span style={{ fontWeight: 700 }}>
                      {formatDate(sale.saleDate)}
                    </span>
                  </Typography>
                  {/* <Typography fontSize={13} sx={{ mt: 0.5 }}>
                    Receipt No.:{" "}
                    <span style={{ fontWeight: 700 }}>
                      {sale.receiptNo || "-"}
                    </span>
                  </Typography> */}
                </Box>
              </Box>
              <br />
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography fontSize={15} sx={{ fontWeight: 700 }}>
                  <span className="client-name">CLIENT NAME</span>:{" "}
                  {`${sale?.customer?.fullName || "-"}`}
                </Typography>
                <Typography fontSize={15} sx={{ fontWeight: 700 }}>
                  <span className="store-name">STORE NAME</span>:{" "}
                  {`${sale?.customer?.storeName || "-"}`}
                </Typography>
                <Typography fontSize={15} sx={{ fontWeight: 700 }}>
                  <span className="address">ADDRESS</span>:{" "}
                  {`${sale?.customer?.address || "-"}`}
                </Typography>
                <Typography fontSize={14} sx={{ mt: 0.5 }}>
                  <span className="greeting">
                    Greetings! We are pleased to submit our quotation on the
                    following items for your approval:
                  </span>
                </Typography>
              </Box>

              <table
                className="table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  marginBottom: 8,
                }}
              >
                {/* equal fixed column widths; tuned so text cells don't overflow numeric columns */}
                <colgroup>
                  {withBoxEchoBag ? (
                    <>
                      <col style={{ width: "23%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "19%" }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: "35%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "19%" }} />
                    </>
                  )}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                        background: "#f39c12",
                        color: "#fff",
                        fontWeight: 700,
                        whiteSpace: "normal",
                      }}
                    >
                      PRODUCT
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                        background: "#f39c12",
                        color: "#fff",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        textAlign: "center",
                      }}
                    >
                      QTY
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                        background: "#f39c12",
                        color: "#fff",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        textAlign: "right",
                      }}
                    >
                      PRICE
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                        background: "#FF0000",
                        color: "#fff",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        textAlign: "right",
                      }}
                    >
                      DISCOUNT
                    </th>
                    <th
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        verticalAlign: "middle",
                        background: "#f39c12",
                        color: "#fff",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        textAlign: "right",
                      }}
                    >
                      TOTAL
                    </th>
                    {withBoxEchoBag && (
                      <th
                        className="box-echo-header"
                        style={{
                          border: "1px solid #222",
                          padding: 6,
                          verticalAlign: "middle",
                          background: "#f39c12",
                          color: "#fff",
                          fontWeight: 700,
                          textAlign: "left",
                        }}
                      >
                        BOX / ECHO BAG
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(sale.products) && sale.products.length > 0 ? (
                    sale.products.map((p: any, idx: number) => {
                      const key = getProductKey(p, idx);
                      const rowMeta = boxEchoData[key] || { box: "", echoBag: "" };
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
                              whiteSpace: "nowrap",
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
                              whiteSpace: "nowrap",
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
                              whiteSpace: "nowrap",
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
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatCurrency(
                              p.price * p.quantity - p.discount * p.quantity
                            )}
                          </td>
                          {withBoxEchoBag && (
                            <td
                              className="box-echo-cell"
                              style={{
                                border: "1px solid #222",
                                padding: 6,
                                textAlign: "left",
                                verticalAlign: "middle",
                                whiteSpace: "pre-line",
                                fontSize: 13,
                              }}
                            >
                              {`Box: ${rowMeta.box || "-"}\nEcho bag: ${rowMeta.echoBag || "-"}`}
                            </td>
                          )}
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
                        colSpan={withBoxEchoBag ? 6 : 5}
                      >
                        No products found.
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "left",
                        fontWeight: 700,
                        background: "#dff0d8",
                        verticalAlign: "middle",
                        fontSize: 14,
                      }}
                    >
                      TOTAL
                    </td>
                    <td
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "center",
                        fontWeight: 700,
                        background: "#dff0d8",
                        verticalAlign: "middle",
                        fontSize: 14,
                      }}
                    >
                      {totalQuantity}
                    </td>
                    <td
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "right",
                        fontWeight: 700,
                        background: "#dff0d8",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        fontSize: 14,
                      }}
                    >
                      {formatCurrency(totalUnitPriceSum)}
                    </td>
                    <td
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "right",
                        fontWeight: 700,
                        background: "#dff0d8",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        fontSize: 14,
                      }}
                    >
                      {formatCurrency(sale.totalDiscount)}
                    </td>
                    <td
                      className="grand-total-row"
                      style={{
                        border: "1px solid #222",
                        padding: 6,
                        textAlign: "right",
                        fontWeight: 700,
                        background: "#dff0d8",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                        fontSize: 14,
                      }}
                    >
                      {formatCurrency(sale.netTotal)}
                    </td>
                    {withBoxEchoBag && (
                      <td
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                        }}
                      />
                    )}
                  </tr>
                </tbody>
              </table>

              {/* Freebies table (placed above Terms of Payment) */}
              {Array.isArray(sale?.freebies) && sale.freebies.length > 0 && (
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Typography fontSize={15} sx={{ fontWeight: 700, mb: 1 }}>
                    Freebies
                  </Typography>

                  <table
                    className="table"
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      tableLayout: "fixed",
                      marginBottom: 8,
                    }}
                  >
                    {/* match column widths with main products table */}
                    <colgroup>
                      {/* match reduced description column and larger numeric columns */}
                      <col style={{ width: "35%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "19%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th
                          style={{
                            border: "1px solid #222",
                            padding: 6,
                            verticalAlign: "middle",
                            background: "#f39c12",
                            color: "#fff",
                            fontWeight: 700,
                            whiteSpace: "normal",
                          }}
                        >
                          PRODUCT
                        </th>
                        <th
                          style={{
                            border: "1px solid #222",
                            padding: 6,
                            verticalAlign: "middle",
                            textAlign: "center",
                            background: "#f39c12",
                            color: "#fff",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          QTY
                        </th>
                        <th
                          style={{
                            border: "1px solid #222",
                            padding: 6,
                            verticalAlign: "middle",
                            textAlign: "right",
                            background: "#f39c12",
                            color: "#fff",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          PRICE
                        </th>
                        <th
                          style={{
                            border: "1px solid #222",
                            padding: 6,
                            verticalAlign: "middle",
                            textAlign: "right",
                            background: "##FF0000",
                            color: "#fff",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          DISCOUNT
                        </th>
                        <th
                          style={{
                            border: "1px solid #222",
                            padding: 6,
                            verticalAlign: "middle",
                            textAlign: "right",
                            background: "#f39c12",
                            color: "#fff",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.freebies.map((f: any, i: number) => {
                        const qty = Number(f.qty ?? 0);
                        const unitPrice = Number(f.price ?? 0);
                        const discount = unitPrice * qty;
                        const total = 0; // freebies total is 0
                        return (
                          <tr key={`freebie-${i}`}>
                            <td
                              style={{
                                border: "1px solid #222",
                                padding: 6,
                                verticalAlign: "middle",
                              }}
                            >
                              {f.name || f.sku || "-"}
                            </td>
                            <td
                              style={{
                                border: "1px solid #222",
                                padding: 6,
                                textAlign: "center",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
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
                                whiteSpace: "nowrap",
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
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatCurrency(discount)}
                            </td>
                            <td
                              style={{
                                border: "1px solid #222",
                                padding: 6,
                                textAlign: "right",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              )}

              {/* Terms of Payment (top) */}
              <Box sx={{ mb: 1 }}>
                <Typography
                  className="terms-text"
                  fontWeight={500}
                  fontSize={14}
                  sx={{ mt: 2 }}
                >
                  TERMS OF PAYMENT: {sale.termsOfPayment || "-"}
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

              {/* signature / footer area */}
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
                  <Typography
                    fontSize={12}
                    sx={{ mt: 1, fontWeight: 700, textAlign: "center" }}
                  >
                    SIGNATURE
                  </Typography>
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
                  <Typography
                    fontSize={12}
                    sx={{ mt: 1, fontWeight: 700, textAlign: "center" }}
                  >
                    OVER PRINTED SIGNATURE
                  </Typography>
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
          <Tooltip title="Print Invoice">
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
              Print Invoice
            </Button>
          </Tooltip>

          <Tooltip title="Download Invoice">
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
              Download Invoice
            </Button>
          </Tooltip>

          <Tooltip title="Copy Invoice">
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
              Copy Invoice
            </Button>
          </Tooltip>
        </Stack>
      </DialogActions>

      <Dialog
        open={boxEchoModalOpen}
        onClose={() => setBoxEchoModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Box / Echo Bag per Product</DialogTitle>
        <DialogContent dividers>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 220 }}>Box</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 220 }}>Echo bag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(sale?.products) && sale.products.length > 0 ? (
                sale.products.map((p: any, idx: number) => {
                  const key = getProductKey(p, idx);
                  return (
                    <TableRow key={`box-echo-${key}`}>
                      <TableCell>{p.name || "-"}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={boxEchoDraft[key]?.box || ""}
                          onChange={(
                            e: React.ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement
                            >
                          ) =>
                            handleDraftChange(key, "box", e.target.value)
                          }
                          placeholder="Enter box"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={boxEchoDraft[key]?.echoBag || ""}
                          onChange={(
                            e: React.ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement
                            >
                          ) =>
                            handleDraftChange(key, "echoBag", e.target.value)
                          }
                          placeholder="Enter echo bag"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={3}>No products found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setBoxEchoModalOpen(false)}
            sx={{ minWidth: 140 }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={saveBoxEchoData}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default InvoiceModal;
