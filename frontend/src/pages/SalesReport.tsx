import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import axiosInstance from "../configs/axiosConfig";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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

const SalesReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<any[]>([]);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [allTimeRecord, setAllTimeRecord] = useState<any>({
    itemsSold: 0,
    sales: 0,
    expenses: 0,
    grossProfit: 0,
    grossProfitMargin: 0,
  });
  const [dailyChartData, setDailyChartData] = useState<any>({
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
  const [monthlyChartData, setMonthlyChartData] = useState<any>({
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

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.get("/dashboard/sales/summary");

        // all-time record
        setAllTimeRecord({
          itemsSold: Number(data.allTimeRecord?.itemsSold || 0),
          sales: Number(data.allTimeRecord?.sales || 0),
          expenses: Number(data.allTimeRecord?.expenses || 0),
          grossProfit: Number(data.allTimeRecord?.grossProfit || 0),
          grossProfitMargin: Number(data.allTimeRecord?.grossProfitMargin || 0),
        });

        // daily chart
        const dLabels = Array.isArray(data.dailyLabels) ? data.dailyLabels : [];
        const dSales = Array.isArray(data.dailySales) ? data.dailySales : Array(dLabels.length).fill(0);
        const dItems = Array.isArray(data.dailyItems) ? data.dailyItems : Array(dLabels.length).fill(0);
        // expenses not provided by this endpoint (server removed); default to zeros
        const dExpenses = Array(dLabels.length).fill(0);

        setDailyChartData({
          labels: dLabels,
          datasets: [
            {
              label: "Sales",
              backgroundColor: "#27ae60",
              data: dSales,
              borderRadius: 4,
              barPercentage: 0.7,
            },
            {
              label: "Expenses",
              backgroundColor: "#c0392b",
              data: dExpenses,
              borderRadius: 4,
              barPercentage: 0.7,
            },
          ],
        });

        // monthly chart
        const mSales = Array.isArray(data.monthlySales) ? data.monthlySales : Array(12).fill(0);
        const mItems = Array.isArray(data.monthlyItems) ? data.monthlyItems : Array(12).fill(0);
        const mExpenses = Array(12).fill(0);

        setMonthlyChartData({
          labels: months,
          datasets: [
            {
              label: "Sales",
              backgroundColor: "#27ae60",
              data: mSales,
              borderRadius: 4,
              barPercentage: 0.7,
            },
            {
              label: "Expenses",
              backgroundColor: "#c0392b",
              data: mExpenses,
              borderRadius: 4,
              barPercentage: 0.7,
            },
          ],
        });

        setTopProducts(Array.isArray(data.topProducts) ? data.topProducts : []);

        // build daily breakdown table data (server returns labels, sales, expenses)
        const dailyBreakdownData = dLabels.map((label, idx) => ({
          day: Number(label),
          items: Number(dItems[idx] || 0),
          sales: Number(dSales[idx] || 0),
          expenses: Number(dExpenses[idx] || 0),
          profit: Number((dSales[idx] || 0) - (dExpenses[idx] || 0)),
        }));
        setDailyBreakdown(dailyBreakdownData);

        // build monthly breakdown table data (server returns arrays length 12)
        const monthlyBreakdownData = months.map((m, idx) => ({
          month: m,
          items: Number(mItems[idx] || 0),
          sales: Number(mSales[idx] || 0),
          expenses: Number(mExpenses[idx] || 0),
          profit: Number((mSales[idx] || 0) - (mExpenses[idx] || 0)),
        }));
        setMonthlyBreakdown(monthlyBreakdownData);
      } catch (err) {
        setDailyChartData({ labels: [], datasets: [] });
        setMonthlyChartData({ labels: [], datasets: [] });
        setTopProducts([]);
        setAllTimeRecord({
          itemsSold: 0,
          sales: 0,
          expenses: 0,
          grossProfit: 0,
          grossProfitMargin: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const chartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: "top" as const },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "#eee" },
        ticks: {
          callback: (value: any) =>
            value.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        },
      },
    },
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      {/* All-Time Record Widget */}
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Sales Report
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          View the Sales Report
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
        <Box sx={{ width: '100%' }}>
          <Box
            sx={{
              bgcolor: "#23224c",
              color: "#fff",
              px: 2,
              py: 1,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              textAlign: "center",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: 1,
              border: "1px solid #23224c",
            }}
          >
            ALL-TIME RECORD
          </Box>
          <Box
            sx={{
              display: "flex",
              border: "1px solid #23224c",
              borderTop: "none",
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
              overflow: "hidden",
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Box
              sx={{
                flex: 1,
                bgcolor: "#f39c12",
                textAlign: "center",
                py: 1,
                borderRight: "1px solid #23224c",
              }}
            >
              <Typography fontWeight={600} fontSize={15} color="#fff">
                Items Sold
              </Typography>
              <Typography fontWeight={700} fontSize={22} color="#fff">
                {allTimeRecord.itemsSold.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                bgcolor: "#229954",
                textAlign: "center",
                py: 1,
                borderRight: "1px solid #23224c",
              }}
            >
              <Typography fontWeight={600} fontSize={15} color="#fff">
                Sales
              </Typography>
              <Typography fontWeight={700} fontSize={22} color="#fff">
                {allTimeRecord.sales.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                bgcolor: "#c0392b",
                textAlign: "center",
                py: 1,
                borderRight: "1px solid #23224c",
              }}
            >
              <Typography fontWeight={600} fontSize={15} color="#fff">
                Expenses
              </Typography>
              <Typography fontWeight={700} fontSize={22} color="#fff">
                {allTimeRecord.expenses.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                bgcolor: "#2980b9",
                textAlign: "center",
                py: 1,
                borderRight: "1px solid #23224c",
              }}
            >
              <Typography fontWeight={600} fontSize={15} color="#fff">
                Gross Profit
              </Typography>
              <Typography fontWeight={700} fontSize={22} color="#fff">
                {allTimeRecord.grossProfit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Box>
            <Box
              sx={{ flex: 1, bgcolor: "#eb984e", textAlign: "center", py: 1 }}
            >
              <Typography fontWeight={600} fontSize={15} color="#fff">
                Gross Profit Margin
              </Typography>
              <Typography fontWeight={700} fontSize={22} color="#fff">
                {allTimeRecord.grossProfitMargin}%
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
      {/* --- Start: Two columns for Daily and Monthly Sales, one column for Top 20 --- */}
      <Stack spacing={3} sx={{ mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#f39c12", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Daily Sales Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell>
                  <TableCell>Items Sold</TableCell>
                  <TableCell>Sales</TableCell>
                  <TableCell>Expenses</TableCell>
                  <TableCell>Profit/Loss</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyBreakdown.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell>{row.day}</TableCell>
                    <TableCell>{row.items}</TableCell>
                    <TableCell>
                      {row.sales.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.expenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.profit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#f39c12", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Monthly Sales Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Items Sold</TableCell>
                  <TableCell>Sales</TableCell>
                  <TableCell>Expenses</TableCell>
                  <TableCell>Profit/Loss</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyBreakdown.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>{row.items}</TableCell>
                    <TableCell>
                      {row.sales.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.expenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.profit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>

        <Paper sx={{ p: 0, overflow: "auto" }}>
          <Box sx={{ bgcolor: "#f39c12", color: "#fff", py: 1, px: 2 }}>
            <Typography fontWeight={700}>
              Top 20 Bestselling Products/Services
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Total Sales</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topProducts.map((row, idx) => (
                <TableRow key={row.name || idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    {Number(row.total || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
      {/* --- End: Two columns for Daily and Monthly Sales, one column for Top 20 --- */}
    </Box>
  );
};

export default SalesReport;
