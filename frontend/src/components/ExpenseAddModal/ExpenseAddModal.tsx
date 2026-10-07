import React, { useEffect, useState, useRef } from "react";
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
  MenuItem,
  Stack,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import axiosInstance from "../../configs/axiosConfig";
import { useDropzone } from "react-dropzone";
import { useNotification } from "../../hooks/useNotification";
import { UserContext } from "../../layouts/DashboardLayout";
import CancelButton from "../../shared/buttons/CancelButton";

interface ExpenseAddModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: ExpenseFormValues;
  isEdit?: boolean;
  submitting?: boolean;
}

export interface ExpenseFormValues {
  purchaseDate: string;
  expenseCategory: string;
  itemDescription: string;
  totalCost: string;
  status: string;
  receiptNo?: string;
  vendorName?: string;
  tinNo?: string;
  businessAddress?: string;
  /** Optional: where the expense was funded from */
  sourceOfFund?: string;
  // added attachment support
  attachment?: File | null;
}

const validationSchema = Yup.object({
  purchaseDate: Yup.string().required("Purchase Date is required"),
  expenseCategory: Yup.string().required("Expense Category is required"),
  itemDescription: Yup.string().required("Item Description is required"),
  totalCost: Yup.string().required("Total Cost is required"),
  status: Yup.string().required("Status is required"),
  receiptNo: Yup.string(),
  vendorName: Yup.string(),
  tinNo: Yup.string(),
  businessAddress: Yup.string(),
  sourceOfFund: Yup.string().nullable(),
  attachment: Yup.mixed().nullable(),
});

