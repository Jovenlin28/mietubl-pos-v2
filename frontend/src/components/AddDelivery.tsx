import React, { useContext, useEffect, useState, useRef } from "react";
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
  Typography,
  Autocomplete,
  MenuItem,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import { useDropzone } from "react-dropzone";
import axiosInstance from "../configs/axiosConfig";
import { DELIVERY_STATUS } from "../enums/delivery-status.enum";
import { DElIVERY_METHOD } from "../enums/delivery-method.enum";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";

interface AddDeliveryProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: any;
}

interface DeliveryFormValues {
  purchaseOrderNumber: string;
  method: string;
  status: string;
  date: string;
  trackingNumber: string;
  attachment: File | string | null;
}

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

const validationSchema = Yup.object({
  purchaseOrderNumber: Yup.string().required("PO Number is required"),
  method: Yup.string().required("Delivery Method is required"),
  status: Yup.string().required("Delivery Status is required"),
  date: Yup.string().required("Date is required"),
  trackingNumber: Yup.string().nullable(),
  attachment: Yup.mixed().nullable(),
});

const AddDelivery: React.FC<AddDeliveryProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode,
  initialValues,
}) => {
  const mappedInitialValues = React.useMemo<DeliveryFormValues>(() => {
    if (!initialValues) {
      return {
        purchaseOrderNumber: "",
        method: "",
        status: "",
        date: "",
        trackingNumber: "",
        attachment: null,
      };
    }

    const status = initialValues.status || "";
    const mappedDate =
      initialValues.date ||
      (status === DELIVERY_STATUS.PROCESSED
        ? initialValues.processedDate
        : status === DELIVERY_STATUS.PICKED_UP
        ? initialValues.pickedUpDate
        : status === DELIVERY_STATUS.DELIVERED
        ? initialValues.deliveredDate
        : "") ||
      initialValues.processedDate ||
      initialValues.pickedUpDate ||
      initialValues.deliveredDate ||
      "";

    return {
      purchaseOrderNumber: initialValues.purchaseOrderNumber || "",
      method: initialValues.method || "",
      status,
      date: mappedDate,
      trackingNumber: initialValues.trackingNumber || "",
      attachment: null,
    };
  }, [initialValues]);

  const [poNumbers, setPoNumbers] = useState<string[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);
  useEffect(() => {
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

  const formik = useFormik<DeliveryFormValues>({
    initialValues: mappedInitialValues,
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        // Keep existing attachment url when editing
        let attachmentUrl =
          initialValues?.processingAttachment ||
          initialValues?.pickedUpAttachment ||
          initialValues?.deliveredAttachment ||
          "";

        if (values.attachment && values.attachment instanceof File) {
          const filename = `${Date.now()}-${values.attachment.name}`;
          const contentType =
            values.attachment.type || "application/octet-stream";
          const presignRes = await axiosInstance.get("/upload/presign", {
            params: { filename, contentType },
          });

          const { url: presignedUrl, method, expiresAt } = presignRes.data;
          if (expiresAt && Date.now() + 5000 > expiresAt) {
            throw new Error(
              "Presigned URL is about to expire; please retry upload"
            );
          }

          const resp = await fetch(presignedUrl, {
            method: method || "PUT",
            headers: {
              "Content-Type": contentType,
              "x-amz-acl": "public-read",
            },
            body: values.attachment,
          });
          if (!resp.ok) {
            const body = await resp.text();
            console.error("Upload failed", resp.status, body);
            throw new Error(`Upload failed: ${resp.status}`);
          }

          attachmentUrl = presignedUrl.split("?")[0];
        }

        // Build payload according to Delivery model
        const payload: any = {
          purchaseOrderNumber: values.purchaseOrderNumber,
          method: values.method || null,
          status: values.status || null,
          date: values.date || null,
          trackingNumber: (values.trackingNumber || "").trim() || null,
          attachment: attachmentUrl || null,
        };

        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(`/deliveries/${initialValues.id}`, payload);
          axiosInstance.post(`/system-logs/`, {
            module: "Deliveries",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated a delivery`,
            createdBy: user.fullName,
          });
          showSuccess("Delivery updated successfully");
        } else {
          await axiosInstance.post("/deliveries", payload);
          axiosInstance.post(`/system-logs/`, {
            module: "Deliveries",
            action: "Create",
            description: `${user.fullName} (${user.role}) created a delivery`,
            createdBy: user.fullName,
          });
          showSuccess("Delivery created successfully");
        }

        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        console.error("submit error", err);
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save delivery";
        showError(msg);
      }
      setSubmitting(false);
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

  // ref to drop area to support paste (copy/paste images)
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
              const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
              const pasted = new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type });
              formik.setFieldValue("attachment", pasted);
              ev.preventDefault();
              break;
            }
          }
        }
      } catch (err) {
        console.error("Paste handling failed", err);
      }
    };

    window.addEventListener("paste", onPaste as any);
    return () => {
      window.removeEventListener("paste", onPaste as any);
    };
  }, [open, formik]);

  const methodOptions = Object.values(DElIVERY_METHOD || {});
  const statusOptions = Object.values(DELIVERY_STATUS || {});

  const dateLabel =
    formik.values.status === DELIVERY_STATUS.PROCESSED
      ? "Processed Date"
      : formik.values.status === DELIVERY_STATUS.PICKED_UP
      ? "Picked up Date"
      : formik.values.status === DELIVERY_STATUS.DELIVERED
      ? "Delivered Date"
      : "Date";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {/* close button */}
      <Box sx={{ position: "absolute", top: 5, right: 5 }}>
        <IconButton onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </Box>
      <DialogTitle fontWeight={700} sx={{ pr: 6 }}>
        {isEditMode ? "Edit Delivery" : "Add Delivery"}
      </DialogTitle>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                {isEditMode ? (
                  <TextField
                    label={<>PO Number{requiredMark}</>}
                    name="purchaseOrderNumber"
                    value={formik.values.purchaseOrderNumber}
                    disabled
                    fullWidth
                    onBlur={formik.handleBlur}
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
                        error={
                          formik.touched.purchaseOrderNumber &&
                          Boolean(formik.errors.purchaseOrderNumber)
                        }
                        helperText={
                          (formik.touched.purchaseOrderNumber &&
                          typeof formik.errors.purchaseOrderNumber === "string"
                            ? formik.errors.purchaseOrderNumber
                            : "") ||
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
                  select
                  label={<>Delivery Method{requiredMark}</>}
                  name="method"
                  value={formik.values.method}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.method && Boolean(formik.errors.method)}
                  helperText={
                    formik.touched.method && typeof formik.errors.method === "string"
                      ? formik.errors.method
                      : ""
                  }
                  fullWidth
                >
                  {methodOptions.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label={<>Delivery Status{requiredMark}</>}
                  name="status"
                  value={formik.values.status}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.status && Boolean(formik.errors.status)}
                  helperText={
                    formik.touched.status && typeof formik.errors.status === "string"
                      ? formik.errors.status
                      : ""
                  }
                  fullWidth
                >
                  {statusOptions.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* DateTime picker (replaces old date TextField) */}
              <Grid item xs={12} sm={6}>
                <DateTimePicker
                  label={<>{dateLabel}{requiredMark}</>}
                  value={
                    formik.values.date
                      ? new Date(formik.values.date)
                      : null
                  }
                  onChange={(val) => {
                    if (!val || isNaN((val as Date).getTime())) {
                      formik.setFieldValue("date", "");
                    } else {
                      formik.setFieldValue(
                        "date",
                        (val as Date).toISOString()
                      );
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error:
                        formik.touched.date &&
                        Boolean(formik.errors.date),
                      helperText:
                        formik.touched.date && typeof formik.errors.date === "string"
                          ? formik.errors.date
                          : "",
                      InputLabelProps: { shrink: true },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Tracking Number"
                  name="trackingNumber"
                  value={formik.values.trackingNumber || ""}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.trackingNumber &&
                    Boolean(formik.errors.trackingNumber)
                  }
                  helperText={
                    formik.touched.trackingNumber &&
                    typeof formik.errors.trackingNumber === "string"
                      ? formik.errors.trackingNumber
                      : ""
                  }
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <Typography fontWeight={500} mb={1}>
                  Upload Attachment
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
                  aria-label="Upload attachment (you can paste an image)"
                >
                  <input {...getInputProps()} />
                  <Typography variant="body2" color="text.secondary">
                    {formik.values.attachment
                      ? formik.values.attachment instanceof File
                        ? formik.values.attachment.name
                        : formik.values.attachment
                      : "Drag & drop or click to upload (PDF, JPG, PNG)"}
                  </Typography>
                </Box>
                {formik.touched.attachment && formik.errors.attachment && (
                  <Typography color="error" variant="caption">
                    {typeof formik.errors.attachment === "string"
                      ? formik.errors.attachment
                      : ""}
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
                      {isEditMode ? "Save Changes" : "Add Delivery"}
                    </>
                  ) : isEditMode ? (
                    "Save Changes"
                  ) : (
                    "Add Delivery"
                  )
                }
              />
            </Stack>
          </DialogActions>
        </form>
      </LocalizationProvider>
    </Dialog>
  );
};

export default AddDelivery;
