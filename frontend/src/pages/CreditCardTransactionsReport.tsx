import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
} from "@mui/material";
import axiosInstance from "../configs/axiosConfig";
import { Bar, Pie } from "react-chartjs-2";
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
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { addDays } from "date-fns/addDays";
import { startOfDay } from "date-fns";
import { endOfDay } from "date-fns";
import { format, differenceInCalendarDays } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface CreditCardTransactionAccount {
  id: number;
  store: string;
  status?: string;
  createdOn?: string;
}
interface CreditCardTransaction {
  id: number;
  transactionAmount: string | number;
  transactionDate: string;
  receiptNo?: string;
  attachment?: string | null;
  createdOn?: string;
  account?: CreditCardTransactionAccount | null;
}

const monthNames = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May.",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sept",
  "Oct.",
  "Nov.",
  "Dec.",
];

const generateColor = (i: number) => {
  const hue = (i * 47) % 360;
  return `hsl(${hue} 65% 45%)`;
};

const formatPeso = (v: number) =>
  `₱${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CreditCardTransactionsReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CreditCardTransaction[]>([]);
  const [monthIndex, setMonthIndex] = useState<number>(new Date().getMonth());
  const [selectedStore, setSelectedStore] = useState<string>("");
  const snapshotRef = useRef<HTMLDivElement | null>(null);

  // new date range filters
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/credit-card-transactions", {
          params: { perPage: 1000, currentPage: 1 },
        });
        const data: CreditCardTransaction[] = res.data.items || res.data || [];
        setItems(data);
        const filtered = data.filter((it) => {
          if (!it?.transactionDate) return false;
          const d = new Date(it.transactionDate);
          const day = d.getDate();
          return day >= 1 && day <= 15;
        });
        if (filtered.length > 0)
          setMonthIndex(new Date(filtered[0].transactionDate).getMonth());
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // labels for 1..15 days of selected month (or computed range when both dates selected)
  const { labels, labelsDates } = useMemo(() => {
    // when both dates selected, build an array of dates between them (max 30 days)
    if (dateFrom && dateTo) {
      const start = startOfDay(dateFrom);
      const end = endOfDay(dateTo);
      const maxDays = Math.min(30, Math.max(0, differenceInCalendarDays(end, start) + 1));
      const dates = Array.from({ length: maxDays }, (_, i) => addDays(start, i));
      return {
        labels: dates.map((d) => format(d, "MMM d")),
        labelsDates: dates,
      };
    }

    // default: 1..15 of selected monthIndex for current year
    const year = new Date().getFullYear();
    const dates = Array.from({ length: 15 }, (_, i) => new Date(year, monthIndex, i + 1));
    return {
      labels: dates.map((d) => `${monthNames[monthIndex]} ${d.getDate()}`),
      labelsDates: dates,
    };
  }, [monthIndex, dateFrom, dateTo]);

  // compute datasets and stores list; if selectedStore set, only include that store
  const { barData, pieData, stores } = useMemo(() => {
    // build nested map keyed by dateKey (yyyy-MM-dd) and totals per store
    const storeSet = new Set<string>();
    const nested = new Map<string, Map<string, number>>(); // dateKey -> store -> net
    const totals = new Map<string, number>(); // gross per store

    // helper to include item based on either explicit date range or default 1..15 behavior
    const includeItem = (d: Date) => {
      if (dateFrom && dateTo) {
        return d >= startOfDay(dateFrom) && d <= endOfDay(dateTo);
      }
      // default: include only if month matches monthIndex and day 1..15
      return d.getMonth() === monthIndex && d.getDate() >= 1 && d.getDate() <= 15;
    };

    for (const it of items) {
      if (!it?.transactionDate) continue;
      const d = new Date(it.transactionDate);
      if (!includeItem(d)) continue;
      const dateKey = format(startOfDay(d), "yyyy-MM-dd");
      const store = it.account?.store || "Unassigned";
      const amount = Number(it.transactionAmount || 0) || 0;
      const net = amount * 0.95;

      storeSet.add(store);
      totals.set(store, (totals.get(store) || 0) + amount);

      if (!nested.has(dateKey)) nested.set(dateKey, new Map());
      const dayMap = nested.get(dateKey)!;
      dayMap.set(store, (dayMap.get(store) || 0) + net);
    }

    const storeList = Array.from(storeSet).sort();

    // If a store is selected, narrow the dataset list to that store only
    const datasetStores = selectedStore ? [selectedStore] : storeList;

    // ensure consistent color for each store by using its index in storeList
    const datasets = datasetStores.map((st) => {
      const dataArr = labelsDates.map((d) => {
        const key = format(startOfDay(d), "yyyy-MM-dd");
        const dayMap = nested.get(key);
        return dayMap ? Number((dayMap.get(st) || 0).toFixed(2)) : 0;
      });
      // use storeList index to pick color so single-selection uses the same color as in the full chart
      const colorIndex = Math.max(0, storeList.indexOf(st));
      return {
        label: st,
        data: dataArr,
        backgroundColor: generateColor(colorIndex),
        borderRadius: 4,
      };
    });

    const pie = {
      labels: datasetStores,
      datasets: [
        {
          data: datasetStores.map((s) => Number((totals.get(s) || 0).toFixed(2))),
          backgroundColor: datasetStores.map((s) => {
            const colorIndex = Math.max(0, storeList.indexOf(s));
            return generateColor(colorIndex);
          }),
        },
      ],
    };

    const bar = {
      labels,
      datasets,
    };

    return { barData: bar, pieData: pie, stores: storeList };
  }, [items, labels, selectedStore, dateFrom, dateTo]);
  // end useMemo
  // compute title label
  const chartTitle = dateFrom && dateTo
    ? `Net Sales ${format(dateFrom, "MMM d")} — ${format(dateTo, "MMM d")}`
    : `Net Sales 1st–15th of ${monthNames[monthIndex]}`;

  const barOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = Number(ctx.raw || 0);
            return `${ctx.dataset.label}: ${val.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`;
          },
        },
      },
      title: { display: false },
    },
    scales: {
      x: { ticks: { maxRotation: 0 } },
      y: {
        ticks: {
          callback: (value: any) => `₱${Number(value).toLocaleString()}`,
        },
      },
    },
  };

  const pieOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = Number(ctx.parsed || 0);
            return `${ctx.label}: ${formatPeso(val)}`;
          },
        },
      },
    },
  };

  const generateSnapshot = async () => {
    if (!selectedStore) return;
    try {
      // build map keyed by yyyy-MM-dd for the current labelsDates (dynamic range or 1..15)
      const allowedKeys = new Set(labelsDates.map((d) => format(startOfDay(d), "yyyy-MM-dd")));
      const dayMap = new Map<string, { amount: number; receipts: string[] }>();
      let totalGross = 0;

      for (const it of items) {
        if (!it?.transactionDate) continue;
        const d = new Date(it.transactionDate);
        const key = format(startOfDay(d), "yyyy-MM-dd");
        if (!allowedKeys.has(key)) continue;
        const store = it.account?.store || "Unassigned";
        if (store !== selectedStore) continue;
        const amount = Number(it.transactionAmount || 0) || 0;
        totalGross += amount;
        const entry = dayMap.get(key) || { amount: 0, receipts: [] };
        entry.amount += amount;
        if (it.receiptNo) entry.receipts.push(String(it.receiptNo));
        dayMap.set(key, entry);
      }

      // prepare HTML snapshot element (light color)
      const container = document.createElement("div");
      container.setAttribute("data-snapshot", "credit-card-report");
      Object.assign(container.style, {
        width: "1200px",
        padding: "18px",
        background: "#fff9f9",
        color: "#111",
        fontFamily: "Arial, Helvetica, sans-serif",
        boxSizing: "border-box",
        border: "1px solid #e6bcbc",
        position: "fixed",
        left: "10px",
        top: "10px",
        zIndex: "2147483647",
      });

      const title = document.createElement("div");
      title.style.display = "flex";
      title.style.justifyContent = "space-between";
      title.style.alignItems = "center";
      title.style.marginBottom = "12px";

      const left = document.createElement("div");
      const h = document.createElement("h3");
      h.style.margin = "0";
      h.style.fontSize = "18px";
      h.textContent = "Credit Card Transactions Snapshot";
      left.appendChild(h);

      const sub = document.createElement("div");
      sub.style.fontSize = "12px";
      sub.style.color = "#444";
      // show selected range if both dates present, otherwise show month 1st-15th message
      if (dateFrom && dateTo) {
        sub.textContent = `${selectedStore} — ${format(dateFrom, "MMM d, yyyy")} — ${format(dateTo, "MMM d, yyyy")}`;
      } else {
        sub.textContent = `${selectedStore} — 1st to 15th of ${monthNames[monthIndex]}`;
      }
      left.appendChild(sub);

      const right = document.createElement("div");
      right.style.textAlign = "right";
      right.innerHTML = `<div style="font-size:12px;color:#666">Generated: ${new Date().toLocaleString()}</div>`;

      title.appendChild(left);
      title.appendChild(right);
      container.appendChild(title);

      // table
      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "13px";

      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th style="border:1px solid #e0bebe;padding:6px;background:#f39c12;color:#fff;font-weight:700;text-align:left;width:60px">Day</th>
          <th style="border:1px solid #e0bebe;padding:6px;background:#f39c12;color:#fff;font-weight:700;text-align:right">Amount</th>
          <th style="border:1px solid #e0bebe;padding:6px;background:#f39c12;color:#fff;font-weight:700;text-align:left">DATE</th>
          <th style="border:1px solid #e0bebe;padding:6px;background:#f39c12;color:#fff;font-weight:700;text-align:right">RECEIPT #</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      // iterate the dynamic labelsDates array to render rows in the selected range/order
      for (const d of labelsDates) {
        const key = format(startOfDay(d), "yyyy-MM-dd");
        const entry = dayMap.get(key);
        const dateStr = format(d, "MMM d/yyyy");
        const dayNum = d.getDate();
        const receipts = entry && entry.receipts.length ? entry.receipts.join(", ") : "";
        const amountStr = entry ? formatPeso(entry.amount) : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="border:1px solid #f0d6d6;padding:6px;background:transparent">${dayNum}</td>
          <td style="border:1px solid #f0d6d6;padding:6px;text-align:right">${amountStr}</td>
          <td style="border:1px solid #f0d6d6;padding:6px">${dateStr}</td>
          <td style="border:1px solid #f0d6d6;padding:6px;text-align:right">${receipts}</td>
        `;
        tbody.appendChild(tr);
      }

      // totals rows - reflect the filtered totalGross
      const totalNet = Number((totalGross * 0.95).toFixed(2));
      const lessFive = Number((totalGross * 0.05).toFixed(2));
      const trows = [
        { label: "Total", value: totalGross, bold: false },
        { label: "Less 5%", value: lessFive, bold: false },
        { label: "Net Total", value: totalNet, bold: true },
      ];
      for (const r of trows) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="border:1px solid #e0bebe;padding:6px;background:#fff;font-weight:700">${r.label}</td>
          <td style="border:1px solid #e0bebe;padding:6px;background:#fff;text-align:right;font-weight:${r.bold ? 800 : 600}">₱${Number(r.value || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
          <td style="border:1px solid #e0bebe;padding:6px;background:#fff"></td>
          <td style="border:1px solid #e0bebe;padding:6px;background:#fff"></td>
        `;
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      container.appendChild(table);

      // append into DOM (visible) so html-to-image can correctly render
      document.body.appendChild(container);

      // small delay to ensure layout/layout fonts are ready
      await new Promise((r) => setTimeout(r, 140));

      const mod: any = await import("html-to-image");
      const toJpeg = mod.toJpeg || mod.toPng;
      const dataUrl = await toJpeg(container, {
        quality: 0.98,
        backgroundColor: "#fff",
      });

      const link = document.createElement("a");
      const rangeSafe =
        dateFrom && dateTo
          ? `${format(dateFrom, "yyyyMMdd")}_${format(dateTo, "yyyyMMdd")}`
          : `${monthNames[monthIndex].replace(".", "")}_1-15`;
      const storeSafe = (selectedStore || "all").replace(/\s+/g, "_");
      link.download = `snapshot-${storeSafe}-${rangeSafe}.jpg`;
      link.href = dataUrl;
      link.click();

      // cleanup
      document.body.removeChild(container);
    } catch (err) {
      console.error("Snapshot generation failed", err);
    }
  };

  // add a key that changes when filters change so chart remounts
  const chartKey = `${selectedStore}-${dateFrom?.toISOString() || ""}-${dateTo?.toISOString() || ""}-${monthIndex}`;

  return (
    <Box ref={snapshotRef} sx={{ p: 3 }}>
      <Box mb={1} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Credit Card Transactions Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View the Credit Card Transactions Report
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="From"
              value={dateFrom}
              onChange={(d) => {
                if (!d) {
                  setDateFrom(null);
                  setDateTo(null);
                  return;
                }
                // ensure we store a JS Date
                const from = d instanceof Date ? d : new Date(d);
                setDateFrom(from);
                // clear dateTo if it's outside valid 30-day window for the new from date
                if (dateTo && (dateTo < from || dateTo > addDays(from, 30))) {
                  setDateTo(null);
                }
              }}
              slotProps={{
                textField: { size: "small" },
              }}
            />
            <DatePicker
              label="To"
              value={dateTo}
              onChange={(d) => setDateTo(d ? (d instanceof Date ? d : new Date(d)) : null)}
              disabled={!dateFrom}
              minDate={dateFrom || undefined}
              maxDate={dateFrom ? addDays(dateFrom, 30) : undefined}
              slotProps={{
                textField: { size: "small" },
              }}
            />
          </LocalizationProvider>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="store-filter-label">Filter by store</InputLabel>
            <Select
              labelId="store-filter-label"
              value={selectedStore}
              label="Filter by store"
              onChange={(e) => setSelectedStore(String(e.target.value))}
            >
              <MenuItem value="">All stores</MenuItem>
              {stores.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            disabled={!selectedStore}
            onClick={generateSnapshot}
            sx={{ bgcolor: "#1976d2", color: "#fff" }}
          >
            Generate snapshot
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : barData.datasets?.length === 0 ? (
          <Typography align="center" color="text.secondary">
            No transactions found for the 1st–15th cutoff.
          </Typography>
        ) : (
          <Box>
            <Typography
              textAlign="center"
              variant="subtitle1"
              sx={{ mb: 1, fontWeight: 600 }}
            >
              {chartTitle}
            </Typography>
            <Box sx={{ height: 340 }}>
              <Bar
                key={chartKey}
                data={barData as any}
                options={{ ...barOptions, maintainAspectRatio: false }}
              />
            </Box>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : pieData.datasets?.[0].data.length === 0 ? (
          <Typography align="center" color="text.secondary">
            No sales distribution data available.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Box sx={{ width: 360, minWidth: 260 }}>
              <Typography
                textAlign="center"
                variant="subtitle1"
                sx={{ mb: 1, fontWeight: 600 }}
              >
                Sales distribution
              </Typography>
              <Box
                sx={{
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pie
                  key={`pie-${chartKey}`}
                  data={pieData as any}
                  options={{ ...pieOptions, maintainAspectRatio: false }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default CreditCardTransactionsReport;
