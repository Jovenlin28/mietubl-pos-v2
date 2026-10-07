import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Backdrop,
  LinearProgress,
  TextField,
  Button,
  Box as MBox,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { Bar as BarChart, Doughnut } from "react-chartjs-2";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartOptions,
} from "chart.js";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PieChartIcon from "@mui/icons-material/PieChart";
import StoreIcon from "@mui/icons-material/Store";
import GroupIcon from "@mui/icons-material/Group";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import axiosInstance from "../configs/axiosConfig";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, alpha } from "@mui/material/styles";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SALES_TARGET = 6000000;
const ALL_MONTH_VALUE = -1;

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [allTime, setAllTime] = useState({
    grossProfit: 0,
    grossProfitMargin: 0,
    sales: 0,
    totalCostingPrice: 0,
    expenses: 0,
    totalPurchaseOrders: 0,
    totalAgentCommissions: 0,
    totalPaidOrders: 0,
    totalPaidOrdersPartially: 0,
    totalUnpaidOrders: 0,
    totalPaymentsAccomplies: 0,
  });
  // const [today, setToday] = useState({
  //   sales: 0,
  //   itemsSold: 0,
  //   expenses: 0,
  // });
  // number of orders (sales records) for today
  const [ordersToday, setOrdersToday] = useState<number>(0);
  const [bestsellers, setBestsellers] = useState<any[]>([]);
  const [topChannels, setTopChannels] = useState<any[]>([]);
  const [expenseDist, setExpenseDist] = useState<any[]>([]);
  const [dailyChart, setDailyChart] = useState<any>({
    labels: [],
    datasets: [
      {
        label: "Sales",
        data: [],
        backgroundColor: "#27ae60",
        borderRadius: 4,
        barPercentage: 0.7,
      },
      {
        label: "Expenses",
        data: [],
        backgroundColor: "#c0392b",
        borderRadius: 4,
        barPercentage: 0.7,
      },
    ],
  });
  const [monthlyChart, setMonthlyChart] = useState<any>({
    labels: [],
    datasets: [
      {
        label: "Sales",
        data: [],
        backgroundColor: "#27ae60",
        borderRadius: 4,
        barPercentage: 0.7,
      },
      {
        label: "Expenses",
        data: [],
        backgroundColor: "#c0392b",
        borderRadius: 4,
        barPercentage: 0.7,
      },
    ],
  });
  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery("(max-width:800px)");
  const textColor = theme.palette.text.primary;

  const buildSummaryParams = (
    mIndex = monthIndex,
    y = year,
    categoryName = selectedCategoryName
  ) => {
    const params = new URLSearchParams();
    params.append("year", String(y));

    if (mIndex !== ALL_MONTH_VALUE) {
      params.append("month", String(mIndex + 1).padStart(2, "0"));
    }

    if (categoryName) {
      params.append("category", categoryName);
    }

    return params;
  };

  // move loader function out so UI controls can call it
  const loadSummary = async (
    mIndex = monthIndex,
    y = year,
    categoryName = selectedCategoryName
  ) => {
    setLoading(true);
    try {
      const params = buildSummaryParams(mIndex, y, categoryName);

      const url = "/dashboard/summary" + (params.toString() ? `?${params.toString()}` : "");
      const { data } = await axiosInstance.get(url);

      // top-level summary
      const totalSold = Number(data.totalSoldPrice || 0);
      const totalCostingPrice = Number(data.totalCostingPrice || 0);
      const grossProfit = Number(data.allTimeGrossProfit || 0);
      const allExpenses = Number(data.allTimeExpenses || 0);

      setAllTime({
        grossProfit,
        grossProfitMargin: totalSold
          ? Math.round((grossProfit / totalSold) * 100)
          : 0,
        sales: totalSold,
        totalCostingPrice,
        expenses: allExpenses,
        totalPurchaseOrders: Number(data.totalPurchaseOrders || 0),
        totalAgentCommissions: Number(data.totalAgentCommissions || 0),
        totalPaidOrders: Number(data.totalPaidOrders || 0),
        totalPaidOrdersPartially: Number(data.totalPaidOrdersPartially || 0),
        totalUnpaidOrders: Number(data.totalUnpaidOrders || 0),
        totalPaymentsAccomplies: Number(
          data.totalPaymentsAccomplies || data.totalDeliveryAccomplies || 0
        ),
      });

      // setToday({
      //   sales: Number(data.salesToday || 0),
      //   itemsSold: Number(data.itemsSoldToday || 0),
      //   expenses: Number(data.expensesToday || 0),
      // });

      // labels: if backend returned dailyLabels use them; otherwise generate by current month
      let labels: string[] = [];
      if (Array.isArray(data.dailyLabels) && data.dailyLabels.length > 0) {
        // show just the day part for compactness if they are YYYY-MM-DD
        labels = data.dailyLabels.map((d: string) => {
          if (typeof d === "string" && d.match(/^\d{4}-\d{2}-\d{2}$/))
            return d.slice(8);
          return String(d);
        });
      } else {
        const now = new Date();
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) =>
          (i + 1).toString()
        );
      }

      setDailyChart({
        labels,
        datasets: [
          {
            label: "Sales",
            backgroundColor: "#27ae60",
            data: Array.isArray(data.dailySales)
              ? data.dailySales
              : Array(labels.length).fill(0),
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: "Expenses",
            backgroundColor: "#c0392b",
            data: Array.isArray(data.dailyExpenses)
              ? data.dailyExpenses
              : Array(labels.length).fill(0),
            borderRadius: 4,
            barPercentage: 0.7,
          },
        ],
      });

      setMonthlyChart({
        labels: months,
        datasets: [
          {
            label: "Sales",
            backgroundColor: "#27ae60",
            data: Array.isArray(data.monthlySales)
              ? data.monthlySales
              : Array(12).fill(0),
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: "Expenses",
            backgroundColor: "#c0392b",
            data: Array.isArray(data.monthlyExpenses)
              ? data.monthlyExpenses
              : Array(12).fill(0),
            borderRadius: 4,
            barPercentage: 0.7,
          },
        ],
      });

      setTopChannels(Array.isArray(data.topChannels) ? data.topChannels : []);
      setExpenseDist(Array.isArray(data.expenseDist) ? data.expenseDist : []);
      setOrdersToday(Number(data.ordersToday || 0));

      // bestsellers already set in previous loadSummary (productQuantities)
      const prodQuant: any[] = Array.isArray(data.productQuantities)
        ? data.productQuantities
        : [];
      setBestsellers(
        prodQuant.slice(0, 10).map((p) => ({
          name: p.name || "Unknown",
          total: Number(p.totalQuantity || 0),
        }))
      );
    } catch (err) {
      // keep previous state on error
    } finally {
      setLoading(false);
    }
  };

  const didLoadRef = useRef(false);
  useEffect(() => {
    // Guard so we don't fire twice in React 18 StrictMode (dev)
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    loadSummary();
  }, []);

  // load categories for dropdown
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axiosInstance.get("/categories");
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        // ignore
      }
    };
    fetchCategories();
  }, []);

  // lighter card style
  const chartCardSx = {
    flex: 2,
    bgcolor: "#fff",
    color: textColor,
    p: 2,
    borderRadius: 2,
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
  };

  const chartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: textColor,
          font: { size: 13 },
        },
      },
      title: { display: false },
    },
    scales: {
      x: {
        grid: { display: false, color: "rgba(0,0,0,0.04)" },
        ticks: { color: textColor },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: {
          color: textColor,
          callback: (value: any) =>
            value.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        },
      },
    },
  };

  const horizontalBarOptions: ChartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            ctx.parsed.x.toLocaleString(undefined, {
              minimumFractionDigits: 0,
            }),
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: { color: textColor },
      },
      y: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 13 } },
      },
    },
  };

  // top widget: use white card + colored icon badge
  const widgetBox = (
    accent: string,
    icon: React.ReactNode,
    label: string,
    value: string | number
  ) => (
    <Paper
      sx={{
        bgcolor: "#fff",
        color: textColor,
        p: 2,
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        minHeight: 100,
        border: "1px solid rgba(15,23,42,0.06)",
        boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 1.5,
          mr: 2,
          bgcolor: alpha(accent, 0.12),
          color: accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography fontWeight={700} fontSize={14} color="text.secondary">
          {label}
        </Typography>
        <Typography fontWeight={700} fontSize={18} mt={0.5}>
          {typeof value === "number"
            ? value.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : value}
        </Typography>
      </Box>
    </Paper>
  );

  const summaryWidgets = [
    {
      label: "All Time Gross Profit",
      accent: "#27ae60",
      icon: <TrendingUpIcon />,
      value: Number(allTime.grossProfit || 0).toLocaleString(),
    },
    {
      label: "Total Sold Price",
      accent: "#2980b9",
      icon: <ShoppingCartIcon />,
      value: Number(allTime.sales || 0).toLocaleString(),
    },
    {
      label: "Total Costing Price",
      accent: "#f39c12",
      icon: <LocalOfferIcon />,
      value: Number(allTime.totalCostingPrice || 0).toLocaleString(),
    },
    {
      label: "Total Received Payments",
      accent: "#27ae60",
      icon: <AccountBalanceWalletIcon />,
      value: Number((allTime as any).totalPaymentsAccomplies || 0).toLocaleString(),
    },
    {
      label: "Total Unreceived Payments",
      accent: "#c0392b",
      icon: <ReportProblemIcon />,
      value: Math.max(
        0,
        Number(allTime.sales || 0) -
          Number((allTime as any).totalPaymentsAccomplies || 0)
      ),
    },
    {
      label: "Total Purchase Orders",
      accent: "#6c7a89",
      icon: <AssignmentIcon />,
      value: Number((allTime as any).totalPurchaseOrders || 0).toLocaleString(),
    },
    {
      label: "Total Paid Orders",
      accent: "#27ae60",
      icon: <AccountBalanceWalletIcon />,
      value: Number((allTime as any).totalPaidOrders || 0).toLocaleString(),
    },
    {
      label: "Total Unpaid Orders",
      accent: "#c0392b",
      icon: <ReportProblemIcon />,
      value: Number((allTime as any).totalUnpaidOrders || 0).toLocaleString(),
    },
    {
      label: "Total Paid Orders Partially",
      accent: "#8e44ad",
      icon: <HourglassEmptyIcon />,
      value: Number((allTime as any).totalPaidOrdersPartially || 0).toLocaleString(),
    },
    {
      label: "Total Agent Commissions",
      accent: "#f39c12",
      icon: <MonetizationOnIcon />,
      value: Number((allTime as any).totalAgentCommissions || 0).toLocaleString(),
    },
  ];

  const formatAmount = (value: number) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getSelectedMonthLabel = () =>
    monthIndex === ALL_MONTH_VALUE ? "All Months" : months[monthIndex];

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load image"));
      image.src = src;
    });

  const addReportLogo = async (report: jsPDF) => {
    try {
      const image = await loadImage("/mietubl_logo.png");
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return 40;

      ctx.drawImage(image, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");

      const maxLogoWidth = 170;
      const maxLogoHeight = 60;
      const ratio = Math.min(
        maxLogoWidth / image.naturalWidth,
        maxLogoHeight / image.naturalHeight
      );
      const logoWidth = image.naturalWidth * ratio;
      const logoHeight = image.naturalHeight * ratio;
      const x = (report.internal.pageSize.getWidth() - logoWidth) / 2;

      report.addImage(dataUrl, "PNG", x, 18, logoWidth, logoHeight);

      return 18 + logoHeight + 16;
    } catch (error) {
      return 40;
    }
  };

  const handleGenerateReport = async () => {
    const report = new jsPDF({ unit: "pt", format: "a4" });
    const generatedAt = new Date();
    const monthLabel = getSelectedMonthLabel();
    const categoryLabel = selectedCategoryName || "All Categories";
    const headerStartY = await addReportLogo(report);
    const titleY = headerStartY + 18;
    const detailsY = titleY + 22;
    const generatedY = detailsY + 16;
    const tableStartY = generatedY + 14;

    report.setFontSize(18);
    report.text("Summary Report", 40, titleY);

    report.setFontSize(11);
    report.setTextColor(80);
    report.text(`Year: ${year}`, 40, detailsY);
    report.text(`Month: ${monthLabel}`, 140, detailsY);
    report.text(`Category: ${categoryLabel}`, 270, detailsY);
    report.text(`Generated: ${generatedAt.toLocaleString()}`, 40, generatedY);

    autoTable(report, {
      startY: tableStartY,
      head: [["Metric", "Value"]],
      body: [
        ["All Time Gross Profit", formatAmount(allTime.grossProfit)],
        ["Gross Profit Margin", `${allTime.grossProfitMargin}%`],
        ["Total Sold Price", formatAmount(allTime.sales)],
        ["Total Costing Price", formatAmount(allTime.totalCostingPrice)],
        ["All-time Expense", formatAmount(allTime.expenses)],
        [
          "Total Received Payments",
          formatAmount(Number((allTime as any).totalPaymentsAccomplies || 0)),
        ],
        [
          "Total Unreceived Payments",
          formatAmount(
            Math.max(
              0,
              Number(allTime.sales || 0) -
                Number((allTime as any).totalPaymentsAccomplies || 0)
            )
          ),
        ],
        [
          "Total Purchase Orders",
          Number((allTime as any).totalPurchaseOrders || 0).toLocaleString(),
        ],
        ["Total Paid Orders", Number((allTime as any).totalPaidOrders || 0).toLocaleString()],
        [
          "Total Unpaid Orders",
          Number((allTime as any).totalUnpaidOrders || 0).toLocaleString(),
        ],
        [
          "Total Paid Orders Partially",
          Number((allTime as any).totalPaidOrdersPartially || 0).toLocaleString(),
        ],
        [
          "Total Agent Commissions",
          formatAmount(Number((allTime as any).totalAgentCommissions || 0)),
        ],
        ["Orders This Month", ordersToday.toLocaleString()],
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 156, 18] },
      columnStyles: {
        0: { cellWidth: 230 },
      },
    });

    autoTable(report, {
      startY: (report as any).lastAutoTable.finalY + 18,
      head: [["Top Sales Channel", "Total"]],
      body:
        topChannels.length > 0
          ? topChannels.map((ch) => [
              ch.name || "Unknown",
              Number(ch.total || 0).toLocaleString(),
            ])
          : [["No data", "0"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 156, 18] },
    });

    autoTable(report, {
      startY: (report as any).lastAutoTable.finalY + 18,
      head: [["Top Selling Item / Service", "Total Quantity"]],
      body:
        bestsellers.length > 0
          ? bestsellers.map((item) => [
              item.name || "Unknown",
              Number(item.total || 0).toLocaleString(),
            ])
          : [["No data", "0"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [39, 174, 96] },
    });

    autoTable(report, {
      startY: (report as any).lastAutoTable.finalY + 18,
      head: [["Expense Category", "Total"]],
      body:
        expenseDist.length > 0
          ? expenseDist.map((item) => [
              item.name || "Unknown",
              formatAmount(Number(item.total || 0)),
            ])
          : [["No data", "0.00"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [192, 57, 43] },
    });

    const normalizedMonth =
      monthIndex === ALL_MONTH_VALUE
        ? "all"
        : String(monthIndex + 1).padStart(2, "0");
    report.save(`dashboard-report-${year}-${normalizedMonth}.pdf`);
  };

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        width: "100%",
        boxSizing: "border-box",
        bgcolor: "transparent",
      }}
    >
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box
        mb={2}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Welcome, Admin
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            You have {ordersToday.toLocaleString()} Orders this month
          </Typography>
        </Box>

        <MBox
          sx={{
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
          }}
          display="flex"
          gap={1}
          alignItems="center"
        >
          <FormControl
            size="small"
            sx={{
              width: { xs: "100%", sm: 200 },
              bgcolor: "#fafbfc",
              "& .MuiInputBase-root": { height: 40 },
            }}
          >
            <InputLabel>Month</InputLabel>
            <Select
              label="Month"
              value={monthIndex}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMonthIndex(v);
                loadSummary(v, year, selectedCategoryName);
              }}
            >
              <MenuItem value={ALL_MONTH_VALUE}>All</MenuItem>
              {months.map((m, i) => (
                <MenuItem key={m} value={i}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            size="small"
            sx={{
              width: { xs: "100%", sm: 140 },
              bgcolor: "#fafbfc",
              "& .MuiInputBase-root": { height: 40 },
            }}
          >
            <InputLabel>Year</InputLabel>
            <Select
              label="Year"
              value={year}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYear(v);
                loadSummary(monthIndex, v, selectedCategoryName);
              }}
            >
              {([new Date().getFullYear(), new Date().getFullYear() - 1]).map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            select
            label="Category"
            size="small"
            value={selectedCategoryName ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : String(e.target.value);
              setSelectedCategoryName(v);
              loadSummary(monthIndex, year, v);
            }}
            sx={{
              width: { xs: "100%", sm: 220 },
              bgcolor: "#fafbfc",
              "& .MuiInputBase-root": { height: 40 },
            }}
          >
            <MenuItem value="">All</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.name}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <Box gap={2} display="flex">
            <Button
              variant="contained"
              size="small"
              onClick={() => loadSummary(monthIndex, year, selectedCategoryName)}
            >
              Apply
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                setMonthIndex(currentMonth);
                setSelectedCategoryName(null);
                setYear(currentYear);
                loadSummary(currentMonth, currentYear, null);
              }}
            >
              Clear
            </Button>
            <Button variant="outlined" size="small" onClick={handleGenerateReport}>
              Generate Report
            </Button>
          </Box>
        </MBox>
        {/* date filters (right side of title) */}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
          gap: 2,
          mb: 2,
          alignItems: "stretch",
        }}
      >
        {summaryWidgets.map((widget) => (
          <Box key={widget.label} sx={{ minWidth: 0 }}>
            {widgetBox(widget.accent, widget.icon, widget.label, widget.value)}
          </Box>
        ))}
      </Box>

      {/* Second row widgets */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={0}
        sx={{ gap: 2 }}
        mb={2}
      >
        <Paper
          sx={{
            bgcolor: "#fff",
            color: textColor,
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            p: 2,
            borderRadius: 2,
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
          }}
        >
          <Typography fontWeight={700} fontSize={18}>
            Gross Profit Margin
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
            <PieChartIcon sx={{ fontSize: 40, color: "#f39c12", mr: 2 }} />
            <Typography fontWeight={700} fontSize={28}>
              {allTime.grossProfitMargin}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, allTime.grossProfitMargin))}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: "rgba(15,23,42,0.04)",
              "& .MuiLinearProgress-bar": { bgcolor: "#f39c12" },
              mt: 2,
            }}
          />
        </Paper>

        <Paper
          sx={{
            bgcolor: "#fff",
            color: textColor,
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            p: 2,
            borderRadius: 2,
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
          }}
        >
          <Typography fontWeight={700} fontSize={18}>
            All-time Expense
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
            <ReceiptIcon sx={{ fontSize: 40, color: "#c0392b", mr: 2 }} />
            <Typography fontWeight={700} fontSize={28}>
              {allTime.expenses.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </Box>
        </Paper>
      </Stack>

      {/* Main charts and lists */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={0}
        sx={{ gap: 2 }}
        mb={2}
      >
        <Paper sx={{ ...chartCardSx, width: "100%", boxSizing: "border-box" }}>
          <Typography fontWeight={700} fontSize={20} mb={1}>
            Daily Sales Trend
          </Typography>
          <BarChart data={dailyChart} options={chartOptions} height={180} />
          <Typography fontSize={14} color="text.secondary" mt={1}>
            Peak{" "}
            {Math.max(...(dailyChart.datasets[0]?.data || [0])).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
              }
            )}
          </Typography>
        </Paper>

        <Paper sx={{ ...chartCardSx, width: "100%", boxSizing: "border-box" }}>
          <Typography fontWeight={700} fontSize={20} mb={1}>
            Monthly Sales Trend
          </Typography>
          <BarChart data={monthlyChart} options={chartOptions} height={180} />
          <Typography fontSize={14} color="text.secondary" mt={1}>
            Peak{" "}
            {Math.max(
              ...(monthlyChart.datasets[0]?.data || [0])
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Typography>
        </Paper>
      </Stack>

      {/* Bestselling and channels */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={0}
        sx={{ gap: 2 }}
        mb={2}
      >
        <Paper
          sx={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            bgcolor: "#fff",
            color: textColor,
            p: 3,
            borderRadius: 2,
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography fontWeight={700} fontSize={16} mb={2}>
            Top Sales Channel
          </Typography>
          <BarChart
            data={{
              labels: topChannels.map((ch) => ch.name),
              datasets: [
                {
                  data: topChannels.map((ch) => ch.total),
                  backgroundColor: "#4f8cff",
                  borderRadius: 8,
                  barPercentage: 0.7,
                  categoryPercentage: 0.7,
                  maxBarThickness: 32,
                },
              ],
            }}
            options={horizontalBarOptions}
            height={180}
          />
        </Paper>

        <Paper
          sx={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            bgcolor: "#fff",
            color: textColor,
            p: 3,
            borderRadius: 2,
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography fontWeight={700} fontSize={16} mb={2}>
            Top 10 best selling items / services
          </Typography>
          <BarChart
            data={{
              labels: bestsellers.map((ch) => ch.name),
              datasets: [
                {
                  data: bestsellers.map((ch) => ch.total),
                  backgroundColor: "#4f8cff",
                  borderRadius: 8,
                  barPercentage: 0.7,
                  categoryPercentage: 0.7,
                  maxBarThickness: 32,
                },
              ],
            }}
            options={horizontalBarOptions}
            height={180}
          />
        </Paper>
      </Stack>

      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={0}
        sx={{ gap: 2 }}
        mb={2}
      >
        <Paper
          sx={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            bgcolor: "#fff",
            color: textColor,
            p: 3,
            borderRadius: 2,
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography fontWeight={700} fontSize={16} mb={2}>
            Expense Distribution
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              justifyContent: "center",
              gap: 4,
              px: 2,
            }}
          >
            <Box sx={{ width: 160, height: 160, flexShrink: 0 }}>
              <Doughnut
                data={{
                  labels: expenseDist.map((e) => e.name),
                  datasets: [
                    {
                      data: expenseDist.map((e) => e.total),
                      backgroundColor: [
                        "#4f8cff",
                        "#ff5c5c",
                        "#ffd966",
                        "#4fd18b",
                        "#7c4fff",
                        "#ffb366",
                        "#6ec6ff",
                        "#a3e635",
                        "#f9e79f",
                      ],
                    },
                  ],
                }}
                options={{
                  plugins: { legend: { display: false } },
                  cutout: "70%",
                }}
              />
            </Box>

            <Box
              sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}
            >
              {expenseDist.slice(0, 6).map((e, idx) => (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  key={e.name}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      bgcolor: [
                        "#4f8cff",
                        "#ff5c5c",
                        "#ffd966",
                        "#4fd18b",
                        "#7c4fff",
                        "#ffb366",
                        "#6ec6ff",
                        "#a3e635",
                        "#f9e79f",
                      ][idx % 9],
                    }}
                  />
                  <Typography fontSize={14} color="text.primary">
                    {e.name}
                  </Typography>
                </Stack>
              ))}
              {expenseDist.length > 6 && (
                <Typography fontSize={13} color="text.secondary" mt={0.5}>
                  {expenseDist.length - 6} more
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>

        <Paper
          sx={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            bgcolor: "#fff",
            color: textColor,
            p: 3,
            borderRadius: 2,
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
          }}
        >
          <Typography
            fontWeight={700}
            fontSize={16}
            mb={2}
            sx={{ ml: 0.5, mt: 0 }}
          >
            Annual Sales Revenue Target
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              mt: 2,
              gap: 4,
            }}
          >
            <Box sx={{ position: "relative", width: 160, height: 160 }}>
              <Doughnut
                data={{
                  labels: ["Current", "Remaining"],
                  datasets: [
                    {
                      data: [
                        allTime.sales,
                        Math.max(SALES_TARGET - allTime.sales, 0),
                      ],
                      backgroundColor: ["#4fd18b", "#e6e7ee"],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  cutout: "70%",
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx: any) =>
                          ctx.label === "Current"
                            ? `Current: ${allTime.sales.toLocaleString(
                                undefined,
                                { minimumFractionDigits: 2 }
                              )}`
                            : `Remaining: ${Math.max(
                                SALES_TARGET - allTime.sales,
                                0
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}`,
                      },
                    },
                  },
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Typography fontWeight={700} fontSize={20} color="#4fd18b">
                  {Math.round((allTime.sales / SALES_TARGET) * 100)}%
                </Typography>
              </Box>
            </Box>

            <Box sx={{ ml: 2 }}>
              <Typography fontSize={14} color="text.secondary">
                Current
              </Typography>
              <Typography fontWeight={700} fontSize={18} mb={1}>
                {allTime.sales.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
              <Typography fontSize={14} color="text.secondary">
                Goal
              </Typography>
              <Typography fontWeight={700} fontSize={18}>
                {SALES_TARGET.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
};

export default Dashboard;
