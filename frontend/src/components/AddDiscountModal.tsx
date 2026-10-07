import React, { useContext, useEffect, useState } from "react";
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
  Checkbox,
  ListItemText,
  Autocomplete,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

interface AddDiscountModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: DiscountFormValues;
  isEdit?: boolean;
  submitting?: boolean;
}

export interface DiscountFormValues {
  customer_id: number[]; // allow multiple customers
  product_id: number[]; // allow multiple products
  discount_value: number | "";
}

const validationSchema = Yup.object({
  customer_id: Yup.array()
    .of(Yup.number())
    .min(1, "Customer is required")
    .required("Customer is required"),
  product_id: Yup.array()
    .of(Yup.number())
    .min(1, "Product is required")
    .required("Product is required"),
  discount_value: Yup.number()
    .typeError("Discount value must be a number")
    .min(0, "Discount must be at least 0")
    .required("Discount value is required"),
});

const AddDiscountModal: React.FC<AddDiscountModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialValues,
  isEdit = false,
  submitting = false,
}) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  const formik = useFormik<DiscountFormValues>({
    initialValues:
      initialValues && (initialValues as any).product_id
        ? {
            customer_id: Array.isArray((initialValues as any).customer_id)
              ? (initialValues as any).customer_id
              : [(initialValues as any).customer_id],
            // if editing, ensure product_id is an array
            product_id: Array.isArray((initialValues as any).product_id)
              ? (initialValues as any).product_id
              : [(initialValues as any).product_id],
            discount_value: (initialValues as any).discount_value ?? "",
          }
        : {
            customer_id: [],
            product_id: [],
            discount_value: "",
          },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      setLoading(true);
      try {
        const customerIds = Array.isArray(values.customer_id)
          ? values.customer_id
          : [values.customer_id as any];
        const productIds = Array.isArray(values.product_id)
          ? values.product_id
          : [values.product_id as any];

        if (isEdit && initialValues && (initialValues as any).id) {
          // For edit, update the existing discount row.
          // Use the first selected customer and first selected product as the edited record target.
          const cid = customerIds.length > 0 ? customerIds[0] : null;
          const pid = productIds.length > 0 ? productIds[0] : null;
          if (cid === null || pid === null)
            throw new Error("Customer and Product are required");
          await axiosInstance.put(
            `/customer-product-discounts/${(initialValues as any).id}`,
            {
              customer_id: cid,
              product_id: pid,
              discount_value: values.discount_value,
            }
          );
          axiosInstance.post(`/system-logs/`, {
            module: "Discounts",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated a discount`,
            createdBy: user.fullName,
          });
          showSuccess("Discount updated successfully");
        } else {
          // Create one discount record per selected customer-product pair
          for (const cid of customerIds) {
            for (const pid of productIds) {
              await axiosInstance.post("/customer-product-discounts", {
                customer_id: cid,
                product_id: pid,
                discount_value: values.discount_value,
              });
            }
          }
          axiosInstance.post(`/system-logs/`, {
            module: "Discounts",
            action: "Create",
            description: `${user.fullName} (${user.role}) created a discount`,
            createdBy: user.fullName,
          });
          showSuccess("Discount created successfully");
        }

        onSuccess();
        onClose();
      } catch (err: any) {
        console.error("Discount save error:", err);
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save discount";
        showError(msg);
      }
      setLoading(false);
      setSubmitting(false);
    },
  });

  useEffect(() => {
    if (open) {
      // Fetch customers
      axiosInstance
        .get("/customers", { params: { perPage: 1000 } })
        .then((res) => setCustomers(res.data.items || []))
        .catch(() => setCustomers([]));
      // Fetch products
      axiosInstance
        .get("/products", { params: { perPage: 1000 } })
        .then((res) => setProducts(res.data.items || []))
        .catch(() => setProducts([]));
    }
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
        <Box flex={1}>{isEdit ? "Edit Discount" : "Add Discount"}</Box>
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
          <Stack spacing={2}>
            {/* Searchable multi-select customers */}
            <Autocomplete
              multiple
              fullWidth
              options={customers}
              getOptionLabel={(option) => option.fullName || ""}
              disableCloseOnSelect
              value={customers.filter((c) =>
                formik.values.customer_id.includes(c.id)
              )}
              onChange={(_, value) => {
                const ids = Array.isArray(value)
                  ? value.map((v: any) => v.id)
                  : [];
                formik.setFieldValue("customer_id", ids);
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox checked={selected} sx={{ mr: 1 }} />
                  <ListItemText primary={option.fullName} />
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer *"
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.customer_id &&
                    Boolean(formik.errors.customer_id)
                  }
                  helperText={
                    formik.touched.customer_id &&
                    (formik.errors.customer_id as string)
                  }
                />
              )}
            />

            {/* Searchable multi-select products */}
            <Autocomplete
              multiple
              fullWidth
              options={products}
              getOptionLabel={(option) => option.name || ""}
              disableCloseOnSelect
              value={products.filter((p) =>
                formik.values.product_id.includes(p.id)
              )}
              onChange={(_, value) => {
                const ids = Array.isArray(value)
                  ? value.map((v: any) => v.id)
                  : [];
                formik.setFieldValue("product_id", ids);
              }}
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox checked={selected} sx={{ mr: 1 }} />
                  <ListItemText primary={option.name} />
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product *"
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.product_id &&
                    Boolean(formik.errors.product_id)
                  }
                  helperText={
                    formik.touched.product_id &&
                    (formik.errors.product_id as string)
                  }
                />
              )}
            />

            <TextField
              fullWidth
              label="Discount Value *"
              name="discount_value"
              type="number"
              value={formik.values.discount_value}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.discount_value &&
                Boolean(formik.errors.discount_value)
              }
              helperText={
                formik.touched.discount_value && formik.errors.discount_value
              }
            />
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
              disabled={loading || formik.isSubmitting}
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
              disabled={loading || formik.isSubmitting}
            >
              {loading || formik.isSubmitting ? (
                <CircularProgress size={24} sx={{ color: "#fff" }} />
              ) : isEdit ? (
                "UPDATE DISCOUNT"
              ) : (
                "CREATE DISCOUNT"
              )}
            </Button>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AddDiscountModal;
