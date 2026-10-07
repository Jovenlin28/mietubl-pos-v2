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

const ExpenseReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dailyBreakdown, setDailyBreakdown] = useState<{
    day: number;
    expenses: number;
  }[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyPeak, setDailyPeak] = useState(0);
  const [dailyChartData, setDailyChartData] = useState<any>({
    labels: [],
    datasets: [
      {
        label: "Expenses",
        data: [],
        backgroundColor: "#c0392b",
        borderRadius: 4,
        barPercentage: 0.7,
      },
    ],
  });
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<{
    month: string;
    expenses: number;
  }[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyPeak, setMonthlyPeak] = useState(0);
  const [yearlyBreakdown, setYearlyBreakdown] = useState<{
    year: string;
    expenses: number;
  }[]>([]);
  const [yearlyTotal, setYearlyTotal] = useState(0);
  const [yearlyPeak, setYearlyPeak] = useState(0);
  const [categoriesBreakdown, setCategoriesBreakdown] = useState<
    { category: string; expenses: number; percent: number }[]
  >([]);
  const [categoriesTotal, setCategoriesTotal] = useState(0);
  useEffect(() => {
    // Fetch server-side expense summary (aggregated) instead of downloading all expenses
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.get("/dashboard/expense/summary");

        // daily
        const labels = Array.isArray(data.dailyLabels) ? data.dailyLabels : [];
        const dExpenses = Array.isArray(data.dailyExpenses)
          ? data.dailyExpenses
          : Array(labels.length).fill(0);
        const dailyBreakdownData = labels.map((label: string, idx: number) => ({
          day: Number(label),
          expenses: Number(dExpenses[idx] || 0),
        }));
        setDailyBreakdown(dailyBreakdownData);
        setDailyTotal(
          Number(
            data.dailyTotal || dailyBreakdownData.reduce((a, b) => a + b.expenses, 0)
          )
        );
        setDailyPeak(
          Number(
            data.dailyPeak ||
              (dailyBreakdownData.length
                ? Math.max(...dailyBreakdownData.map((d) => d.expenses))
                : 0)
          )
        );
        setDailyChartData({
          labels,
          datasets: [
            {
              label: "Expenses",
              backgroundColor: "#c0392b",
              data: dExpenses,
              borderRadius: 4,
              barPercentage: 0.7,
            },
          ],
        });

        // monthly
        const mExpenses = Array.isArray(data.monthlyExpenses)
          ? data.monthlyExpenses
          : Array(12).fill(0);
        const monthlyBreakdownData = months.map((m, idx) => ({
          month: m,
          expenses: Number(mExpenses[idx] || 0),
        }));
        setMonthlyBreakdown(monthlyBreakdownData);
        setMonthlyTotal(
          Number(
            data.monthlyTotal || monthlyBreakdownData.reduce((a, b) => a + b.expenses, 0)
          )
        );
        setMonthlyPeak(
          Number(
            data.monthlyPeak ||
              (monthlyBreakdownData.length
                ? Math.max(...monthlyBreakdownData.map((r) => r.expenses))
                : 0)
          )
        );

        // yearly
        const yLabels = Array.isArray(data.yearlyLabels) ? data.yearlyLabels : [];
        const yExpenses = Array.isArray(data.yearlyExpenses)
          ? data.yearlyExpenses
          : Array(yLabels.length).fill(0);
        const yearlyBreakdownData = yLabels.map((y: string, idx: number) => ({
          year: y,
          expenses: Number(yExpenses[idx] || 0),
        }));
        setYearlyBreakdown(yearlyBreakdownData);
        setYearlyTotal(
          Number(
            data.yearlyTotal || yearlyBreakdownData.reduce((a, b) => a + b.expenses, 0)
          )
        );
        setYearlyPeak(
          Number(
            data.yearlyPeak ||
              (yearlyBreakdownData.length
                ? Math.max(...yearlyBreakdownData.map((r) => r.expenses))
                : 0)
          )
        );

        // categories
        const cats = Array.isArray(data.categories) ? data.categories : [];
        setCategoriesBreakdown(
          cats.map((c: any) => ({
            category: c.category,
            expenses: Number(c.expenses || 0),
            percent: Number(c.percent || 0),
          }))
        );
        setCategoriesTotal(
          Number(
            data.categoriesTotal || cats.reduce((a: number, b: any) => a + Number(b.expenses || 0), 0)
          )
        );
      } catch (err) {
        // clear on error
        setDailyBreakdown([]);
        setDailyTotal(0);
        setDailyPeak(0);
        setDailyChartData({
          labels: [],
          datasets: [{ label: "Expenses", data: [], backgroundColor: "#c0392b" }],
        });
        setMonthlyBreakdown([]);
        setMonthlyTotal(0);
        setMonthlyPeak(0);
        setYearlyBreakdown([]);
        setYearlyTotal(0);
        setYearlyPeak(0);
        setCategoriesBreakdown([]);
        setCategoriesTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Expense Report
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          View the Expense Report
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
        <Box sx={{ width: "100%" }}>
          {/* fixed-height container so ChartJS doesn't get stretched by parent */}
          <Paper sx={{ p: 2, minHeight: { xs: 220, md: 260 } }}>
            <Typography
              fontWeight={700}
              fontSize={18}
              sx={{ mb: 2, textAlign: "center" }}
            >
              Daily Expense Trend
            </Typography>
            <Box sx={{ height: { xs: 220, md: 260 } }}>
              {/* keep maintainAspectRatio: false in chartOptions so chart fills this box */}
              <Bar data={dailyChartData} options={chartOptions} />
            </Box>
          </Paper>
        </Box>
      </Box>
      <Stack spacing={3}>
        {/* First row: Daily and Monthly side-by-side */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#a93226", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Daily Expense Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyBreakdown.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell>{row.day}</TableCell>
                    <TableCell align="right">
                      {row.expenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {dailyTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Peak</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {dailyPeak.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#a93226", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Monthly Expense Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyBreakdown.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{row.month}</TableCell>
                    <TableCell align="right">
                      {row.expenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {monthlyTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Peak</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {monthlyPeak.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </Stack>

        {/* Second row: Yearly and Categories side-by-side */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#a93226", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Yearly Expense Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Year</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {yearlyBreakdown.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell>{row.year}</TableCell>
                    <TableCell align="right">
                      {row.expenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {yearlyTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Peak</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {yearlyPeak.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#a93226", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Categories Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Categories</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                  <TableCell align="right">Percent Coverage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categoriesBreakdown.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell align="right">
                      {row.expenses.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell align="right">
                      {row.percent.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {categoriesTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    100.00%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ExpenseReport;
