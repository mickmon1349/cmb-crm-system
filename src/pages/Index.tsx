import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Papa from "papaparse";
import axios from "axios";
import pinyin from "pinyin";
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

// Utility function to get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Utility function to set nested value in object using dot notation
const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
};

// Get nesting level from dot notation
const getNestingLevel = (key: string): number => {
  return key.split('.').length;
};
const Index = () => {
  const [uiSchema, setUiSchema] = useState<SchemaField[]>([]);
  const [shopData, setShopData] = useState<any>(null);
  const [shopIdInput, setShopIdInput] = useState("taiwan_zz001");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [useMockData, setUseMockData] = useState(true);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  // Load UI Schema from CSV
  useEffect(() => {
    fetch("/ui-schema.csv").then(response => response.text()).then(csvText => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: results => {
          setUiSchema(results.data as SchemaField[]);
        }
      });
    }).catch(error => {
      console.error("Error loading UI schema:", error);
      toast.error("載入UI結構定義失敗");
    });
  }, []);

  // Load data from schema (using "value" column as the actual data)
  const loadSchemaData = (): any => {
    const schemaData: any = {};
    uiSchema.forEach(field => {
      // Use "value" column if available, otherwise use "default" column
      const dataValue = field.value || field.default;
      if (dataValue && field.key && field["Input Type"] !== "N/A") {
        let value: any = dataValue;
        if (field["Input Type"] === "checkbox") {
          value = String(dataValue).toUpperCase() === "TRUE";
        } else if (field["Input Type"] === "number") {
          value = parseInt(dataValue) || 0;
        }
        // Replace first level with dynamic shop_id
        const dynamicKey = field.key.replace(/^[^.]+/, shopIdInput);
        setNestedValue(schemaData, dynamicKey, value);
      }
    });
    return schemaData;
  };

  // Get caller keys from shopData
  const getCallerKeys = (): string[] => {
    if (!shopData || !shopIdInput) return [];
    const callersPath = `${shopIdInput}.callers`;
    const callers = getNestedValue(shopData, callersPath);
    if (!callers || typeof callers !== 'object') return [];
    return Object.keys(callers);
  };

  // Get additional caller keys (excluding the main shop_id)
  const getAdditionalCallerKeys = (): string[] => {
    const callerKeys = getCallerKeys();
    return callerKeys.filter(key => key !== shopIdInput);
  };

  // Check if isMultiCaller is true (dynamically calculated based on callers count)
  const isMultiCaller = (): boolean => {
    if (!shopData || !shopIdInput) return false;
    const callerKeys = getCallerKeys();
    return callerKeys.length >= 2;
  };

  // Get get_num keys from shopData
  const getGetNumKeys = (): string[] => {
    if (!shopData || !shopIdInput) return [];
    const getNumPath = `${shopIdInput}.get_num`;
    const getNumData = getNestedValue(shopData, getNumPath);
    if (!getNumData || typeof getNumData !== 'object') return [];
    // Filter out _type and only return actual caller/shop keys
    return Object.keys(getNumData).filter(key => key !== '_type');
  };

  // Get additional get_num keys (excluding the main shop_id)
  const getAdditionalGetNumKeys = (): string[] => {
    const getNumKeys = getGetNumKeys();
    return getNumKeys.filter(key => key !== shopIdInput);
  };

  // Handle Search
  const handleSearch = async () => {
    if (!shopIdInput.trim()) {
      toast.error("請輸入店家代碼");
      return;
    }
    setIsLoading(true);
    try {
      let data;
      if (useMockData) {
        // Use mock data from JSON file
        const response = await fetch("/example_crm_json_list.json");
        const jsonData = await response.json();
        data = jsonData[shopIdInput];
        if (!data) {
          toast.error("找不到該店家資料");
          setIsLoading(false);
          return;
        }
        toast.success("成功載入資料 (開發模式)");
      } else {
        // Call actual API
        const response = await axios.post("https://line-bot-306511771181.asia-east1.run.app/get_shop_data", {
          shop_id: shopIdInput
        });
        if (response.data.result !== "OK") {
          toast.error(`查詢失敗: ${response.data.result}`);
          setIsLoading(false);
          return;
        }
        data = response.data.shop_data;
        toast.success("成功載入資料");
      }

      // Merge with schema values (from "value" column in CSV)
      const schemaData = loadSchemaData();
      const mergedData = {
        ...schemaData,
        ...data
      };
      setShopData(mergedData);
      
      // Initialize toggles for booking
      setToggles({
        [`${shopIdInput}.booking`]: false
      });
    } catch (error) {
      console.error("Search error:", error);
      toast.error("查詢失敗，請檢查網路連線");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Save
  const handleSave = async () => {
    if (!shopData) {
      toast.error("沒有資料可儲存");
      return;
    }
    if (useMockData) {
      toast.info("開發模式下不會實際儲存至伺服器");
      console.log("Save data:", shopData);
      return;
    }
    setIsSaving(true);
    try {
      // Implement save API call here
      toast.success("儲存成功");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle input change
  const handleInputChange = (key: string, value: any) => {
    if (!shopData) return;
    const newData = {
      ...shopData
    };
    setNestedValue(newData, key, value);
    
    // Auto-populate pinyin when name changes
    if (key === `${shopIdInput}.name` && typeof value === 'string') {
      const pinyinResult = pinyin(value, {
        style: pinyin.STYLE_TONE,
        heteronym: false
      }).map(item => item[0]).join(' ');
      setNestedValue(newData, `${shopIdInput}.pinyin`, pinyinResult);
    }
    
    setShopData(newData);
  };

  // Handle toggle change
  const handleToggle = (key: string) => {
    setToggles(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Group fields by their category for better organization
  const getFieldGroup = (field: SchemaField): 'reordered' | 'anchor' | 'other' => {
    const key = field.key.replace(/^[^.]+/, shopIdInput);
    
    // Define reordered block (will be grouped together and sorted by num)
    const reorderedKeys = [
      `${shopIdInput}.active`,
      `${shopIdInput}.address`,
      `${shopIdInput}.booking`,
      `${shopIdInput}.name`,
      `${shopIdInput}.phone`,
      `${shopIdInput}.pinyin`,
      `${shopIdInput}.vendor_id`,
      `${shopIdInput}.zone`
    ];
    
    // Define anchor fields (keep in original position)
    const anchorKeys = [
      `${shopIdInput}.id`,
      `${shopIdInput}.call_modes`,
      `${shopIdInput}.callers`,
      `${shopIdInput}.get_num`
    ];
    
    if (reorderedKeys.some(k => key === k || key.startsWith(k + '.'))) return 'reordered';
    if (anchorKeys.some(k => key === k || key.startsWith(k + '.'))) return 'anchor';
    return 'other';
  };

  // Render field based on schema
  const renderField = (field: SchemaField, overrideKey?: string, isInReorderedBlock = false) => {
    // Skip if describe is "隱藏" or class is "隱藏" or default is "隱藏"
    if (field.describe === "隱藏" || field.class === "隱藏" || field.default === "隱藏") {
      return null;
    }
    
    // Skip isMultiCaller at 1-5-3 position (we'll render it in reordered block instead)
    if (field.num === "1-5-3" && field.key.includes("isMultiCaller")) {
      return null;
    }
    
    // Use overrideKey if provided (for additional callers), otherwise replace first level with shop_id
    const key = overrideKey || field.key.replace(/^[^.]+/, shopIdInput);
    const inputType = field["Input Type"];
    const hint = field["key之參數hint說明"];
    const nestingLevel = getNestingLevel(key);

    // Calculate font size based on nesting level and reordered block
    const getFontSize = () => {
      if (isInReorderedBlock) return "text-sm"; // 14px equivalent
      if (nestingLevel === 1) return "text-2xl";
      if (nestingLevel === 2) return "text-xl";
      if (nestingLevel === 3) return "text-lg";
      return "text-base";
    };

    // Check if this is a conditional field under booking
    const bookingToggleKey = `${shopIdInput}.booking`;
    if (key.startsWith(`${shopIdInput}.booking.`) && !toggles[bookingToggleKey]) {
      return null;
    }

    // Handle N/A (parent objects) - Special rendering for call_modes and get_num
    if (inputType === "N/A") {
      const label = key.split('.').pop() || key;

      // Special handling for call_modes
      if (key.endsWith(".call_modes")) {
        return <div key={key} className="col-span-2 mt-6 mb-2">
            <hr className="border-border mb-4" />
            <h2 className="text-2xl font-bold text-foreground">[ call_modes 表單資料 ]    </h2>
          </div>;
      }

      // Special handling for get_num
      if (key.endsWith(".get_num")) {
        return <div key={key} className="col-span-2 mt-6 mb-2">
            <hr className="border-border mb-4" />
            <h2 className="text-2xl font-bold text-foreground">[ get_num 表單資料 ]  </h2>
          </div>;
      }

      // Special handling for booking toggle
      if (key === `${shopIdInput}.booking`) {
        return <div key={key} className="col-span-2 flex items-center gap-3 my-2">
            <Label htmlFor="booking-toggle" className={`${getFontSize()} font-semibold`} title={hint || ""}>
              {label}
            </Label>
            <Checkbox id="booking-toggle" checked={toggles[key]} onCheckedChange={() => handleToggle(key)} />
          </div>;
      }
      
      // Special handling for isMultiCaller (display only, computed dynamically)
      if (key === `${shopIdInput}.isMultiCaller`) {
        const isMulti = isMultiCaller();
        return <div key={key} className="flex items-center gap-2 col-span-2">
            <Checkbox id={key} checked={isMulti} disabled />
            <Label htmlFor={key} className="cursor-not-allowed opacity-70" title={hint || ""}>
              {label} (自動計算)
            </Label>
          </div>;
      }

      // Special handling for callers with dynamic list and add button
      if (key === `${shopIdInput}.callers`) {
        const callerKeys = getCallerKeys();
        return <div key={key} className="col-span-2 my-4">
            <hr className="border-border mb-4" />
            <div className="flex items-center justify-between mb-2">
              <Label className={`${getFontSize()} font-semibold`} title={hint || ""}>
                {label}
              </Label>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">add caller</Button>
            </div>
            {callerKeys.length > 0 && (
              <div className="ml-4 space-y-1">
                {callerKeys.map(callerKey => (
                  <div key={callerKey} className="text-base text-foreground">
                    {callerKey}
                  </div>
                ))}
              </div>
            )}
          </div>;
      }
      return <div key={key} className="col-span-2 mt-4">
          <Label className={`${getFontSize()} font-semibold`} title={hint || ""}>
            {label}
          </Label>
        </div>;
    }
    const value = shopData ? getNestedValue(shopData, key) : field.default;
    const label = key.split('.').pop() || key;

    // Render based on input type
    if (inputType === "checkbox") {
      return <div key={key} className="flex items-center gap-2 col-span-2">
          <Checkbox id={key} checked={value === true || value === "true"} onCheckedChange={checked => handleInputChange(key, checked)} />
          <Label htmlFor={key} className="cursor-pointer" title={hint || ""}>
            {label}
          </Label>
        </div>;
    }
    if (inputType === "radio") {
      // Special handling for mode field (dynamic for all callers)
      if (key.includes(".call_modes.") && key.endsWith(".mode")) {
        const defaultValue = field.default || "sequential";
        return <div key={key} className="col-span-2 space-y-2">
            <Label title={hint || ""}>mode</Label>
            <RadioGroup value={value || defaultValue} onValueChange={val => handleInputChange(key, val)} className="flex flex-row gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="random" id={`${key}-random`} />
                <Label htmlFor={`${key}-random`} className="cursor-pointer">random</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sequential" id={`${key}-sequential`} />
                <Label htmlFor={`${key}-sequential`} className="cursor-pointer">sequential</Label>
              </div>
            </RadioGroup>
          </div>;
      }

      // Special handling for _type field
      if (key === `${shopIdInput}.get_num._type`) {
        const defaultValue = field.default || "caller";
        return <div key={key} className="col-span-2 space-y-2">
            <Label title={hint || ""}>_type</Label>
            <RadioGroup value={value || defaultValue} onValueChange={val => handleInputChange(key, val)} className="flex flex-row gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="shop" id={`${key}-shop`} />
                <Label htmlFor={`${key}-shop`} className="cursor-pointer">shop</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="caller" id={`${key}-caller`} />
                <Label htmlFor={`${key}-caller`} className="cursor-pointer">caller</Label>
              </div>
            </RadioGroup>
          </div>;
      }
    }
    if (inputType === "textarea") {
      return <div key={key} className="col-span-2 space-y-2">
          <Label htmlFor={key} title={hint || ""}>
            {label}
          </Label>
          <textarea id={key} value={value || ""} onChange={e => handleInputChange(key, e.target.value)} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>;
    }
    if (inputType === "number") {
      return <div key={key} className="space-y-2">
          <Label htmlFor={key} title={hint || ""}>
            {label === "game_start_time" ? "game_start_time (yyyy-mm-ddTHH:mm:ss)" : label}
          </Label>
          <Input id={key} type="number" value={value || ""} onChange={e => handleInputChange(key, parseInt(e.target.value) || 0)} />
        </div>;
    }
    if (inputType === "url") {
      return <div key={key} className="col-span-2 space-y-2">
          <Label htmlFor={key} title={hint || ""}>
            {label}
          </Label>
          <Input id={key} type="url" value={value || ""} onChange={e => handleInputChange(key, e.target.value)} />
        </div>;
    }

    // Default text input
    return <div key={key} className="space-y-2">
        <Label htmlFor={key} title={hint || ""}>
          {label === "game_start_time" ? "game_start_time (yyyy-mm-ddTHH:mm:ss)" : label}
        </Label>
        <Input id={key} type="text" value={value || ""} onChange={e => handleInputChange(key, e.target.value)} />
      </div>;
  };
  return <div className="min-h-screen bg-primary py-8 px-4">
      <Card className="max-w-4xl mx-auto bg-white shadow-xl">
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle className="text-3xl text-center font-bold">叫叫找顧客管理系統</CardTitle>
          <CardDescription className="text-primary-foreground/90 text-center">
            顧客資訊輸入
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {/* Development Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <Label htmlFor="dev-mode" className="cursor-pointer">
              開發模式 (Development Mode)
            </Label>
            <Switch id="dev-mode" checked={useMockData} onCheckedChange={setUseMockData} />
          </div>

          {/* Search Section */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="shop_id" className="text-lg font-semibold">
                shop_id:
              </Label>
              <Input id="shop_id" value={shopIdInput} onChange={e => setShopIdInput(e.target.value)} placeholder="請輸入店家代碼" onKeyDown={e => e.key === "Enter" && handleSearch()} />
            </div>
            <Button onClick={handleSearch} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
              {isLoading ? "查詢中..." : "Search"}
            </Button>
          </div>

          {/* Form Fields */}
          {!shopData ? <div className="text-center py-12 text-muted-foreground">
              請輸入店家代碼並點擊 Search 按鈕查詢資料
            </div> : <>
              <div className="grid grid-cols-2 gap-4">
                {/* Reordered Block - Basic Shop Info */}
                <div className="col-span-2 space-y-3 p-4 bg-muted/30 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">基本店家資訊</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {uiSchema
                      .filter(field => getFieldGroup(field) === 'reordered')
                      .sort((a, b) => {
                        const numA = a.num.split('-').map(n => parseInt(n));
                        const numB = b.num.split('-').map(n => parseInt(n));
                        for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
                          if ((numA[i] || 0) !== (numB[i] || 0)) {
                            return (numA[i] || 0) - (numB[i] || 0);
                          }
                        }
                        return 0;
                      })
                      .map(field => renderField(field, undefined, true))
                    }
                    {/* Render isMultiCaller in reordered block (dynamically computed) */}
                    {uiSchema.find(f => f.num === "1-9" && f.key.includes("isMultiCaller")) && (
                      <div className="flex items-center gap-2 col-span-2">
                        <Checkbox id={`${shopIdInput}.isMultiCaller`} checked={isMultiCaller()} disabled />
                        <Label htmlFor={`${shopIdInput}.isMultiCaller`} className="cursor-not-allowed opacity-70 text-sm" 
                               title={uiSchema.find(f => f.num === "1-9")?.["key之參數hint說明"] || ""}>
                          isMultiCaller (自動計算)
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Anchor Fields - Render in original order */}
                {uiSchema.filter(field => getFieldGroup(field) === 'anchor').map(field => {
                  const renderedField = renderField(field);
                  
                  // After rendering get_num header, render fields in specific order: _type, first caller key, then others
                  if (field.key.endsWith('.get_num') && field["Input Type"] === "N/A") {
                    const getNumKeys = getGetNumKeys();
                    const firstCallerKey = getNumKeys[0];
                    
                    // Find _type field
                    const typeField = uiSchema.find(f => f.key.replace(/^[^.]+/, shopIdInput) === `${shopIdInput}.get_num._type`);
                    
                    // Find first caller key N/A field (e.g., tawe_zz001.get_num.tawe_zz001)
                    const firstCallerHeaderField = uiSchema.find(f => 
                      f.key.replace(/^[^.]+/, shopIdInput) === `${shopIdInput}.get_num.${firstCallerKey}` && 
                      f["Input Type"] === "N/A"
                    );
                    
                    return (
                      <React.Fragment key={field.key}>
                        {renderedField}
                        {/* Render _type field first */}
                        {typeField && renderField(typeField)}
                        {/* Render first caller key header */}
                        {firstCallerKey && firstCallerHeaderField && (
                          <div className="col-span-2 mt-4 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">{firstCallerKey}</h3>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }
                  
                  // Skip rendering _type separately since it's rendered above
                  if (field.key.replace(/^[^.]+/, shopIdInput) === `${shopIdInput}.get_num._type`) {
                    return null;
                  }
                  
                  // Skip rendering first caller header separately
                  const getNumKeys = getGetNumKeys();
                  const firstCallerKey = getNumKeys[0];
                  if (field.key.replace(/^[^.]+/, shopIdInput) === `${shopIdInput}.get_num.${firstCallerKey}` && 
                      field["Input Type"] === "N/A") {
                    return null;
                  }
                  
                  return renderedField;
                })}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                  {isSaving ? "儲存中..." : "儲存"}
                </Button>
              </div>
            </>}
        </CardContent>
      </Card>
    </div>;
};
export default Index;