import React, { useState, useEffect, useContext, useMemo } from "react";
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
  Divider,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { Product } from "../models/Product";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../configs/axiosConfig";
import { Customer } from "../models/Customer";
import { Category } from "../models/Category";
import { useNotification } from "../hooks/useNotification";
import { DElIVERY_METHOD } from "../enums/delivery-method.enum";
import { UserContext } from "../layouts/DashboardLayout";

const SALES_SCHEMA = Yup.object().shape({
  saleDate: Yup.string().required("Sale date is required"),
  salesChannel: Yup.string().required("Sales channel is required"),
  deliveryOption: Yup.string().required("Delivery option is required"),
  category: Yup.string().required("Category is required"),
  // customer is now required
  customerId: Yup.mixed().required("Customer is required"),
  paymentOption: Yup.string().required("Payment Option is required"),
  address: Yup.string(),
  notes: Yup.string(), // optional
  company: Yup.string(),
  // optional agent commission percentage (0-100)
  agentCommission: Yup.number()
    .transform((value, originalValue) => (String(originalValue).trim() === "" ? null : value))
    .nullable()
    .min(0, "Agent commission must be >= 0")
    .max(100, "Agent commission must be <= 100"),
  // optional agent selection
  agentId: Yup.mixed().nullable(),
  products: Yup.array()
    .of(
      Yup.object().shape({
        id: Yup.number().required(),
        name: Yup.string().required(),
        price: Yup.number().required(),
        qty: Yup.number().min(1).required(),
        stock: Yup.number().required(),
        discount: Yup.number(),
      })
    )
    .min(1, "At least one product is required"),
});

type ProductCode = { sku: string; name: string };

