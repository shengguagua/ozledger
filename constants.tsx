
import { CategoryItem, Account } from './types';
import { 
  Home, GraduationCap, ShoppingCart, Utensils, 
  Bus, ShoppingBag, Banknote, HeartHandshake, 
  Plane, Smartphone, CreditCard, Wallet, 
  Landmark, Gem, Briefcase, Coffee, Receipt,
  ScanLine, MessageCircle, BarChart3, Clock, Key,
  Ticket, Camera, Coins, Package
} from 'lucide-react';

export const DEFAULT_EXCHANGE_RATE = 4.5;

export const DEFAULT_ACCOUNTS: Account[] = [
  // --- 小盛 Accounts ---
  // CNY Assets
  { id: 'xs_icbc', name: '工商银行', owner: '小盛', type: 'bank', currency: 'CNY', initialBalance: 0, iconName: 'CreditCard', color: 'bg-red-600 text-white' },
  { id: 'xs_boc_cn', name: '中国银行', owner: '小盛', type: 'bank', currency: 'CNY', initialBalance: 34145.75, iconName: 'Landmark', color: 'bg-red-500 text-white' },
  { id: 'xs_wechat', name: '微信', owner: '小盛', type: 'wechat', currency: 'CNY', initialBalance: 4570.32, iconName: 'MessageCircle', color: 'bg-green-500 text-white' },
  { id: 'xs_alipay', name: '支付宝', owner: '小盛', type: 'alipay', currency: 'CNY', initialBalance: 36881.74, iconName: 'ScanLine', color: 'bg-blue-500 text-white' },
  { id: 'xs_cash_cny', name: '现金(CNY)', owner: '小盛', type: 'cash', currency: 'CNY', initialBalance: 0, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },
  // CNY Liabilities
  { id: 'xs_huabei', name: '花呗', owner: '小盛', type: 'huabei', currency: 'CNY', initialBalance: 8162.98, iconName: 'ScanLine', color: 'bg-blue-400 text-white' },
  { id: 'xs_cgb', name: '广发信用卡', owner: '小盛', type: 'credit', currency: 'CNY', initialBalance: 34.94, iconName: 'CreditCard', color: 'bg-purple-700 text-white' },

  // AUD Assets
  { id: 'xs_commbank', name: 'CommBank', owner: '小盛', type: 'bank', currency: 'AUD', initialBalance: 24.97, iconName: 'Wallet', color: 'bg-yellow-400 text-black' },
  { id: 'xs_hsbc', name: 'HSBC', owner: '小盛', type: 'bank', currency: 'AUD', initialBalance: 1298.6, iconName: 'Landmark', color: 'bg-red-600 text-white' },
  { id: 'xs_anz', name: 'ANZ', owner: '小盛', type: 'bank', currency: 'AUD', initialBalance: 101.25, iconName: 'CreditCard', color: 'bg-blue-600 text-white' },
  { id: 'xs_cash_aud', name: '现金(AUD)', owner: '小盛', type: 'cash', currency: 'AUD', initialBalance: 100, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },


  // --- 大王 Accounts ---
  // CNY Assets
  { id: 'dw_boc_cn', name: '中国银行', owner: '大王', type: 'bank', currency: 'CNY', initialBalance: 10325, iconName: 'Landmark', color: 'bg-red-500 text-white' },
  { id: 'dw_wechat', name: '微信', owner: '大王', type: 'wechat', currency: 'CNY', initialBalance: 11.58, iconName: 'MessageCircle', color: 'bg-green-500 text-white' },
  { id: 'dw_alipay', name: '支付宝', owner: '大王', type: 'alipay', currency: 'CNY', initialBalance: 173188, iconName: 'ScanLine', color: 'bg-blue-500 text-white' },
  // CNY Liabilities
  { id: 'dw_huabei', name: '花呗', owner: '大王', type: 'huabei', currency: 'CNY', initialBalance: 0, iconName: 'ScanLine', color: 'bg-blue-400 text-white' },

  // AUD Assets
  { id: 'dw_commbank', name: 'CommBank', owner: '大王', type: 'bank', currency: 'AUD', initialBalance: 1020, iconName: 'Wallet', color: 'bg-yellow-400 text-black' },
  { id: 'dw_hsbc', name: 'HSBC', owner: '大王', type: 'bank', currency: 'AUD', initialBalance: 697, iconName: 'Landmark', color: 'bg-red-600 text-white' },
  { id: 'dw_cash_aud', name: '现金(AUD)', owner: '大王', type: 'cash', currency: 'AUD', initialBalance: 0, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },
  { id: 'dw_cash_cny', name: '现金(CNY)', owner: '大王', type: 'cash', currency: 'CNY', initialBalance: 0, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },


  // --- 特殊资产 (Investments / Pending / Long-term) ---
  // Investments
  { id: 'sp_us_stock', name: '美股账户', owner: '家庭', type: 'investment', currency: 'USD', initialBalance: 8700, iconName: 'BarChart3', color: 'bg-indigo-600 text-white' },
  
  // Pending
  { id: 'sp_ctrip', name: '未使用票券', owner: '家庭', type: 'pending', currency: 'CNY', initialBalance: 5496, iconName: 'Ticket', color: 'bg-orange-400 text-white' },
  { id: 'sp_reimburse', name: '待报销款项', owner: '家庭', type: 'pending', currency: 'CNY', initialBalance: 0, iconName: 'Clock', color: 'bg-amber-500 text-white' },

  // Long-term
  { id: 'sp_bond', name: 'Bond (押金)', owner: '家庭', type: 'longterm', currency: 'AUD', initialBalance: 2940, iconName: 'Key', color: 'bg-teal-600 text-white' },
  { id: 'sp_prepaid_rent', name: '预付房租', owner: '家庭', type: 'longterm', currency: 'AUD', initialBalance: 0, iconName: 'Home', color: 'bg-teal-500 text-white' },

  // New Special Assets (Requested)
  { id: 'sp_foreign_cash', name: '外币现金 (折合)', owner: '家庭', type: 'cash', currency: 'CNY', initialBalance: 0, iconName: 'Coins', color: 'bg-emerald-700 text-white' },
  { id: 'sp_fixed_assets', name: '固定资产 (闲置)', owner: '家庭', type: 'longterm', currency: 'CNY', initialBalance: 0, iconName: 'Package', color: 'bg-stone-500 text-white' },
];

export const CATEGORIES: CategoryItem[] = [
  // Expenses
  { id: 'rent', name: '房租', iconName: 'Home', color: 'bg-blue-50 text-blue-600' },
  { id: 'groceries', name: '超市', iconName: 'ShoppingCart', color: 'bg-green-50 text-green-600' },
  { id: 'dining', name: '餐饮', iconName: 'Utensils', color: 'bg-orange-50 text-orange-600' },
  { id: 'transport', name: '交通', iconName: 'Bus', color: 'bg-indigo-50 text-indigo-600' },
  { id: 'tuition', name: '学费', iconName: 'GraduationCap', color: 'bg-sky-50 text-sky-600' },
  { id: 'shopping', name: '购物', iconName: 'ShoppingBag', color: 'bg-pink-50 text-pink-600' },
  { id: 'entertainment', name: '娱乐', iconName: 'Smartphone', color: 'bg-purple-50 text-purple-600' },
  { id: 'travel', name: '旅行', iconName: 'Plane', color: 'bg-teal-50 text-teal-600' },
  { id: 'bills', name: '账单缴费', iconName: 'Receipt', color: 'bg-gray-100 text-gray-600' },
  
  // Income
  { id: 'salary', name: '兼职收入', iconName: 'Briefcase', color: 'bg-emerald-50 text-emerald-600' },
  { id: 'remittance', name: '生活费汇款', iconName: 'HeartHandshake', color: 'bg-red-50 text-red-600' },
  { id: 'investment_return', name: '理财收益', iconName: 'BarChart3', color: 'bg-indigo-50 text-indigo-600' },
  { id: 'other_income', name: '其他收入', iconName: 'Banknote', color: 'bg-blue-50 text-blue-600' },
];

export const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    Home, GraduationCap, ShoppingCart, Utensils, 
    Bus, ShoppingBag, Banknote, HeartHandshake,
    Coffee, Plane, Smartphone, CreditCard, 
    Wallet, Landmark, Gem, Briefcase, Receipt,
    ScanLine, MessageCircle, BarChart3, Clock, Key,
    Ticket, Camera, Coins, Package
  };
  return icons[iconName] || ShoppingCart;
};
