import React, { useContext, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  IconButton,
  MenuItem,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

export interface CreditCardTransactionsAccountFormValues {
  store: string;
  status: "Active" | "Inactive";
}

export interface AddCreditCardTransactionsAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (saved: any, isEdit: boolean) => void;
  isEdit?: boolean;
  initialValues?: (CreditCardTransactionsAccountFormValues & { id?: number }) | null;
  submitting?: boolean;
}

const validationSchema = Yup.object({
  store: Yup.string().required("Store is required"),
  status: Yup.string().oneOf(["Active", "Inactive"]).required(),
});

const AddCreditCardTransactionsAccountModal: React.FC<AddCreditCardTransactionsAccountModalProps> = ({
  open,
  onClose,
  onSubmit,
  isEdit = false,
  initialValues,
  submitting = false,
}) => {
  const { showError, showSuccess } = useNotification();
  const user = useContext(UserContext) as any;
  const [saving, setSaving] = useState(false);

  const formik = useFormik<CreditCardTransactionsAccountFormValues>({
    initialValues: initialValues || { store: "", status: "Active" },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        const payload = {
          store: (values.store || "").trim(),
          status: values.status,
        };

        let saved;
        if (isEdit && initialValues?.id) {
          await axiosInstance.put(`/credit-card-transactions-accounts/${initialValues.id}`, payload);
          const res = await axiosInstance.get(`/credit-card-transactions-accounts/${initialValues.id}`);
          saved = res.data;
          showSuccess("Account updated");
          try {
            await axiosInstance.post("/system-logs", {
              module: "Credit Card Transactions Accounts",
              action: "Update",
              description: `${user?.fullName || "User"} updated credit card transaction account: ${payload.store}`,
              createdBy: user?.fullName || user?.username || "system",
            });
          } catch {}
        } else {
          const res = await axiosInstance.post("/credit-card-transactions-accounts", payload);
          saved = res.data?.item || res.data;
          showSuccess("Account created");
          try {
            await axiosInstance.post("/system-logs", {
              module: "Credit Card Transactions Accounts",
              action: "Create",
              description: `${user?.fullName || "User"} created credit card transaction account: ${payload.store}`,
              createdBy: user?.fullName || user?.username || "system",
            });
          } catch {}
        }

        onSubmit?.(saved, !!isEdit);
        onClose();
      } catch (err: any) {
        showError(err?.response?.data?.error || err?.message || "Failed to save account");
      } finally {
        setSaving(false);
      }
    },
  });

  useEffect(() => { if (!open) setSaving(false); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", pl: 3, pr: 1 }}>
        <Box flex={1}>{isEdit ? "Edit Credit Card Transaction Account" : "Add Credit Card Transaction Account"}</Box>
        <IconButton aria-label="close" onClick={onClose} sx={{ color: "#e74c3c" }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box component="form" onSubmit={formik.handleSubmit} autoComplete="off" sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <TextField fullWidth label="Store *" name="store" value={formik.values.store} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.touched.store && Boolean(formik.errors.store)} helperText={formik.touched.store && formik.errors.store} />
            <TextField select fullWidth label="Status *" name="status" value={formik.values.status} onChange={formik.handleChange}>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Stack>

          <DialogActions sx={{ px: 0, pb: 0, pt: 3 }}>
            <Button onClick={onClose} variant="contained" sx={{ bgcolor: "#0a2239", color: "#fff", fontWeight: 700, px: 4, boxShadow: 0, "&:hover": { bgcolor: "#173f5f" } }} disabled={saving}>CANCEL</Button>
            <Button type="submit" variant="contained" sx={{ bgcolor: "#f39c12", color: "#fff", fontWeight: 700, px: 4, boxShadow: 0, "&:hover": { bgcolor: "#e67e22" } }} disabled={saving || submitting || formik.isSubmitting}>
              {isEdit ? "UPDATE ACCOUNT" : "ADD ACCOUNT"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AddCreditCardTransactionsAccountModal;