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
import { Plus, Trash2 } from "lucide-react";
import { addShopData } from "@/lib/shopApi";

interface SchemaField {
  num: string;
  key: string;
  value: string;
  "Input Type": string;
  class: string;
  describe: string;
  default: string;
  hint: string;
}

interface CreateShopFormProps {
  isDevMode: boolean;
  onCancel: () => void;
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

// Generate UUID v4
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Check if a value is a UUID
const isUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// Create initial form data
const createInitialFormData = () => ({
  shop_id: "",
  shop_data: {
    active: true,
    isMultiCaller: false,
    name: "",
    address: "",
    phone: "",
    pinyin: "",
    vendor_id: "",
    zone: "",
    id: "",
    booking: {
      phone: "",
      phone_hint: "",
      url: "",
      url_label: ""
    },
    callers: {},
    call_modes: {},
    get_num: {
      _type: "caller"
    },
    google_map: {
      address: "",
      comment_num: 0,
      coordinate: {
        x: 0,
        y: 0
      },
      name: "",
      star_num: 0
    }
  }
});

export const CreateShopForm: React.FC<CreateShopFormProps> = ({ isDevMode, onCancel }) => {
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [formData, setFormData] = useState<any>(createInitialFormData());
  const [callerIds, setCallerIds] = useState<string[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");
  const [bookingEnabled, setBookingEnabled] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize with one default caller
  useEffect(() => {
    if (schema.length > 0 && callerIds.length === 0) {
      handleAddCaller();
    }
  }, [schema]);

  // Load schema
  useEffect(() => {
    fetch("/ui-schema-create.csv")
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

  // Add new caller
  const handleAddCaller = () => {
    const newCallerId = generateUUID();
    const newData = { ...formData };
    
    // Initialize caller name
    newData.shop_data.callers[newCallerId] = "";
    
    // Initialize call_modes with defaults
    newData.shop_data.call_modes[newCallerId] = {
      mode: 'sequential',
      early_call: 0,
      caller_notes: '',
      estimate_time: false,
      expire_num: true,
      num_interval: 1,
      password: '',
      set_params: {
        get_num_max: 0
      },
      time_period_items: []
    };
    
    // Initialize get_num with defaults
    newData.shop_data.get_num[newCallerId] = {
      _external: false,
      auto_get_num: false,
      get_num_item_names: [],
      get_num_item_type: '',
      get_num_limit: true,
      get_num_notes: '',
      pre_order_food: '',
      reserve_time_limit: 10,
      support_reserve_num: false,
      get_num_max: 0,
      hide_cancel_btn: false,
      one_time_limit: false,
      hide_get_num_btn: false,
      game_start_time: '',
      guests_per_game: 1,
      time_per_game: 3,
      url: '',
      get_num_btn_name: '線上取號'
    };
    
    // Update isMultiCaller and select the new caller
    const newCallerIds = [...callerIds, newCallerId];
    newData.shop_data.isMultiCaller = newCallerIds.length > 1;
    
    setFormData(newData);
    setCallerIds(newCallerIds);
    setSelectedCallerId(newCallerId);
    toast.success("已新增叫號機");
  };

  // Delete caller
  const handleDeleteCaller = (callerId: string) => {
    const newData = { ...formData };
    
    delete newData.shop_data.callers[callerId];
    delete newData.shop_data.call_modes[callerId];
    delete newData.shop_data.get_num[callerId];
    
    const newCallerIds = callerIds.filter(id => id !== callerId);
    newData.shop_data.isMultiCaller = newCallerIds.length > 1;
    
    // Update selected caller if the deleted one was selected
    if (selectedCallerId === callerId) {
      setSelectedCallerId(newCallerIds.length > 0 ? newCallerIds[0] : "");
    }
    
    setFormData(newData);
    setCallerIds(newCallerIds);
    toast.success("已刪除叫號機");
  };

  // Reset form to initial state
  const resetForm = () => {
    setFormData(createInitialFormData());
    setCallerIds([]);
    setSelectedCallerId("");
    setBookingEnabled(false);
    // Will trigger useEffect to add one default caller
  };

  // Transform data before submission
  const transformDataForBackend = (data: any) => {
    const transformed = JSON.parse(JSON.stringify(data)); // Deep clone
    
    // 1. Transform booking structure based on UI toggle state
    transformed.shop_data.booking = {
      phone: bookingEnabled ? (data.shop_data.booking?.phone || "") : "",
      phone_hint: bookingEnabled ? (data.shop_data.booking?.phone_hint || "") : "",
      url: bookingEnabled ? (data.shop_data.booking?.url || "") : "",
      url_label: bookingEnabled ? (data.shop_data.booking?.url_label || "") : ""
    };
    
    // 2. Transform UUID-keyed objects to Business ID-keyed objects
    const uuidToBusinessId: { [uuid: string]: string } = {};
    const businessIdToName: { [businessId: string]: string } = {};
    
    // Extract mapping from callers (UUID -> Business ID input)
    Object.entries(data.shop_data.callers as { [uuid: string]: string }).forEach(([uuid, userInput]) => {
      // User input can be "businessId" or "businessId | DisplayName"
      const parts = (userInput || "").split('|').map(p => p.trim());
      const businessId = parts[0] || uuid; // Fall back to UUID if no business ID
      const displayName = parts[1] || parts[0] || ""; // Second part is name, or use ID as name
      
      uuidToBusinessId[uuid] = businessId;
      businessIdToName[businessId] = displayName;
    });
    
    // Transform callers
    const newCallers: { [businessId: string]: string } = {};
    Object.entries(data.shop_data.callers as { [uuid: string]: string }).forEach(([uuid, _]) => {
      const businessId = uuidToBusinessId[uuid];
      const displayName = businessIdToName[businessId];
      newCallers[businessId] = displayName;
    });
    transformed.shop_data.callers = newCallers;
    
    // Transform call_modes
    const newCallModes: { [businessId: string]: any } = {};
    Object.entries(data.shop_data.call_modes as { [uuid: string]: any }).forEach(([uuid, config]) => {
      const businessId = uuidToBusinessId[uuid];
      if (businessId) {
        newCallModes[businessId] = config;
      }
    });
    transformed.shop_data.call_modes = newCallModes;
    
    // Transform get_num (preserve _type, transform UUID keys)
    const newGetNum: { [key: string]: any } = {
      _type: data.shop_data.get_num._type
    };
    Object.entries(data.shop_data.get_num as { [key: string]: any }).forEach(([key, config]) => {
      if (key === '_type') return; // Already handled
      const businessId = uuidToBusinessId[key];
      if (businessId) {
        newGetNum[businessId] = config;
      }
    });
    transformed.shop_data.get_num = newGetNum;
    
    // 3. Clean up: remove any fields where default matches hint pattern
    // (Smart default cleanup - if default value matches hint in parentheses, clear it)
    
    return transformed;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.shop_id.trim()) {
      toast.error("請輸入店家ID");
      return;
    }
    
    // Transform data before submission
    const backendPayload = transformDataForBackend(formData);
    
    if (isDevMode) {
      console.log("=== CREATE SHOP DATA (DEV MODE) ===");
      console.log(JSON.stringify(backendPayload, null, 2));
      toast.success("資料載入成功");
      resetForm();
    } else {
      setIsSubmitting(true);
      try {
        const response = await addShopData(backendPayload);
        if (response.success) {
          toast.success("店家已成功建立");
          resetForm();
          onCancel();
        }
        // Error handling is done in shopApi
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Check if a field key should be hidden (internal fields like _type, _external)
  const shouldHideField = (key: string): boolean => {
    // Hide _type field from get_num (it's rendered separately)
    if (key === 'shop_data.get_num._type') return true;
    // Hide _external field (internal use only)
    if (key.endsWith('._external')) return true;
    return false;
  };

  // Render field based on schema
  const renderField = (field: SchemaField, callerId?: string) => {
    const inputType = field["Input Type"];
    const hint = field.hint;
    const defaultValue = field.default;
    
    if (inputType === "N/A") return null;
    
    // Skip hidden internal fields
    if (shouldHideField(field.key)) return null;
    
    // Handle booking toggle separately
    if (field.key === 'shop_data.booking') {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor="booking-toggle" className="text-sm">
            預約設定
            {hint && <span className="text-muted-foreground ml-1">({hint})</span>}
          </Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="booking-toggle"
              checked={bookingEnabled}
              onCheckedChange={setBookingEnabled}
            />
          </div>
        </div>
      );
    }
    
    const fieldKey = callerId 
      ? field.key.replace('shop_data.call_modes.tawe_zz001', '').replace('shop_data.get_num.tawe_zz001', '').replace(/^\./, '')
      : field.key;
    
    let value: any;
    if (callerId) {
      if (field.key.includes('call_modes')) {
        value = getNestedValue(formData.shop_data.call_modes[callerId], fieldKey);
      } else if (field.key.includes('get_num')) {
        value = formData.shop_data.get_num[callerId]?.[fieldKey];
      } else if (field.key.includes('callers')) {
        value = formData.shop_data.callers[callerId];
      }
    } else {
      value = getNestedValue(formData, field.key);
    }
    
    // Apply default if value is undefined (Smart default: skip if default matches hint)
    if (value === undefined && defaultValue) {
      // Check if default matches hint pattern - if so, treat as placeholder
      const hintMatch = hint && defaultValue === hint;
      if (!hintMatch) {
        if (inputType === "boolean" || inputType === "switch-toggle" || inputType === "checkbox") {
          value = String(defaultValue).toLowerCase() === "true";
        } else if (inputType === "number") {
          value = parseInt(defaultValue) || 0;
        } else {
          value = defaultValue;
        }
      }
    }
    
    const handleFieldChange = (newValue: any) => {
      if (callerId) {
        if (field.key.includes('call_modes')) {
          handleCallerChange(callerId, 'call_modes', fieldKey, newValue);
        } else if (field.key.includes('get_num')) {
          handleCallerChange(callerId, 'get_num', fieldKey, newValue);
        } else if (field.key.includes('callers')) {
          handleCallerChange(callerId, 'callers', '', newValue);
        }
      } else {
        handleChange(field.key, newValue);
      }
    };
    
    // Extract leaf key (last segment) for label
    const leafKey = fieldKey ? fieldKey.split('.').pop() : field.key.split('.').pop();
    
    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key} title={hint} className="text-sm">
          {leafKey}
          {hint && <span className="text-muted-foreground ml-1">({hint})</span>}
        </Label>
        
        {(inputType === "boolean" || inputType === "switch-toggle" || inputType === "checkbox") && (
          <div className="flex items-center space-x-2">
            <Switch
              id={field.key}
              checked={value || false}
              onCheckedChange={handleFieldChange}
            />
          </div>
        )}
        
        {inputType === "radio" && (
          <RadioGroup value={value || defaultValue} onValueChange={handleFieldChange}>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="random" id={`${field.key}-random`} />
                <Label htmlFor={`${field.key}-random`}>random</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sequential" id={`${field.key}-sequential`} />
                <Label htmlFor={`${field.key}-sequential`}>sequential</Label>
              </div>
            </div>
          </RadioGroup>
        )}
        
        {(inputType === "text" || inputType === "form-control" || inputType === "url") && (
          <Input
            id={field.key}
            type="text"
            value={value || ""}
            onChange={(e) => handleFieldChange(e.target.value)}
            placeholder={hint}
          />
        )}
        
        {inputType === "number" && (
          <Input
            id={field.key}
            type="number"
            value={value || 0}
            onChange={(e) => handleFieldChange(parseInt(e.target.value) || 0)}
            placeholder={hint}
          />
        )}
        
        {inputType === "array" && (
          <Input
            id={field.key}
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ""}
            onChange={(e) => handleFieldChange(e.target.value.split(',').map(s => s.trim()))}
            placeholder="用逗號分隔多個值"
          />
        )}
      </div>
    );
  };

  // Get base fields (excluding dynamic caller fields and google_map)
  const getBaseFields = () => {
    return schema.filter(f => 
      !f.key.includes('call_modes.tawe_zz001') && 
      !f.key.includes('get_num.tawe_zz001') &&
      !f.key.includes('callers.tawe_zz001') &&
      !f.key.includes('google_map') &&
      !f.key.startsWith('shop_data.booking.') && // Exclude booking child fields
      f.key !== 'shop_data.call_modes' &&
      f.key !== 'shop_data.get_num' &&
      f.key !== 'shop_data.callers' &&
      f.key !== 'shop_data.get_num._type' // Exclude _type, rendered separately
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
      f.key.includes('call_modes.tawe_zz001') && 
      !f.key.includes('set_params')
    );
  };

  // Get caller-specific fields for get_num (excluding _type and _external)
  const getGetNumFields = () => {
    return schema.filter(f => 
      f.key.includes('get_num.tawe_zz001') &&
      !f.key.includes('get_num._type') &&
      !f.key.endsWith('._external')
    );
  };

  // Get the _type field for get_num
  const getGetNumTypeField = () => {
    return schema.find(f => f.key === 'shop_data.get_num._type');
  };

  // Get caller display name (extract name part from "id | name" format)
  const getCallerDisplayName = (callerId: string, index: number): string => {
    const value = formData.shop_data.callers[callerId] || "";
    if (!value) return `叫號機 ${index + 1}`;
    const parts = value.split('|').map((p: string) => p.trim());
    return parts[1] || parts[0] || `叫號機 ${index + 1}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">基本店家資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {getBaseFields().map(field => renderField(field))}
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

      {/* Get Num Type Radio (Static - Shared across all callers) */}
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">取號機型別設定</CardTitle>
        </CardHeader>
        <CardContent>
          {getGetNumTypeField() && (
            <div className="space-y-2">
              <Label>取號機型別 (_type)</Label>
              <RadioGroup 
                value={formData.shop_data.get_num._type || "caller"} 
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
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">叫號機管理</CardTitle>
        </CardHeader>
        <CardContent>
          {callerIds.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">尚未新增叫號機</p>
              <Button
                type="button"
                onClick={handleAddCaller}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                <Plus className="mr-2 h-4 w-4" />
                新增叫號機
              </Button>
            </div>
          ) : (
            <Tabs value={selectedCallerId} onValueChange={setSelectedCallerId} className="w-full">
              {/* Horizontal Tabs: TabsList on top */}
              <div className="flex items-center justify-between mb-4">
                <TabsList className="inline-flex h-10">
                  {callerIds.map((callerId, index) => (
                    <TabsTrigger key={callerId} value={callerId}>
                      {getCallerDisplayName(callerId, index)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button
                  type="button"
                  onClick={handleAddCaller}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新增叫號機
                </Button>
              </div>

              {/* TabsContent below */}
              {callerIds.map((callerId, index) => (
                <TabsContent key={callerId} value={callerId}>
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
                      <div className="space-y-1">
                        <CardTitle className="text-base text-primary">
                          叫號機 #{index + 1}
                        </CardTitle>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCaller(callerId)}
                        disabled={callerIds.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {/* Caller ID & Name */}
                      <div className="space-y-2">
                        <Label>叫號機 ID | 名稱</Label>
                        <Input
                          value={formData.shop_data.callers[callerId] || ""}
                          onChange={(e) => handleCallerChange(callerId, 'callers', '', e.target.value)}
                          placeholder="例如: tawe_a010m | 超音波"
                        />
                        <p className="text-xs text-muted-foreground">
                          格式：業務ID | 顯示名稱（例如：tawe_a010m | Ultrasound）
                        </p>
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

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? "送出中..." : "確認送出"}
        </Button>
      </div>
    </form>
  );
};
