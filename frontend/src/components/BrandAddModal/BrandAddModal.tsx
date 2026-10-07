import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  IconButton,
  Stack,
  CircularProgress,
  Switch,
  Typography,
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Brand } from "../../models/Brand";
import axiosInstance from "../../configs/axiosConfig";
import { useNotification } from "../../hooks/useNotification";

interface BrandAddModalProps {
  open: boolean;
  onClose: (isSuccess?: boolean) => void;
  editBrand?: Partial<Brand>;
  isEdit?: boolean;
}

export interface BrandFormValues {
  name: string;
  status: string;
}

const validationSchema = Yup.object({
  name: Yup.string().required("Brand name is required"),
  status: Yup.string().required(),
});

const BrandAddModal: React.FC<BrandAddModalProps> = ({
  open,
  onClose,
  editBrand,
  isEdit = false,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useNotification();
  const formik = useFormik<Partial<Brand>>({
    initialValues: editBrand || {
      name: "",
      status: "Active",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: (values) => {
      handleAddEditBrand(values);
    },
  });

  const handleAddEditBrand = async (brand: Partial<Brand>) => {
      setSubmitting(true);
      try {
        if (isEdit && brand.id) {
          await axiosInstance.put(`/brands/${brand.id}`, brand);
          showSuccess("Brand updated successfully");
        } else {
          await axiosInstance.post(`/brands`, brand);
          showSuccess("Brand created successfully");
        }
        onClose(true);
      } catch (error: any) {
        console.error("Error saving brand:", error);
        const msg = error?.response?.data?.error || error?.message || "Failed to save brand";
        showError(msg);
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <Dialog open={open} onClose={() => onClose()} maxWidth="xs" fullWidth>
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
        <Box flex={1}>{isEdit ? "Edit Brand" : "Add Brand"}</Box>
        <IconButton
          aria-label="close"
          onClick={() => onClose()}
          sx={{
            color: "#e74c3c",
            ml: 2,
            alignSelf: "center",
          }}
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
          <TextField
            fullWidth
            label="Brand Name *"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && Boolean(formik.errors.name)}
            helperText={formik.touched.name && formik.errors.name}
            sx={{ mb: 2 }}
          />
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
          <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
            <Button
              onClick={() => onClose()}
              variant="contained"
              sx={{
                bgcolor: "#0a2239",
                color: "#fff",
                fontWeight: 700,
                px: 4,
                boxShadow: 0,
                "&:hover": { bgcolor: "#173f5f" },
              }}
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
              disabled={submitting || formik.isSubmitting}
            >
              {submitting || formik.isSubmitting ? (
                <CircularProgress size={24} sx={{ color: "#fff" }} />
              ) : isEdit ? "UPDATE BRAND" : "ADD BRAND"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default BrandAddModal;
