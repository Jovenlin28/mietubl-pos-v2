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

export interface RoyaltyFeeAccountFormValues {
  mall: string;
  store: string;
  partner: string;
  status: "Active" | "Inactive";
}

export interface AddFinancialRoyaltyFeesAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (saved: any, isEdit: boolean) => void;
  isEdit?: boolean;
  initialValues?: (RoyaltyFeeAccountFormValues & { id?: number }) | null;
  submitting?: boolean;
}

const validationSchema = Yup.object({
  mall: Yup.string().required("Mall is required"),
  store: Yup.string().required("Store is required"),
  partner: Yup.string().nullable(),
  status: Yup.string().oneOf(["Active", "Inactive"]).required(),
});

const AddFinancialRoyaltyFeesAccountModal: React.FC<AddFinancialRoyaltyFeesAccountModalProps> = ({
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

  const formik = useFormik<RoyaltyFeeAccountFormValues>({
    initialValues: initialValues || { mall: "", store: "", partner: "", status: "Active" },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        const payload = {
          mall: (values.mall || "").trim(),
          store: (values.store || "").trim(),
          partner: (values.partner || "").trim() || null,
          status: values.status,
        };

        let saved;
        if (isEdit && initialValues?.id) {
          await axiosInstance.put(`/royalty-fees-accounts/${initialValues.id}`, payload);
          const res = await axiosInstance.get(`/royalty-fees-accounts/${initialValues.id}`);
          saved = res.data;
          showSuccess("Account updated");
          try {
            await axiosInstance.post("/system-logs", {
              module: "Royalty Fees Accounts",
              action: "Update",
              description: `${user?.fullName || "User"} updated royalty fee account: ${payload.mall} / ${payload.store}`,
              createdBy: user?.fullName || user?.username || "system",
            });
          } catch {}
        } else {
          const res = await axiosInstance.post("/royalty-fees-accounts", payload);
          saved = res.data?.item || res.data;
          showSuccess("Account created");
          try {
            await axiosInstance.post("/system-logs", {
              module: "Royalty Fees Accounts",
              action: "Create",
              description: `${user?.fullName || "User"} created royalty fee account: ${payload.mall} / ${payload.store}`,
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

  useEffect(() => {
    if (!open) setSaving(false);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", pl: 3, pr: 1 }}>
        <Box flex={1}>{isEdit ? "Edit Royalty Fee Account" : "Add Royalty Fee Account"}</Box>
        <IconButton aria-label="close" onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box component="form" onSubmit={formik.handleSubmit} autoComplete="off" sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Mall *"
              name="mall"
              value={formik.values.mall}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.mall && Boolean(formik.errors.mall)}
              helperText={formik.touched.mall && formik.errors.mall}
            />
            <TextField
              fullWidth
              label="Store *"
              name="store"
              value={formik.values.store}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.store && Boolean(formik.errors.store)}
              helperText={formik.touched.store && formik.errors.store}
            />
            <TextField
              fullWidth
              label="Partner"
              name="partner"
              value={formik.values.partner}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            <TextField
              select
              fullWidth
              label="Status *"
              name="status"
              value={formik.values.status}
              onChange={formik.handleChange}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Stack>

          <DialogActions sx={{ px: 0, pb: 0, pt: 3 }}>
            <Button
              onClick={onClose}
              variant="contained"
              sx={{
                bgcolor: "#0a2239",
                color: "#fff",
                fontWeight: 700,
                px: 4,
                boxShadow: 0,
                "&:hover": { bgcolor: "#173f5f" },
              }}
              disabled={saving}
            >
              CANCEL
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                bgcolor: "#f39c12",
                color: "#fff",
                fontWeight: 700,
                px: 4,
                boxShadow: 0,
                "&:hover": { bgcolor: "#e67e22" },
              }}
              disabled={saving || submitting || formik.isSubmitting}
            >
              {isEdit ? "UPDATE ACCOUNT" : "ADD ACCOUNT"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AddFinancialRoyaltyFeesAccountModal;