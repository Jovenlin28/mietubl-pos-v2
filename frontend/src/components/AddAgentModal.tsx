import React, { useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  IconButton,
  Stack,
  CircularProgress,
  Grid,
  MenuItem,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

interface AddAgentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: Partial<any>;
}

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

function getValidationSchema() {
  return Yup.object({
    fullName: Yup.string().required("Full name is required"),
    phone: Yup.string().nullable(),
    status: Yup.string().oneOf(["Active", "Inactive"]).required("Status is required"),
  });
}

const AddAgentModal: React.FC<AddAgentModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode = false,
  initialValues,
}) => {
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  const formik = useFormik<Partial<any>>({
    initialValues: {
      fullName: initialValues?.fullName || "",
      phone: initialValues?.phone || "",
      status: initialValues?.status || "Active",
    },
    validationSchema: getValidationSchema(),
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(`/agents/${initialValues.id}`, values);
          axiosInstance.post(`/system-logs/`, {
            module: "Agents",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated an agent`,
            createdBy: user.fullName,
          });
          showSuccess("Agent updated successfully");
        } else {
          await axiosInstance.post(`/agents`, values);
          axiosInstance.post(`/system-logs/`, {
            module: "Agents",
            action: "Create",
            description: `${user.fullName} (${user.role}) created an agent`,
            createdBy: user.fullName,
          });
          showSuccess("Agent created successfully");
        }
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || "Failed to save agent";
        showError(msg);
      }
      setSubmitting(false);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ position: "absolute", top: 5, right: 5 }}>
        <IconButton onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </Box>
      <DialogTitle fontWeight={700} sx={{ pr: 6 }}>
        {isEditMode ? "Edit Agent" : "Add Agent"}
      </DialogTitle>
      <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={<>Full Name{requiredMark}</>}
                name="fullName"
                value={formik.values.fullName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.fullName && Boolean(formik.errors.fullName)}
                helperText={
                  (formik.touched.fullName && formik.errors.fullName)
                    ? String(formik.errors.fullName)
                    : undefined
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                name="phone"
                value={formik.values.phone}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.phone && Boolean(formik.errors.phone)}
                helperText={
                  (formik.touched.phone && formik.errors.phone)
                    ? String(formik.errors.phone)
                    : undefined
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label={<>Status{requiredMark}</>}
                name="status"
                value={formik.values.status}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.status && Boolean(formik.errors.status)}
                helperText={
                  (formik.touched.status && formik.errors.status)
                    ? String(formik.errors.status)
                    : undefined
                }
                fullWidth
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Stack direction="row" spacing={2} width="100%" justifyContent="space-between">
            <CancelButton onClick={onClose} />
            <PrimaryButton
              type="submit"
              disabled={formik.isSubmitting}
              textBtn={
                formik.isSubmitting ? (
                  <>
                    <CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />
                    {isEditMode ? "Save Changes" : "Add Agent"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Agent"
                )
              }
            />
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddAgentModal;