const ExpenseAddModal: React.FC<ExpenseAddModalProps> = ({
  open,
  onClose,
  onSuccess, // will be used only as optional callback after save
  initialValues,
  isEdit = false,
  submitting = false,
}) => {
  const { showSuccess, showError } = useNotification();
  const user = React.useContext(UserContext) as any;
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [catsLoading, setCatsLoading] = useState(false);
  const [categoryBudget, setCategoryBudget] = useState<{
    budget: any | null;
    spent: number;
    remaining: number;
  } | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const formatDate = (v?: string | null) => {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPeso = (v?: number | string) =>
    `₱${Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const getNameFromUrl = (u?: string | null) => {
    if (!u) return "";
    try {
      const parts = String(u).split("/");
      const last = parts[parts.length - 1].split("?")[0];
      return decodeURIComponent(last);
    } catch {
      return String(u);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      setCatsLoading(true);
      try {
        const res = await axiosInstance.get("/expense-categories/all");
        const list = Array.isArray(res.data)
          ? res.data.map((c: any) => ({ id: c.id, name: c.name }))
          : [];
        setCategories(list);
      } catch (err) {
        setCategories([]);
      } finally {
        setCatsLoading(false);
      }
    };

    if (open) {
      fetchCategories();
    }
  }, [open]);

  // normalize initial values so attachment string URL becomes {name, url}
  const normalizedInitial = React.useMemo(() => {
    if (!initialValues) return undefined;
    const att = (initialValues as any).attachment;
    return {
      ...initialValues,
      attachment:
        typeof att === "string" && att
          ? { name: getNameFromUrl(att), url: att }
          : att || null,
    } as ExpenseFormValues;
  }, [initialValues]);

  const formik = useFormik<ExpenseFormValues>({
    // use normalizedInitial (falls back to defaults when undefined)
    initialValues: normalizedInitial || initialValues || {
      purchaseDate: "",
      expenseCategory: "",
      itemDescription: "",
      totalCost: "",
      status: "Fulfilled",
      receiptNo: "",
      vendorName: "",
      tinNo: "",
      businessAddress: "",      sourceOfFund: "",      attachment: null,
    },
    validationSchema,
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      setSubmitting(true);
      try {
        // handle attachment upload similar to CreatePaymentModal
        // support initialValues.attachment as either string URL or object { name, url }
        let attachmentUrl: string =
          typeof (initialValues as any)?.attachment === "string"
            ? (initialValues as any)?.attachment
            : (initialValues as any)?.attachment?.url || "";
 
        if (values.attachment && values.attachment instanceof File) {
          const filename = `${Date.now()}-${values.attachment.name}`;
          const contentType =
            values.attachment.type || "application/octet-stream";
          const presignRes = await axiosInstance.get("/upload/presign", {
            params: { filename, contentType },
          });
          const { url: presignedUrl, method, expiresAt } = presignRes.data;
          if (expiresAt && Date.now() + 5000 > expiresAt) {
            throw new Error("Presigned URL expired. Try again.");
          }
          const uploadResp = await fetch(presignedUrl, {
            method: method || "PUT",
            headers: {
              "Content-Type": contentType,
              "x-amz-acl": "public-read",
            },
            body: values.attachment,
          });
          if (!uploadResp.ok) throw new Error("Upload failed");
          attachmentUrl = presignedUrl.split("?")[0];
        }

        // prepare payload (attachment is URL string or null)
        const payload: any = {
          purchaseDate: values.purchaseDate || null,
          expenseCategory: values.expenseCategory || null,
          itemDescription: values.itemDescription || null,
          totalCost: values.totalCost || 0,
          status: values.status || null,
          receiptNo: values.receiptNo || null,
          vendorName: values.vendorName || null,
          sourceOfFund: values.sourceOfFund || null,
          tinNo: values.tinNo || null,
          businessAddress: values.businessAddress || null,
          attachment: attachmentUrl || null,
        };

        // ensure update uses PUT and we have an id
        const expenseId = (initialValues as any)?.id;
        if (isEdit) {
          if (!expenseId) {
            throw new Error(
              "Missing expense id for update. Ensure the modal was opened in edit mode with an id."
            );
          }
          await axiosInstance.put(`/expenses/${expenseId}`, payload);
          showSuccess("Expense updated successfully");
          // optional system log
          try {
            await axiosInstance.post("/system-logs/", {
              module: "Expenses",
              action: "Update",
              description: `${
                user?.fullName || user?.username || "User"
              } updated an expense`,
              createdBy: user?.fullName || user?.username || "system",
            });
          } catch (e) {
            /* ignore logging errors */
          }
        } else {
          // create
          await axiosInstance.post("/expenses", payload);
          showSuccess("Expense created successfully");
          try {
            await axiosInstance.post("/system-logs/", {
              module: "Expenses",
              action: "Create",
              description: `${
                user?.fullName || user?.username || "User"
              } created an expense`,
              createdBy: user?.fullName || user?.username || "system",
            });
          } catch (e) {
            /* ignore logging errors */
          }
        }

        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        console.error("Expense save failed", err, err?.response?.data);
        showError(
          err?.response?.data?.error ||
            err?.response?.data ||
            err?.message ||
            "Failed to save expense"
        );
      } finally {
        setSubmitting(false);
      }
    },
  });

  const { getRootProps, getInputProps } = useDropzone({
    multiple: false,
    onDrop: (files) => {
      if (files && files[0]) {
        formik.setFieldValue("attachment", files[0]);
      }
    },
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png"],
    },
  });

  // paste handling similar to CreatePaymentModal
  useEffect(() => {
    if (!open) return;
    const onPaste = (ev: ClipboardEvent) => {
      try {
        const items = ev.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind === "file" && it.type.startsWith("image/")) {
            const file = it.getAsFile();
            if (file) {
              const ext = (file.type.split("/")[1] || "png").replace(
                /[^a-z0-9]/gi,
                ""
              );
              const pasted = new File([file], `pasted-${Date.now()}.${ext}`, {
                type: file.type,
              });
              formik.setFieldValue("attachment", pasted);
              ev.preventDefault();
              break;
            }
          }
        }
      } catch (err) {
        // ignore
        console.error("Paste handling failed", err);
      }
    };

    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [open, formik]);

  // fetch budget when category changes
  useEffect(() => {
    const loadBudget = async (categoryName: string) => {
      try {
        setCategoryBudget(null);
        const cat = categories.find((c) => c.name === categoryName);
        if (!cat) return;
        const res = await axiosInstance.get(
          `/expense-categories/${cat.id}/budgets/current`
        );
        setCategoryBudget(res.data);
      } catch (err) {
        setCategoryBudget(null);
      }
    };

    if (formik.values.expenseCategory) {
      loadBudget(formik.values.expenseCategory);
    } else {
      setCategoryBudget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.expenseCategory, categories]);

  const fieldError = (name: string) =>
    ((formik.touched as any)[name] || formik.submitCount > 0) &&
    (formik.errors as any)[name];

  // determine if entered cost exceeds remaining budget for selected category
  // show a non-blocking visual warning only (do not mark field as error or disable submit)
  const enteredCost = Number(formik.values.totalCost || 0);
  const remainingAmount = Number(categoryBudget?.remaining ?? NaN);
  const overBudget =
    !isNaN(remainingAmount) && remainingAmount !== 0
      ? enteredCost > remainingAmount
      : false;

  const totalCostValidationText =
    (formik.touched.totalCost && (formik.errors.totalCost as any)) || "";
  const totalCostHelperText =
    totalCostValidationText ||
    (overBudget
      ? `Warning: amount exceeds remaining budget ${formatPeso(
          remainingAmount
        )}`
      : "");

  // compute display name for attachment (handles File | {name,url} | string)
  const attachmentDisplayName = (() => {
    const a = formik.values.attachment as any;
    if (!a) return "";
    if (typeof a === "string") return getNameFromUrl(a);
    if (a.name) return a.name;
    if (a.url) return getNameFromUrl(a.url);
    return String(a);
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      // limit dialog height to viewport and let DialogContent scroll
      PaperProps={{ sx: { overflow: "hidden" } }}
    >
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
        <Box flex={1}>{isEdit ? "Edit Expense" : "Add Expense"}</Box>
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
      <DialogContent dividers sx={{ px: 3, overflow: "auto" }}>
        <Box
          component="form"
          onSubmit={formik.handleSubmit}
          autoComplete="off"
          sx={{ mt: 2 }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              label="Purchase Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              name="purchaseDate"
              value={formik.values.purchaseDate}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.purchaseDate &&
                Boolean(formik.errors.purchaseDate)
              }
              helperText={
                formik.touched.purchaseDate && formik.errors.purchaseDate
              }
            />
            <TextField
              select
              label="Expense Category"
              fullWidth
              name="expenseCategory"
              value={formik.values.expenseCategory}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.expenseCategory &&
                Boolean(formik.errors.expenseCategory)
              }
              helperText={
                formik.touched.expenseCategory && formik.errors.expenseCategory
              }
              disabled={catsLoading}
            >
              {categories.length === 0 ? (
                <MenuItem value="">
                  {catsLoading ? "Loading..." : "No categories"}
                </MenuItem>
              ) : (
                categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </MenuItem>
                ))
              )}
            </TextField>
          </Stack>

          {/* Budget info for selected category */}
          {formik.values.expenseCategory && (
            <Box
              sx={{
                mb: 2,
                p: 1,
                borderRadius: 1,
                border: "1px solid #eee",
                background: "#fbfbfb",
              }}
            >
              {categoryBudget ? (
                categoryBudget.budget ? (
                  <Box>
                    <Typography variant="body2">
                      Budget:{" "}
                      <strong>
                        {formatPeso(categoryBudget.budget.amount || 0)}
                      </strong>
                    </Typography>
                    <Typography variant="body2">
                      Period: {formatDate(categoryBudget.budget.period_start)} →{" "}
                      {formatDate(categoryBudget.budget.period_end)}
                    </Typography>
                    <Typography variant="body2">
                      Spent:{" "}
                      <strong>{formatPeso(categoryBudget.spent || 0)}</strong>
                    </Typography>
                    <Typography
                      variant="body2"
                      color={
                        (categoryBudget.remaining || 0) < 0
                          ? "error.main"
                          : "text.primary"
                      }
                    >
                      Remaining:{" "}
                      <strong>
                        {formatPeso(categoryBudget.remaining || 0)}
                      </strong>
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2">
                    No active budget for this category
                  </Typography>
                )
              ) : (
                <Typography variant="body2">Loading budget...</Typography>
              )}
            </Box>
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              label="Item Description"
              fullWidth
              name="itemDescription"
              value={formik.values.itemDescription}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.itemDescription &&
                Boolean(formik.errors.itemDescription)
              }
              helperText={
                formik.touched.itemDescription && formik.errors.itemDescription
              }
            />
            <TextField
              label="Total Cost"
              fullWidth
              name="totalCost"
              type="number"
              value={formik.values.totalCost}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.totalCost && Boolean(formik.errors.totalCost)
              }
              helperText={totalCostHelperText}
              FormHelperTextProps={{
                sx: {
                  // only color the helper red when it's the over-budget warning
                  color:
                    !totalCostValidationText && overBudget
                      ? "error.main"
                      : undefined,
                },
              }}
            />
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              select
              label="Status"
              fullWidth
              name="status"
              value={formik.values.status}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.status && Boolean(formik.errors.status)}
              helperText={formik.touched.status && formik.errors.status}
            >
              <MenuItem value="Fulfilled">Fulfilled</MenuItem>
              <MenuItem value="Unfulfilled">Unfulfilled</MenuItem>
            </TextField>
            <TextField
              label="Receipt No."
              fullWidth
              name="receiptNo"
              value={formik.values.receiptNo}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.receiptNo && Boolean(formik.errors.receiptNo)
              }
              helperText={formik.touched.receiptNo && formik.errors.receiptNo}
            />
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              label="Vendor Name"
              fullWidth
              name="vendorName"
              value={formik.values.vendorName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                formik.touched.vendorName && Boolean(formik.errors.vendorName)
              }
              helperText={formik.touched.vendorName && formik.errors.vendorName}
            />
            <TextField
              label="TIN No."
              fullWidth
              name="tinNo"
              value={formik.values.tinNo}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.tinNo && Boolean(formik.errors.tinNo)}
              helperText={formik.touched.tinNo && formik.errors.tinNo}
            />
          </Stack>

          <TextField
            label="Source of Fund"
            fullWidth
            name="sourceOfFund"
            value={(formik.values as any).sourceOfFund || ""}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={Boolean((formik.touched as any).sourceOfFund && (formik.errors as any).sourceOfFund)}
            helperText={(formik.touched as any).sourceOfFund && (formik.errors as any).sourceOfFund}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Business Address"
            fullWidth
            name="businessAddress"
            value={formik.values.businessAddress}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={
              formik.touched.businessAddress &&
              Boolean(formik.errors.businessAddress)
            }
            helperText={
              formik.touched.businessAddress && formik.errors.businessAddress
            }
            sx={{ mb: 2 }}
          />

          {/* Attachment dropzone (same pattern as CreatePaymentModal) */}
          <Typography fontWeight={500} mb={1}>
            Upload attachment
          </Typography>
          <Box
            {...getRootProps()}
            ref={dropRef}
            tabIndex={0}
            sx={{
              border: "1px dashed #bdbdbd",
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: "#fafbfc",
              mb: 2,
            }}
          >
            <input {...getInputProps()} />
            <Typography variant="body2" color="text.secondary">
              {attachmentDisplayName
                ? attachmentDisplayName
                : "Drag & drop or click to upload (PDF, JPG, PNG)"}
            </Typography>
          </Box>
          {fieldError("attachment") && (
            <Typography color="error" variant="caption">
              {fieldError("attachment") as any}
            </Typography>
          )}
          <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <CancelButton onClick={onClose} />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  bgcolor: "#f39c12",
                  color: "#fff",
                  fontWeight: 700,
                  boxShadow: 0,
                  "&:hover": { bgcolor: "#e67e22" },
                }}
                disabled={submitting || formik.isSubmitting}
              >
                {submitting || formik.isSubmitting ? (
                  <CircularProgress size={24} sx={{ color: "#fff" }} />
                ) : isEdit ? (
                  "UPDATE EXPENSE"
                ) : (
                  "ADD EXPENSE"
                )}
              </Button>
            </Box>
          </DialogActions>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseAddModal;
