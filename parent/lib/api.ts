import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// For Android emulator, use 10.0.2.2 to access localhost
// For Android device, use the actual IP address of your development machine
// For iOS simulator, localhost works fine
const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  if (Platform.OS === "android") {
    // Use 10.0.2.2 for Android emulator (maps to host machine's localhost)
    // For physical device, use the machine's local IP address
    // Update this IP if your machine's IP changes
    return "http://192.168.1.105:8000/api/v1";
  }
  
  // iOS simulator or web
  return "http://localhost:8000/api/v1";
};

const API_URL = getApiUrl();

// #region agent log
console.log('[DEBUG] API configuration initialized:', { apiUrl: API_URL, platform: Platform.OS, envUrl: process.env.EXPO_PUBLIC_API_URL || 'not set' });
fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:28',message:'API configuration initialized',data:{apiUrl:API_URL,platform:Platform.OS,envUrl:process.env.EXPO_PUBLIC_API_URL||'not set'},timestamp:Date.now(),sessionId:'debug-session',runId:'api-init',hypothesisId:'D'})}).catch(()=>{});
// #endregion

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("parentToken");
    // #region agent log
    const stackTrace = new Error().stack;
    const callerInfo = stackTrace?.split('\n').slice(1, 6).join(' | ') || 'unknown';
    console.log('[DEBUG] API request:', { url: config.url, method: config.method, baseURL: config.baseURL, hasToken: !!token, caller: callerInfo });
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:40',message:'API request interceptor',data:{url:config.url,method:config.method,baseURL:config.baseURL,hasToken:!!token,caller:callerInfo,stackTrace:stackTrace?.split('\n').slice(1,10).join(' | ')},timestamp:Date.now(),sessionId:'debug-session',runId:'api-request',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses and errors
api.interceptors.response.use(
  (response) => {
    // #region agent log
    console.log('[DEBUG] API response success:', { url: response.config?.url, status: response.status });
    // #endregion
    return response;
  },
  async (error) => {
    // #region agent log
    console.error('[DEBUG] API request error:', { 
      errorMessage: error?.message, 
      errorCode: error?.code, 
      errorResponse: error?.response ? { status: error.response.status, data: error.response.data } : 'no response',
      url: error?.config?.url, 
      baseURL: error?.config?.baseURL 
    });
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:45',message:'API request error in interceptor',data:{errorMessage:error?.message,errorCode:error?.code,errorResponse:error?.response?JSON.stringify({status:error.response.status,data:error.response.data}):'no response',url:error?.config?.url,baseURL:error?.config?.baseURL,fullError:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'api-error',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("parentToken");
      await AsyncStorage.removeItem("parentData");
    }
    return Promise.reject(error);
  }
);

export default api;







