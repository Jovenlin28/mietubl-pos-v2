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
  Switch,
  Stack,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";

interface AddWarehouseModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: WarehouseFormValues) => void;
  initialValues?: WarehouseFormValues;
  isEdit?: boolean;
  submitting?: boolean;
}

export interface WarehouseFormValues {
  name: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  address: string;
  status: boolean;
}

const validationSchema = Yup.object({
  name: Yup.string().required("Warehouse name is required"),
  address: Yup.string().required("Address is required"),
  status: Yup.boolean().required(),
  contactPerson: Yup.string(),
  contactEmail: Yup.string().email("Invalid email"),
  contactPhone: Yup.string(),
});

const AddWarehouseModal: React.FC<AddWarehouseModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialValues,
  isEdit = false,
  submitting = false,
}) => {
  const formik = useFormik<WarehouseFormValues>({
    initialValues: initialValues || {
      name: "",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      status: true,
    },
    validationSchema,
    enableReinitialize: true,
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
        <Box flex={1}>{isEdit ? "Edit Warehouse" : "Add Warehouse"}</Box>
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
            label="Warehouse Name *"
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
            label="Contact Person"
            name="contactPerson"
            value={formik.values.contactPerson}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Contact Email"
            name="contactEmail"
            value={formik.values.contactEmail}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.contactEmail && Boolean(formik.errors.contactEmail)}
            helperText={formik.touched.contactEmail && formik.errors.contactEmail}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Contact Phone"
            name="contactPhone"
            value={formik.values.contactPhone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
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
          <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
            <Switch
              checked={formik.values.status}
              onChange={(e) =>
                formik.setFieldValue("status", e.target.checked)
              }
              color="primary"
            />
            <Typography sx={{ ml: 1 }}>
              Status
              <Typography
                component="span"
                sx={{
                  ml: 1,
                  color: formik.values.status ? "#229954" : "#b7950b",
                  fontWeight: 700,
                }}
              >
                {formik.values.status ? "Active" : "Inactive"}
              </Typography>
            </Typography>
          </Stack>
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
              {submitting || formik.isSubmitting ? (
                <CircularProgress size={24} sx={{ color: "#fff" }} />
              ) : isEdit ? "UPDATE WAREHOUSE" : "ADD WAREHOUSE"}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AddWarehouseModal;