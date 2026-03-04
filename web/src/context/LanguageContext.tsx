import React, { createContext, useContext, useMemo, useState } from 'react';

export type Language = 'en' | 'ta' | 'hi';

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  en: {
    langLabel: 'Language',
    dashboard: 'Dashboard',
    assets: 'Assets',
    procurement: 'Procurement',
    labs: 'Labs',
    users: 'Users',
    maintenance: 'Maintenance',
    reports: 'Reports',
    settings: 'Settings',
    myAssets: 'My Assets',
    maintenanceRequests: 'Maintenance Requests',
    assignedTasks: 'Assigned Tasks',
    vendorOrders: 'Vendor Orders',
    signIn: 'Sign In',
    register: 'Register',
    logout: 'Logout'
  },
  ta: {
    langLabel: 'மொழி',
    dashboard: 'டாஷ்போர்டு',
    assets: 'சொத்துகள்',
    procurement: 'கொள்முதல்',
    labs: 'ஆய்வகங்கள்',
    users: 'பயனர்கள்',
    maintenance: 'பராமரிப்பு',
    reports: 'அறிக்கைகள்',
    settings: 'அமைப்புகள்',
    myAssets: 'என் சொத்துகள்',
    maintenanceRequests: 'பராமரிப்பு கோரிக்கைகள்',
    assignedTasks: 'ஒதுக்கப்பட்ட பணிகள்',
    vendorOrders: 'விற்பனையாளர் ஆர்டர்கள்',
    signIn: 'உள்நுழைவு',
    register: 'பதிவு',
    logout: 'வெளியேறு'
  },
  hi: {
    langLabel: 'भाषा',
    dashboard: 'डैशबोर्ड',
    assets: 'एसेट्स',
    procurement: 'प्रोक्योरमेंट',
    labs: 'लैब्स',
    users: 'यूज़र्स',
    maintenance: 'मेंटेनेंस',
    reports: 'रिपोर्ट्स',
    settings: 'सेटिंग्स',
    myAssets: 'मेरे एसेट्स',
    maintenanceRequests: 'मेंटेनेंस अनुरोध',
    assignedTasks: 'असाइन्ड टास्क्स',
    vendorOrders: 'वेंडर ऑर्डर्स',
    signIn: 'साइन इन',
    register: 'रजिस्टर',
    logout: 'लॉगआउट'
  }
};

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('campusledger_language');
    if (stored === 'ta' || stored === 'hi' || stored === 'en') {
      return stored;
    }
    return 'en';
  });

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        setLanguage(nextLanguage);
        localStorage.setItem('campusledger_language', nextLanguage);
      },
      t: (key, fallback) => dictionaries[language][key] ?? fallback ?? key
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
