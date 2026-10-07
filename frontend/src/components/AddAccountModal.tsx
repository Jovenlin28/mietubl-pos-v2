import React, { useContext, useState, useEffect } from "react";
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

export interface AccountFormValues {
  name: string;
  status: "Active" | "Inactive";
}

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
  // called after successful save, receives saved account and whether it was edit
  onSubmit?: (saved: any, isEdit: boolean) => void;
  isEdit?: boolean;
  // may include id for editing
  initialValues?: (AccountFormValues & { id?: number }) | null;
  submitting?: boolean;
}

const validationSchema = Yup.object({
  name: Yup.string().required("Account name is required"),
  status: Yup.string().oneOf(["Active", "Inactive"]).required(),
});

const AddAccountModal: React.FC<AddAccountModalProps> = ({
  open,
  onClose,
  onSubmit,
  isEdit = false,
  initialValues,
  submitting = false,
}) => {
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext) as any;
  const [saving, setSaving] = useState(false);

  const formik = useFormik<AccountFormValues>({
    initialValues: initialValues || {
      name: "",
      status: "Active",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        let saved;
        const payload = {
          name: values.name.trim(),
          status: values.status,
        };
        if (isEdit && initialValues?.id) {
          await axiosInstance.put(`/accounts/${initialValues.id}`, payload);
          // fetch updated row
          const res = await axiosInstance.get(`/accounts/${initialValues.id}`);
          saved = res.data;
          showSuccess("Account updated successfully");
          // system log
          await axiosInstance.post("/system-logs", {
            module: "Accounts",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated an account`,
            createdBy: user?.fullName,
          });
        } else {
          const res = await axiosInstance.post("/accounts", payload);
          saved = res.data?.item || res.data;
          showSuccess("Account created successfully");
          await axiosInstance.post("/system-logs", {
            module: "Accounts",
            action: "Create",
            description: `${user.fullName} (${user.role}) created an account`,
            createdBy: user?.fullName,
          });
        }
        if (onSubmit) onSubmit(saved, !!isEdit);
        onClose();
      } catch (err: any) {
        showError(
          err?.response?.data?.error ||
            err?.message ||
            (isEdit ? "Failed to update account" : "Failed to create account")
        );
      } finally {
        setSaving(false);
      }
    },
  });

  // reset saving state when dialog closes
  useEffect(() => {
    if (!open) setSaving(false);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          minHeight: 56,
          pl: 3,
          pr: 1,
          pt: 2,
          pb: 2,
        }}
      >
        <Box flex={1}>{isEdit ? "Edit Account" : "Add Account"}</Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: "#e74c3c", ml: 2, alignSelf: "center" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          component="form"
          onSubmit={formik.handleSubmit}
          autoComplete="off"
          sx={{ mt: 2 }}
        >
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Account Name *"
              name="name"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
            />
            <TextField
              select
              fullWidth
              label="Status *"
              name="status"
              value={formik.values.status}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.status && Boolean(formik.errors.status)}
              helperText={formik.touched.status && formik.errors.status}
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

export default AddAccountModal;
