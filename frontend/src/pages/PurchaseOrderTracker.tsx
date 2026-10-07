import React, { useEffect, useState } from "react";
import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../configs/axiosConfig";

type PublicPurchaseOrderDetail = {
  id?: number;
  ticket_code?: string;
  status?: string;
  createdAt?: string;
};

const normalizeStatus = (status?: string) =>
  String(status || "submitted").trim().toLowerCase();

const getStatusMessage = (status?: string) => {
  const normalized = normalizeStatus(status);

  if (normalized === "submitted") {
    return {
      label: "Submitted",
      text: "Your order has been submitted for checking.",
      bg: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (normalized === "converted") {
    return {
      label: "Processed",
      text: "Your order is now being processed.",
      bg: "#dcfce7",
      color: "#166534",
    };
  }

  if (normalized === "processing") {
    return {
      label: "Processing",
      text: "Your order is currently being processed.",
      bg: "#fef3c7",
      color: "#92400e",
    };
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return {
      label: "Cancelled",
      text: "This order was cancelled. Please contact support for help.",
      bg: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    label: status || "Unknown",
    text: "Your order status is being updated.",
    bg: "#e5e7eb",
    color: "#374151",
  };
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const PurchaseOrderTracker: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [ticketCodeInput, setTicketCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<PublicPurchaseOrderDetail | null>(null);

  useEffect(() => {
    const ticketCode = searchParams.get("ticketCode")?.trim() || "";
    if (ticketCode) {
      setTicketCodeInput(ticketCode);
    }
  }, [searchParams]);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const ticketCode = ticketCodeInput.trim();
    if (!ticketCode) {
      setErrorMessage("Please enter your ticket code.");
      setResult(null);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const res = await axiosInstance.get(
        `/public/purchase-orders/${encodeURIComponent(ticketCode)}`
      );
      setResult(res.data || null);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setErrorMessage("Ticket code not found. Please check and try again.");
      } else {
        setErrorMessage(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to fetch purchase order status"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const statusUI = getStatusMessage(result?.status);

  return (
    <Box
      sx={{
        minHeight: "100%",
        p: { xs: 2, sm: 4 },
        background:
          "radial-gradient(circle at 20% 20%, #fef9c3 0, transparent 35%), radial-gradient(circle at 80% 10%, #bfdbfe 0, transparent 30%), #f8fafc",
      }}
    >
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <Box
          component="img"
          src="/mietubl-logo.png"
          alt="Mietubl Philippines"
          sx={{
            width: { xs: 150, sm: 280 },
            maxWidth: "100%",
            height: "auto",
          }}
        />
      </Box>

      <Paper
        elevation={2}
        sx={{
          maxWidth: 900,
          mx: "auto",
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Purchase Order Tracker
        </Typography>
        <Typography color="text.secondary" mb={3}>
          Enter your ticket code to check the latest status of your purchase order.
        </Typography>

        <form onSubmit={handleTrack} autoComplete="off">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "stretch" }}
          >
            <TextField
              fullWidth
              label="Ticket Code"
              placeholder="Example: PPO-20260828-ZX3CW"
              value={ticketCodeInput}
              onChange={(e) => setTicketCodeInput(e.target.value)}
              error={!!errorMessage}
              helperText={errorMessage || " "}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<SearchIcon />}
              sx={{
                bgcolor: "#ea580c",
                color: "#fff",
                height: 56,
                minWidth: { xs: "100%", sm: 150 },
                textTransform: "none",
                fontWeight: 700,
                "&:hover": { bgcolor: "#c2410c" },
              }}
            >
              Track
            </Button>
          </Stack>
        </form>

        {result && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1.5}
            >
              <Typography fontWeight={700}>Ticket: {result.ticket_code || "-"}</Typography>
              <Chip
                label={statusUI.label}
                sx={{ bgcolor: statusUI.bg, color: statusUI.color, fontWeight: 700 }}
              />
            </Stack>

            <Typography sx={{ mt: 1.5 }} color={statusUI.color} fontWeight={600}>
              {statusUI.text}
            </Typography>

            <Box sx={{ mt: 2 }}>
              {/* <Typography variant="body2" color="text.secondary">
                PO Date: {formatDate(result.sale_date)}
              </Typography> */}
              <Typography variant="body2" color="text.secondary">
                Created On: {formatDate(result.createdAt)}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default PurchaseOrderTracker;
