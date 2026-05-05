export const DEFAULT_EXCHANGE_RATE = 4.5;
export const DEFAULT_USD_RATE = 1.5;

export const defaultAccounts = [
  { id: 'xs_icbc', name: '工商银行', owner: '小盛', type: 'bank', currency: 'CNY', initialBalance: 0, iconName: 'CreditCard', color: 'bg-red-600 text-white' },
  { id: 'xs_boc_cn', name: '中国银行', owner: '小盛', type: 'bank', currency: 'CNY', initialBalance: 34145.75, iconName: 'Landmark', color: 'bg-red-500 text-white' },
  { id: 'xs_wechat', name: '微信', owner: '小盛', type: 'wechat', currency: 'CNY', initialBalance: 4570.32, iconName: 'MessageCircle', color: 'bg-green-500 text-white' },
  { id: 'xs_alipay', name: '支付宝', owner: '小盛', type: 'alipay', currency: 'CNY', initialBalance: 36881.74, iconName: 'ScanLine', color: 'bg-blue-500 text-white' },
  { id: 'xs_cash_cny', name: '现金(CNY)', owner: '小盛', type: 'cash', currency: 'CNY', initialBalance: 0, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },
  { id: 'xs_huabei', name: '花呗', owner: '小盛', type: 'huabei', currency: 'CNY', initialBalance: 8162.98, iconName: 'ScanLine', color: 'bg-blue-400 text-white' },
  { id: 'xs_cgb', name: '广发信用卡', owner: '小盛', type: 'credit', currency: 'CNY', initialBalance: 34.94, iconName: 'CreditCard', color: 'bg-purple-700 text-white' },
  { id: 'xs_commbank', name: 'CommBank', owner: '小盛', type: 'bank', currency: 'AUD', initialBalance: 24.97, iconName: 'Wallet', color: 'bg-yellow-400 text-black' },
  { id: 'xs_hsbc', name: 'HSBC', owner: '小盛', type: 'bank', currency: 'AUD', initialBalance: 1298.6, iconName: 'Landmark', color: 'bg-red-600 text-white' },
  { id: 'xs_anz', name: 'ANZ', owner: '小盛', type: 'bank', currency: 'AUD', initialBalance: 101.25, iconName: 'CreditCard', color: 'bg-blue-600 text-white' },
  { id: 'xs_cash_aud', name: '现金(AUD)', owner: '小盛', type: 'cash', currency: 'AUD', initialBalance: 100, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },
  { id: 'dw_boc_cn', name: '中国银行', owner: '大王', type: 'bank', currency: 'CNY', initialBalance: 10325, iconName: 'Landmark', color: 'bg-red-500 text-white' },
  { id: 'dw_wechat', name: '微信', owner: '大王', type: 'wechat', currency: 'CNY', initialBalance: 11.58, iconName: 'MessageCircle', color: 'bg-green-500 text-white' },
  { id: 'dw_alipay', name: '支付宝', owner: '大王', type: 'alipay', currency: 'CNY', initialBalance: 173188, iconName: 'ScanLine', color: 'bg-blue-500 text-white' },
  { id: 'dw_huabei', name: '花呗', owner: '大王', type: 'huabei', currency: 'CNY', initialBalance: 0, iconName: 'ScanLine', color: 'bg-blue-400 text-white' },
  { id: 'dw_commbank', name: 'CommBank', owner: '大王', type: 'bank', currency: 'AUD', initialBalance: 1020, iconName: 'Wallet', color: 'bg-yellow-400 text-black' },
  { id: 'dw_hsbc', name: 'HSBC', owner: '大王', type: 'bank', currency: 'AUD', initialBalance: 697, iconName: 'Landmark', color: 'bg-red-600 text-white' },
  { id: 'dw_cash_aud', name: '现金(AUD)', owner: '大王', type: 'cash', currency: 'AUD', initialBalance: 0, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },
  { id: 'dw_cash_cny', name: '现金(CNY)', owner: '大王', type: 'cash', currency: 'CNY', initialBalance: 0, iconName: 'Banknote', color: 'bg-emerald-500 text-white' },
  { id: 'sp_us_stock', name: '美股账户', owner: '家庭', type: 'investment', currency: 'USD', initialBalance: 8700, iconName: 'BarChart3', color: 'bg-indigo-600 text-white' },
  { id: 'sp_ctrip', name: '未使用票券', owner: '家庭', type: 'pending', currency: 'CNY', initialBalance: 5496, iconName: 'Ticket', color: 'bg-orange-400 text-white' },
  { id: 'sp_reimburse', name: '待报销款项', owner: '家庭', type: 'pending', currency: 'CNY', initialBalance: 0, iconName: 'Clock', color: 'bg-amber-500 text-white' },
  { id: 'sp_bond', name: 'Bond (押金)', owner: '家庭', type: 'longterm', currency: 'AUD', initialBalance: 2940, iconName: 'Key', color: 'bg-teal-600 text-white' },
  { id: 'sp_prepaid_rent', name: '预付房租', owner: '家庭', type: 'longterm', currency: 'AUD', initialBalance: 0, iconName: 'Home', color: 'bg-teal-500 text-white' },
  { id: 'sp_foreign_cash', name: '外币现金 (折合)', owner: '家庭', type: 'cash', currency: 'CNY', initialBalance: 0, iconName: 'Coins', color: 'bg-emerald-700 text-white' },
  { id: 'sp_fixed_assets', name: '固定资产 (闲置)', owner: '家庭', type: 'longterm', currency: 'CNY', initialBalance: 0, iconName: 'Package', color: 'bg-stone-500 text-white' },
];

export const defaultTransactions = [];

export const defaultSnapshots = [];
