import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MenuItem from "@mui/material/MenuItem";
import { useFormik } from "formik";
import * as Yup from "yup";

export interface StoreFormValues {
  name: string;
  address: string;
  phoneNumber?: string;
  status: "Active" | "Inactive";
}

interface AddStoreModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: StoreFormValues) => void;
  isEdit?: boolean;
  initialValues?: StoreFormValues;
  submitting?: boolean;
}

const validationSchema = Yup.object({
  name: Yup.string().required("Store name is required"),
  address: Yup.string().required("Address is required"),
  phoneNumber: Yup.string(),
  status: Yup.string().oneOf(["Active", "Inactive"]),
});

const AddStoreModal: React.FC<AddStoreModalProps> = ({
  open,
  onClose,
  onSubmit,
  isEdit,
  initialValues,
  submitting = false,
}) => {
  const formik = useFormik<StoreFormValues>({
    initialValues: initialValues || {
      name: "",
      address: "",
      phoneNumber: "",
      status: "Active",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: (values) => {
      onSubmit(values);
    },
  });

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
        <Box flex={1}>{isEdit ? "Edit Store" : "Add Store"}</Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
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
            label="Store Name *"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && Boolean(formik.errors.name)}
            helperText={formik.touched.name && formik.errors.name}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Address *"
            name="address"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.address && Boolean(formik.errors.address)}
            helperText={formik.touched.address && formik.errors.address}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Phone Number"
            name="phoneNumber"
            value={formik.values.phoneNumber}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.phoneNumber && Boolean(formik.errors.phoneNumber)}
            helperText={formik.touched.phoneNumber && formik.errors.phoneNumber}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            fullWidth
            label="Status"
            name="status"
            value={formik.values.status}
            onChange={formik.handleChange}
            sx={{ mb: 2 }}
          >
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Inactive">Inactive</MenuItem>
          </TextField>
          <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
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
              {isEdit ? "UPDATE STORE" : "ADD STORE"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AddStoreModal;