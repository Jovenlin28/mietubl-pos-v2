import React, { useState, useEffect, useContext, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Grid,
  Box,
  Typography,
  CircularProgress,
  Stack,
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useDropzone } from "react-dropzone";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

interface RoyaltyFeeFormValues {
  account: string; // selected account id (string)
  amountToPay: string | number;
  dueDate: string;
  amountPaid: string | number;
  datePaid: string;
  attachment: File | null;
  existingAttachment: string;
}

interface AccountOption {
  id: number | string;
  mall: string | null;
  store: string | null;
  partner: string | null;
}

interface AddRoyaltyFeeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (saved: any, isEdit: boolean) => void;
  isEdit?: boolean;
  initialValues?: (Partial<RoyaltyFeeFormValues> & { id?: number; account_id?: number }) | null;
  submitting?: boolean;
}

const validationSchema = Yup.object({
  amountToPay: Yup.number()
    .typeError("Amount To Pay must be a number")
    .required("Amount To Pay is required"),
  amountPaid: Yup.number().typeError("Amount Paid must be a number").nullable(),
  account: Yup.string().required("Account is required"),
  dueDate: Yup.string().nullable(),
  datePaid: Yup.string().nullable(),
  attachment: Yup.mixed().nullable(),
});

const AddRoyaltyFeeModal: React.FC<AddRoyaltyFeeModalProps> = ({
  open,
  onClose,
  onSubmit,
  isEdit = false,
  initialValues,
  submitting = false,
}) => {
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext) as any;
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const load = async () => {
      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const res = await axiosInstance.get("/royalty-fees-accounts", {
          params: { perPage: 500, currentPage: 1, sortBy: "store", sortDir: "ASC" },
        });
        if (!mounted) return;
        setAccounts(res.data?.items || res.data || []);
      } catch (err) {
        if (!mounted) return;
        setAccounts([]);
        setAccountsError("Failed to load accounts");
      } finally {
        if (mounted) setAccountsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [open]);

  const toDateInput = (v: any) =>
    v ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : (String(v).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "")) : "";

  const formik = useFormik<RoyaltyFeeFormValues>({
    initialValues: {
      account: initialValues?.account || (initialValues?.account_id ? String(initialValues.account_id) : ""),
      amountToPay: initialValues?.amountToPay ?? "",
      dueDate: toDateInput(initialValues?.dueDate),
      amountPaid: initialValues?.amountPaid ?? "",
      datePaid: toDateInput(initialValues?.datePaid),
      attachment: null,
      existingAttachment: (initialValues as any)?.attachment || "",
    },
    enableReinitialize: true,
    validationSchema,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        // upload attachment if provided
        let attachmentUrl = values.existingAttachment || "";
        if (values.attachment instanceof File) {
          const filename = `${Date.now()}-${values.attachment.name}`;
          const contentType = values.attachment.type || "application/octet-stream";
          const presignRes = await axiosInstance.get("/upload/presign", { params: { filename, contentType } });
          const { url: presignedUrl, method, expiresAt } = presignRes.data;
          if (expiresAt && Date.now() + 5000 > expiresAt) throw new Error("Presigned URL expired. Try again.");
          const uploadResp = await fetch(presignedUrl, {
            method: method || "PUT",
            headers: { "Content-Type": contentType, "x-amz-acl": "public-read" },
            body: values.attachment,
          });
          if (!uploadResp.ok) throw new Error("Upload failed");
          attachmentUrl = presignedUrl.split("?")[0];
        }

        // find selected account object
        const selectedAccount = accounts.find((a) => String(a.id) === String(values.account));
        const payload: any = {
          account_id: selectedAccount ? selectedAccount.id : Number(values.account) || null,
          amountToPay: Number(values.amountToPay || 0),
          dueDate: values.dueDate || null,
          amountPaid: values.amountPaid === "" || values.amountPaid === null ? 0 : Number(values.amountPaid),
          datePaid: values.datePaid || null,
          attachment: attachmentUrl || null,
        };

        let saved;
        if (isEdit && initialValues?.id) {
          await axiosInstance.put(`/royalty-fees/${initialValues.id}`, payload);
          const res = await axiosInstance.get(`/royalty-fees/${initialValues.id}`);
          saved = res.data;
          showSuccess("Royalty fee updated");
          await axiosInstance.post("/system-logs", {
            module: "Royalty Fees",
            action: "Update",
            description: `${user?.fullName || "User"} updated a royalty fee`,
            createdBy: user?.fullName || user?.username || "system",
          });
        } else {
          const res = await axiosInstance.post(`/royalty-fees`, payload);
          saved = res.data?.item || res.data;
          showSuccess("Royalty fee created");
          await axiosInstance.post("/system-logs", {
            module: "Royalty Fees",
            action: "Create",
            description: `${user?.fullName || "User"} created a royalty fee`,
            createdBy: user?.fullName || user?.username || "system",
          });
        }

        onSubmit?.(saved, !!isEdit);
        onClose();
      } catch (err: any) {
        showError(err?.response?.data?.error || err?.message || (isEdit ? "Failed to update royalty fee" : "Failed to create royalty fee"));
      } finally {
        setSaving(false);
      }
    },
  });

  // Dropzone + paste support (unchanged)
  const dropRef = useRef<HTMLDivElement | null>(null);
  const { getRootProps, getInputProps } = useDropzone({
    multiple: false,
    onDrop: (files) => { if (files && files[0]) formik.setFieldValue("attachment", files[0]); },
    accept: { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png"] },
  });

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
              const pasted = new File([file], `royalty-fee-${Date.now()}.${ext}`, { type: file.type });
              formik.setFieldValue("attachment", pasted);
              ev.preventDefault();
              break;
            }
          }
        }
      } catch (e) { /* ignore */ }
    };
    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [open, formik]);

  // if initialValues provided with account_id, set the select after accounts load
  useEffect(() => {
    if (!open) return;
    if (!accounts.length) return;
    if (!initialValues) return;

    // prefer explicit account_id, fallback to nested account.id from the row
    const incomingAccountId =
      (initialValues as any).account_id ??
      (initialValues as any).account?.id ??
      null;

    if (incomingAccountId == null) return;

    // only set if different/empty to avoid overwriting user selection
    if (String(formik.values.account || "") !== String(incomingAccountId)) {
      formik.setFieldValue("account", String(incomingAccountId), false);
    }
  }, [open, accounts, initialValues]); // eslint-disable-line

  useEffect(() => { if (!open) setSaving(false); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", minHeight: 56, pl: 3, pr: 1 }}>
        {isEdit ? "Edit Royalty Fee" : "Add Royalty Fee"}
        <IconButton aria-label="close" onClick={onClose} sx={{ ml: "auto", color: "#e74c3c" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <form onSubmit={formik.handleSubmit} autoComplete="off">
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label={<>Account <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>*</Box></>}
                name="account"
                value={formik.values.account}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.account && Boolean(formik.errors.account)}
                helperText={(formik.touched.account && formik.errors.account) || accountsError}
                disabled={accountsLoading}
              >
                <MenuItem value="">-- Select account --</MenuItem>
                {accounts.map((acc) => (
                  <MenuItem key={acc.id} value={String(acc.id)}>
                    {`${acc.mall || "-"} - ${acc.store || "-"} - ${acc.partner || "-"}`}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount To Pay *"
                name="amountToPay"
                type="number"
                value={formik.values.amountToPay}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.amountToPay && Boolean(formik.errors.amountToPay)}
                helperText={formik.touched.amountToPay && formik.errors.amountToPay}
                inputProps={{ step: "0.01" }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Due Date" name="dueDate" type="date" value={formik.values.dueDate} onChange={formik.handleChange} onBlur={formik.handleBlur} InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Amount Paid" name="amountPaid" type="number" value={formik.values.amountPaid} onChange={formik.handleChange} onBlur={formik.handleBlur} inputProps={{ step: "0.01" }} error={formik.touched.amountPaid && Boolean(formik.errors.amountPaid)} helperText={formik.touched.amountPaid && formik.errors.amountPaid} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date Paid" name="datePaid" type="date" value={formik.values.datePaid} onChange={formik.handleChange} onBlur={formik.handleBlur} InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid item xs={12}>
              <Typography fontWeight={500} mb={1}>Upload attachment</Typography>
              <Box {...getRootProps()} ref={dropRef} tabIndex={0} sx={{ border: "1px dashed #bdbdbd", borderRadius: 2, p: 2, textAlign: "center", cursor: "pointer", bgcolor: "#fafbfc" }}>
                <input {...getInputProps()} />
                <Typography variant="body2" color="text.secondary">
                  {formik.values.attachment ? (formik.values.attachment as any).name : formik.values.existingAttachment ? formik.values.existingAttachment.split("/").pop() : "Drag & drop or click to upload (PDF, JPG, PNG)"}
                </Typography>
              </Box>
              {formik.touched.attachment && formik.errors.attachment && <Typography color="error" variant="caption">{formik.errors.attachment as any}</Typography>}
            </Grid>
          </Grid>

          <DialogActions sx={{ mt: 3, px: 0 }}>
            <Stack direction="row" spacing={2} width="100%" justifyContent="space-between">
              <Button onClick={onClose} variant="contained" sx={{ bgcolor: "#0a2239", color: "#fff", fontWeight: 700, px: 4, boxShadow: 0, "&:hover": { bgcolor: "#173f5f" } }} disabled={saving}>CANCEL</Button>
              <Button type="submit" variant="contained" sx={{ bgcolor: "#f39c12", color: "#fff", fontWeight: 700, px: 4, boxShadow: 0, "&:hover": { bgcolor: "#e67e22" } }} disabled={saving || submitting || formik.isSubmitting}>
                {saving || formik.isSubmitting ? (<><CircularProgress size={18} sx={{ color: "#fff", mr: 1 }} />{isEdit ? "UPDATING..." : "SAVING..."}</>) : isEdit ? "UPDATE ROYALTY FEE" : "ADD ROYALTY FEE"}
              </Button>
            </Stack>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddRoyaltyFeeModal;