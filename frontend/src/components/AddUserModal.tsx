import React, { useContext, useEffect, useState } from "react";
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
import { User } from "../models/User";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: Partial<User>;
}

function getValidationSchema(isEditMode: boolean) {
  return Yup.object({
    fullName: Yup.string().required("Full name is required"),
    username: Yup.string().required("Username is required"),
    phone: Yup.string().nullable(),
    ...(isEditMode
      ? {}
      : {
          password: Yup.string().required("Password is required"),
        }),
    role: Yup.string().required("Role is required"),
    status: Yup.string()
      .oneOf(["Active", "Inactive"])
      .required("Status is required"),
  });
}

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

const AddUserModal: React.FC<AddUserModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode = false,
  initialValues,
}) => {
  const [roleOptions, setRoleOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  useEffect(() => {
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const res = await axiosInstance.get("/roles");
        const items = res.data.items || [];
        setRoleOptions(
          items.map((role: any) => ({
            value: role.name,
            label: role.name,
          }))
        );
      } catch {
        setRoleOptions([]);
      }
      setRolesLoading(false);
    };
    fetchRoles();
  }, []);

  const formik = useFormik<Partial<User>>({
    initialValues: {
      fullName: initialValues?.fullName || "",
      username: initialValues?.username || "",
      phone: initialValues?.phone || "",
      password: "",
      role: initialValues?.role || "",
      status: initialValues?.status || "Active",
    },
    validationSchema: getValidationSchema(isEditMode),
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(`/users/${initialValues.id}`, {
            ...values,
            password: values.password ? values.password : undefined,
          });
          axiosInstance.post(`/system-logs/`, {
            module: "Users",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated a user`,
            createdBy: user.fullName,
          });
          showSuccess("User updated successfully");
        } else {
          await axiosInstance.post("/users", values);
          axiosInstance.post(`/system-logs/`, {
            module: "Users",
            action: "Create",
            description: `${user.fullName} (${user.role}) created a user`,
            createdBy: user.fullName,
          });
          showSuccess("User created successfully");
        }
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        const msg =
          err?.response?.data?.error || err?.message || "Failed to save user";
        showError(msg);
      }
      setSubmitting(false);
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
        {isEditMode ? "Edit User" : "Add User"}
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
                label={<>Username{requiredMark}</>}
                name="username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.username && Boolean(formik.errors.username)
                }
                helperText={formik.touched.username && formik.errors.username}
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
                helperText={formik.touched.phone && formik.errors.phone}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label={<>Role{requiredMark}</>}
                name="role"
                value={formik.values.role}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.role && Boolean(formik.errors.role)}
                helperText={formik.touched.role && formik.errors.role}
                fullWidth
                disabled={rolesLoading}
              >
                {roleOptions.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {!isEditMode && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label={<>Password{requiredMark}</>}
                  name="password"
                  type="password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.password && Boolean(formik.errors.password)
                  }
                  helperText={formik.touched.password && formik.errors.password}
                  fullWidth
                />
              </Grid>
            )}
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
                    {isEditMode ? "Save Changes" : "Add User"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add User"
                )
              }
            />
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddUserModal;
