import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import Papa from "papaparse";
import pinyin from "pinyin";
import { getShopData, updateShopData } from "@/lib/shopApi";

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

interface SearchShopFormProps {
  isDevMode: boolean;
}

// Utility function to get nested value
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Utility function to set nested value
const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
};

// Check if a value is empty (null, undefined, empty string, empty array)
const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

export const SearchShopForm: React.FC<SearchShopFormProps> = ({ isDevMode }) => {
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [formData, setFormData] = useState<any>(null);
  const [shopIdInput, setShopIdInput] = useState("tawe_zz001");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [callerIds, setCallerIds] = useState<string[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");
  const [bookingEnabled, setBookingEnabled] = useState<boolean>(false);

  // Load schema from CSV
  useEffect(() => {
    fetch("/ui-schema.csv")
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: results => {
            setSchema(results.data as SchemaField[]);
          }
        });
      })
      .catch(error => {
        console.error("Error loading schema:", error);
        toast.error("載入表單結構失敗");
      });
  }, []);

  // Extract caller IDs from shop data
  const extractCallerIds = (data: any): string[] => {
    if (!data?.shop_data?.callers) return [];
    return Object.keys(data.shop_data.callers);
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
      if (isDevMode) {
        const response = await fetch("/example_crm_json_list.json");
        const jsonData = await response.json();
        if (!jsonData.shop_id || jsonData.shop_id !== shopIdInput) {
          toast.error("找不到該店家資料");
          setIsLoading(false);
          return;
        }
        data = jsonData;
        toast.success("成功載入資料 (開發模式)");
      } else {
        const response = await getShopData(shopIdInput);
        if (!response.success) {
          setIsLoading(false);
          return;
        }
        data = {
          shop_id: shopIdInput,
          shop_data: response.data
        };
        toast.success("成功載入資料");
      }

      setFormData(data);
      
      // Extract and set caller IDs
      const ids = extractCallerIds(data);
      setCallerIds(ids);
      setSelectedCallerId(ids.length > 0 ? ids[0] : "");
      
      // Check if booking has any data
      const booking = data?.shop_data?.booking;
      const hasBookingData = booking && (booking.phone || booking.url);
      setBookingEnabled(!!hasBookingData);
      
    } catch (error) {
      console.error("Search error:", error);
      toast.error("查詢失敗，請檢查網路連線");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Save
  const handleSave = async () => {
    if (!formData) {
      toast.error("沒有資料可儲存");
      return;
    }
    if (isDevMode) {
      console.log("=== SAVE SHOP DATA (DEV MODE) ===");
      console.log(JSON.stringify(formData, null, 2));
      toast.info("開發模式下不會實際儲存至伺服器");
      return;
    }
    setIsSaving(true);
    try {
      const response = await updateShopData(formData);
      if (response.success) {
        toast.success("儲存成功");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("儲存失敗");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle input change
  const handleChange = (path: string, value: any) => {
    const newData = { ...formData };
    setNestedValue(newData, path, value);
    
    // Auto-populate pinyin when name changes
    if (path === 'shop_data.name' && typeof value === 'string') {
      const pinyinResult = pinyin(value, {
        style: pinyin.STYLE_TONE,
        heteronym: false
      }).map(item => item[0]).join(' ');
      setNestedValue(newData, 'shop_data.pinyin', pinyinResult);
    }
    
    setFormData(newData);
  };

  // Handle caller-specific input change
  const handleCallerChange = (callerId: string, section: 'callers' | 'call_modes' | 'get_num', field: string, value: any) => {
    const newData = { ...formData };
    
    if (section === 'callers') {
      newData.shop_data.callers[callerId] = value;
    } else if (section === 'call_modes') {
      if (!newData.shop_data.call_modes[callerId]) {
        newData.shop_data.call_modes[callerId] = {};
      }
      if (field.includes('.')) {
        setNestedValue(newData.shop_data.call_modes[callerId], field, value);
      } else {
        newData.shop_data.call_modes[callerId][field] = value;
      }
    } else if (section === 'get_num') {
      if (!newData.shop_data.get_num[callerId]) {
        newData.shop_data.get_num[callerId] = {};
      }
      newData.shop_data.get_num[callerId][field] = value;
    }
    
    setFormData(newData);
  };

  // Check if a field key should be hidden
  const shouldHideField = (key: string): boolean => {
    if (key === 'shop_data.get_num._type') return true;
    if (key.endsWith('._external')) return true;
    if (key === 'shop_data.get_num.type') return true; // Use _type
    return false;
  };

  // Render field with sparse display logic
  const renderField = (field: SchemaField, callerId?: string) => {
    const inputType = field["Input Type"];
    const hint = field["key之參數hint說明"];
    
    if (inputType === "N/A") return null;
    if (shouldHideField(field.key)) return null;
    
  // Handle booking toggle (N/A type means it's a container with toggle)
    if (field.key === 'shop_data.booking' && inputType === 'N/A') {
      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-sm">預約設定</Label>
          <div className="flex items-center space-x-2">
            <Switch
              checked={bookingEnabled}
              onCheckedChange={setBookingEnabled}
            />
          </div>
        </div>
      );
    }
    
    // Skip shop_id in base fields (already shown at top)
    if (field.key === 'shop_id') return null;
    
    const fieldKey = callerId 
      ? field.key
          .replace(/shop_data\.call_modes\.[^.]+\./, '')
          .replace(/shop_data\.get_num\.[^.]+\./, '')
          .replace(/shop_data\.callers\.[^.]+/, '')
      : field.key;
    
    let value: any;
    if (callerId) {
      if (field.key.includes('call_modes.')) {
        const cleanKey = field.key.split('.').pop() || '';
        value = formData?.shop_data?.call_modes?.[callerId]?.[cleanKey];
      } else if (field.key.includes('get_num.') && !field.key.includes('._type')) {
        const cleanKey = field.key.split('.').pop() || '';
        value = formData?.shop_data?.get_num?.[callerId]?.[cleanKey];
      } else if (field.key.includes('callers.')) {
        value = formData?.shop_data?.callers?.[callerId];
      }
    } else {
      value = getNestedValue(formData, field.key);
    }
    
    // SPARSE DISPLAY: Skip rendering if value is empty
    if (isEmpty(value) && inputType !== "checkbox" && inputType !== "boolean") {
      return null;
    }
    
    const handleFieldChange = (newValue: any) => {
      if (callerId) {
        const cleanKey = field.key.split('.').pop() || '';
        if (field.key.includes('call_modes.')) {
          handleCallerChange(callerId, 'call_modes', cleanKey, newValue);
        } else if (field.key.includes('get_num.')) {
          handleCallerChange(callerId, 'get_num', cleanKey, newValue);
        } else if (field.key.includes('callers.')) {
          handleCallerChange(callerId, 'callers', '', newValue);
        }
      } else {
        handleChange(field.key, newValue);
      }
    };
    
    const leafKey = field.key.split('.').pop() || field.key;
    
    return (
      <div key={`${field.key}-${callerId || 'base'}`} className="space-y-2">
        <Label title={hint} className="text-sm">
          {leafKey}
          {hint && <span className="text-muted-foreground ml-1 text-xs">({hint})</span>}
        </Label>
        
        {inputType === "checkbox" && (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value === true || value === "TRUE" || value === "true"}
              onCheckedChange={handleFieldChange}
            />
          </div>
        )}
        
        {inputType === "radio" && (
          <RadioGroup value={value || ""} onValueChange={handleFieldChange}>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="random" id={`${field.key}-${callerId}-random`} />
                <Label htmlFor={`${field.key}-${callerId}-random`}>random</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sequential" id={`${field.key}-${callerId}-sequential`} />
                <Label htmlFor={`${field.key}-${callerId}-sequential`}>sequential</Label>
              </div>
            </div>
          </RadioGroup>
        )}
        
        {(inputType === "text" || inputType === "url") && (
          <Input
            type="text"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            placeholder={hint}
          />
        )}
        
        {inputType === "number" && (
          <Input
            type="number"
            value={value ?? ""}
            onChange={(e) => handleFieldChange(parseInt(e.target.value) || 0)}
            placeholder={hint}
          />
        )}
      </div>
    );
  };

  // Get base fields (excluding dynamic caller fields, google_map, and internal)
  const getBaseFields = () => {
    return schema.filter(f => 
      !f.key.includes('call_modes.tawe_zz00') && 
      !f.key.includes('get_num.tawe_zz00') &&
      !f.key.includes('callers.tawe_zz00') &&
      !f.key.includes('google_map') &&
      !f.key.startsWith('shop_data.booking.') &&
      f.key !== 'shop_id' && // Skip shop_id - shown separately at top
      f.key !== 'shop_data' && // Skip container
      f.key !== 'shop_data.booking' && // Skip booking container - rendered separately
      f.key !== 'shop_data.isMultiCaller' && // Skip isMultiCaller - rendered separately
      f.key !== 'shop_data.call_modes' &&
      f.key !== 'shop_data.get_num' &&
      f.key !== 'shop_data.callers' &&
      f.key !== 'shop_data.get_num._type' &&
      f.key !== 'shop_data.get_num.type' &&
      f["Input Type"] !== "N/A"
    );
  };

  // Get booking child fields
  const getBookingFields = () => {
    return schema.filter(f => 
      f.key.startsWith('shop_data.booking.') && 
      f.key !== 'shop_data.booking'
    );
  };

  // Get caller-specific fields for call_modes
  const getCallModeFields = () => {
    return schema.filter(f => 
      f.key.includes('call_modes.tawe_zz00') && 
      !f.key.includes('set_params') &&
      f["Input Type"] !== "N/A"
    );
  };

  // Get caller-specific fields for get_num
  const getGetNumFields = () => {
    return schema.filter(f => 
      f.key.includes('get_num.tawe_zz00') &&
      !f.key.includes('._type') &&
      !f.key.endsWith('._external') &&
      f["Input Type"] !== "N/A"
    );
  };

  // Get caller display name
  const getCallerDisplayName = (callerId: string): string => {
    const value = formData?.shop_data?.callers?.[callerId];
    return value || callerId;
  };

  // Check if isMultiCaller
  const isMultiCaller = callerIds.length > 1;

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="shop_id" className="text-lg font-semibold">
            shop_id:
          </Label>
          <Input
            id="shop_id"
            value={shopIdInput}
            onChange={(e) => setShopIdInput(e.target.value)}
            placeholder="請輸入店家代碼"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
        >
          {isLoading ? "查詢中..." : "Search"}
        </Button>
      </div>

      {/* Form Fields - Only show when data is loaded */}
      {!formData ? (
        <div className="text-center py-12 text-muted-foreground">
          請輸入店家代碼並點擊 Search 按鈕查詢資料
        </div>
      ) : (
        <>
          {/* Basic Shop Info */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">基本店家資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shop ID Display */}
              <div className="space-y-2">
                <Label className="text-sm">shop_id</Label>
                <Input value={formData.shop_id || ""} disabled className="bg-muted" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {getBaseFields().map(field => renderField(field))}
              </div>
              
              {/* Booking Toggle */}
              <div className="space-y-2">
                <Label className="text-sm">預約設定</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={bookingEnabled}
                    onCheckedChange={setBookingEnabled}
                  />
                </div>
              </div>
              
              {/* isMultiCaller - Read-only */}
              <div className="flex items-center space-x-2">
                <Switch checked={isMultiCaller} disabled />
                <Label className="text-sm text-muted-foreground">
                  isMultiCaller (自動計算: {isMultiCaller ? 'TRUE' : 'FALSE'})
                </Label>
              </div>
              
              {/* Booking child fields - conditionally rendered */}
              {bookingEnabled && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
                  <h3 className="text-sm font-semibold text-primary">預約詳細設定</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {getBookingFields().map(field => renderField(field))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Get Num Type Radio */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">取號機型別設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>取號機型別 (_type)</Label>
                <RadioGroup 
                  value={formData?.shop_data?.get_num?._type || "caller"} 
                  onValueChange={(value) => handleChange('shop_data.get_num._type', value)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="caller" id="type-caller" />
                      <Label htmlFor="type-caller">Caller</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="shop" id="type-shop" />
                      <Label htmlFor="type-shop">Shop</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Caller Management */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">叫號機管理</CardTitle>
            </CardHeader>
            <CardContent>
              {callerIds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  此店家無叫號機資料
                </div>
              ) : (
                <Tabs value={selectedCallerId} onValueChange={setSelectedCallerId} className="w-full">
                  <TabsList className="inline-flex h-10 mb-4">
                    {callerIds.map((callerId) => (
                      <TabsTrigger key={callerId} value={callerId}>
                        {getCallerDisplayName(callerId)}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {callerIds.map((callerId) => (
                    <TabsContent key={callerId} value={callerId}>
                      <Card className="border-2 border-primary/20">
                        <CardHeader className="bg-muted/30">
                          <CardTitle className="text-base text-primary">
                            {getCallerDisplayName(callerId)} ({callerId})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                          {/* Caller Name */}
                          <div className="space-y-2">
                            <Label>叫號機名稱</Label>
                            <Input
                              value={formData?.shop_data?.callers?.[callerId] || ""}
                              onChange={(e) => handleCallerChange(callerId, 'callers', '', e.target.value)}
                            />
                          </div>

                          <Separator />

                          {/* Call Modes Section */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-primary">叫號模式設定 (call_modes)</h3>
                            <div className="grid grid-cols-2 gap-4">
                              {getCallModeFields().map(field => renderField(field, callerId))}
                            </div>
                          </div>

                          <Separator />

                          {/* Get Num Section */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-primary">取號設定 (get_num)</h3>
                            <div className="grid grid-cols-2 gap-4">
                              {getGetNumFields().map(field => renderField(field, callerId))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
            >
              {isSaving ? "儲存中..." : "儲存"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
