import React, { useContext, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Stack,
  IconButton,
  MenuItem,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Button,
  Autocomplete,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as yup from "yup";
import axiosInstance from "../configs/axiosConfig";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import { jwtDecode } from "jwt-decode";
import { UserContext } from "../layouts/DashboardLayout";
interface Product {
  id: number;
  name: string;
}

interface StockInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isEditMode?: boolean;
  editStockIn?: any;
}

const validationSchema = yup.object({
  product_id: yup.number().required("Product is required"),
  stocks_added: yup
    .number()
    .typeError("Stocks to Add must be a number")
    .positive("Stocks to Add must be greater than 0")
    .required("Stocks to Add is required"),
  status: yup
    .string()
    .oneOf(["In Process", "Completed"])
    .required("Status is required"),
  notes: yup.string(),
});

const initialValues = {
  product_id: "",
  stocks_added: "",
  status: "In Process",
  notes: "",
};

const StockInModal: React.FC<StockInModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode,
  editStockIn,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const user = useContext(UserContext);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await axiosInstance.get<{ items: Product[] }>(
        `/products?perPage=1000`
      );
      setProducts(res.data.items);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchProducts();
  }, [open]);

  const formik = useFormik({
    initialValues: editStockIn || initialValues,
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      setSubmitting(true);
      let createdBy: string = "";
      try {

        if (isEditMode && editStockIn?.id) {
          // Update existing stock-in log
          await axiosInstance.put(`/stock-in-log/${editStockIn.id}`, {
            product_id: values.product_id,
            stocks_added: Number(values.stocks_added),
            status: values.status,
            notes: values.notes,
          });
          axiosInstance.post(`/system-logs/`, {
            module: "Stock In Logs",
            action: "Update",
            description: `${(user as any)?.fullName || "User"} updated a stock in log`,
            createdBy: (user as any)?.fullName,
          });
        } else {
          // Create new
          await axiosInstance.post("/stock-in-log", {
            product_id: values.product_id,
            stocks_added: Number(values.stocks_added),
            status: values.status,
            notes: values.notes,
            stock_in_date: new Date().toISOString().slice(0, 10),
            createdBy,
          });
          axiosInstance.post(`/system-logs/`, {
            module: "Stock In Logs",
            action: "Create",
            description: `${(user as any)?.fullName || "User"} created a stock in log`,
            createdBy: (user as any)?.fullName,
          });
        }

        formik.resetForm();
        onClose();
        onSuccess();
      } catch {
      } finally {
        setSubmitting(false);
      }
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
        <Box flex={1}>{isEditMode ? "Edit Stock In" : "Stock In"}</Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: "#e74c3c",
            ml: 2,
            alignSelf: "center",
          }}
        >
          <CloseIcon fontSize="large" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          component="form"
          id="stock-in-form"
          onSubmit={formik.handleSubmit}
          autoComplete="off"
          sx={{ mt: 2 }}
        >
          <Stack spacing={2}>
            <FormControl fullWidth>
              {/* Searchable product dropdown */}
              <Autocomplete
                options={products}
                getOptionLabel={(opt) => (opt ? opt.name : "")}
                loading={productsLoading}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={
                  products.find(
                    (p) => String(p.id) === String(formik.values.product_id)
                  ) || null
                }
                onChange={(_e, val) => {
                  formik.setFieldValue("product_id", val ? val.id : "");
                }}
                onBlur={() => formik.setFieldTouched("product_id", true)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Product"
                    disabled={isEditMode} // disable product change when editing
                    error={
                      formik.touched.product_id &&
                      Boolean(formik.errors.product_id)
                    }
                    helperText={
                      formik.touched.product_id && formik.errors.product_id
                        ? String(formik.errors.product_id)
                        : ""
                    }
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productsLoading ? (
                            <CircularProgress color="inherit" size={18} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </FormControl>
            <TextField
              fullWidth
              id="stocks_added"
              name="stocks_added"
              label="Stocks to Add"
              type="number"
              value={formik.values.stocks_added}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.stocks_added &&
                Boolean(formik.errors.stocks_added)
              }
              helperText={
                formik.touched.stocks_added && formik.errors.stocks_added
              }
            />
            <FormControl fullWidth>
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                id="status"
                name="status"
                label="Status"
                value={formik.values.status}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.status && Boolean(formik.errors.status)}
              >
                <MenuItem value="In Process">In Process</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
              </Select>
              {formik.touched.status && formik.errors.status && (
                <Typography color="error" variant="caption">
                  {formik.errors.status}
                </Typography>
              )}
            </FormControl>
            <TextField
              fullWidth
              id="notes"
              name="notes"
              label="Notes"
              multiline
              minRows={2}
              value={formik.values.notes}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.notes && Boolean(formik.errors.notes)}
              helperText={formik.touched.notes && formik.errors.notes}
            />
            <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
              <CancelButton onClick={onClose} />
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
                ) : isEditMode ? (
                  "SAVE CHANGES"
                ) : (
                  "SAVE"
                )}
              </Button>
            </DialogActions>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default StockInModal;
