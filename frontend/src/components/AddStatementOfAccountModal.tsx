import React, { useEffect, useState, useRef, useContext } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  IconButton,
  Stack,
  Grid,
  MenuItem,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useDropzone } from "react-dropzone";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CancelButton from "../shared/buttons/CancelButton";
import { UserContext } from "../layouts/DashboardLayout";

interface AccountOption {
  id: number;
  name: string;
  status: string;
  createdOn?: string;
}

export interface AddStatementOfAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: any; // existing statement object when editing
}

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

const validationSchema = Yup.object({
  account_id: Yup.number()
    .typeError("Account is required")
    .required("Account is required"),
  amountToPay: Yup.number()
    .typeError("Amount To Pay must be a number")
    .required("Amount To Pay is required"),
  amountPaid: Yup.number().typeError("Amount Paid must be a number").nullable(),
  referenceNo: Yup.string().nullable(),
  description: Yup.string().nullable(),
  periodStart: Yup.string().nullable(),
  periodEnd: Yup.string().nullable(),
  attachment: Yup.mixed().nullable(),
});

const AddStatementOfAccountModal: React.FC<AddStatementOfAccountModalProps> = ({
  open,
  onClose,
  onSuccess,
  isEditMode,
  initialValues,
}) => {
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext) as any;
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const load = async () => {
      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const res = await axiosInstance.get("/accounts", {
          params: { perPage: 500, currentPage: 1, sortBy: "name", sortDir: "ASC" },
        });
        if (mounted) setAccounts(res.data?.items || []);
      } catch (err) {
        if (mounted) {
          setAccounts([]);
          setAccountsError("Failed to load accounts");
        }
      } finally {
        if (mounted) setAccountsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [open]);

  const formik = useFormik({
    initialValues: {
      account_id:
        initialValues?.account_id ||
        initialValues?.account?.id ||
        "",
      referenceNo: initialValues?.referenceNo || "",
      description: initialValues?.description || "",
      amountToPay:
        initialValues?.amountToPay !== undefined
          ? String(initialValues.amountToPay)
          : "",
      amountPaid:
        initialValues?.amountPaid !== undefined
          ? String(initialValues.amountPaid)
          : "",
      periodStart: initialValues?.periodStart
        ? initialValues.periodStart.substring(0, 10)
        : "",
      periodEnd: initialValues?.periodEnd
        ? initialValues.periodEnd.substring(0, 10)
        : "",
      attachment: null,
      existingAttachment: initialValues?.attachment || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        let attachmentUrl = values.existingAttachment || "";

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
          if (!uploadResp.ok) {
            const body = await uploadResp.text();
            console.error("Upload failed", uploadResp.status, body);
            throw new Error("Upload failed");
          }
          attachmentUrl = presignedUrl.split("?")[0];
        }

        const payload = {
          account_id: Number(values.account_id),
          referenceNo: values.referenceNo || null,
          description: values.description || null,
          amountToPay: Number(values.amountToPay) || 0,
          amountPaid: values.amountPaid ? Number(values.amountPaid) : 0,
          attachment: attachmentUrl || null,
          periodStart: values.periodStart || null,
          periodEnd: values.periodEnd || null,
        };

        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(
            `/statement-of-accounts/${initialValues.id}`,
            payload
          );
          axiosInstance.post("/system-logs", {
            module: "StatementOfAccounts",
            action: "Update",
            description: `${user?.fullName || "User"} updated statement #${
              initialValues.id
            }`,
            createdBy: user?.fullName || user?.username || "system",
          });
          showSuccess("Statement updated successfully");
        } else {
          await axiosInstance.post("/statement-of-accounts", payload);
          axiosInstance.post("/system-logs", {
            module: "StatementOfAccounts",
            action: "Create",
            description: `${user?.fullName || "User"} created a statement`,
            createdBy: user?.fullName || user?.username || "system",
          });
          showSuccess("Statement created successfully");
        }

        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save statement";
        showError(msg);
      }
      setSubmitting(false);
    },
  });

  // File upload dropzone
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

  // paste support
  const dropAreaRef = useRef<HTMLDivElement | null>(null);
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
              const pasted = new File(
                [file],
                `soa-pasted-${Date.now()}.${ext}`,
                { type: file.type }
              );
              formik.setFieldValue("attachment", pasted);
              ev.preventDefault();
              break;
            }
          }
        }
      } catch (e) {
        console.error("Paste failed", e);
      }
    };
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
        {isEditMode ? "Edit Statement of Account" : "Add Statement of Account"}
      </DialogTitle>
      <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label={
                  <>
                    Account{requiredMark}
                    {accountsLoading && (
                      <Typography
                        component="span"
                        sx={{ fontSize: 11, ml: 1, color: "text.secondary" }}
                      >
                        Loading...
                      </Typography>
                    )}
                  </>
                }
                name="account_id"
                value={formik.values.account_id}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.account_id &&
                  Boolean(formik.errors.account_id)
                }
                helperText={
                  (formik.touched.account_id && formik.errors.account_id) ||
                  accountsError
                }
                fullWidth
                disabled={accountsLoading}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Reference No."
                name="referenceNo"
                value={formik.values.referenceNo}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={
                  <>
                    Amount To Pay{requiredMark}
                  </>
                }
                name="amountToPay"
                type="number"
                value={formik.values.amountToPay}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.amountToPay &&
                  Boolean(formik.errors.amountToPay)
                }
                helperText={
                  formik.touched.amountToPay && formik.errors.amountToPay
                }
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Amount Paid"
                name="amountPaid"
                type="number"
                value={formik.values.amountPaid}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.amountPaid &&
                  Boolean(formik.errors.amountPaid)
                }
                helperText={
                  formik.touched.amountPaid && formik.errors.amountPaid
                }
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Period Start"
                name="periodStart"
                type="date"
                value={formik.values.periodStart}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Period End"
                name="periodEnd"
                type="date"
                value={formik.values.periodEnd}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                fullWidth
                InputLabelProps={{ shrink: true }}
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
                minRows={3}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography fontWeight={500} mb={1}>
                Upload attachment
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
                    ? (formik.values.attachment as any).name ||
                      formik.values.attachment
                    : formik.values.existingAttachment
                    ? formik.values.existingAttachment.split("/").pop()
                    : "Drag & drop or click to upload (PDF, JPG, PNG)"}
                </Typography>
              </Box>
              {formik.touched.attachment && formik.errors.attachment && (
                <Typography color="error" variant="caption">
                  {formik.errors.attachment as any}
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
                    {isEditMode ? "Save Changes" : "Add Statement"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Statement"
                )
              }
            />
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddStatementOfAccountModal;