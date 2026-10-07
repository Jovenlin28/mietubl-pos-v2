import React, { useRef, useState, useEffect, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  IconButton,
  Stack,
  CircularProgress,
  Grid,
  MenuItem,
  Typography,
  Autocomplete,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";

// For file upload, use react-dropzone
import { useDropzone } from "react-dropzone";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

interface CreatePaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: any; // may contain parentPaymentId for new child payment
}

const validationSchema = Yup.object({
  referenceNo: Yup.string().nullable(),
  purchaseOrderNumber: Yup.string().required("PO Number is required"),
  amount: Yup.number()
    .typeError("Amount must be a number")
    .required("Amount is required"),
  paymentChannel: Yup.string().nullable(),
  description: Yup.string().nullable(),
  paymentDate: Yup.string().nullable(),   // <-- made optional (removed .required)
  dueDate: Yup.string().nullable(),
  attachment: Yup.mixed().nullable(),
});

const paymentChannels = [
  "Bank Transfer",
  "Cash",
  "Credit Card",
  "Cheque",
  "Online Payment",
  "LBC",
];

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

// Helper to convert various date representations to 'YYYY-MM-DD' for <input type="date">
const toDateInput = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") {
    // Already plain YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // Try to extract from ISO
    const isoMatch = val.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const CreatePaymentModal: React.FC<CreatePaymentModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode,
  initialValues,
}) => {
  const [poNumbers, setPoNumbers] = useState<string[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  useEffect(() => {
    // Only fetch when modal opens and not in edit mode
    if (!open) return;
    if (isEditMode) return;

    let mounted = true;
    const fetchPoNumbers = async () => {
      setPoLoading(true);
      setPoError(null);
      try {
        const res = await axiosInstance.get("/sales/unpaid/po-numbers");
        if (!mounted) return;
        setPoNumbers(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load unpaid PO numbers", err);
        if (mounted) setPoError("Failed to load PO numbers");
      } finally {
        if (mounted) setPoLoading(false);
      }
    };

    fetchPoNumbers();
    return () => {
      mounted = false;
    };
  }, [open, isEditMode]);

  // Preprocess initial values for Formik (ensure date fields are formatted)
  const processedInitialValues = React.useMemo(() => {
    if (initialValues) {
      return {
        ...initialValues,
        paymentDate: toDateInput(initialValues.paymentDate),
        dueDate: toDateInput(initialValues.dueDate),
        parentPaymentId: initialValues.parentPaymentId || null,
        attachment: null, // keep existing attachment URL separately (we reuse initialValues?.attachment on submit)
      };
    }
    return {
      referenceNo: "",
      purchaseOrderNumber: "",
      amount: "",
      paymentChannel: "",
      description: "",
      paymentDate: "",
      dueDate: "",
      attachment: null,
      parentPaymentId: initialValues?.parentPaymentId || null,
    };
  }, [initialValues]);

  const formik = useFormik({
    initialValues: processedInitialValues,
    validationSchema,
    enableReinitialize: true,
    validateOnChange: false,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        let attachmentUrl = initialValues?.attachment || "";

        // Upload via presigned URL (backend should expose /api/upload/presign)
        if (values.attachment && values.attachment instanceof File) {
          // create a deterministic filename (backend presign expects this)
          const filename = `${Date.now()}-${values.attachment.name}`;
          const contentType =
            values.attachment.type || "application/octet-stream";
          // request presigned URL from backend
          const presignRes = await axiosInstance.get("/upload/presign", {
            params: {
              filename,
              contentType,
            },
          });

          const { url: presignedUrl, method, expiresAt } = presignRes.data;

          // if presign already near expiry, request a fresh one
          if (expiresAt && Date.now() + 5000 > expiresAt) {
            throw new Error(
              "Presigned URL is about to expire; please retry upload"
            );
          }

          // upload directly to storage using the presigned URL
          const resp = await fetch(presignedUrl, {
            method: method || "PUT",
            headers: {
              "Content-Type": contentType,
              // header must match what was signed (or omitted if not signed)
              "x-amz-acl": "public-read",
            },
            body: values.attachment,
          });
          if (!resp.ok) {
            const body = await resp.text();
            console.error("Upload failed", resp.status, body);
            throw new Error(`Upload failed: ${resp.status}`);
          }

          // derive public URL by stripping query string from presigned URL
          // (works if your bucket is public or you're using a CDN/bucket hostname)
          attachmentUrl = presignedUrl.split("?")[0];
        }

        const payload: any = {
          referenceNo: values.referenceNo,
          purchaseOrderNumber: values.purchaseOrderNumber,
          amount: values.amount,
          paymentChannel: values.paymentChannel,
          description: values.description,
          paymentDate: values.paymentDate,
          dueDate: values.dueDate || null,          // <-- include
          attachment: attachmentUrl
        };

        // include parentPaymentId only on CREATE
        if (!isEditMode && values.parentPaymentId) {
          payload.parentPaymentId = values.parentPaymentId;
        }

        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(`/payments/${initialValues.id}`, payload);
          axiosInstance.post(`/system-logs/`, {
            module: "Payments",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated a payment`,
            createdBy: user.fullName,
          });
          showSuccess("Payment updated successfully");
        } else {
          await axiosInstance.post("/payments", payload);
          axiosInstance.post(`/system-logs/`, {
            module: "Payments",
            action: "Create",
            description: `${user.fullName} (${user.role}) created a payment`,
            createdBy: user.fullName,
          });
          showSuccess("Payment created successfully");
        }
        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        console.error("submit error", err);
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save payment";
        showError(msg);
      }
      setSubmitting(false);
    },
  });

  // Helper to show error if field touched OR a submit was attempted
  const fieldError = (name: string) =>
    ((formik.touched as any)[name] || formik.submitCount > 0) &&
    (formik.errors as any)[name];

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

  // ref to drop area to support paste
  const dropAreaRef = useRef<HTMLDivElement | null>(null);

  // allow pasting images from clipboard into the drop area
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
              // create a filename for pasted image
              const ext = (file.type.split("/")[1] || "png")
                .replace(/[^a-z0-9]/gi, "");
              const pasted = new File(
                [file],
                `pasted-${Date.now()}.${ext}`,
                { type: file.type }
              );
              formik.setFieldValue("attachment", pasted);
              // prevent default so browser doesn't try to navigate
              ev.preventDefault();
              break;
            }
          }
        }
      } catch (err) {
        // swallow errors; not critical
        console.error("Paste handling failed", err);
      }
    };

    // attach to window so paste works even when the drop area isn't focused
    window.addEventListener("paste", onPaste as any);
    return () => {
      window.removeEventListener("paste", onPaste as any);
    };
  }, [open, formik]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ position: "absolute", top: 5, right: 5 }}>
        <IconButton onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </Box>
      <DialogTitle fontWeight={700} sx={{ pr: 6 }}>
        {isEditMode ? "Edit Payment" : "Add Payment"}
      </DialogTitle>
      <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {isEditMode ||
              (initialValues && initialValues.purchaseOrderNumber && initialValues.parentPaymentId) ? (
                <TextField
                  label={<>PO Number{requiredMark}</>}
                  name="purchaseOrderNumber"
                  value={formik.values.purchaseOrderNumber}
                  disabled
                  fullWidth
                  onBlur={formik.handleBlur}
                  error={Boolean(fieldError("purchaseOrderNumber"))}
                  helperText={fieldError("purchaseOrderNumber") as any}
                />
              ) : isEditMode ||
                (initialValues &&
                  initialValues.purchaseOrderNumber &&
                  !initialValues.parentPaymentId) ? (
                <TextField
                  label={<>PO Number{requiredMark}</>}
                  name="purchaseOrderNumber"
                  value={formik.values.purchaseOrderNumber}
                  disabled
                  fullWidth
                  onBlur={formik.handleBlur}
                  error={Boolean(fieldError("purchaseOrderNumber"))}
                  helperText={fieldError("purchaseOrderNumber") as any}
                />
              ) : (
                <Autocomplete
                  freeSolo={false}
                  options={poNumbers}
                  filterSelectedOptions
                  loading={poLoading}
                  value={formik.values.purchaseOrderNumber || null}
                  onChange={(_, newValue) =>
                    formik.setFieldValue(
                      "purchaseOrderNumber",
                      newValue === null ? "" : newValue
                    )
                  }
                  onBlur={() =>
                    formik.setFieldTouched("purchaseOrderNumber", true)
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={<>PO Number{requiredMark}</>}
                      error={Boolean(fieldError("purchaseOrderNumber"))}
                      helperText={
                        (fieldError("purchaseOrderNumber") as any) ||
                        (poError ? poError : "")
                      }
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {poLoading ? (
                              <CircularProgress color="inherit" size={20} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                      fullWidth
                    />
                  )}
                />
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={"Reference No"}                 // removed requiredMark
                name="referenceNo"
                value={formik.values.referenceNo}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(fieldError("referenceNo"))}
                helperText={fieldError("referenceNo") as any}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={<>Amount{requiredMark}</>}
                name="amount"
                type="number"
                value={formik.values.amount}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(fieldError("amount"))}
                helperText={fieldError("amount") as any}
                fullWidth
              />
            </Grid>
            {/* Payment Channel and Payment Date side by side */}
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label={"Payment Channel"}              // removed requiredMark
                name="paymentChannel"
                value={formik.values.paymentChannel}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(fieldError("paymentChannel"))}
                helperText={fieldError("paymentChannel") as any}
                fullWidth
              >
                {paymentChannels.map((channel) => (
                  <MenuItem key={channel} value={channel}>
                    {channel}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={"Payment Date"}                // <-- removed requiredMark
                name="paymentDate"
                type="date"
                value={formik.values.paymentDate}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(fieldError("paymentDate"))}
                helperText={fieldError("paymentDate") as any}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {/* Due Date (optional) */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Due Date"
                name="dueDate"
                type="date"
                value={formik.values.dueDate}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(fieldError("dueDate"))}
                helperText={fieldError("dueDate") as any}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {/* Description field - full width */}
            <Grid item xs={12}>
              <TextField
                label="Notes"
                name="description"
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={Boolean(fieldError("description"))}
                helperText={fieldError("description") as any}
                fullWidth
                multiline
                minRows={3}
              />
            </Grid>
            {/* File upload field - full width */}
            <Grid item xs={12}>
              <Typography fontWeight={500} mb={1}>
                Upload proof of payment
              </Typography>
              <Box
                {...getRootProps()}
                ref={dropAreaRef}
                tabIndex={0}
                sx={{
                  border: "1px dashed #bdbdbd",
                  borderRadius: 2,
                  p: 2,
                  textAlign: "center",
                  cursor: "pointer",
                  bgcolor: "#fafbfc",
                }}
                aria-label="Upload proof of payment (you can paste an image)"
              >
                <input {...getInputProps()} />
                <Typography variant="body2" color="text.secondary">
                  {formik.values.attachment
                    ? formik.values.attachment.name || formik.values.attachment
                    : "Drag & drop or click to upload (PDF, JPG, PNG)"}
                </Typography>
              </Box>
              {formik.touched.attachment && formik.errors.attachment && (
                <Typography color="error" variant="caption">
                  {formik.errors.attachment}
                </Typography>
              )}
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
                    {isEditMode ? "Save Changes" : "Add Payment"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Payment"
                )
              }
            />
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreatePaymentModal;
