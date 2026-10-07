import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  TableContainer,
  Typography,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import axiosInstance from "../configs/axiosConfig";
import ViewAttachmentModal from "./ViewAttachmentModal";

interface Payment {
  id?: number;
  referenceNo?: string;
  purchaseOrderNumber?: string;
  amount?: number;
  paymentChannel?: string;
  description?: string;
  createdOn?: string;
  paymentDate?: string;
  attachment?: string;
}

interface ViewPaymentsModalProps {
  open: boolean;
  onClose: () => void;
  purchaseOrderNumber: string;
}

const ViewPaymentsModal: React.FC<ViewPaymentsModalProps> = ({ open, onClose, purchaseOrderNumber }) => {
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string | null>(null);
  const [viewAttachmentOpen, setViewAttachmentOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!purchaseOrderNumber) {
      setPayments([]);
      return;
    }

    const fetchPayments = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get<{ items: Payment[] }>(
          `/payments/po/${encodeURIComponent(purchaseOrderNumber)}`
        );
        setPayments(res.data.items || []);
      } catch (err) {
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [open, purchaseOrderNumber]);

  const handleOpenAttachment = (url?: string) => {
    if (!url) return;
    setViewAttachmentUrl(url);
    setViewAttachmentOpen(true);
  };

  const handleCloseAttachment = () => {
    setViewAttachmentOpen(false);
    setViewAttachmentUrl(null);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h6">Payments for PO: {purchaseOrderNumber}</Typography>
            <Typography variant="body2" color="text.secondary">
              Showing all payments linked to this PO
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Reference No</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Payment Date</TableCell>
                    <TableCell>Attachment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No payments found
                      </TableCell>
                    </TableRow>
                  )}
                  {payments.map((p) => (
                    <TableRow key={p.id || `${p.referenceNo}-${Math.random()}`}>
                      <TableCell>{p.referenceNo || "-"}</TableCell>
                      <TableCell>
                        {typeof p.amount === "number"
                          ? p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : p.amount || "-"}
                      </TableCell>
                      <TableCell>{p.paymentChannel || "-"}</TableCell>
                      <TableCell style={{ maxWidth: 300, whiteSpace: "normal", wordBreak: "break-word" }}>
                        {p.description || "-"}
                      </TableCell>
                      <TableCell>
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleString() : p.createdOn ? new Date(p.createdOn).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        {p.attachment ? (
                          <Tooltip title="View attachment">
                            <IconButton size="small" onClick={() => handleOpenAttachment(p.attachment)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      <ViewAttachmentModal
        open={viewAttachmentOpen}
        onClose={handleCloseAttachment}
        attachmentUrl={viewAttachmentUrl || ""}
      />
    </>
  );
};

export default ViewPaymentsModal;