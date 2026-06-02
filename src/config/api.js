// Single source of truth for API URL
// In development: reads from .env → http://localhost:5000
// In production: reads from Vercel env variables → your Render URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default API_URL;