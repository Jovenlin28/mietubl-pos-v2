import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  IconButton,
  Button,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useNotification } from "../hooks/useNotification";
import axiosInstance from "../configs/axiosConfig";
import CancelButton from "../shared/buttons/CancelButton";

interface BudgetValues {
  category_id: string;
  amount: string;
  period_start: string;
  period_end: string;
  notes: string;
}

interface AddExpenseBudgetModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialValues?: {
    id?: number | null;
    category_id?: number | null;
    amount?: number | null;
    period_start?: string | null;
    period_end?: string | null;
    notes?: string | null;
  } | null;
}

const validationSchema = Yup.object({
  category_id: Yup.string().required("Category is required"),
  amount: Yup.number().required("Amount is required").min(0, "Amount must be >= 0"),
  period_start: Yup.string().required("Period start is required"),
  period_end: Yup.string().required("Period end is required"),
});

const AddExpenseBudgetModal: React.FC<AddExpenseBudgetModalProps> = ({
  open,
  onClose,
  onSaved,
  initialValues,
}) => {
  const { showSuccess, showError } = useNotification();
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // helper: normalize various date formats to YYYY-MM-DD for <input type="date">
  // use local date components (avoid toISOString which converts to UTC and can shift the day)
  const formatToInputDate = (v?: string | null) => {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (!open) return;
    const fetchCats = async () => {
      setLoadingCats(true);
      try {
        const res = await axiosInstance.get("/expense-categories/all");
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setCategories([]);
      } finally {
        setLoadingCats(false);
      }
    };
    fetchCats();
  }, [open]);

  const formik = useFormik<BudgetValues>({
    initialValues: {
      category_id: initialValues?.category_id ? String(initialValues.category_id) : "",
      amount: initialValues?.amount ? String(initialValues.amount) : "",
      // normalize server-provided dates into YYYY-MM-DD so <input type="date"> shows them
      period_start: formatToInputDate(initialValues?.period_start ?? null),
      period_end: formatToInputDate(initialValues?.period_end ?? null),
      notes: initialValues?.notes || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setSubmitting(true);
      try {
        const payload = {
          category_id: Number(values.category_id),
          amount: Number(values.amount),
          period_start: values.period_start,
          period_end: values.period_end,
          notes: values.notes || null,
        };
        if (initialValues?.id) {
          await axiosInstance.put(`/expense-category-budgets/${initialValues.id}`, payload);
          showSuccess("Budget updated");
        } else {
          await axiosInstance.post("/expense-category-budgets", payload);
          showSuccess("Budget created");
        }
        if (onSaved) onSaved();
        onClose();
      } catch (err: any) {
        console.error("Budget save failed", err, err?.response?.data);
        showError(err?.response?.data?.error || err?.message || "Failed to save budget");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          pl: 3,
          pr: 1,
        }}
      >
        <Box flex={1}>{initialValues?.id ? "Edit Budget" : "New Budget"}</Box>
        <IconButton aria-label="close" onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box component="form" onSubmit={formik.handleSubmit} sx={{ mt: 1 }}>
          <TextField
            select
            fullWidth
            name="category_id"
            value={formik.values.category_id}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            SelectProps={{ native: true }}
            error={Boolean(formik.touched.category_id && formik.errors.category_id)}
            helperText={formik.touched.category_id && (formik.errors.category_id as any)}
            sx={{ mb: 2 }}
            disabled={loadingCats}
          >
            <option value="">{loadingCats ? "Loading..." : "Select category"}</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </TextField>

          <TextField
            label="Amount"
            type="number"
            fullWidth
            name="amount"
            value={formik.values.amount}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={Boolean(formik.touched.amount && formik.errors.amount)}
            helperText={formik.touched.amount && (formik.errors.amount as any)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Period start"
            type="date"
            fullWidth
            name="period_start"
            value={formik.values.period_start}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            InputLabelProps={{ shrink: true }}
            error={Boolean(formik.touched.period_start && formik.errors.period_start)}
            helperText={formik.touched.period_start && (formik.errors.period_start as any)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Period end"
            type="date"
            fullWidth
            name="period_end"
            value={formik.values.period_end}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            InputLabelProps={{ shrink: true }}
            error={Boolean(formik.touched.period_end && formik.errors.period_end)}
            helperText={formik.touched.period_end && (formik.errors.period_end as any)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Notes"
            fullWidth
            multiline
            rows={3}
            name="notes"
            value={formik.values.notes}
            onChange={formik.handleChange}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 0, pb: 2, pt: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", px: 2 }}>
          <CancelButton onClick={onClose} />

          <Button
            onClick={() => formik.submitForm()}
            variant="contained"
            sx={{ bgcolor: "#f39c12", color: "#fff", fontWeight: 700 }}
            disabled={formik.isSubmitting}
          >
            {formik.isSubmitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Save Budget"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AddExpenseBudgetModal;