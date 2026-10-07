import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Backdrop,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import { useFormik } from "formik";
import * as Yup from "yup";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { DElIVERY_METHOD } from "../enums/delivery-method.enum";

type CategoryOption = {
  id: number;
  name: string;
};

type ProductOption = {
  id?: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  discount: number;
};

type ProductCode = {
  sku: string;
  name: string;
};

type FormProduct = {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  qty: number | "";
  discount: number;
};

interface FormValues {
  saleDate: string;
  deliveryOption: string;
  category: string;
  paymentOption: string;
  customerName: string;
  storeName: string;
  customerPhone: string;
  customerEmail: string;
  company: string;
  address: string;
  notes: string;
  products: FormProduct[];
}

const PUBLIC_PO_SCHEMA = Yup.object().shape({
  saleDate: Yup.string().required("Purchase Order date is required"),
  deliveryOption: Yup.string().required("Delivery option is required"),
  category: Yup.string().required("Category is required"),
  paymentOption: Yup.string().required("Payment option is required"),
  customerName: Yup.string().required("Customer name is required"),
  storeName: Yup.string().required("Store name is required"),
  customerPhone: Yup.string()
    .trim()
    .required("Phone number is required")
    .matches(
      /^[+0-9()\-\s]+$/,
      "Phone number can only contain digits, spaces, +, -, and parentheses"
    )
    .test(
      "phone-length",
      "Phone number must be between 7 and 15 digits",
      (value) => {
        if (!value) return false;
        const digitsOnly = value.replace(/\D/g, "");
        return digitsOnly.length >= 7 && digitsOnly.length <= 15;
      }
    ),
  customerEmail: Yup.string().email("Email must be a valid email"),
  address: Yup.string().required("Address is required"),
  company: Yup.string(),
  notes: Yup.string(),
  products: Yup.array()
    .of(
      Yup.object().shape({
        id: Yup.number().required(),
        name: Yup.string().required(),
        sku: Yup.string().required(),
        price: Yup.number().required(),
        stock: Yup.number().required(),
        qty: Yup.number()
          .typeError("Quantity is required")
          .min(1, "Quantity must be at least 1")
          .required("Quantity is required"),
        discount: Yup.number().required(),
      })
    )
    .min(1, "At least one product is required"),
});

const PublicPurchaseOrder: React.FC = () => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [productCodesLoading, setProductCodesLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<ProductCode[]>([]);
  const [submittedTicketCode, setSubmittedTicketCode] = useState<string>("");

  const formik = useFormik<FormValues>({
    initialValues: {
      saleDate: new Date().toISOString().slice(0, 10),
      deliveryOption: "",
      category: "",
      paymentOption: "",
      customerName: "",
      storeName: "",
      customerPhone: "",
      customerEmail: "",
      company: "",
      address: "",
      notes: "",
      products: [],
    },
    validationSchema: PUBLIC_PO_SCHEMA,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      setLoading(true);
      setSubmittedTicketCode("");
      try {
        const payload = {
          saleDate: values.saleDate,
          salesChannel: "Online",
          deliveryOption: values.deliveryOption,
          category: values.category,
          paymentOption: values.paymentOption,
          customer: {
            fullName: values.customerName,
            storeName: values.storeName,
            phone: values.customerPhone,
            email: values.customerEmail || null,
            company: values.company,
            address: values.address,
          },
          storeName: values.storeName,
          company: values.company,
          address: values.address,
          notes: values.notes,
          products: values.products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            price: Number(p.price),
            qty: Number(p.qty),
            discount: Number(p.discount || 0),
          })),
        };

        const res = await axiosInstance.post("/public/purchase-orders", payload);
        const ticketCode =
          res?.data?.ticketCode ||
          res?.data?.ticket_code ||
          res?.data?.code ||
          res?.data?.referenceCode ||
          "";

        if (ticketCode) {
          setSubmittedTicketCode(String(ticketCode));
        }

        showSuccess(
          ticketCode
            ? `Purchase order submitted. Ticket code: ${ticketCode}`
            : "Purchase order submitted successfully."
        );

        resetForm({
          values: {
            saleDate: new Date().toISOString().slice(0, 10),
            deliveryOption: "",
            category: "",
            paymentOption: "",
            customerName: "",
            storeName: "",
            customerPhone: "",
            customerEmail: "",
            company: "",
            address: "",
            notes: "",
            products: [],
          },
        });
        setSelectedCodes([]);
        setProductOptions([]);
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to submit purchase order";
        showError(msg);
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    },
  });

  const fetchCategories = async () => {
    setCategoryLoading(true);
    try {
      const res = await axiosInstance.get("/categories", {
        params: { perPage: 1000, currentPage: 1 },
      });
      const list = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];

      setCategoryOptions(
        list
          .map((c: any) => ({ id: Number(c.id), name: String(c.name || "") }))
          .filter((c: CategoryOption) => c.name)
      );
    } catch {
      setCategoryOptions([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const fetchProductsByCategory = async (category: string) => {
    if (!category) {
      setProductOptions([]);
      return;
    }
    setProductCodesLoading(true);
    try {
      const res = await axiosInstance.get(
        `/products/category/${encodeURIComponent(category)}`,
        {
          params: { perPage: 1000, currentPage: 1 },
        }
      );
      const list = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];

      const mapped: ProductOption[] = list
        .map((p: any) => ({
          id: p.id !== undefined && p.id !== null ? Number(p.id) : undefined,
          name: String(p.name ?? p.product_name ?? p.title ?? ""),
          sku: String(p.sku ?? p.code ?? ""),
          price: Number(p.price ?? p.unit_price ?? 0),
          stock: Number(p.qty ?? p.stock ?? 0),
          discount:
            Number(p.discount ?? p.discountValue ?? p.discount_value ?? 0) || 0,
        }))
        .filter((p: ProductOption) => p.name && p.sku);

      const uniq = Array.from(new Map(mapped.map((p) => [p.sku, p])).values());
      setProductOptions(uniq);
    } catch {
      setProductOptions([]);
    } finally {
      setProductCodesLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCategories();
  }, []);

  const filteredProductOptions = useMemo(
    () => productOptions.map((p) => ({ sku: p.sku, name: p.name })),
    [productOptions]
  );

  const handleCategoryChange = async (category: string) => {
    formik.setFieldValue("category", category);
    formik.setFieldValue("products", []);
    setSelectedCodes([]);
    setSearchError("");
    await fetchProductsByCategory(category);
  };

  const handleQuantityChange = (idx: number, value: number | string) => {
    const products = [...formik.values.products];
    const availableStock = Number(products[idx].stock || 0);

    if (value === "") {
      products[idx].qty = "";
      formik.setFieldValue("products", products);
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const qty = Math.max(0, Math.floor(parsed));

    if (availableStock > 0 && qty > availableStock) {
      products[idx].qty = "";
      formik.setFieldValue("products", products);
      return;
    }

    products[idx].qty = qty;
    formik.setFieldValue("products", products);
  };

  const handleDeleteProduct = (idx: number) => {
    const products = [...formik.values.products];
    const removed = products.splice(idx, 1)[0];
    formik.setFieldValue("products", products);
    if (removed?.sku) {
      setSelectedCodes((prev) => prev.filter((c) => c.sku !== removed.sku));
    }
  };

  const handleCopyTicketCode = async () => {
    if (!submittedTicketCode) return;

    try {
      await navigator.clipboard.writeText(submittedTicketCode);
      showSuccess("Ticket code copied.");
    } catch {
      showError("Failed to copy ticket code.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100%",
        p: { xs: 2, sm: 4 },
        background:
          "radial-gradient(circle at 20% 20%, #fef9c3 0, transparent 35%), radial-gradient(circle at 80% 10%, #bfdbfe 0, transparent 30%), #f8fafc",
      }}
    >
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Box
            component="img"
            src="/mietubl-logo.png"
            alt="Mietubl Philippines"
            sx={{
              width: { xs: 150, sm: 280 },
              maxWidth: "100%",
              height: "auto",
            }}
          />
        </Box>

      <Paper
        elevation={2}
        sx={{
          maxWidth: 1200,
          mx: "auto",
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" fontWeight={700} mb={0.5}>
          Purchase Order Request
        </Typography>
        <Typography color="text.secondary" mb={3}>
          Fill out this form to submit your order request. We will generate a ticket
          code after submission.
        </Typography>

        {submittedTicketCode && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 2,
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography fontWeight={600} color="#166534">
                Your ticket code is {submittedTicketCode}
              </Typography>
              <Tooltip title="Copy ticket code" arrow>
                <IconButton
                  size="small"
                  onClick={handleCopyTicketCode}
                  sx={{ color: "#166534", p: 0.5 }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="body2" color="#166534" mt={0.5}>
              Please keep this code. Our staff will use it to process your order.
            </Typography>
            <Button
              component="a"
              href={`/purchase-order-tracker?ticketCode=${encodeURIComponent(
                submittedTicketCode
              )}`}
              variant="text"
              size="small"
              sx={{ mt: 0.5, px: 0, textTransform: "none", fontWeight: 700 }}
            >
              Track this purchase order
            </Button>
          </Box>
        )}

        <form onSubmit={formik.handleSubmit} autoComplete="off">
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
            <TextField
              label="Customer Name"
              name="customerName"
              value={formik.values.customerName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={!!formik.errors.customerName && !!formik.touched.customerName}
              helperText={formik.touched.customerName && formik.errors.customerName}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField
              label="Store Name"
              name="storeName"
              value={formik.values.storeName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                !!formik.errors.storeName && !!formik.touched.storeName
              }
              helperText={
                formik.touched.storeName && formik.errors.storeName
              }
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField
              label="Phone Number"
              name="customerPhone"
              type="tel"
              value={formik.values.customerPhone}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                !!formik.errors.customerPhone && !!formik.touched.customerPhone
              }
              helperText={
                formik.touched.customerPhone && formik.errors.customerPhone
              }
              inputProps={{ maxLength: 20 }}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <TextField
              label="Email (optional)"
              name="customerEmail"
              value={formik.values.customerEmail}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={
                !!formik.errors.customerEmail && !!formik.touched.customerEmail
              }
              helperText={
                formik.touched.customerEmail && formik.errors.customerEmail
              }
              sx={{ flex: 1, minWidth: 240 }}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 3,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <TextField
              label="Company (optional)"
              name="company"
              value={formik.values.company}
              onChange={formik.handleChange}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Address"
              name="address"
              value={formik.values.address}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={!!formik.errors.address && !!formik.touched.address}
              helperText={formik.touched.address && formik.errors.address}
              sx={{ flex: 1 }}
            />
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
            <TextField
              label="Purchase Order Date"
              type="date"
              name="saleDate"
              value={formik.values.saleDate}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 220 }}
              error={!!formik.errors.saleDate && !!formik.touched.saleDate}
              helperText={formik.touched.saleDate && formik.errors.saleDate}
            />
            <TextField
              label="Delivery Option"
              name="deliveryOption"
              select
              value={formik.values.deliveryOption}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              sx={{ flex: 1, minWidth: 220 }}
              error={
                !!formik.errors.deliveryOption && !!formik.touched.deliveryOption
              }
              helperText={
                formik.touched.deliveryOption && formik.errors.deliveryOption
              }
            >
              <MenuItem value={DElIVERY_METHOD.LALA_MOVE}>
                {DElIVERY_METHOD.LALA_MOVE}
              </MenuItem>
              <MenuItem value={DElIVERY_METHOD.AP_CARGO}>
                {DElIVERY_METHOD.AP_CARGO}
              </MenuItem>
              <MenuItem value={DElIVERY_METHOD.LBC}>{DElIVERY_METHOD.LBC}</MenuItem>
              <MenuItem value={DElIVERY_METHOD.WALK_IN_CLIENT}>
                {DElIVERY_METHOD.WALK_IN_CLIENT}
              </MenuItem>
              <MenuItem value={DElIVERY_METHOD.BUS_DELIVERY}>
                {DElIVERY_METHOD.BUS_DELIVERY}
              </MenuItem>
              <MenuItem value={DElIVERY_METHOD.PERSONAL_DELIVERY}>
                {DElIVERY_METHOD.PERSONAL_DELIVERY}
              </MenuItem>
              <MenuItem value={DElIVERY_METHOD.OTHERS}>
                {DElIVERY_METHOD.OTHERS}
              </MenuItem>
            </TextField>
            <TextField
              label="Payment Option"
              name="paymentOption"
              select
              value={formik.values.paymentOption}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              sx={{ flex: 1, minWidth: 220 }}
              error={
                !!formik.errors.paymentOption && !!formik.touched.paymentOption
              }
              helperText={
                formik.touched.paymentOption && formik.errors.paymentOption
              }
            >
              <MenuItem value="Cash Payment">Cash Payment</MenuItem>
              <MenuItem value="Installment Payment">Installment Payment</MenuItem>
              <MenuItem value="LBC">LBC</MenuItem>
              <MenuItem value="PDC">PDC</MenuItem>
              <MenuItem value="TBD">TBD</MenuItem>
            </TextField>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 2,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <TextField
              label="Select category"
              name="category"
              select
              value={formik.values.category}
              onFocus={fetchCategories}
              onChange={async (e) => {
                await handleCategoryChange(e.target.value);
              }}
              onBlur={formik.handleBlur}
              sx={{ width: { xs: "100%", sm: 360 } }}
              error={!!formik.errors.category && !!formik.touched.category}
              helperText={formik.touched.category && formik.errors.category}
              disabled={categoryLoading}
            >
              {categoryOptions.map((c) => (
                <MenuItem key={c.id} value={c.name}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <Autocomplete
              multiple
              options={filteredProductOptions}
              value={selectedCodes}
              getOptionLabel={(opt) => `${opt.name}-${opt.sku}`}
              isOptionEqualToValue={(option, value) => option.sku === value.sku}
              renderTags={() => null}
              filterSelectedOptions
              loading={productCodesLoading}
              disabled={!formik.values.category || productCodesLoading}
              onChange={async (_, values) => {
                const prevSkus = new Set(selectedCodes.map((s) => s.sku));
                const nowSkus = new Set(values.map((s) => s.sku));

                const added = values.filter((v) => !prevSkus.has(v.sku));
                const removedSkus = Array.from(prevSkus).filter(
                  (sku) => !nowSkus.has(sku)
                );

                setSelectedCodes(values);
                setSearchError("");

                if (removedSkus.length > 0) {
                  formik.setFieldValue(
                    "products",
                    formik.values.products.filter(
                      (p) => !removedSkus.includes(String(p.sku))
                    )
                  );
                }

                if (added.length > 0) {
                  setLoading(true);
                  try {
                    const fetches = added.map((o) =>
                      axiosInstance
                        .get(`/products/code/${encodeURIComponent(o.sku)}`)
                        .then((r) => r.data)
                        .catch(() => null)
                    );
                    const results = await Promise.all(fetches);
                    const toAdd: FormProduct[] = [];
                    for (const found of results) {
                      if (!found) continue;

                      const sku = String(found.sku ?? found.code ?? "");
                      if (formik.values.products.some((p) => p.sku === sku)) {
                        continue;
                      }

                      toAdd.push({
                        id: Number(found.id),
                        name: String(found.name ?? found.product_name ?? "Product"),
                        sku,
                        price: Number(found.price ?? found.unit_price ?? 0),
                        stock: Number(found.qty ?? found.stock ?? 0),
                        qty:
                          (Number(found.qty ?? found.stock ?? 0) || 0) > 0
                            ? 1
                            : 0,
                        discount:
                          Number(
                            found.discount ??
                              found.discountValue ??
                              found.discount_value ??
                              0
                          ) || 0,
                      });
                    }

                    if (toAdd.length > 0) {
                      formik.setFieldValue("products", [
                        ...formik.values.products,
                        ...toAdd,
                      ]);
                    }
                  } catch {
                    setSearchError("Failed to add some products.");
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select products"
                  sx={{ minWidth: { xs: "100%", sm: 360 } }}
                  helperText={
                    searchError ||
                    (!formik.values.category
                      ? "Select a category to load products"
                      : "")
                  }
                  error={!!searchError}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productCodesLoading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ width: { xs: "100%", sm: 420 } }}
            />
          </Box>

          {formik.values.products.length > 0 && (
            <Box sx={{ mt: 2, mb: 3 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                {selectedCodes.map((pc) => (
                  <Button
                    key={pc.sku}
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSelectedCodes((prev) => prev.filter((c) => c.sku !== pc.sku));
                      formik.setFieldValue(
                        "products",
                        formik.values.products.filter((p) => p.sku !== pc.sku)
                      );
                    }}
                    sx={{ borderRadius: 4, textTransform: "none" }}
                  >
                    {pc.name}-{pc.sku}
                  </Button>
                ))}
              </Box>

              <Typography fontWeight={700} fontSize={16} mb={1}>
                Products
              </Typography>
              <Box
                sx={{
                  overflowX: "auto",
                  borderRadius: 2,
                  background: "#f8fafc",
                  p: 2,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <colgroup>
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8 }}>Product</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Code</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Unit Cost</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Stock</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Quantity</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Subtotal</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formik.values.products.map((p, idx) => {
                      const availableStock = Number(p.stock || 0);
                      const selectedQty =
                        availableStock === 0
                          ? 0
                          : typeof p.qty === "undefined" || p.qty === null
                          ? ""
                          : p.qty;
                      const qtyNum = selectedQty === "" ? 0 : Number(selectedQty) || 0;
                      const unitNet =
                        Number(p.price || 0) - Number(p.discount || 0);
                      const subtotal = Math.max(0, unitNet) * qtyNum;

                      return (
                        <tr key={p.sku || idx} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: 8 }}>{p.name}</td>
                          <td style={{ padding: 8 }}>{p.sku}</td>
                          <td style={{ padding: 8 }}>₱{Number(p.price).toFixed(2)}</td>
                          <td style={{ padding: 8 }}>{availableStock}</td>
                          <td style={{ padding: 8 }}>
                            <Box
                              sx={{
                                display: "flex",
                                bgcolor: "#f4f6fb",
                                borderRadius: 1,
                                width: 130,
                                gap: 1,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={() =>
                                  handleQuantityChange(
                                    idx,
                                    Math.max(0, (Number(selectedQty) || 0) - 1)
                                  )
                                }
                                disabled={
                                  availableStock === 0 ||
                                  selectedQty === "" ||
                                  Number(selectedQty) <= 1
                                }
                                sx={{
                                  color: "#fff",
                                  bgcolor: "#2563eb",
                                  "&:hover": { bgcolor: "#1d4ed8" },
                                  width: 26,
                                  height: 26,
                                  minWidth: 26,
                                  minHeight: 26,
                                }}
                              >
                                <ArrowBackIosNewIcon fontSize="small" />
                              </IconButton>

                              <TextField
                                size="small"
                                value={selectedQty === "" ? "" : selectedQty}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "") {
                                    handleQuantityChange(idx, "");
                                    return;
                                  }
                                  const num = Number(v);
                                  if (Number.isNaN(num)) return;
                                  handleQuantityChange(idx, Math.max(0, Math.floor(num)));
                                }}
                                onBlur={() => {
                                  const cur =
                                    selectedQty === "" ? "" : Number(selectedQty);
                                  if (cur === "") return;

                                  const stock = Number(availableStock || 0);
                                  if (stock > 0 && (cur as number) > stock) {
                                    handleQuantityChange(idx, "");
                                    return;
                                  }

                                  const clamped = Math.max(
                                    1,
                                    Math.floor(Number(cur))
                                  );
                                  if (clamped !== Number(selectedQty)) {
                                    handleQuantityChange(idx, clamped);
                                  }
                                }}
                                inputProps={{
                                  inputMode: "numeric",
                                  pattern: "[0-9]*",
                                  min: 1,
                                  max: availableStock,
                                  style: {
                                    textAlign: "center",
                                    padding: "6px 8px",
                                  },
                                }}
                                sx={{
                                  width: 56,
                                  "& .MuiInputBase-input": {
                                    textAlign: "center",
                                    fontWeight: 500,
                                  },
                                }}
                              />

                              <IconButton
                                size="small"
                                onClick={() =>
                                  handleQuantityChange(
                                    idx,
                                    (Number(selectedQty) || 0) + 1
                                  )
                                }
                                disabled={
                                  availableStock === 0 ||
                                  (Number(selectedQty) || 0) >= availableStock
                                }
                                sx={{
                                  color: "#fff",
                                  bgcolor: "#2563eb",
                                  "&:hover": { bgcolor: "#1d4ed8" },
                                  width: 26,
                                  height: 26,
                                  minWidth: 26,
                                  minHeight: 26,
                                }}
                              >
                                <ArrowForwardIosIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </td>
                          <td style={{ padding: 8 }}>
                            ₱
                            {Number(subtotal).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ padding: 8 }}>
                            <IconButton color="error" onClick={() => handleDeleteProduct(idx)}>
                              <DeleteIcon />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </Box>
          )}

          <TextField
            label="Notes"
            name="notes"
            value={formik.values.notes}
            onChange={formik.handleChange}
            sx={{ width: "100%", mb: 3 }}
            multiline
            minRows={3}
            placeholder="Optional notes"
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={formik.isSubmitting}
              sx={{
                bgcolor: "#ea580c",
                color: "#fff",
                minWidth: 220,
                textTransform: "none",
                fontWeight: 700,
                "&:hover": { bgcolor: "#c2410c" },
              }}
            >
              Submit Purchase Order Request
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default PublicPurchaseOrder;