const AddSales: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const [searchError, setSearchError] = useState("");
  const { showSuccess, showError } = useNotification();
  // product codes dropdown (searchable, multi-select) — objects { sku, name }
  const [productCodes, setProductCodes] = useState<ProductCode[]>([]);
  const [productCodesLoading, setProductCodesLoading] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<ProductCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferMode, setTransferMode] = useState(false);
  // freebies states (transferred from CreateProduct)
  const [freebiesCategory, setFreebiesCategory] = useState<string>("");
  const [freebieProductCodes, setFreebieProductCodes] = useState<any[]>([]);
  const [freebieProductCodesLoading, setFreebieProductCodesLoading] =
    useState(false);
  const [selectedFreebies, setSelectedFreebies] = useState<
    {
      id: number;
      name: string;
      sku: string;
      price?: number;
      stock?: number;
      qty?: number | "";
    }[]
  >([]);

  // Customers (unchanged)
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Dynamic categories from API
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const user = useContext(UserContext);

  // load agents once
  useEffect(() => {
    const fetchAgents = async () => {
      setAgentLoading(true);
      try {
        const res = await axiosInstance.get('/agents', { params: { perPage: 1000, currentPage: 1 } });
        setAgentOptions(res.data.items || []);
      } catch (e) {
        setAgentOptions([]);
      }
      setAgentLoading(false);
    };
    fetchAgents();
  }, []);

  const [productDiscounts, setProductDiscounts] = useState<
    Record<number, number>
  >({});

  // Agents list for dropdown
  const [agentOptions, setAgentOptions] = useState<any[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const navigate = useNavigate();

  type FormikProduct = {
    id: number;
    name: string;
    sku?: string;
    price: number;
    qty: number | "";
    stock: number;
    discount?: number;
    /**
     * Stores the original per-unit discount (from customer mapping or product default).
     * This is used to restore the discount when transfer mode is disabled.
     */
    baseDiscount?: number;
  };

  interface FormikValues {
    saleDate: string;
    salesChannel: string;
    deliveryOption: string;
    category: string;
    customerId: string;
    storeName: string;
    paymentOption: string;
    address: string;
    company: string;
    notes: string;
    agentCommission: number | string;
    agentId: string;
    products: FormikProduct[];
  }

  const formik = useFormik<FormikValues>({
    initialValues: {
      saleDate: new Date().toISOString().slice(0, 10),
      salesChannel: "",
      deliveryOption: "",
      category: "",
      customerId: "",
      storeName: "",
      paymentOption: "",
      address: "",
      company: "",
      notes: "", // new optional field
      agentCommission: "",
      agentId: "",
      products: [],
    },
    validationSchema: SALES_SCHEMA,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      setLoading(true);
      try {
        const payload = {
          saleDate: values.saleDate,
          salesChannel: values.salesChannel,
          deliveryOption: values.deliveryOption,
          category: values.category,
          customer_id: values.customerId || null,
          storeName: values.storeName ?? "",
          paymentOption: values.paymentOption,
          company: values.company ?? "",
          address: values.address,
          notes: values.notes,
          agentCommission: String(values.agentCommission).trim() === "" ? null : Number(values.agentCommission),
          agentId: String(values.agentId).trim() === "" ? null : values.agentId,
          forTransfer: transferMode,
          products: values.products,
          // include freebies same shape as CreateProduct
          freebies: selectedFreebies.map((f) => ({
            id: f.id,
            sku: f.sku,
            name: f.name,
            price: f.price,
            qty: Number(f.qty || 0),
          })),
        }; 

        if (isEditMode && id) {
          await axiosInstance.put(`/sales/${id}`, payload);
          axiosInstance.post(`/system-logs/`, {
            module: "Purchase Order",
            action: "Update",
            description: `${user.fullName} (${user.role}) updated a purchase order`,
            createdBy: user.fullName,
          });
          showSuccess("Purchase order successfully");
        } else {
          await axiosInstance.post("/sales", payload);
          axiosInstance.post(`/system-logs/`, {
            module: "Purchase Order",
            action: "Create",
            description: `${user.fullName} (${user.role}) created a purchase order`,
            createdBy: user.fullName,
          });
          showSuccess("Purchase order created successfully");
        }
        setLoading(false);
        navigate("/sales");
      } catch (err: any) {
        setLoading(false);
        const msg =
          err?.response?.data?.error || err?.message || "Failed to save sale";
        showError(msg);
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
          params: { perPage: 1000, currentPage: 1, sortBy: 'mostTransactions' },
        });
        setCustomerOptions(res.data.items || []);
      } catch {
        setCustomerOptions([]);
      }
      setCustomerLoading(false);
    };
    fetchCustomers();
  }, []);

  // Fetch categories (per request: integrate GET /customers, and derive categories from the response)
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoryLoading(true);
      try {
        const res = await axiosInstance.get("/categories", {
          params: { perPage: 1000, currentPage: 1 },
        });
        const data = (res.data || []) as Category[];
        setCategoryOptions(data);
      } catch {
        setCategoryOptions([]);
      } finally {
        setCategoryLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Helper function to fetch current stock for a batch of products
  const fetchProductsStock = async (products: any[]): Promise<any[]> => {
    if (!products.length) return products;

    const stockPromises = products.map(async (product) => {
      if (!product.id && !product.sku) {
        return { ...product, stock: 0 };
      }

      try {
        // Try to fetch by ID first, then by SKU as fallback
        let stockData = null;
        if (product.id) {
          try {
            const res = await axiosInstance.get(`/products/${product.id}`);
            stockData = res.data;
          } catch {
            // If ID fetch fails, try SKU
            if (product.sku) {
              const res = await axiosInstance.get(
                `/products/code/${encodeURIComponent(product.sku)}`
              );
              stockData = res.data;
            }
          }
        } else if (product.sku) {
          const res = await axiosInstance.get(
            `/products/code/${encodeURIComponent(product.sku)}`
          );
          stockData = res.data;
        }

        const currentStock = stockData
          ? Number(stockData.qty ?? stockData.stock ?? 0)
          : 0;
        return { ...product, stock: currentStock };
      } catch (err) {
        console.warn(
          `Failed to fetch stock for product ${product.sku || product.id}:`,
          err
        );
        return { ...product, stock: 0 };
      }
    });

    return Promise.all(stockPromises);
  };

  // If editing, fetch sale by id and populate form
  useEffect(() => {
    if (!isEditMode || !id) return;

    const fetchSale = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/sales/${id}`);
        const sale = res.data;
        // Ensure transfer mode reflects what is stored in the existing record
        setTransferMode(Boolean(sale.forTransfer));

        // Map products from API to canonical shape (price, qty, stock, discount per-unit)
        const mappedProducts = Array.isArray(sale.products)
          ? sale.products.map((p: any) => {
              const unitPrice = Number(p.price ?? p.unit_price ?? 0);
              const unitDiscount =
                Number(
                  p.discount ?? p.discountValue ?? p.discount_value ?? 0
                ) || 0;
              const qty = Number(p.qty ?? p.quantity ?? 1) || 1;
              return {
                id: p.product_id ?? p.id ?? null,
                name: p.name ?? p.product_name ?? p.productTitle ?? "Product",
                sku: p.sku ?? p.code ?? p.product_sku ?? "",
                price: unitPrice,
                qty,
                stock: 0, // Will be updated with real stock values below
                discount: unitDiscount,
                baseDiscount: unitDiscount,
                tax: 0,
              };
            })
          : [];

        // Fetch current stock values for all products
        const productsWithStock = await fetchProductsStock(mappedProducts);

        const categoryValue = sale.category ?? sale.category_name ?? "";

        formik.setValues({
          saleDate: sale.saleDate
            ? sale.saleDate.slice(0, 10)
            : sale.sale_date ?? formik.initialValues.saleDate,
          salesChannel:
            sale.salesChannel ??
            sale.sales_channel ??
            formik.initialValues.salesChannel,
          deliveryOption: sale.deliveryOption ?? "",
          category: categoryValue,
          customerId: sale.customer?.id ?? sale.customer_id ?? "",
          storeName: sale.customer?.storeName ?? sale.storeName ?? "",
          paymentOption: sale.paymentOption ?? "",
          company: sale.company ?? "",
          address: sale.address ?? "",
          notes: sale.notes ?? "",
          agentCommission: sale.agentCommission ?? "",
          agentId: sale.agent?.id ?? sale.agent_id ?? "",
          products: productsWithStock,
        });

        // Prepare product code options from existing items (to allow editing chips)
        const preCodes: ProductCode[] = productsWithStock.map((p: any) => ({
          sku: String(p.sku ?? ""),
          name: String(p.name ?? ""),
        }));
        const uniqCodes = Array.from(
          new Map(preCodes.map((c) => [c.sku, c])).values()
        );
        setProductCodes((prev) => {
          const merged = new Map<string, ProductCode>();
          [...prev, ...uniqCodes].forEach((c) => merged.set(c.sku, c));
          return Array.from(merged.values());
        });

        // Fetch full category products to populate the dropdown (preserving existing)
        if (categoryValue) {
          await fetchCategoryProducts(categoryValue, true);
        }

        // Preselect freebies category and load previously-saved freebies (if any)
        if (Array.isArray(sale.freebies) && sale.freebies.length > 0) {
          try {
            // set freebies category select so the freebies UI is enabled
            setFreebiesCategory(categoryValue);
            // load freebie product options for that category
            await fetchFreebieCategoryProducts(categoryValue);

            // Map freebies returned by API to the UI shape (id = product id expected by submit)
            const mappedFreebies = sale.freebies.map((f: any) => ({
              id: f.product_id ?? f.id ?? null,
              name: f.name ?? f.product_name ?? "",
              sku: f.sku ?? "",
              price: Number(f.price ?? 0),
              qty: Number(f.qty ?? 0),
              stock: 0,
            }));

            // fetch current stock for freebies where possible
            const freebiesWithStock = await fetchProductsStock(mappedFreebies);
            setSelectedFreebies(
              freebiesWithStock.map((f: any) => ({ ...f, qty: Number(f.qty ?? 0) }))
            );
          } catch (e) {
            console.warn("Failed to load existing freebies for sale", e);
            setSelectedFreebies([]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch sale", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // Keep the chips (selectedCodes) in sync with the table products
  useEffect(() => {
    const codes = (formik.values.products as any[]).map((p) => ({
      sku: String(p.sku ?? ""),
      name: String(p.name ?? ""),
    }));
    // ensure unique by sku
    const uniq = Array.from(new Map(codes.map((c) => [c.sku, c])).values());
    setSelectedCodes(uniq);
  }, [formik.values.products]);

  const handleQuantityChange = (idx: number, value: number | string) => {
    const products = [...(formik.values.products as any[])];
    // Use stock field directly (numeric) - no fallback to avoid confusion
    const availableStock = Number(products[idx].stock ?? 0);

    // allow empty string so user can clear the input before typing
    if (value === "") {
      products[idx].qty = "";
      formik.setFieldValue("products", products);
      return;
    }
    const n = Number(value ?? 0);
    if (Number.isNaN(n)) return;
    const qty = Math.max(0, Math.floor(n));

    // if entered qty exceeds available stock, clear the qty field (same as AddQuotation)
    if (availableStock > 0 && qty > availableStock) {
      products[idx].qty = "";
      formik.setFieldValue("products", products);
      return;
    }

    products[idx].qty = qty;
    formik.setFieldValue("products", products);
  };

  // Delete product (from table and from chips)
  const handleDeleteProduct = (idx: number) => {
    const products = [...(formik.values.products as any[])];
    const removed = products.splice(idx, 1)[0] as any;
    formik.setFieldValue("products", products);
    // remove corresponding code from the selectedCodes chips if present
    if (removed && removed.sku) {
      const sku = String(removed.sku);
      setSelectedCodes((prev) => prev.filter((c) => String(c.sku) !== sku));
    }
  };

  // Remove product chip (clicking chip "x") -> also remove from products table
  const handleRemoveChip = (sku: string) => {
    const sk = String(sku);
    setSelectedCodes((prev) => prev.filter((c) => String(c.sku) !== sk));
    const remaining = (formik.values.products as any[]).filter(
      (p: any) => String(p.sku) !== sk
    );
    formik.setFieldValue("products", remaining);
  };

  // Freebies quantity handler (mirrors main product behavior)
  const handleFreebieQuantityChange = (idx: number, value: number | string) => {
    setSelectedFreebies((prev) => {
      const next = [...prev];
      const item = next[idx];
      if (!item) return prev;
      const availableStock = Number(item.stock ?? 0);

      if (value === "") {
        next[idx] = { ...item, qty: "" as any };
        return next;
      }
      const n = Number(value);
      if (Number.isNaN(n)) return prev;
      const qty = Math.max(0, Math.floor(n));
      // if exceeds stock and stock is known (>0) clear to empty (same UX as products table)
      if (availableStock > 0 && qty > availableStock) {
        next[idx] = { ...item, qty: "" as any };
        return next;
      }
      next[idx] = { ...item, qty };
      return next;
    });
  };

  // Delete freebie (from table and from chips)
  const handleDeleteFreebie = (idx: number) => {
    setSelectedFreebies((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  // Fetch customer product-discounts when customer selection changes
  useEffect(() => {
    const fetchDiscounts = async () => {
      const customerId = formik.values.customerId;
      if (!customerId) {
        setProductDiscounts({});
        return;
      }
      try {
        const res = await axiosInstance.get(
          `/customers/${customerId}/product-discounts`
        );
        const map: Record<number, number> = {};
        (res.data.items || []).forEach((d: any) => {
          map[Number(d.product_id)] = Number(
            d.discount_value ?? d.discount ?? 0
          );
        });
        setProductDiscounts(map);
      } catch {
        setProductDiscounts({});
      }
    };
    fetchDiscounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.customerId]);

  // Apply productDiscounts to current products whenever mapping changes
  // Keep a copy of the original per-unit discount so we can restore it when transfer mode is disabled.
  useEffect(() => {
    if (!(formik.values.products as any[]).length) return;
    const items = (formik.values.products as any[]).map((item: any) => {
      const baseDiscount =
        Number(
          productDiscounts[item.id] ?? item.baseDiscount ?? item.discount ?? item.discountValue ?? 0
        ) || 0;
      const qty = Number(item.qty ?? 1) || 1;
      return {
        ...item,
        baseDiscount,
        discount: transferMode
          ? Number(item.price ?? 0)
          : baseDiscount,
        price: Number(item.price ?? 0),
        tax: 0,
        qty,
      };
    });
    formik.setFieldValue("products", items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productDiscounts, transferMode]);

  // When transfer mode is toggled, update product discounts accordingly.
  // - When ON: discount = unit price (100% off)
  // - When OFF: restore per-unit discount from baseDiscount (customer/product mapping or default)
  useEffect(() => {
    if (!(formik.values.products as any[]).length) return;

    const items = (formik.values.products as any[]).map((item: any) => {
      const price = Number(item.price ?? 0);
      const baseDiscount =
        item.baseDiscount !== undefined
          ? Number(item.baseDiscount) || 0
          : Number(item.discount ?? item.discountValue ?? 0) || 0;
      return {
        ...item,
        // Keep the original per-unit discount even when transfer mode is toggled on
        baseDiscount,
        discount: transferMode ? price : baseDiscount,
      };
    });
    formik.setFieldValue("products", items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferMode]);

  // Helper function to fetch products for a category
  const fetchCategoryProducts = async (
    category: string,
    preserveExisting: boolean = false
  ) => {
    if (!category) {
      setProductCodes([]);
      return;
    }

    setProductCodesLoading(true);
    try {
      // per request, fetch by category
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
      // map to {name, sku}
      const codes: ProductCode[] = list
        .map((p: any) => ({
          name: String(p.name ?? p.product_name ?? p.title ?? ""),
          sku: String(p.sku ?? p.code ?? ""),
        }))
        .filter((x: any) => x.sku && x.name);
      // unique by sku
      const uniq = Array.from(new Map(codes.map((c) => [c.sku, c])).values());

      // If preserveExisting is true, merge with existing codes (for edit mode)
      // If false, replace completely (for normal category change)
      if (preserveExisting) {
        setProductCodes((prev) => {
          const merged = new Map<string, ProductCode>();
          [...prev, ...uniq].forEach((c) => merged.set(c.sku, c));
          return Array.from(merged.values());
        });
      } else {
        setProductCodes(uniq);
      }
    } catch (err) {
      console.error("Failed to fetch products for category", err);
      if (!preserveExisting) {
        setProductCodes([]);
      }
    } finally {
      setProductCodesLoading(false);
    }
  };

  // Fetch products for freebies category (separate list)
  const fetchFreebieCategoryProducts = async (category: string) => {
    if (!category) {
      setFreebieProductCodes([]);
      return;
    }
    setFreebieProductCodesLoading(true);
    try {
      const res = await axiosInstance.get(
        `/products/category/${encodeURIComponent(category)}`,
        { params: { perPage: 1000, currentPage: 1 } }
      );
      const list = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];
      const codes = list
        .map((p: any) => ({
          id: p.id,
          name: String(p.name ?? p.product_name ?? p.title ?? ""),
          sku: String(p.sku ?? p.code ?? ""),
          price: Number(p.price ?? 0),
          stock: Number(p.qty ?? p.stock ?? 0),
        }))
        .filter((x: any) => x.sku && x.name);
      const uniq = Array.from(
        new Map(codes.map((c: any) => [c.sku, c])).values()
      );
      setFreebieProductCodes(uniq);
    } catch (err) {
      console.error("Failed to fetch products for freebies category", err);
      setFreebieProductCodes([]);
    } finally {
      setFreebieProductCodesLoading(false);
    }
  };

  // Handle selecting a category: fetch product codes for that category and reset current selections
  const handleCategoryChange = async (newCategory: string) => {
    formik.setFieldValue("category", newCategory);
    // clear previous selections and table rows (not preserving existing for user-initiated changes)
    setSelectedCodes([]);
    formik.setFieldValue("products", []);
    setSearchError("");

    await fetchCategoryProducts(newCategory, false);
  };

  // Keep full product options list; rely on Autocomplete's filterSelectedOptions
  // to prevent re-selecting already-selected items. This avoids MUI warnings when
  // the `value` contains items that are not present in `options`.
  const filteredProductOptions = useMemo(() => productCodes || [], [productCodes]);

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
            {isEditMode ? "Edit Purchase Order" : "Add Purchase Order"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEditMode
              ? "Edit purchase order record"
              : "Create new purchase order record"}
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
          onClick={() => navigate("/sales")}
        >
          Back to Purchase Orders
        </Button>
      </Box>
      <Paper sx={{ p: 2, borderRadius: 3, mb: 3 }}>
        <form onSubmit={formik.handleSubmit} autoComplete="off">
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
                label="Sale Date"
                type="date"
                name="saleDate"
                value={formik.values.saleDate}
                onChange={formik.handleChange}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
                error={!!formik.errors.saleDate && formik.touched.saleDate}
                helperText={formik.touched.saleDate && formik.errors.saleDate}
              />
              <TextField
                label="Sales Channel"
                name="salesChannel"
                select
                value={formik.values.salesChannel}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
                error={
                  !!formik.errors.salesChannel && formik.touched.salesChannel
                }
                helperText={
                  formik.touched.salesChannel && formik.errors.salesChannel
                }
              >
                <MenuItem value="Online">Online</MenuItem>
                <MenuItem value="In-Store">In-Store</MenuItem>
                <MenuItem value="Reseller">Reseller</MenuItem>
              </TextField>

              {/* New required Delivery Option field (replacing the previous Category position) */}
              <TextField
                label="Delivery Option"
                name="deliveryOption"
                select
                value={formik.values.deliveryOption}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                sx={{ flex: 1 }}
                error={
                  !!formik.errors.deliveryOption &&
                  formik.touched.deliveryOption
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
                <MenuItem value={DElIVERY_METHOD.LBC}>
                  {DElIVERY_METHOD.LBC}
                </MenuItem>
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
            </Box>

            <Box
              sx={{
                display: "flex",
                width: "100%",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              {/* Searchable customer dropdown */}
              <Autocomplete
                sx={{ flex: 1 }}
                options={customerOptions}
                // show "{name} - {company}" everywhere (input label, filtering) and include company in display list
                getOptionLabel={(option) =>
                  `${option.fullName || ""}${
                    option.company ? ` - ${option.company}` : ""
                  }`
                }
                renderOption={(props, option) => {
                  // remove key from props before spreading to avoid React warning
                  const { key, ...rest } = props as any;
                  return (
                    <li {...rest}>
                      {`${option.fullName}`} <br />
                      {option.storeName || ""} <br />
                      {option.address || ""}
                    </li>
                  );
                }}
                loading={customerLoading}
                disabled={customerLoading}
                value={
                  customerOptions.find(
                    (c) => +c.id === +formik.values.customerId
                  ) ?? null
                }
                onChange={(_, value) => {
                  if (value) {
                    formik.setFieldValue("customerId", Number(value.id));
                    formik.setFieldValue("storeName", value.storeName ?? "");
                    formik.setFieldValue("address", value.address ?? "");
                  } else {
                    // cleared selection -> clear related fields
                    formik.setFieldValue("customerId", "");
                    formik.setFieldValue("storeName", "");
                    formik.setFieldValue("address", "");
                    formik.setFieldValue("paymentOption", "");
                  }
                }}
                isOptionEqualToValue={(option, value) =>
                  Number(option.id) === Number(value?.id)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer"
                    // ensure blur marks field as touched so validation message appears
                    onBlur={() => formik.setFieldTouched("customerId", true)}
                    // show error when touched OR after user attempted submit
                    error={
                      !!formik.errors.customerId &&
                      (formik.touched.customerId || formik.submitCount > 0)
                    }
                    helperText={
                      (formik.touched.customerId || formik.submitCount > 0) &&
                      formik.errors.customerId
                        ? String(formik.errors.customerId)
                        : undefined
                    }
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {customerLoading ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                disableClearable={false}
                clearOnEscape
              />
              {/* <TextField
                sx={{ flex: 1 }}
                label="TIN"
                name="tin"
                value={formik.values.tin}
                onChange={formik.handleChange}
              /> */}
              <TextField
                label="Payment Option"
                name="paymentOption"
                select
                value={formik.values.paymentOption}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
                error={
                  !!formik.errors.paymentOption && formik.touched.paymentOption
                }
                helperText={
                  formik.touched.paymentOption && formik.errors.paymentOption
                }
              >
                <MenuItem value="Cash Payment">Cash Payment</MenuItem>
                <MenuItem value="Installment Payment">Installment Payment</MenuItem>
                <MenuItem value="LBC">LBC</MenuItem>
                <MenuItem value="TBD">TBD</MenuItem>
                <MenuItem value="PDC">PDC</MenuItem>
              </TextField>
              <TextField
                sx={{ flex: 1 }}
                label="Company"
                name="company"
                value={formik.values.company}
                onChange={formik.handleChange}
              />
              {/* <TextField
                label="Store Name"
                name="storeName"
                value={formik.values.storeName}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Address"
                name="address"
                value={formik.values.address}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
              /> */}
            </Box>

            <Box sx={{ width: "100%", mb: 1, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Agent Commission (percentage)"
                name="agentCommission"
                type="number"
                value={formik.values.agentCommission}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
                inputProps={{ min: 0, max: 100, step: "0.01" }}
                error={
                  !!formik.errors.agentCommission &&
                  (formik.touched.agentCommission || formik.submitCount > 0)
                }
                helperText={
                  (formik.touched.agentCommission || formik.submitCount > 0) &&
                  formik.errors.agentCommission
                    ? String(formik.errors.agentCommission)
                    : undefined
                }
              />

              <TextField
                select
                label="Agent"
                name="agentId"
                value={formik.values.agentId}
                onChange={formik.handleChange}
                sx={{ flex: 1 }}
                disabled={agentLoading}
                helperText={agentLoading ? 'Loading agents...' : ''}
              >
                <MenuItem value="">None</MenuItem>
                {agentOptions.map((a: any) => (
                  <MenuItem key={a.id} value={String(a.id)}>
                    {a.fullName}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <TextField
              label="Notes"
              name="notes"
              value={formik.values.notes}
              onChange={formik.handleChange}
              sx={{ width: "100%", mt: 1 }}
              multiline
              minRows={3}
              placeholder="Optional - describe payment terms, downpayment schedule, etc."
            />
          </Box>

          {/* Category field placed BEFORE the Select/Search Products field (as requested) */}
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
              onChange={async (e) => {
                const newCat = e.target.value;
                await handleCategoryChange(newCat);
              }}
              onBlur={formik.handleBlur}
              sx={{ width: { xs: "100%", sm: 360 } }}
              error={!!formik.errors.category && formik.touched.category}
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
              // Controlled by selectedCodes but hide the chips inside the input
              value={selectedCodes}
              getOptionLabel={(opt) => opt.name ?? ""}
              renderOption={(props, option) => (
                <li {...props}>
                  {option.name}
                </li>
              )}
              // Make option/value equality SKU-based so filterSelectedOptions works
              isOptionEqualToValue={(option, value) =>
                String(option.sku) === String((value as any)?.sku)
              }
              renderTags={() => null}
              onChange={async (_, values: ProductCode[]) => {
                const prevSkus = new Set(
                  (selectedCodes || []).map((s) => String(s.sku))
                );
                const nowSkus = new Set(
                  (values || []).map((s) => String(s.sku))
                );

                const added = (values || []).filter(
                  (v) => !prevSkus.has(String(v.sku))
                );
                const removedSkus = Array.from(prevSkus).filter(
                  (s) => !nowSkus.has(s)
                );

                setSelectedCodes(values || []);
                setSearchError("");

                // remove products whose sku is in removedSkus
                if (removedSkus.length > 0) {
                  const remaining = (formik.values.products as any[]).filter(
                    (p: any) => !removedSkus.includes(String(p.sku))
                  );
                  formik.setFieldValue("products", remaining);
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
                      // avoid duplicates
                      if (
                        (formik.values.products as any[]).some(
                          (p: any) => String(p.sku) === String(found.sku)
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
                        sku: String(found.sku ?? found.code ?? ""),
                        price: unitPrice,
                        stock: found.qty ?? found.stock ?? 0,
                        // default qty to 0 when stock is 0, otherwise default to 1
                        qty:
                          (Number(found.qty ?? found.stock ?? 0) || 0) > 0
                            ? 1
                            : 0,
                        baseDiscount: perUnitDiscount,
                        discount: transferMode ? unitPrice : perUnitDiscount,
                        tax: 0,
                      });
                    }
                    if (toAdd.length > 0) {
                      formik.setFieldValue("products", [
                        ...((formik.values.products as any[]) || []),
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
              loading={productCodesLoading}
              disabled={!formik.values.category || productCodesLoading}
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
              sx={{ width: { xs: "100%", sm: 360 } }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={transferMode}
                  onChange={(_, checked) => setTransferMode(checked)}
                  color="primary"
                />
              }
              label="For transfer"
              sx={{ alignSelf: "center", ml: { xs: 0, sm: 1 } }}
            />
          </Box>

          {/* Products Table */}
          {(formik.values.products as any[]).length > 0 && (
            <Box sx={{ mt: 2, mb: 3 }}>
              {/* Chips for selected products shown above the table */}
              {selectedCodes.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    mb: 2,
                  }}
                >
                  {selectedCodes.map((pc) => (
                    <Chip
                      key={pc.sku}
                      label={`${pc.name}-${pc.sku}`}
                      onDelete={() => handleRemoveChip(pc.sku)}
                      sx={{ borderRadius: 3 }}
                    />
                  ))}
                </Box>
              )}

              <Typography fontWeight={700} fontSize={16}>
                Products for purchase orders
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
                    <col style={{ width: "30%" }} /> {/* Product */}
                    <col style={{ width: "13%" }} /> {/* Code */}
                    <col style={{ width: "10%" }} /> {/* Unit Cost */}
                    <col style={{ width: "9%" }} /> {/* Stock */}
                    <col style={{ width: "15%" }} /> {/* Quantity (wider) */}
                    <col style={{ width: "9%" }} /> {/* Discount */}
                    <col style={{ width: "9%" }} /> {/* Subtotal */}
                    <col style={{ width: "5%" }} /> {/* Delete */}
                  </colgroup>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Product
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Code
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Unit Cost
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Stock
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Quantity
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Discount
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Subtotal
                        </Typography>
                      </th>
                      <th style={{ textAlign: "left", padding: 8 }}>
                        <Typography fontWeight={700} fontSize={16}>
                          Delete
                        </Typography>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formik.values.products as FormikProduct[]).map(
                      (p, idx) => {
                        // Use stock field directly (numeric) - no fallback to qty to avoid confusion
                        const availableStock = Number(p.stock ?? 0);
                        // when stock is zero, show 0 and disable editing
                        const selectedQty =
                          availableStock === 0
                            ? 0
                            : typeof p.qty === "undefined" || p.qty === null
                            ? ""
                            : (p.qty as any);
                        // normalize numeric qty for calculations; keep null/empty as "no qty"
                        const qtyNum =
                          selectedQty === "" ? 0 : Number(selectedQty) || 0;
                        // when qty is empty show unit price minus discount; otherwise show full line total
                        const unitNet = Math.max(
                          0,
                          Number(p.price ?? 0) - Number(p.discount ?? 0)
                        );
                        const lineSubtotal =
                          qtyNum > 0
                            ? (Number(p.price ?? 0) - Number(p.discount ?? 0)) *
                              qtyNum
                            : unitNet;
                        return (
                          <tr
                            key={(p as any).sku || idx}
                            style={{ borderBottom: "1px solid #eee" }}
                          >
                            <td style={{ padding: 8 }}>
                              <Typography fontWeight={400} color="#555">
                                {(p as any).name}
                              </Typography>
                            </td>
                            <td style={{ padding: 8 }}>
                              <Typography fontWeight={400} color="#555">
                                {(p as any).sku}
                              </Typography>
                            </td>
                            <td style={{ padding: 8 }}>
                              <Typography fontWeight={400} color="#555">
                                ₱{Number(p.price).toFixed(2)}
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
                                        (Number(selectedQty) || 0) - 1
                                      )
                                    )
                                  }
                                  // disable when blank or less than or equal to 1
                                  disabled={
                                    availableStock === 0 ||
                                    selectedQty === "" ||
                                    Number(selectedQty) <= 1
                                  }
                                  sx={{
                                    color: "#fff",
                                    bgcolor: "#635bff",
                                    "&:hover": { bgcolor: "#4f46e5" },
                                    width: 26,
                                    height: 26,
                                    minWidth: 26,
                                    minHeight: 26,
                                  }}
                                >
                                  <ArrowBackIosNewIcon fontSize="small" />
                                </IconButton>

                                {/* editable quantity input placed between the arrows */}
                                <TextField
                                  size="small"
                                  // allow empty string so user can clear the field
                                  value={selectedQty === "" ? "" : selectedQty}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                      handleQuantityChange(idx, "");
                                      return;
                                    }
                                    const num = Number(v);
                                    if (Number.isNaN(num)) return;
                                    handleQuantityChange(
                                      idx,
                                      Math.max(0, Math.floor(num))
                                    );
                                  }}
                                  onBlur={() => {
                                    const cur =
                                      selectedQty === ""
                                        ? ""
                                        : Number(selectedQty);
                                    if (cur === "") return;
                                    const stock = Number(availableStock || 0);
                                    // if user entered more than stock, clear the field
                                    if (stock > 0 && (cur as number) > stock) {
                                      handleQuantityChange(idx, "");
                                      return;
                                    }
                                    const clamped = Math.max(
                                      1,
                                      Math.floor(Number(cur))
                                    );
                                    if (clamped !== Number(selectedQty))
                                      handleQuantityChange(idx, clamped);
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
                                  // disable increment when selected qty reaches available stock
                                  disabled={
                                    availableStock === 0 ||
                                    (Number(selectedQty) || 0) >= availableStock
                                  }
                                  sx={{
                                    color: "#fff",
                                    bgcolor: "#635bff",
                                    "&:hover": { bgcolor: "#4f46e5" },
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
                              <Typography fontWeight={400} color="#555">
                                {transferMode
                                  ? "₱" +
                                    Number(p.price ?? 0).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })
                                  : qtyNum > 0
                                  ? "₱" +
                                    (
                                      Number(p.discount ?? 0) * qtyNum
                                    ).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })
                                  : "₱" +
                                    Number(p.discount ?? 0).toLocaleString(
                                      undefined,
                                      { minimumFractionDigits: 2 }
                                    )}
                              </Typography>
                            </td>
                            <td style={{ padding: 8 }}>
                              <Typography fontWeight={400} color="#555">
                                {"₱" +
                                  Number(lineSubtotal).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                    }
                                  )}
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
                      }
                    )}
                  </tbody>
                </table>
              </Box>
            </Box>
          )}
          <Divider />
          {/* Freebies section (moved from CreateProduct) */}
          <Box sx={{ mt: 4, mb: 3 }}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                mb: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <TextField
                name="freebiesCategory"
                label="Category (select to enable freebies)"
                select
                value={freebiesCategory}
                onChange={async (e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setFreebiesCategory(v);
                  setSelectedFreebies([]);
                  await fetchFreebieCategoryProducts(v);
                }}
                sx={{ width: { xs: "100%", sm: 360 } }}
                disabled={categoryLoading}
              >
                {categoryOptions.map((cat) => (
                  <MenuItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </MenuItem>
                ))}
              </TextField>

              <Autocomplete
                multiple
                options={freebieProductCodes}
                getOptionLabel={(opt: any) => opt.name ?? ""}
                value={freebieProductCodes.filter((p) =>
                  selectedFreebies.some((s) => String(s.sku) === String(p.sku))
                )}
                onChange={async (_, values: any[]) => {
                  const prevSkus = new Set(
                    (selectedFreebies || []).map((s) => String(s.sku))
                  );
                  const nowSkus = new Set(
                    (values || []).map((s) => String(s.sku))
                  );
                  const added = (values || []).filter(
                    (v) => !prevSkus.has(String(v.sku))
                  );
                  const removedSkus = Array.from(prevSkus).filter(
                    (s) => !nowSkus.has(s)
                  );

                  if (removedSkus.length > 0) {
                    setSelectedFreebies((prev) =>
                      prev.filter((p) => !removedSkus.includes(String(p.sku)))
                    );
                  }

                  if (added.length > 0) {
                    try {
                      const fetches = added.map((o: any) =>
                        axiosInstance
                          .get(`/products/code/${encodeURIComponent(o.sku)}`)
                          .then((r) => r.data)
                          .catch(() => null)
                      );
                      const results = await Promise.all(fetches);
                      const toAdd: any[] = [];
                      for (const found of results) {
                        if (!found) continue;
                        toAdd.push({
                          id: found.id,
                          name: found.name ?? found.product_name ?? "",
                          sku: String(found.sku ?? found.code ?? ""),
                          price: Number(found.price ?? 0),
                          stock: Number(found.qty ?? found.stock ?? 0),
                          qty: 1,
                        });
                      }
                      if (toAdd.length > 0) {
                        setSelectedFreebies((prev) => [...prev, ...toAdd]);
                      }
                    } catch (e) {
                      console.error("Failed to add freebies", e);
                    }
                  }
                }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props as any;
                  return (
                    <li {...rest}>
                      {option.name}
                    </li>
                  );
                }}
                renderTags={() => null}
                disabled={!freebiesCategory || freebieProductCodesLoading}
                sx={{ width: { xs: "100%", sm: 360 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={
                      !freebiesCategory
                        ? "Select category first"
                        : "Select products"
                    }
                    helperText={
                      !freebiesCategory
                        ? "Select a category to load products"
                        : ""
                    }
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {freebieProductCodesLoading ? (
                            <CircularProgress size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>

            {selectedFreebies.length > 0 && (
              <>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                  {selectedFreebies.map((pc) => (
                    <Chip
                      key={pc.sku}
                      label={`${pc.name} - ${pc.sku}`}
                      onDelete={() =>
                        setSelectedFreebies((prev) =>
                          prev.filter((p) => String(p.sku) !== String(pc.sku))
                        )
                      }
                      sx={{ borderRadius: 3 }}
                    />
                  ))}
                </Box>
                <Typography fontWeight={700} fontSize={18} mb={1}>
                  Products Freebies
                </Typography>
                <Box
                  sx={{
                    overflowX: "auto",
                    borderRadius: 2,
                    background: "#f8fafc",
                    p: 2,
                    mb: 2,
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
                      <col style={{ width: "30%" }} /> {/* Product */}
                      <col style={{ width: "13%" }} /> {/* Code */}
                      <col style={{ width: "10%" }} /> {/* Unit Cost */}
                      <col style={{ width: "9%" }} /> {/* Stock */}
                      <col style={{ width: "15%" }} /> {/* Quantity (wider) */}
                      <col style={{ width: "9%" }} /> {/* Discount */}
                      <col style={{ width: "9%" }} /> {/* Subtotal */}
                      <col style={{ width: "5%" }} /> {/* Delete */}
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ textAlign: "left", padding: 8 }}>
                          Product
                        </th>
                        <th style={{ textAlign: "left", padding: 8 }}>Code</th>
                        <th style={{ textAlign: "left", padding: 8 }}>
                          Unit Cost
                        </th>
                        <th style={{ textAlign: "left", padding: 8 }}>Stock</th>
                        <th style={{ textAlign: "left", padding: 8 }}>
                          Quantity
                        </th>
                        <th style={{ textAlign: "left", padding: 8 }}>
                          Discount
                        </th>
                        <th style={{ textAlign: "left", padding: 8 }}>
                          Subtotal
                        </th>
                        <th style={{ textAlign: "left", padding: 8 }}>
                          Delete
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFreebies.map((p, idx) => {
                        const stock = Number(p.stock ?? 0);
                        // when stock is zero, force qty to 0 and disable editing
                        const qty =
                          stock === 0
                            ? 0
                            : typeof p.qty === "undefined"
                            ? ""
                            : p.qty;
                        const unitCost = Number(p.price ?? 0);
                        const discountAmount =
                          unitCost * (qty === "" ? 0 : Number(qty) || 0);
                        const subtotal = 0; // freebies always have 0 subtotal
                        return (
                          <tr
                            key={p.sku || idx}
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
                                ₱{unitCost.toFixed(2)}
                              </Typography>
                            </td>
                            <td style={{ padding: 8 }}>
                              <Typography
                                fontWeight={400}
                                color="#229954"
                                sx={{
                                  bgcolor: "#e6fcf5",
                                  px: 2,
                                  py: 0.5,
                                  borderRadius: 1,
                                  display: "inline-block",
                                }}
                              >
                                {stock}
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
                                    handleFreebieQuantityChange(
                                      idx,
                                      Math.max(0, (Number(qty) || 0) - 1)
                                    )
                                  }
                                  // disable when stock is zero or qty is empty or <= 1
                                  disabled={stock === 0 || qty === "" || Number(qty) <= 1}
                                  sx={{
                                    color: "#fff",
                                    bgcolor: "#635bff",
                                    "&:hover": { bgcolor: "#4f46e5" },
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
                                  value={qty === "" ? "" : qty}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                      handleFreebieQuantityChange(idx, "");
                                      return;
                                    }
                                    const num = Number(v);
                                    if (Number.isNaN(num)) return;
                                    handleFreebieQuantityChange(
                                      idx,
                                      Math.max(0, Math.floor(num))
                                    );
                                  }}
                                  onBlur={() => {
                                    const cur = qty === "" ? "" : Number(qty);
                                    if (cur === "") return;
                                    const stockVal = Number(p.stock ?? 0);
                                    // if user entered more than stock, clear the field
                                    if (
                                      stockVal > 0 &&
                                      (cur as number) > stockVal
                                    ) {
                                      handleFreebieQuantityChange(idx, "");
                                      return;
                                    }
                                    const clamped = Math.max(
                                      1,
                                      Math.floor(Number(cur))
                                    );
                                    if (clamped !== Number(qty))
                                      handleFreebieQuantityChange(idx, clamped);
                                  }}
                                  inputProps={{
                                    inputMode: "numeric",
                                    pattern: "[0-9]*",
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
                                    handleFreebieQuantityChange(
                                      idx,
                                      (Number(qty) || 0) + 1
                                    )
                                  }
                                  // disable when stock is zero or qty reached stock
                                  disabled={stock === 0 || (Number(qty) >= stock && stock > 0)}
                                  sx={{
                                    color: "#fff",
                                    bgcolor: "#635bff",
                                    "&:hover": { bgcolor: "#4f46e5" },
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
                              <Typography fontWeight={400} color="#555">
                                {"₱" +
                                  Number(discountAmount).toLocaleString(
                                    undefined,
                                    { minimumFractionDigits: 2 }
                                  )}
                              </Typography>
                            </td>
                            <td style={{ padding: 8 }}>
                              <Typography fontWeight={400} color="#555">
                                {"₱" +
                                  Number(0).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                  })}
                              </Typography>
                            </td>
                            <td style={{ padding: 8 }}>
                              <IconButton
                                color="error"
                                onClick={() =>
                                  setSelectedFreebies((prev) =>
                                    prev.filter(
                                      (f) => String(f.sku) !== String(p.sku)
                                    )
                                  )
                                }
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
              </>
            )}
          </Box>
          {/* end freebies section */}
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              onClick={() => formik.submitForm()} // ensure submit fires even if there was a blur/touch timing issue
              variant="contained"
              size="large"
              disabled={formik.isSubmitting}
              sx={{
                bgcolor: "#ff9800",
                color: "#fff",
                minWidth: 160,
                "&:hover": { bgcolor: "#fb8c00" },
                fontWeight: 700,
              }}
            >
              {isEditMode ? "Update Purchase Order" : "Save Purchase Order"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default AddSales;
