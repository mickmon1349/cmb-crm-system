import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Papa from "papaparse";
import pinyin from "pinyin";
import { Plus, Trash2 } from "lucide-react";

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

export const CreateShopForm: React.FC<CreateShopFormProps> = ({ isDevMode, onCancel }) => {
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [formData, setFormData] = useState<any>({
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
        booking: false,
        phone: "",
        phone_hint: "",
        url: "",
        url_label: ""
      },
      callers: {},
      call_modes: {},
      get_num: {
        type: "caller"
      }
    }
  });
  const [callerIds, setCallerIds] = useState<string[]>([]);

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
    newData.shop_data.callers[newCallerId] = `叫號機 ${callerIds.length + 1}`;
    
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
      external: false,
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
    
    // Update isMultiCaller
    const newCallerIds = [...callerIds, newCallerId];
    newData.shop_data.isMultiCaller = newCallerIds.length > 1;
    
    setFormData(newData);
    setCallerIds(newCallerIds);
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
    
    setFormData(newData);
    setCallerIds(newCallerIds);
    toast.success("已刪除叫號機");
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.shop_id.trim()) {
      toast.error("請輸入店家ID");
      return;
    }
    
    if (isDevMode) {
      console.log("=== CREATE SHOP DATA (DEV MODE) ===");
      console.log(JSON.stringify(formData, null, 2));
      toast.success("資料載入成功");
    } else {
      // TODO: Implement actual API call
      console.log("Submit to API:", formData);
      toast.success("店家已成功建立");
      onCancel();
    }
  };

  // Render field based on schema
  const renderField = (field: SchemaField, callerId?: string) => {
    const inputType = field["Input Type"];
    const hint = field.hint;
    const defaultValue = field.default;
    
    if (inputType === "N/A") return null;
    
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
    
    // Apply default if value is undefined
    if (value === undefined && defaultValue) {
      if (inputType === "boolean" || inputType === "switch-toggle") {
        value = String(defaultValue).toLowerCase() === "true";
      } else if (inputType === "number") {
        value = parseInt(defaultValue) || 0;
      } else {
        value = defaultValue;
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
    
    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key} title={hint} className="text-sm">
          {fieldKey || field.key.split('.').pop()}
          {hint && <span className="text-muted-foreground ml-1">({hint})</span>}
        </Label>
        
        {(inputType === "boolean" || inputType === "switch-toggle") && (
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

  // Get base fields (excluding dynamic caller fields)
  const getBaseFields = () => {
    return schema.filter(f => 
      !f.key.includes('call_modes.tawe_zz001') && 
      !f.key.includes('get_num.tawe_zz001') &&
      !f.key.includes('callers.tawe_zz001') &&
      f.key !== 'shop_data.call_modes' &&
      f.key !== 'shop_data.get_num' &&
      f.key !== 'shop_data.callers'
    );
  };

  // Get caller-specific fields for call_modes
  const getCallModeFields = () => {
    return schema.filter(f => 
      f.key.includes('call_modes.tawe_zz001') && 
      !f.key.includes('set_params')
    );
  };

  // Get caller-specific fields for get_num
  const getGetNumFields = () => {
    return schema.filter(f => 
      f.key.includes('get_num.tawe_zz001') &&
      !f.key.startsWith('shop_data.get_num._type')
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">基本店家資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {getBaseFields().map(field => {
              // Handle booking conditional rendering
              if (field.key.includes('booking.') && field.key !== 'shop_data.booking') {
                if (!formData.shop_data.booking.booking) return null;
              }
              return renderField(field);
            })}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">叫號機列表 (callers)</CardTitle>
          <Button
            type="button"
            onClick={handleAddCaller}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Plus className="mr-2 h-4 w-4" />
            新增叫號機
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {callerIds.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              尚未新增叫號機，請點擊上方按鈕新增
            </p>
          ) : (
            callerIds.map((callerId, index) => (
              <Card key={callerId} className="border-2 border-destructive/20">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
                  <div className="space-y-1">
                    <CardTitle className="text-base text-primary">
                      叫號機 #{index + 1}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">UUID: {callerId}</p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteCaller(callerId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Caller Name */}
                  <div className="space-y-2">
                    <Label>叫號機名稱</Label>
                    <Input
                      value={formData.shop_data.callers[callerId] || ""}
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
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" className="bg-primary hover:bg-primary/90">
          確認送出
        </Button>
      </div>
    </form>
  );
};
