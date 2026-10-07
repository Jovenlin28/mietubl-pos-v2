import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
  // You can add headers or interceptors here if needed
});

export default axiosInstance;