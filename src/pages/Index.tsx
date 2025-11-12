import { useState, useEffect } from "react";
import axios from "axios";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, Save } from "lucide-react";

// 型別定義
interface SchemaField {
  num: string;
  key: string;
  value: string;
  "Input Type": string;
  class: string;
  describe: string;
  default: string;
  "key之參數hint說明": string;
}

// 輔助函式：根據點記法路徑從物件中取值
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
};

// 輔助函式：根據點記法路徑設定物件的值
const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
};

const Index = () => {
  const [uiSchema, setUiSchema] = useState<SchemaField[]>([]);
  const [shopData, setShopData] = useState<any>(null);
  const [shopIdInput, setShopIdInput] = useState("tawe_zz001");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    "tawe_zz001.booking": true,
    "tawe_zz001.call_modes": true,
    "tawe_zz001.get_num": true,
    "tawe_zz001.google_map": true,
  });

  // 載入 Schema
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch("/ui-schema.csv");
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setUiSchema(results.data as SchemaField[]);
          },
        });
      } catch (error) {
        console.error("載入 Schema 失敗:", error);
        toast.error("載入設定檔失敗");
      }
    };

    fetchSchema();
  }, []);

  // 查詢店家資料
  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        "https://line-bot-306511771181.asia-east1.run.app/get_shop_data",
        { shop_id: shopIdInput }
      );

      if (response.data.result === "OK") {
        setShopData(response.data.shop_data);
        toast.success("資料載入成功");
      } else {
        toast.error(`查詢失敗: ${response.data.result}`);
      }
    } catch (error) {
      console.error("API 錯誤:", error);
      toast.error("查詢失敗，請檢查網路連線");
    } finally {
      setLoading(false);
    }
  };

  // 儲存店家資料
  const handleSave = async () => {
    if (!shopData) {
      toast.error("無資料可儲存");
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(
        "https://line-bot-306511771181.asia-east1.run.app/set_shop_data",
        {
          action: "modify",
          shop_id: shopIdInput,
          shop_data: shopData,
        }
      );

      if (response.data.result === "OK") {
        toast.success("儲存成功");
      } else {
        toast.error(`儲存失敗: ${response.data.result}`);
      }
    } catch (error) {
      console.error("API 錯誤:", error);
      toast.error("儲存失敗，請檢查網路連線");
    } finally {
      setSaving(false);
    }
  };

  // 處理輸入變更
  const handleInputChange = (key: string, value: any) => {
    if (!shopData) return;
    const newData = { ...shopData };
    setNestedValue(newData, key, value);
    setShopData(newData);
  };

  // 處理父開關切換
  const handleToggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 渲染欄位
  const renderField = (field: SchemaField) => {
    // 功能 1: 隱藏欄位
    if (field.describe === "隱藏") {
      return null;
    }

    // 功能 2: 父開關 (N/A 類型)
    if (field["Input Type"] === "N/A") {
      const isParent = field.describe.includes("物件格式中key之名稱");
      if (isParent) {
        return (
          <div key={field.key} className="mt-6 mb-4">
            <div className="flex items-center space-x-2 border-b-2 border-primary pb-2">
              <Checkbox
                id={`toggle-${field.key}`}
                checked={toggles[field.key] !== false}
                onCheckedChange={() => handleToggle(field.key)}
              />
              <Label
                htmlFor={`toggle-${field.key}`}
                className="text-lg font-semibold cursor-pointer"
                title={field["key之參數hint說明"]}
              >
                {field.key.split(".").pop() || field.key}
              </Label>
            </div>
          </div>
        );
      }
      return null;
    }

    // 功能 2: 條件渲染子欄位
    const parentKeys = Object.keys(toggles);
    for (const parentKey of parentKeys) {
      if (field.key.startsWith(`${parentKey}.`) && !toggles[parentKey]) {
        return null;
      }
    }

    // 取得當前值
    const currentValue = shopData ? getNestedValue(shopData, field.key) : field.value;

    // 渲染不同類型的輸入框
    return (
      <div key={field.key} className="mb-4">
        <Label
          htmlFor={field.key}
          className="text-sm font-medium"
          title={field["key之參數hint說明"]} // 功能 3: Hint 提示
        >
          {field.key}
        </Label>
        <div className="mt-1">
          {field["Input Type"] === "checkbox" ? (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.key}
                checked={
                  currentValue === true ||
                  currentValue === "TRUE" ||
                  currentValue === "true"
                }
                onCheckedChange={(checked) => handleInputChange(field.key, checked)}
                disabled={!shopData}
              />
              <Label htmlFor={field.key} className="text-sm text-muted-foreground cursor-pointer">
                {field["key之參數hint說明"] || "啟用"}
              </Label>
            </div>
          ) : field["Input Type"] === "radio" ? (
            <div className="flex space-x-4">
              {field.class?.includes("random") && field.class?.includes("sequential") ? (
                <>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={field.key}
                      value="random"
                      checked={currentValue === "random"}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      disabled={!shopData}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Random</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={field.key}
                      value="sequential"
                      checked={currentValue === "sequential"}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      disabled={!shopData}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Sequential</span>
                  </label>
                </>
              ) : field.class?.includes("shop") && field.class?.includes("caller") ? (
                <>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={field.key}
                      value="shop"
                      checked={currentValue === "shop"}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      disabled={!shopData}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Shop</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={field.key}
                      value="caller"
                      checked={currentValue === "caller"}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      disabled={!shopData}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm">Caller</span>
                  </label>
                </>
              ) : (
                <Input
                  id={field.key}
                  type="text"
                  value={currentValue || ""}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  disabled={!shopData}
                />
              )}
            </div>
          ) : field.class?.includes("文字輸入") &&
            (field.key.includes("notes") || field.key.includes("caller_notes")) ? (
            <Textarea
              id={field.key}
              value={currentValue || ""}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              disabled={!shopData}
              rows={3}
              className="resize-none"
            />
          ) : field["Input Type"] === "number" ? (
            <Input
              id={field.key}
              type="number"
              value={currentValue || ""}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              disabled={!shopData}
            />
          ) : field["Input Type"] === "url" ? (
            <Input
              id={field.key}
              type="url"
              value={currentValue || ""}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              disabled={!shopData}
              placeholder="https://"
            />
          ) : (
            <Input
              id={field.key}
              type="text"
              value={currentValue || ""}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              disabled={!shopData}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">CRM 店家管理系統</CardTitle>
            <CardDescription>元資料驅動的店家資料管理介面</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="輸入店家代碼 (例: tawe_zz001)"
                value={shopIdInput}
                onChange={(e) => setShopIdInput(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading || !shopIdInput}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    載入中...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    查詢
                  </>
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !shopData}
                variant="default"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    儲存中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    儲存
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {shopData && (
          <Card>
            <CardHeader>
              <CardTitle>店家資料編輯</CardTitle>
              <CardDescription>
                點選標籤可查看欄位說明提示，使用開關控制區塊顯示
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-2">
                {uiSchema.map((field) => renderField(field))}
              </form>
            </CardContent>
          </Card>
        )}

        {!shopData && !loading && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg">請輸入店家代碼並點選查詢按鈕載入資料</p>
                <p className="text-sm mt-2">例如: tawe_zz001</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;