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
  id: string | number;
  store: string;
}

export interface AddCreditCardTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isEditMode?: boolean;
  initialValues?: any;
}

const requiredMark = (
  <Box component="span" sx={{ color: "#e74c3c", ml: 0.3 }}>
    *
  </Box>
);

// UPDATE validation: account is the selected account id (string)
const validationSchema = Yup.object({
  account: Yup.string().required("Account is required"),
  transactionAmount: Yup.number()
    .typeError("Amount must be a number")
    .required("Amount is required"),
  transactionDate: Yup.string().required("Transaction Date is required"),
  receiptNo: Yup.string().required("Receipt No is required"),
  attachment: Yup.mixed().nullable(),
});

const AddCreditCardTransactionModal: React.FC<
  AddCreditCardTransactionModalProps
> = ({ open, onClose, onSuccess, isEditMode, initialValues }) => {
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext) as any;

  // RENAME stores -> accounts and type to AccountOption
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // Fetch accounts (was stores)
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const load = async () => {
      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const res = await axiosInstance.get("/credit-card-transactions-accounts", {
          params: { perPage: 500, currentPage: 1, sortBy: "store", sortDir: "ASC" },
        });
        if (mounted) setAccounts(res.data?.items || res.data || []);
      } catch {
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
      // store selected by account id (string)
      account: initialValues?.account ? String(initialValues.account) : "",
      transactionAmount:
        initialValues?.transactionAmount !== undefined
          ? String(initialValues.transactionAmount)
          : "",
      // Date only (YYYY-MM-DD)
      transactionDate: initialValues?.transactionDate
        ? String(initialValues.transactionDate).slice(0, 10)
        : "",
      receiptNo: initialValues?.receiptNo || "",
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
            throw new Error("Upload failed");
          }
          attachmentUrl = presignedUrl.split("?")[0];
        }

        // Find selected account by id to get store name and id
        const selectedAccount = accounts.find(
          (a) => String(a.id) === String(values.account)
        );


        const payload = {
          account_id: selectedAccount ? selectedAccount.id : null,
          transactionAmount: Number(values.transactionAmount) || 0,
          // Append midnight time for backend DATETIME column
          transactionDate: values.transactionDate
            ? `${values.transactionDate} 00:00:00`
            : null,
          receiptNo: values.receiptNo || null,
          attachment: attachmentUrl || null,
        };

        if (isEditMode && initialValues?.id) {
          await axiosInstance.put(
            `/credit-card-transactions/${initialValues.id}`,
            payload
          );
          axiosInstance.post("/system-logs", {
            module: "CreditCardTransactions",
            action: "Update",
            description: `${user?.fullName || "User"} updated credit card transaction #${initialValues.id}`,
            createdBy: user?.fullName || user?.username || "system",
          });
          showSuccess("Credit card transaction successfully updated");
        } else {
          await axiosInstance.post("/credit-card-transactions", payload);
          axiosInstance.post("/system-logs", {
            module: "CreditCardTransactions",
            action: "Create",
            description: `${user?.fullName || "User"} created a credit card transaction`,
            createdBy: user?.fullName || user?.username || "system",
          });
          showSuccess("Credit card transaction successfully created");
        }

        if (onSuccess) onSuccess();
        resetForm();
        onClose();
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to save credit card transaction";
        showError(msg);
      }
      setSubmitting(false);
    },
  });

  // If editing and initialValues.store provided, set account id once accounts load
  useEffect(() => {
    if (!accounts.length) return;
    if (!initialValues?.store) return;
    // If formik.account already set, do nothing
    if (formik.values.account) return;
    const match = accounts.find((a) => a.store === String(initialValues.store));
    if (match) {
      formik.setFieldValue("account", String(match.id), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, initialValues]);

  // Dropzone
  const { getRootProps, getInputProps } = useDropzone({
    multiple: false,
    onDrop: (files) => {
      if (files?.[0]) formik.setFieldValue("attachment", files[0]);
    },
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png"],
    },
  });

  // Paste support
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
                `cct-pasted-${Date.now()}.${ext}`,
                { type: file.type }
              );
              formik.setFieldValue("attachment", pasted);
              ev.preventDefault();
              break;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [open, formik]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ position: "absolute", top: 5, right: 5 }}>
        <IconButton onClick={onClose} sx={{ color: "#e74c3c" }}>
          <CloseIcon fontSize="large" />
        </IconButton>
      </Box>
      <DialogTitle fontWeight={700} sx={{ pr: 6 }}>
        {isEditMode
          ? "Edit Credit Card Transaction"
          : "Add Credit Card Transaction"}
      </DialogTitle>
      <form onSubmit={formik.handleSubmit} noValidate autoComplete="off">
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
                name="account"
                value={formik.values.account}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.account && Boolean(formik.errors.account)}
                helperText={(formik.touched.account && formik.errors.account) || accountsError}
                fullWidth
                disabled={accountsLoading}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={String(a.id)}>
                    {a.store}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={
                  <>
                    Transaction Amount{requiredMark}
                  </>
                }
                name="transactionAmount"
                type="number"
                value={formik.values.transactionAmount}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.transactionAmount &&
                  Boolean(formik.errors.transactionAmount)
                }
                helperText={
                  formik.touched.transactionAmount &&
                  formik.errors.transactionAmount
                }
                fullWidth
                inputProps={{ min: 0, step: "0.01" }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={
                  <>
                    Transaction Date{requiredMark}
                  </>
                }
                name="transactionDate"
                type="date"
                value={formik.values.transactionDate}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.transactionDate &&
                  Boolean(formik.errors.transactionDate)
                }
                helperText={
                  formik.touched.transactionDate &&
                  formik.errors.transactionDate
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={
                  <>
                    Receipt No.{requiredMark}
                  </>
                }
                name="receiptNo"
                value={formik.values.receiptNo}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={
                  formik.touched.receiptNo &&
                  Boolean(formik.errors.receiptNo)
                }
                helperText={
                  formik.touched.receiptNo &&
                  formik.errors.receiptNo
                }
                fullWidth
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
                    {isEditMode ? "Save Changes" : "Add Transaction"}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Add Transaction"
                )
              }
            />
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddCreditCardTransactionModal;