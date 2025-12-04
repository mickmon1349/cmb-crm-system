import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CreateShopForm } from "@/components/CreateShopForm";
import { SearchShopForm } from "@/components/SearchShopForm";

const Index = () => {
  const [useMockData, setUseMockData] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="min-h-screen bg-primary py-8 px-4">
      <Card className="max-w-4xl mx-auto bg-white shadow-xl">
        {/* Header with View Switcher */}
        <div className="bg-primary text-primary-foreground p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">叫叫我顧客管理系統</h1>
            <p className="text-primary-foreground/90 mt-1">
              {showCreateForm ? "新增店家" : "顧客資訊輸入"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Development Mode Toggle */}
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-lg">
              <Label htmlFor="dev-mode" className="cursor-pointer text-sm whitespace-nowrap">
                開發模式
              </Label>
              <Switch id="dev-mode" checked={useMockData} onCheckedChange={setUseMockData} />
            </div>
            {/* View Switcher Button */}
            <Button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant="secondary"
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {showCreateForm ? "取消" : "新增店家"}
            </Button>
          </div>
        </div>
        
        <CardContent className="p-6">
          {/* Conditional Rendering: Create Form or Search Form */}
          {showCreateForm ? (
            <CreateShopForm 
              isDevMode={useMockData}
              onCancel={() => setShowCreateForm(false)}
            />
          ) : (
            <SearchShopForm isDevMode={useMockData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
