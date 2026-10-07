import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  MenuItem,
  IconButton,
  Stack,
  CircularProgress,
  Grid,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import axiosInstance from "../configs/axiosConfig";

interface AddRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: {
    id?: number;
    name?: string;
    status?: string;
  };
}

const validationSchema = Yup.object({
  name: Yup.string().required("Role name is required"),
  status: Yup.string().oneOf(["Active", "Inactive"]).required("Status is required"),
});

const AddRoleModal: React.FC<AddRoleModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode = false,
  initialValues,
}) => {
  const formik = useFormik({
    initialValues: {
      name: initialValues?.name || "",
      status: initialValues?.status || "Active",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(`/roles/${initialValues.id}`, values);
        } else {
          await axiosInstance.post("/roles", values);
        }
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err) {
        // Optionally handle error
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
        {isEditMode ? "Edit Role" : "Add Role"}
      </DialogTitle>
      <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Role Name"
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Status"
                name="status"
                value={formik.values.status}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.status && Boolean(formik.errors.status)}
                helperText={formik.touched.status && formik.errors.status}
                fullWidth
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Stack
            direction="row"
            spacing={2}
            width="100%"
            justifyContent="space-between"
          >
            <CancelButton onClick={onClose} />
            <PrimaryButton
              type="submit"
              disabled={formik.isSubmitting}
              textBtn={
                formik.isSubmitting ? (
                  <>
                    <CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />
                    {isEditMode ? "Save Changes" : "Add Role"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Role"
                )
              }
            />
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddRoleModal;