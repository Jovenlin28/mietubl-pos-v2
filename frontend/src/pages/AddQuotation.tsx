import React, { useState, useEffect, useContext } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Paper,
  Backdrop,
  CircularProgress,
  Autocomplete,
  Chip,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../configs/axiosConfig";
import { Product } from "../models/Product";
import { Category } from "../models/Category";
import { UserContext } from "../layouts/DashboardLayout";

const QUOTATION_SCHEMA = Yup.object().shape({
  quotationDate: Yup.string().required("Quotation date is required"),
  status: Yup.string().required("Status is required"),
  customerId: Yup.string().required("Customer is required"),
  category: Yup.string().required("Category is required"),
  notes: Yup.string(),
  items: Yup.array()
    .of(
      Yup.object().shape({
        id: Yup.number().required(),
        name: Yup.string().required(),
        price: Yup.number().required(),
        quantity: Yup.number().min(1).required(),
        discount: Yup.number(),
        total: Yup.number(),
      })
    )
    .min(1, "At least one product is required"),
});

const AddQuotation: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<
    { id: number; fullName: string }[]
  >([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [productDiscounts, setProductDiscounts] = useState<{
    [key: string]: number;
  }>({});
  type ProductCode = { sku: string; name: string };
  const [productCodes, setProductCodes] = useState<ProductCode[]>([]);
  const [productCodesLoading, setProductCodesLoading] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<ProductCode[]>([]);
  // Category-related state
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const navigate = useNavigate();
  const user = useContext(UserContext);

  const formik = useFormik({
    initialValues: {
      quotationDate: new Date().toISOString().slice(0, 10),
      status: "Pending",
      customerId: "",
      category: "",
      notes: "",
      items: [],
    },
    validationSchema: QUOTATION_SCHEMA,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      setLoading(true);
      try {
        if (isEditMode && id) {
          await axiosInstance.put(`/quotations/${id}`, {
            customer_id: values.customerId,
            quotationDate: values.quotationDate,
            notes: values.notes,
            category: values.category,
            status: values.status,
            items: values.items.map((item: any) => ({
              product_id: item.id,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount || 0,
              total: (item.price - (item.discount || 0)) * item.quantity,
            })),
          });
          axiosInstance.post(`/system-logs/`, {
            module: "Quotations",
            action: "Update",
            description: `${user?.fullName || 'User'} (${user?.role || 'Unknown'}) updated a quotation`,
            createdBy: user?.fullName || 'User',
          });
        } else {
          await axiosInstance.post("/quotations", {
            customer_id: values.customerId,
            quotationDate: values.quotationDate,
            notes: values.notes,
            category: values.category,
            status: values.status,
            items: values.items.map((item: any) => ({
              product_id: item.id,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount || 0,
              total: (item.price - (item.discount || 0)) * item.quantity,
            })),
          });
          axiosInstance.post(`/system-logs/`, {
            module: "Quotations",
            action: "Create",
            description: `${user?.fullName || 'User'} (${user?.role || 'Unknown'}) created a quotation`,
            createdBy: user?.fullName || 'User',
          });
        }
        setLoading(false);
        navigate("/quotations");
      } catch (err: any) {
        setLoading(false);
        alert(
          err?.response?.data?.error ||
            "Failed to save quotation. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Fetch customers for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      setCustomerLoading(true);
      try {
        const res = await axiosInstance.get("/customers", {
          params: { perPage: 1000, currentPage: 1 },
        });
        const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setCustomerOptions(data);
      } catch (err) {
        console.log('Failed to fetch customers:', err);
        setCustomerOptions([]);
      } finally {
        setCustomerLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch categories for dropdown
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoryLoading(true);
      try {
        const res = await axiosInstance.get("/categories", {
          params: { perPage: 1000, currentPage: 1 },
        });
        const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setCategoryOptions(data);
      } catch (err) {
        console.log('Failed to fetch categories:', err);
        setCategoryOptions([]);
      } finally {
        setCategoryLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch product codes for the multi-select dropdown (removed - now category-dependent)
  
  // Handle selecting a category: fetch product codes for that category and reset current selections
  const handleCategoryChange = async (newCategory: string) => {
    formik.setFieldValue("category", newCategory);
    // clear previous selections and items
    setSelectedCodes([]);
    formik.setFieldValue("items", []);
    setSearchError("");

    if (!newCategory) {
      setProductCodes([]);
      return;
    }

    setProductCodesLoading(true);
    try {
      // fetch products by category
      const res = await axiosInstance.get(
        `/products/category/${encodeURIComponent(newCategory)}`,
        {
          params: { perPage: 1000, currentPage: 1 },
        }
      );
      const list = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];
      // map to {name, sku}
      const codes: ProductCode[] = list
        .map((p: any) => ({
          name: String(p.name ?? p.product_name ?? p.title ?? ""),
          sku: String(p.sku ?? p.code ?? ""),
        }))
        .filter((x: any) => x.sku && x.name);
      // unique by sku
      const uniq = Array.from(new Map(codes.map((c) => [c.sku, c])).values());
      setProductCodes(uniq);
    } catch (err) {
      console.error("Failed to fetch products for category", err);
      setProductCodes([]);
    } finally {
      setProductCodesLoading(false);
    }
  };

  // If editing, fetch quotation by id and populate form
  useEffect(() => {
    if (!isEditMode || !id) return;

    const fetchQuotation = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/quotations/${id}`);
        const q = res.data;
        const mappedItems = Array.isArray(q.items)
          ? q.items.map((it: any) => ({
              id: it.product_id ?? it.id ?? null,
              name: it.name ?? it.product_name ?? "Product",
              sku: it.sku ?? it.code ?? "",
              price: Number(it.price ?? it.unit_price ?? 0),
              quantity: Number(it.quantity ?? it.qty ?? 1),
              discount: Number(it.discount ?? 0),
              total:
                Number(
                  it.total ??
                    (it.price ?? it.unit_price ?? 0) - (it.discount ?? 0)
                ) * Number(it.quantity ?? it.qty ?? 1),
            }))
          : [];

        formik.setValues({
          quotationDate:
            (q.quotationDate && q.quotationDate.slice(0, 10)) ??
            q.quotation_date ??
            formik.initialValues.quotationDate,
          status: q.status ?? q.state ?? formik.initialValues.status,
          customerId: q.customer?.id ?? q.customer_id ?? q.customerId ?? "",
          category: q.category ?? q.category_name ?? "",
          notes: q.notes ?? "",
          items: mappedItems,
        });

        // If editing and has category, fetch product codes for that category
        const categoryToLoad = q.category ?? q.category_name ?? "";
        if (categoryToLoad) {
          await handleCategoryChange(categoryToLoad);
          
          // Set selected codes from existing items
          const codes = mappedItems.map((item: any) => ({
            sku: String(item.sku ?? ""),
            name: String(item.name ?? ""),
          }));
          const uniqCodes = Array.from(new Map(codes.map((c) => [c.sku, c])).values());
          setSelectedCodes(uniqCodes);
        }
      } catch (err) {
        console.error("Failed to fetch quotation", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // Fetch customer-product discounts when customer changes
  useEffect(() => {
    const fetchDiscounts = async () => {
      if (!formik.values.customerId) {
        setProductDiscounts({});
        return;
      }
      try {
        const res = await axiosInstance.get(
          `/customers/${formik.values.customerId}/product-discounts`
        );
        const discounts: { [key: string]: number } = {};
        (res.data.items || []).forEach((d: any) => {
          discounts[d.product_id] = d.discount_value;
        });
        setProductDiscounts(discounts);
      } catch {
        setProductDiscounts({});
      }
    };
    fetchDiscounts();
    // eslint-disable-next-line
  }, [formik.values.customerId]);

  // Update quantity
  // accepts number or empty string so user can clear the input before typing
  const handleQuantityChange = (idx: number, value: number | string) => {
    const items = [...formik.values.items] as any[];
    const discount = Number(items[idx].discount || 0);
    const price = Number(items[idx].price || 0);
    const unitNet = Math.max(0, price - discount);

    // determine available stock for this item
    const availableStock = Number(
      items[idx].stock ?? items[idx].qty ?? items[idx].product_stocks ?? 0
    );

    if (value === "") {
      items[idx].quantity = "";
      // show unitNet as total while qty is empty
      items[idx].total = unitNet;
      formik.setFieldValue("items", items);
      return;
    }

    const n = Number(value);
    if (Number.isNaN(n)) return;
    const qty = Math.max(0, Math.floor(n));

    // if entered qty exceeds available stock, clear the qty field (per request)
    if (availableStock > 0 && qty > availableStock) {
      items[idx].quantity = "";
      items[idx].total = unitNet;
      formik.setFieldValue("items", items);
      return;
    }

    items[idx].quantity = qty;
    items[idx].total = unitNet * qty;
    formik.setFieldValue("items", items);
  };

  // Delete product
  const handleDeleteProduct = (idx: number) => {
    const items = [...formik.values.items];
    const removed = items.splice(idx, 1)[0] as any;
    formik.setFieldValue("items", items);
    // if the removed product had an SKU, remove it from the selectedCodes dropdown
    if (removed && removed.sku) {
      setSelectedCodes((prev) =>
        (prev || []).filter((c) => String(c.sku) !== String(removed.sku))
      );
    }
  };

  // Remove selected product chip
  const handleRemoveChip = (sku: string) => {
    const skuStr = String(sku);
    setSelectedCodes((prev) => (prev || []).filter((c) => c.sku !== skuStr));
    const remaining = (formik.values.items || []).filter(
      (p: any) => String(p.sku) !== skuStr
    );
    formik.setFieldValue("items", remaining);
  };

  // Update discounts in items if customer changes
  useEffect(() => {
    if (!formik.values.items.length) return;
    const items = formik.values.items.map((item: any) => {
      const discount = productDiscounts[item.id] || 0;
      return {
        ...item,
        discount,
        total: (item.price - discount) * (item.quantity || 1),
      };
    });
    formik.setFieldValue("items", items);
    // eslint-disable-next-line
  }, [productDiscounts]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box
        sx={{
          display: "flex",
          mb: 2,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <div>
          <Typography
            variant="h5"
            fontSize={17}
            fontWeight={600}
            sx={{ mr: 2 }}
          >
            {isEditMode ? "Edit Quotation" : "Add Quotation"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEditMode
              ? "Edit quotation record"
              : "Create new quotation record"}
          </Typography>
        </div>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          className="back-button"
          variant="contained"
          startIcon={<ArrowBackIcon />}
          sx={{
            mt: { xs: 2, sm: 0 },
            bgcolor: "#112D4E",
            color: "#fff",
            borderRadius: 2,
            boxShadow: 0,
            textTransform: "none",
            fontWeight: 500,
            "&:hover": { bgcolor: "#0b1e38" },
          }}
          onClick={() => navigate("/quotations")}
        >
          Back to Quotations
        </Button>
      </Box>
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <form onSubmit={formik.handleSubmit} autoComplete="off" noValidate>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              mb: 3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                width: "100%",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <TextField
                label="Quotation Date"
                type="date"
                name="quotationDate"
                value={formik.values.quotationDate}
                onChange={formik.handleChange}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
                error={
                  !!formik.errors.quotationDate && formik.touched.quotationDate
                }
                helperText={
                  formik.touched.quotationDate && formik.errors.quotationDate
                }
              />
              <TextField
                label="Status"
                name="status"
                select
                value={formik.values.status}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
                error={!!formik.errors.status && formik.touched.status}
                helperText={formik.touched.status && formik.errors.status}
              >
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Sent">Sent</MenuItem>
                <MenuItem value="Ordered">Ordered</MenuItem>
              </TextField>

              <Autocomplete
                sx={{ flex: 1 }}
                options={customerOptions}
                // show "{name} - {company}" in input and list; include company in filtering via getOptionLabel
                getOptionLabel={(option: any) =>
                  `${option.fullName || ""}${
                    option.company ? ` - ${option.company}` : ""
                  }`
                }
                renderOption={(props, option: any) => (
                  <li {...props}>
                    {option.fullName}
                    {option.company ? ` - ${option.company}` : ""}
                  </li>
                )}
                value={
                  customerOptions.find(
                    (c) => +c.id === +formik.values.customerId
                  ) || null
                }
                onChange={(_, newValue) => {
                  formik.setFieldValue(
                    "customerId",
                    newValue ? Number(newValue.id) : ""
                  );
                }}
                disabled={customerLoading}
                isOptionEqualToValue={(option: any, value: any) =>
                  Number(option.id) === Number(value?.id)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer"
                    error={
                      !!formik.errors.customerId && formik.touched.customerId
                    }
                    helperText={
                      formik.touched.customerId && formik.errors.customerId
                    }
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {customerLoading ? (
                            <CircularProgress color="inherit" size={18} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              ></Autocomplete>
            </Box>
            <TextField
              label="Notes"
              name="notes"
              value={formik.values.notes}
              onChange={formik.handleChange}
              sx={{ width: "100%" }}
              multiline
              minRows={3}
            />
          </Box>
          {/* Category and Product Codes side-by-side */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 2,
              flexDirection: { xs: "column", sm: "row" },
              alignItems: "flex-start",
            }}
          >
            {/* Category selection */}
            <TextField
              label="Select category"
              name="category"
              select
              value={formik.values.category}
              onChange={async (e) => {
                const newCat = e.target.value;
                await handleCategoryChange(newCat);
              }}
              onBlur={formik.handleBlur}
              sx={{ width: { xs: "100%", sm: 360 } }}
              error={!!formik.errors.category && formik.touched.category}
              helperText={formik.touched.category && formik.errors.category}
              SelectProps={{ displayEmpty: true }}
              disabled={categoryLoading}
            >
              {(categoryOptions || []).map((c) => (
                <MenuItem key={c.id} value={c.name}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            {/* Product Codes multi-select (searchable) */}
            <Autocomplete
              multiple
              options={productCodes}
              value={selectedCodes}
              getOptionLabel={(opt: ProductCode) =>
                `${opt.name ?? ""}${opt.sku ? ` - ${opt.sku}` : ""}`
              }
              renderOption={(props, option: ProductCode) => (
                <li {...props}>
                  {option.name}
                  {option.sku ? ` - ${option.sku}` : ""}
                </li>
              )}
              // hide chips inside the input; we render them separately like in AddSales
              renderTags={() => null}
              onChange={async (_, values: ProductCode[]) => {
                const prevSkus = new Set(
                  (selectedCodes || []).map((s) => s.sku)
                );
                const nowSkus = new Set((values || []).map((s) => s.sku));

                const added = (values || []).filter(
                  (v) => !prevSkus.has(v.sku)
                );
                const removedSkus = Array.from(prevSkus).filter(
                  (s) => !nowSkus.has(s)
                );

                setSelectedCodes(values || []);
                setSearchError("");

                // remove items whose sku is in removedSkus
                if (removedSkus.length > 0) {
                  const remaining = (formik.values.items || []).filter(
                    (p: any) => !removedSkus.includes(String(p.sku))
                  );
                  formik.setFieldValue("items", remaining);
                }

                // fetch and add products for newly selected codes
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
                    const toAdd: any[] = [];
                    for (const found of results) {
                      if (!found) continue;
                      if (
                        (formik.values.items || []).some(
                          (p: any) => p.sku === found.sku
                        )
                      ) {
                        continue;
                      }
                      const unitPrice = Number(
                        found.price ?? found.unit_price ?? 0
                      );
                      const discountFromCustomer =
                        Number(productDiscounts[found.id] ?? 0) || 0;
                      const discountFromProduct =
                        Number(
                          found.discount ??
                            found.discountValue ??
                            found.discount_value ??
                            0
                        ) || 0;
                      const perUnitDiscount =
                        discountFromCustomer || discountFromProduct || 0;
                      toAdd.push({
                        id: found.id,
                        name: found.name ?? found.product_name ?? "Product",
                        sku: found.sku ?? found.code ?? "",
                        price: unitPrice,
                        stock: found.qty ?? found.stock ?? 0,
                        quantity: 1,
                        discount: perUnitDiscount,
                        total: (unitPrice - perUnitDiscount) * 1,
                      });
                    }
                    if (toAdd.length > 0) {
                      formik.setFieldValue("items", [
                        ...(formik.values.items || []),
                        ...toAdd,
                      ]);
                    }
                  } catch (err) {
                    console.error("Failed to add products by code", err);
                    setSearchError("Failed to add some products.");
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              filterSelectedOptions
              disableCloseOnSelect
              loading={productCodesLoading}
              disabled={!formik.values.category || productCodesLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select product codes"
                  placeholder={
                    !formik.values.category
                      ? "Select a category to load products"
                      : "Search Products"
                  }
                  sx={{ minWidth: { xs: "100%", sm: 360 } }}
                  helperText={searchError || ""}
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
              sx={{ width: { xs: "100%", sm: 360 } }}
            />
          </Box>
          {selectedCodes.length > 0 && (
            <Box
              sx={{
                mt: 1,
                mb: 2,
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {selectedCodes.map((pc) => (
                <Chip
                  key={pc.sku}
                  label={`${pc.name}${pc.sku ? ` - ${pc.sku}` : ""}`}
                  onDelete={() => handleRemoveChip(pc.sku)}
                  sx={{ borderRadius: 3 }}
                />
              ))}
            </Box>
          )}
          {formik.values.items.length > 0 && (
            <Box sx={{ mt: 2, mb: 3 }}>
              <Typography fontWeight={700} fontSize={22} mb={2}>
                Selected Products For Quotation
              </Typography>
              <Box
                sx={{
                  overflowX: "auto",
                  borderRadius: 2,
                  background: "#f8fafc",
                  p: 2,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Product
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Code
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Unit Price
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Stock
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Quantity
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Discount
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Subtotal
                        </Typography>
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 8,
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        <Typography fontWeight={700} fontSize={16}>
                          Delete
                        </Typography>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formik.values.items.map((p: any, idx: number) => {
                      const availableStock =
                        p.stock ?? p.qty ?? p.product_stocks ?? 0;
                      // allow empty string so user can clear the qty input
                      const selectedQtyRaw =
                        typeof p.quantity === "undefined" || p.quantity === null
                          ? ""
                          : p.quantity;
                      const qtyNum =
                        selectedQtyRaw === "" ? 0 : Number(selectedQtyRaw) || 0;
                      const price = Number(p.price || 0);
                      const perUnitDisc = Number(p.discount || 0);
                      const unitNet = Math.max(0, price - perUnitDisc);
                      const lineSubtotal =
                        qtyNum > 0 ? unitNet * qtyNum : unitNet;

                      return (
                        <tr
                          key={p.sku || `${p.id}-${idx}`}
                          style={{ borderBottom: "1px solid #eee" }}
                        >
                          <td style={{ padding: 8 }}>
                            <Typography fontWeight={400} color="#555">
                              {p.name}
                            </Typography>
                          </td>
                          <td style={{ padding: 8 }}>
                            <Typography fontWeight={400} color="#555">
                              {p.sku}
                            </Typography>
                          </td>
                          <td style={{ padding: 8 }}>
                            <Typography fontWeight={400} color="#555">
                              ₱{Number(p.price).toLocaleString()}
                            </Typography>
                          </td>
                          <td style={{ padding: 8 }}>
                            <Typography
                              component="span"
                              fontWeight={400}
                              color="#229954"
                              sx={{
                                bgcolor: "#e6fcf5",
                                px: 2,
                                py: 0.5,
                                borderRadius: 1,
                                display: "inline-block",
                                fontWeight: 400,
                              }}
                            >
                              {availableStock}
                            </Typography>
                          </td>
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
                                    Math.max(
                                      0,
                                      (Number(selectedQtyRaw) || 0) - 1
                                    )
                                  )
                                }
                                // disable when blank or less than or equal to 1
                                disabled={
                                  selectedQtyRaw === "" ||
                                  Number(selectedQtyRaw) <= 1
                                }
                                sx={{
                                  color: "#fff",
                                  bgcolor: "#635bff",
                                  "&:hover": { bgcolor: "#4f46e5" },
                                  width: 28,
                                  height: 28,
                                  minWidth: 28,
                                  minHeight: 28,
                                }}
                              >
                                <ArrowBackIosNewIcon fontSize="small" />
                              </IconButton>

                              <TextField
                                size="small"
                                value={
                                  selectedQtyRaw === "" ? "" : selectedQtyRaw
                                }
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "") {
                                    handleQuantityChange(idx, "");
                                    return;
                                  }
                                  const num = Number(v.replace(/[^\d]/g, ""));
                                  if (Number.isNaN(num)) return;
                                  handleQuantityChange(
                                    idx,
                                    Math.max(0, Math.floor(num))
                                  );
                                }}
                                onBlur={() => {
                                  const cur =
                                    selectedQtyRaw === ""
                                      ? ""
                                      : Number(selectedQtyRaw);
                                  if (cur === "") return;
                                  const stock = Number(availableStock || 0);
                                  // if user entered more than stock, clear the field
                                  if (stock > 0 && cur > stock) {
                                    handleQuantityChange(idx, "");
                                    return;
                                  }
                                  const clamped = Math.max(
                                    1,
                                    Math.floor(Number(cur))
                                  );
                                  if (clamped !== Number(selectedQtyRaw))
                                    handleQuantityChange(idx, clamped);
                                }}
                                inputProps={{
                                  inputMode: "numeric",
                                  pattern: "[0-9]*",
                                  min: 0,
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
                                    (Number(selectedQtyRaw) || 0) + 1
                                  )
                                }
                                disabled={
                                  (Number(selectedQtyRaw) || 0) >=
                                  (availableStock || 1)
                                }
                                sx={{
                                  color: "#fff",
                                  bgcolor: "#635bff",
                                  "&:hover": { bgcolor: "#4f46e5" },
                                  width: 28,
                                  height: 28,
                                  minWidth: 28,
                                  minHeight: 28,
                                }}
                              >
                                <ArrowForwardIosIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </td>
                          <td style={{ padding: 8 }}>
                            <Typography fontWeight={400} color="#555">
                              {qtyNum > 0
                                ? `₱${(perUnitDisc * qtyNum).toLocaleString()}`
                                : `₱${perUnitDisc.toLocaleString()}`}
                            </Typography>
                          </td>
                          <td style={{ padding: 8 }}>
                            <Typography fontWeight={400} color="#555">
                              {"₱" + Number(lineSubtotal).toLocaleString()}
                            </Typography>
                          </td>
                          <td style={{ padding: 8 }}>
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteProduct(idx)}
                            >
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
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={formik.isSubmitting || loading}
              sx={{
                bgcolor: "#ff9800",
                color: "#fff",
                minWidth: 160,
                "&:hover": { bgcolor: "#fb8c00" },
                fontWeight: 700,
              }}
            >
              {isEditMode ? "Update Quotation" : "Save Quotation"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default AddQuotation;
