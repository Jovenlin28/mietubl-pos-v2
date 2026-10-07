import React, { useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  IconButton,
  Grid,
  CircularProgress,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import axiosInstance from "../configs/axiosConfig";
import { UserContext } from "../layouts/DashboardLayout";

interface AddExpenseCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialData?: { id?: number; name?: string; description?: string };
}

const validationSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  description: Yup.string().nullable(),
});

const AddExpenseCategoryModal: React.FC<AddExpenseCategoryModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode = false,
  initialData,
}) => {
  const user = useContext(UserContext);
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (isEditMode && initialData?.id) {
          await axiosInstance.put(
            `/expense-categories/${initialData.id}`,
            values
          );
          axiosInstance.post(`/system-logs/`, {
            module: "Expense Categories",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated an expense category`,
            createdBy: user.fullName,
          });
        } else {
          await axiosInstance.post("/expense-categories", values);
          axiosInstance.post(`/system-logs/`, {
            module: "Expense Categories",
            action: "Create",
            description: `${user.fullName} (${user.role}) created an expense category`,
            createdBy: user.fullName,
          });
        }
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err) {
        // Optionally handle error
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ position: "absolute", top: 8, right: 8 }}>
        <IconButton onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon fontSize="medium" />
        </IconButton>
      </Box>

      <DialogTitle fontWeight={700} sx={{ pr: 6 }}>
        {isEditMode ? "Edit Expense Category" : "Add Expense Category"}
      </DialogTitle>

      <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Name"
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
                label="Description"
                name="description"
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <CancelButton onClick={onClose} />
            <PrimaryButton
              type="submit"
              disabled={formik.isSubmitting}
              textBtn={
                formik.isSubmitting ? (
                  <>
                    <CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />
                    {isEditMode ? "Saving..." : "Adding..."}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Expense Category"
                )
              }
            />
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddExpenseCategoryModal;
