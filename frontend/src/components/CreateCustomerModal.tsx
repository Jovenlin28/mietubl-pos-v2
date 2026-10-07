import React, { useContext } from "react";
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

import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import { COUNTRIES } from "../constants/countries.constant";
import axiosInstance from "../configs/axiosConfig";
import { Customer } from "../models/Customer";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialData?: Partial<Customer>; // customer object when editing
}

const validationSchema = Yup.object({
  fullName: Yup.string().required("Full name is required"),
  email: Yup.string().email("Invalid email").nullable(),
  phoneNumber: Yup.string().required("Phone number is required"),
  country: Yup.string().required("Country is required"),
  address: Yup.string().nullable(),
  storeName: Yup.string().required("Store name is required"),
  company: Yup.string().nullable(),
  tinNumber: Yup.string().nullable(),
  status: Yup.string()
    .oneOf(["Active", "Inactive"])
    .required("Status is required"),
});

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode: isEditProp,
  initialData,
}) => {
  const isEditMode =
    typeof isEditProp === "boolean" ? isEditProp : !!initialData;
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      fullName: initialData?.fullName ?? "",
      email: initialData?.email ?? null,
      phoneNumber: initialData?.phoneNumber ?? "",
      country: initialData?.country ?? "",
      address: initialData?.address ?? "",
      storeName: initialData?.storeName ?? "",
      company: initialData?.company ?? "",
      tinNumber: initialData?.tinNumber ?? null,
      status: initialData?.status ?? "Active",
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (isEditMode && initialData?.id) {
          await axiosInstance.put(`/customers/${initialData.id}`, values);
          axiosInstance.post(`/system-logs/`, {
            module: "Customers",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated a customer`,
            createdBy: user.fullName,
          });
          showSuccess("Customer updated successfully");
        } else {
          await axiosInstance.post("/customers", values);
          axiosInstance.post(`/system-logs/`, {
            module: "Customers",
            action: "Create",
            description: `${user.fullName} (${user.role}) created a customer`,
            createdBy: user.fullName,
          });
          showSuccess("Customer created successfully");
        }
        if (onSuccess) await onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        console.error("Save customer failed", err);
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save customer";
        showError(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ position: "absolute", top: 5, right: 5 }}>
        <IconButton onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </Box>
      <DialogTitle fontWeight={700} sx={{ pr: 6 }}>
        {isEditMode ? "Edit Customer" : "Add Customer"}
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
                error={
                  formik.touched.fullName && Boolean(formik.errors.fullName)
                }
                helperText={formik.touched.fullName && formik.errors.fullName}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                name="email"
                value={formik.values.email ?? ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.email && Boolean(formik.errors.email)}
                helperText={formik.touched.email && formik.errors.email}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={<>Phone Number{requiredMark}</>}
                name="phoneNumber"
                value={formik.values.phoneNumber}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.phoneNumber &&
                  Boolean(formik.errors.phoneNumber)
                }
                helperText={
                  formik.touched.phoneNumber && formik.errors.phoneNumber
                }
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label={<>Country{requiredMark}</>}
                name="country"
                value={formik.values.country}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.country && Boolean(formik.errors.country)}
                helperText={formik.touched.country && formik.errors.country}
                fullWidth
              >
                {COUNTRIES.map((country) => (
                  <MenuItem key={country.value} value={country.name}>
                    {country.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={<>Store Name{requiredMark}</>}
                name="storeName"
                value={formik.values.storeName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.storeName && Boolean(formik.errors.storeName)
                }
                helperText={formik.touched.storeName && formik.errors.storeName}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={<>Address</>}
                name="address"
                value={formik.values.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.address && Boolean(formik.errors.address)}
                helperText={formik.touched.address && formik.errors.address}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Company"
                name="company"
                value={formik.values.company}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.company && Boolean(formik.errors.company)}
                helperText={formik.touched.company && formik.errors.company}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="TIN Number"
                name="tinNumber"
                value={formik.values.tinNumber ?? ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.tinNumber && Boolean(formik.errors.tinNumber)
                }
                helperText={formik.touched.tinNumber && formik.errors.tinNumber}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
                    {isEditMode ? "Save Changes" : "Add Customer"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Customer"
                )
              }
            ></PrimaryButton>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateCustomerModal;
