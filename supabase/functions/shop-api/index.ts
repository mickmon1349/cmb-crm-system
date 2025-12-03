import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BACKEND_URL = "https://line-bot-306511771181.asia-east1.run.app";

// Error code mapping
const ERROR_MESSAGES: { [code: string]: string } = {
  "001": "格式錯誤",
  "002": "找不到店家",
  "003": "不支援此動作",
  "006": "資料重複",
  "009": "系統錯誤"
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, shop_id, action, shop_data } = body;

    console.log(`[shop-api] Request type: ${type}, action: ${action}, shop_id: ${shop_id}`);

    let backendUrl: string;
    let backendBody: any;

    if (type === "get") {
      // Fetch shop data
      backendUrl = `${BACKEND_URL}/get_shop_data`;
      backendBody = { shop_id };
    } else if (type === "set") {
      // Add or update shop data
      backendUrl = `${BACKEND_URL}/set_shop_data`;
      backendBody = { 
        action: action || "add",
        shop_data 
      };
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request type" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[shop-api] Calling backend: ${backendUrl}`);
    console.log(`[shop-api] Body: ${JSON.stringify(backendBody)}`);

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendBody),
    });

    const responseText = await backendResponse.text();
    console.log(`[shop-api] Backend response: ${responseText}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { result: responseText };
    }

    // Parse response
    const result = responseData.result || responseText;

    if (result === "OK") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: responseData.shop_data || responseData 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle error responses
    if (typeof result === 'string' && result.startsWith("Fail")) {
      // Parse error code and message from "Fail:XXX:message" format
      const parts = result.split(':');
      const errorCode = parts[1] || "009";
      const errorDetail = parts.slice(2).join(':') || result;
      
      const errorMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES["009"];
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          errorCode,
          error: errorMessage,
          detail: errorDetail
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return raw response if not recognized
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Unknown response format",
        raw: responseData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[shop-api] Error:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
