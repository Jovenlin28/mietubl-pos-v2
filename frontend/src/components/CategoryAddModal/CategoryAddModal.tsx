import React, { useState, useEffect, useContext } from "react";
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
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Category } from "../../models/Category";
import axiosInstance from "../../configs/axiosConfig";
import { useNotification } from "../../hooks/useNotification";
import { UserContext } from "../../layouts/DashboardLayout";

interface CategoryAddModalProps {
  open: boolean;
  onClose: (isSuccess?: boolean) => void;
  editCategory?: Partial<Category>;
  isEdit?: boolean;
}

export interface CategoryFormValues {
  name: string;
  categorySlug: string;
  status: boolean;
}

const validationSchema = Yup.object({
  name: Yup.string().required("Category name is required"),
  categorySlug: Yup.string().required("Category slug is required"),
  status: Yup.string().required(),
});

const CategoryAddModal: React.FC<CategoryAddModalProps> = ({
  open,
  onClose,
  editCategory,
  isEdit = false,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);
  const formik = useFormik<Partial<Category>>({
    initialValues: editCategory || {
      name: "",
      categorySlug: "",
      status: "Active",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: (values) => {
      handleAddEditCategory(values);
    },
  });

  const handleAddEditCategory = async (category: Partial<Category>) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        // Update existing category
        await axiosInstance.put(`/categories/${category.id}`, category);
        axiosInstance.post(`/system-logs/`, {
          module: "Categories",
          action: "Update",
          description: `${user.fullName} (${user.role}) updated a category`,
          createdBy: user.fullName,
        });
        showSuccess("Category updated successfully");
      } else {
        // Add new category
        await axiosInstance.post(`/categories`, category);
        axiosInstance.post(`/system-logs/`, {
          module: "Categories",
          action: "Create",
          description: `${user.fullName} (${user.role}) created a category`,
          createdBy: user.fullName,
        });
        showSuccess("Category created successfully");
      }
      onClose(true);
    } catch (error: any) {
      console.error("Error saving category:", error);
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save category";
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
        <Box flex={1}>{isEdit ? "Edit Category" : "Add Category"}</Box>
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
            label="Category *"
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
            label="Category Slug *"
            name="categorySlug"
            value={formik.values.categorySlug}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={
              formik.touched.categorySlug && Boolean(formik.errors.categorySlug)
            }
            helperText={
              formik.touched.categorySlug && formik.errors.categorySlug
            }
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
              disabled={submitting}
            >
              {submitting ? (
                <CircularProgress size={24} sx={{ color: "#fff" }} />
              ) : isEdit ? (
                "UPDATE CATEGORY"
              ) : (
                "ADD CATEGORY"
              )}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryAddModal;
