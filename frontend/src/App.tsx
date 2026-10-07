import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Brands from "./pages/Brands";
import Categories from "./pages/Categories";
import Warehouses from "./pages/Warehouses";
import StockInLogs from "./pages/StockInLogs";
import SalesListing from "./pages/SalesListing";
import ExpenseListing from "./pages/ExpenseListing";
import CreateProduct from "./pages/CreateProduct";
import ExpiredProducts from "./pages/ExpiredProducts";
import LowStocks from "./pages/LowStocks";
import SalesReport from "./pages/SalesReport";
import ExpenseReport from "./pages/ExpenseReport";
import AgentsReport from "./pages/AgentsReport";
import AddSales from "./pages/AddSales";
import Customers from "./pages/Customers";
import Discount from "./pages/Discount";
import ProductDetail from "./pages/ProductDetail";
import DashboardLayout from "./layouts/DashboardLayout";
import Stores from "./pages/Stores";
import Users from "./pages/Users";
import Agents from "./pages/Agents";
import RolesAndPermissions from "./pages/RolesAndPermissions";
import Permissions from "./pages/Permissions";
import PaymentsMonitoring from "./pages/PaymentsMonitoring";
import DeliveriesMonitoring from "./pages/DeliveriesMonitoring";
import Quotations from "./pages/Quotations";
import AddQuotation from "./pages/AddQuotation";
import Expenses from "./pages/ExpenseListing";
import ExpenseCategories from "./pages/ExpenseCategories";
import Profile from "./pages/Profile";
import SystemLogs from "./pages/SystemLogs";
import Accounts from "./pages/FinancialStatementOfAccounts";
import StatementOfAccounts from "./pages/StatementOfAccounts";
import CreditCardTransactions from "./pages/CreditCardTransactions";
import RoyaltyFees from "./pages/RoyaltyFees";
import FinancialRoyaltyFeesAccounts from "./pages/FinancialRoyaltyFeesAccounts";
import CreditCardTransactionsAccounts from "./pages/CreditCardTransactionsAccounts";
import FinancialStatementOfAccounts from "./pages/FinancialStatementOfAccounts";
import CreditCardTransactionsReport from "./pages/CreditCardTransactionsReport";
import ExpenseBudgetManagement from "./pages/ExpenseBudgetManagement";
import PublicPurchaseOrder from "./pages/PublicPurchaseOrder";
import CustomerPurchaseOrders from "./pages/CustomerPurchaseOrders";
import PurchaseOrderTracker from "./pages/PurchaseOrderTracker";

// Route guard component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  let isValid = false;
  if (token) {
    try {
      const decoded: any = jwtDecode(token);
      // Check for expiration if exp exists
      if (!decoded.exp || decoded.exp * 1000 > Date.now()) {
        isValid = true;
      }
    } catch {
      isValid = false;
    }
  }

  if (!isValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />
        <Route path="/purchase-order" element={<PublicPurchaseOrder />} />
        <Route path="/purchase-order-tracker" element={<PurchaseOrderTracker />} />

        {/* Protected routes with DashboardLayout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="brands" element={<Brands />} />
          <Route path="categories" element={<Categories />} />
          <Route path="warehouses" element={<Warehouses />} />
          <Route path="stock-in-logs" element={<StockInLogs />} />
          <Route path="sales" element={<SalesListing />} />
          <Route path="customer-purchase-orders" element={<CustomerPurchaseOrders />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="products/create" element={<CreateProduct />} />
          <Route path="expired-products" element={<ExpiredProducts />} />
          <Route path="products/:id/edit" element={<CreateProduct />} />
          <Route path="low-stocks" element={<LowStocks />} />
          <Route path="sales-report" element={<SalesReport />} />
          <Route path="expense-report" element={<ExpenseReport />} />
          <Route path="agents-report" element={<AgentsReport />} />
          <Route path="add-sales" element={<AddSales />} />
          <Route path="sales/:id/edit" element={<AddSales />} />
          <Route path="customers" element={<Customers />} />
          <Route path="discounts" element={<Discount />} />
          <Route path="stores" element={<Stores />} />
          <Route path="users" element={<Users />} />
          <Route path="agents" element={<Agents />} />
          <Route path="roles" element={<RolesAndPermissions />} />
          <Route path="roles/:id/permissions" element={<Permissions />} />
          <Route path="/payments-monitoring" element={<PaymentsMonitoring />} />
          <Route
            path="/deliveries-monitoring"
            element={<DeliveriesMonitoring />}
          />
          <Route path="/quotations" element={<Quotations />} />
          <Route path="/add-quotation" element={<AddQuotation />} />{" "}
          {/* <-- Added AddQuotation route */}
          <Route path="/quotations/:id/edit" element={<AddQuotation />} />
          <Route path="/expense-categories" element={<ExpenseCategories />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/system-logs" element={<SystemLogs />} />
          <Route path="/financial-statement-of-accounts" element={<FinancialStatementOfAccounts />} />
          <Route
            path="/statement-of-accounts"
            element={<StatementOfAccounts />}
          />
          <Route
            path="/financial-royalty-fees-accounts"
            element={<FinancialRoyaltyFeesAccounts />}
          />
          <Route
            path="/credit-card-transactions"
            element={<CreditCardTransactions />}
          />
          <Route path="/royalty-fees" element={<RoyaltyFees />} />
          <Route
            path="/credit-card-transactions-accounts"
            element={<CreditCardTransactionsAccounts />}
          />
          <Route
            path="/credit-card-transactions-report"
            element={<CreditCardTransactionsReport />}
          />
           <Route
            path="/expense-budget-management"
            element={<ExpenseBudgetManagement />}
          />
        </Route>

        {/* Catch-all: redirect to dashboard if authenticated, else to login */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
