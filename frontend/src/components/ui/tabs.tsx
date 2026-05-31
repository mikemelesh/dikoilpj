import React, { useState, createContext, useContext } from "react";

interface TabsContextProps {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextProps | undefined>(undefined);

interface TabsProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({ 
  children, 
  value, 
  onValueChange, 
  defaultValue = "", 
  className = "" 
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  
  const currentValue = value !== undefined ? value : internalValue;
  
  const handleChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ value: currentValue, onChange: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

const TabsList: React.FC<TabsListProps> = ({ children, className = "" }) => {
  return (
    <div className={`flex border-b ${className}`}>{children}</div>
  );
};

interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  children, 
  value, 
  className = "" 
}) => {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }
  
  const { value: currentValue, onChange } = context;
  
  const isActive = currentValue === value;
  
  return (
    <button
      type="button"
      className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
        isActive
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      } ${className}`}
      onClick={() => onChange(value)}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

const TabsContent: React.FC<TabsContentProps> = ({ 
  children, 
  value, 
  className = "" 
}) => {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }
  
  const { value: currentValue } = context;
  
  if (currentValue !== value) {
    return null;
  }
  
  return (
    <div className={`mt-4 p-4 rounded-md bg-muted/20 ${className}`}>
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };