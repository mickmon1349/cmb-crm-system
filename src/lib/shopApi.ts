import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShopApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
  detail?: string;
}

// Error code to message mapping
const ERROR_MESSAGES: { [code: string]: string } = {
  "001": "格式錯誤",
  "002": "找不到店家",
  "003": "不支援此動作",
  "006": "資料重複",
  "009": "系統錯誤"
};

// Error code 006 requires alert dialog
const ERROR_ALERTS: { [code: string]: (detail?: string) => void } = {
  "006": (detail) => {
    alert(`資料重複 (Data Duplicate): ${detail || "Unknown item"}`);
  }
};

/**
 * Get shop data by shop_id
 */
export const getShopData = async (shopId: string): Promise<ShopApiResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('shop-api', {
      body: { type: 'get', shop_id: shopId }
    });

    if (error) {
      console.error('[shopApi] Edge function error:', error);
      toast.error("API 連線失敗");
      return { success: false, error: error.message };
    }

    if (!data.success) {
      handleApiError(data);
      return data;
    }

    return data;
  } catch (err: any) {
    console.error('[shopApi] Exception:', err);
    toast.error("系統錯誤");
    return { success: false, error: err.message };
  }
};

/**
 * Add new shop data
 */
export const addShopData = async (shopData: any): Promise<ShopApiResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('shop-api', {
      body: { type: 'set', action: 'add', shop_data: shopData }
    });

    if (error) {
      console.error('[shopApi] Edge function error:', error);
      toast.error("API 連線失敗");
      return { success: false, error: error.message };
    }

    if (!data.success) {
      handleApiError(data);
      return data;
    }

    return data;
  } catch (err: any) {
    console.error('[shopApi] Exception:', err);
    toast.error("系統錯誤");
    return { success: false, error: err.message };
  }
};

/**
 * Update existing shop data
 */
export const updateShopData = async (shopData: any): Promise<ShopApiResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('shop-api', {
      body: { type: 'set', action: 'update', shop_data: shopData }
    });

    if (error) {
      console.error('[shopApi] Edge function error:', error);
      toast.error("API 連線失敗");
      return { success: false, error: error.message };
    }

    if (!data.success) {
      handleApiError(data);
      return data;
    }

    return data;
  } catch (err: any) {
    console.error('[shopApi] Exception:', err);
    toast.error("系統錯誤");
    return { success: false, error: err.message };
  }
};

/**
 * Handle API error responses
 */
const handleApiError = (response: ShopApiResponse) => {
  const { errorCode, error, detail } = response;

  // Use mapped error messages
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] || error || "系統錯誤") : (error || "系統錯誤");

  // Special handling for error code 006 (alert dialog)
  if (errorCode && ERROR_ALERTS[errorCode]) {
    ERROR_ALERTS[errorCode](detail);
  } else {
    toast.error(errorMessage);
  }
};
