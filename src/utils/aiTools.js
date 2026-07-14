const dashboardService = require('../services/dashboardService');
const transactionService = require('../services/transactionService');
const salaryCycleService = require('../services/salaryCycleService');
const fundService = require('../services/fundService');
const accountService = require('../services/accountService');
const categoryService = require('../services/categoryService');
const reportService = require('../services/reportService');
const mongoose = require('mongoose');

// Required Models
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Fund = require('../models/Fund');
const User = require('../models/User');


// Required Services & Repositories
const exchangeRateService = require('../services/exchangeRateService');
const dashboardRepository = require('../repositories/dashboardRepository');

// Helper functions for fuzzy matching names
const findAccountByName = async (userId, name) => {
  if (!name) return null;
  const accounts = await Account.find({ userId });
  let matched = accounts.find(a => a.name.toLowerCase() === name.toLowerCase());
  if (matched) return matched;
  matched = accounts.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
  if (matched) return matched;
  return null;
};

const findCategoryByName = async (userId, name, type) => {
  if (!name) return null;
  const categories = await Category.find({
    $or: [{ userId }, { isDefault: true }]
  });
  let filtered = categories;
  if (type) {
    filtered = categories.filter(c => c.transactionType === type);
  }
  let matched = filtered.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (matched) return matched;
  matched = filtered.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
  if (matched) return matched;
  return null;
};

const findGoalByName = async (userId, name) => {
  if (!name) return null;
  const funds = await Fund.find({ userId, status: { $ne: 'ARCHIVED' } });
  let matched = funds.find(f => f.name.toLowerCase() === name.toLowerCase());
  if (matched) return matched;
  matched = funds.find(f => f.name.toLowerCase().includes(name.toLowerCase()));
  if (matched) return matched;
  return null;
};


const formatDateWIB = (dateInput) => {
  if (!dateInput) return dateInput;
  const date = new Date(dateInput);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  
  const d = parts.find(p => p.type === 'day').value;
  const m = parts.find(p => p.type === 'month').value;
  const y = parts.find(p => p.type === 'year').value;
  const h = parts.find(p => p.type === 'hour').value;
  const min = parts.find(p => p.type === 'minute').value;
  
  // Convert month to Indonesian if needed or just use standard 'Jun'
  const monthsIndo = { Jan: 'Jan', Feb: 'Feb', Mar: 'Mar', Apr: 'Apr', May: 'Mei', Jun: 'Jun', Jul: 'Jul', Aug: 'Agt', Sep: 'Sep', Oct: 'Okt', Nov: 'Nov', Dec: 'Des' };
  const mIndo = monthsIndo[m] || m;

  return `${d} ${mIndo} ${y} ${h}:${min} WIB`;
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'Rp 0';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
};

// Define tool schemas for Groq
const toolSchemas = [
  {
    type: 'function',
    function: {
      name: 'search_transactions',
      description: "Search the user's transaction history with filters. Use this when the user asks about specific transactions, spending on specific items, wants to find particular entries, or wants to see their largest/smallest transactions (using sortBy).",
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Optional keyword to search in note or category name' },
          startDate: { type: 'string', format: 'date-time', description: 'Start of date range (ISO 8601)' },
          endDate: { type: 'string', format: 'date-time', description: 'End of date range (ISO 8601)' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'CONVERSION', 'ADJUSTMENT'], description: 'Filter by transaction type' },
          sortBy: { type: 'string', enum: ['amount_desc', 'amount_asc', 'date_asc', 'date_desc'], description: 'Sort criteria (e.g. amount_desc for largest transactions)' },
          limit: { type: 'integer', description: 'Maximum number of results to return (default 20)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_test_push_notification',
      description: "Send a test push notification to the user's subscribed devices. Bypasses typical limits like daily cooldown. Requires correct developer password ('Dearijik').",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the push notification' },
          description: { type: 'string', description: 'The body content of the push notification' },
          password: { type: 'string', description: 'Developer password required to execute the test (must be "Dearijik")' }
        },
        required: ['title', 'description', 'password']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_balance',
      description: 'Get the total liquid balance (available money) and asset value for the user. Use for quick balance checks.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_active_salary_cycle',
      description: 'Get details about the user\'s currently active salary cycle (name, start date, end date).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_expense_by_category',
      description: 'Get a summary of expenses grouped by category for the current salary cycle. Use when the user asks about spending breakdown or top expense categories.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_transactions',
      description: 'Get the 5 most recent transactions. Use when the user asks about latest or recent transactions.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_overview',
      description: 'Get a comprehensive financial snapshot: available money, allocated funds, asset value, net worth, cycle income/expense, and detailed breakdowns per account and fund. Use this for overall financial health questions.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_goals',
      description: 'Search goals by name (fuzzy match). Returns goal details including progress and average monthly saving.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Goal name or partial name to search' },
          limit: { type: 'number', description: 'Maximum number of goals to return (default 5)' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'forecast_goal_completion',
      description: 'Forecast when a specific goal will be reached based on historical savings pace.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Exact or partial goal name to forecast' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_goals',
      description: 'Get a list of all financial goals (GOAL and EMERGENCY funds) with their target amounts and current progress.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_goal_progress',
      description: 'Get deep forecasting and analysis of all goals, including estimated completion months and averages.',
      parameters: { type: 'object', properties: {} }
    }
  },
  // === NEW TOOLS ===
  {
    type: 'function',
    function: {
      name: 'get_accounts',
      description: 'Get a list of all user accounts (bank, e-wallet, cash, precious metal, etc.) with current balance and estimated IDR value. Use when user asks about account balances, list of accounts, or specific account info.',
      parameters: {
        type: 'object',
        properties: {
          includeArchived: { type: 'boolean', description: 'Whether to include archived accounts (default false)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_categories',
      description: 'Get all transaction categories (INCOME and EXPENSE) that belong to the user. Use when user asks about their categories or wants to know available categories.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_report',
      description: 'Get a detailed monthly financial report: total income, total expense, net balance, and expense breakdown by category. Use when user asks about specific month financial summary.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'Year (e.g. 2026). Defaults to current year if omitted.' },
          month: { type: 'integer', description: 'Month number 1-12 (e.g. 6 for June). Defaults to current month if omitted.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_yearly_report',
      description: 'Get a yearly financial report with monthly income/expense trends (12 months). Use when user asks about annual summary or yearly trends.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'Year (e.g. 2026). Defaults to current year if omitted.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_review',
      description: 'Get income vs expense trend data for the last 6 months. Use when user asks about spending trends, income trends, or financial trajectory over recent months.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_all_salary_cycles',
      description: 'Get the full history of all salary cycles (past and active). Use when user asks about salary history, past cycles, or cycle list.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_net_worth_breakdown',
      description: 'Get a detailed breakdown of net worth: liquid money per account, asset value per account, and allocated funds per goal. Use when user asks for detailed net worth composition.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_transaction',
      description: 'Create a new transaction (INCOME, EXPENSE, TRANSFER, or ADJUSTMENT). Always use this when the user asks to log, record, or add a transaction.',
      parameters: {
        type: 'object',
        properties: {
          accountName: { type: 'string', description: 'Name of the account to use (e.g., Bank Mandiri, Cash)' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'], description: 'Transaction type' },
          amount: { type: 'number', description: 'Amount of the transaction' },
          categoryName: { type: 'string', description: 'Category name (required for INCOME and EXPENSE, e.g., Makan & Minum)' },
          transferAccountName: { type: 'string', description: 'Destination account name (required for TRANSFER)' },
          note: { type: 'string', description: 'Optional description/note for the transaction' },
          transactionDate: { type: 'string', format: 'date-time', description: 'ISO date string. Defaults to current date if omitted.' },
          isPrimarySalary: { type: 'boolean', description: 'Whether this is a primary salary transaction that starts a new cycle.' },
          adminFee: { type: 'number', description: 'Optional admin fee' },
          adminFeeAccount: { type: 'string', enum: ['SOURCE', 'DESTINATION'], description: 'Where the admin fee is charged (default SOURCE)' }
        },
        required: ['accountName', 'type', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'allocate_to_goal',
      description: 'Allocate money from available balance to a specific financial goal/fund.',
      parameters: {
        type: 'object',
        properties: {
          goalName: { type: 'string', description: 'Name of the goal/fund (e.g., Dana Darurat, Tabungan Nikah)' },
          amount: { type: 'number', description: 'Amount of money to allocate' },
          note: { type: 'string', description: 'Optional note/description' }
        },
        required: ['goalName', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'withdraw_from_goal',
      description: 'Withdraw money from a specific financial goal/fund back to available balance.',
      parameters: {
        type: 'object',
        properties: {
          goalName: { type: 'string', description: 'Name of the goal/fund' },
          amount: { type: 'number', description: 'Amount of money to withdraw' },
          note: { type: 'string', description: 'Optional note/description' }
        },
        required: ['goalName', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'transfer_between_goals',
      description: 'Transfer allocated money directly from one financial goal/fund to another goal/fund.',
      parameters: {
        type: 'object',
        properties: {
          sourceGoalName: { type: 'string', description: 'Name of the source goal/fund to transfer FROM' },
          destinationGoalName: { type: 'string', description: 'Name of the destination goal/fund to transfer TO' },
          amount: { type: 'number', description: 'Amount of money to transfer' },
          note: { type: 'string', description: 'Optional note/description' }
        },
        required: ['sourceGoalName', 'destinationGoalName', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_fund_transaction_history',
      description: 'Get the detailed transaction history (allocations, withdrawals, transfers) for a specific financial goal/fund.',
      parameters: {
        type: 'object',
        properties: {
          goalName: { type: 'string', description: 'Name of the goal/fund' }
        },
        required: ['goalName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_salary_cycle_report',
      description: 'Get a comprehensive financial summary (income, expense, saving rate, category breakdown) for a specific past or active salary cycle.',
      parameters: {
        type: 'object',
        properties: {
          cycleName: { type: 'string', description: 'Name of the salary cycle (e.g., May 2026). If omitted, defaults to the currently active cycle.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_transaction_summary',
      description: 'Get a high-precision aggregated sum of transactions matching specific filters (keyword, category, account, type, date range). Use this to calculate total spending or income accurately for custom queries.',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Optional search query in transaction notes or category name' },
          categoryName: { type: 'string', description: 'Optional category name to filter by' },
          accountName: { type: 'string', description: 'Optional account name to filter by' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'CONVERSION'], description: 'Optional transaction type' },
          startDate: { type: 'string', format: 'date-time', description: 'Optional start of date range (ISO 8601)' },
          endDate: { type: 'string', format: 'date-time', description: 'Optional end of date range (ISO 8601)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: 'Create a new transaction category for the user.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the category (e.g., Langganan Netflix)' },
          transactionType: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'Type of transactions this category belongs to' }
        },
        required: ['name', 'transactionType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_category',
      description: 'Update the name or transaction type of an existing custom category.',
      parameters: {
        type: 'object',
        properties: {
          oldName: { type: 'string', description: 'Current name of the custom category' },
          newName: { type: 'string', description: 'New name to assign to the category' },
          transactionType: { type: 'string', enum: ['INCOME', 'EXPENSE'], description: 'New transaction type to assign' }
        },
        required: ['oldName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_category',
      description: 'Delete a custom transaction category for the user.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the category to delete' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_account',
      description: 'Create a new financial account (bank, e-wallet, cash, precious metal, etc.).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the account (e.g., Bank BCA, OVO)' },
          type: { type: 'string', enum: ['BANK', 'EWALLET', 'CASH', 'ASSET', 'PRECIOUS_METAL'], description: 'Account type' },
          assetClass: { type: 'string', enum: ['FIAT', 'CRYPTO', 'GOLD'], description: 'Asset class (default FIAT)' },
          assetCode: { type: 'string', description: 'Currency or asset code (e.g., IDR, USD, BTC, ETH, XAU. Default IDR)' },
          unit: { type: 'string', enum: ['GRAM', 'UNIT'], description: 'Unit type (required for PRECIOUS_METAL accounts, e.g., GRAM for gold)' },
          initialBalance: { type: 'number', description: 'Initial balance of the account (default 0)' }
        },
        required: ['name', 'type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_account',
      description: 'Update settings of an existing account (e.g., rename, archive, change asset details).',
      parameters: {
        type: 'object',
        properties: {
          accountName: { type: 'string', description: 'Current name of the account to update' },
          newName: { type: 'string', description: 'New name for the account' },
          type: { type: 'string', enum: ['BANK', 'EWALLET', 'CASH', 'ASSET', 'PRECIOUS_METAL'], description: 'New type for the account' },
          isArchived: { type: 'boolean', description: 'Set to true to archive the account, false to unarchive' },
          assetClass: { type: 'string', enum: ['FIAT', 'CRYPTO', 'GOLD'], description: 'New asset class' },
          assetCode: { type: 'string', description: 'New currency/asset code' },
          unit: { type: 'string', enum: ['GRAM', 'UNIT'], description: 'New unit type' }
        },
        required: ['accountName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_account',
      description: 'Delete a financial account (and its transaction history). Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          accountName: { type: 'string', description: 'Name of the account to delete' }
        },
        required: ['accountName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'adjust_account_balance',
      description: 'Adjust the balance of an account manually by creating an ADJUSTMENT transaction to make the recorded balance match real life.',
      parameters: {
        type: 'object',
        properties: {
          accountName: { type: 'string', description: 'Name of the account to adjust' },
          amount: { type: 'number', description: 'New actual balance amount' },
          note: { type: 'string', description: 'Reason/note for adjustment (default: Balance adjustment)' },
          transactionDate: { type: 'string', format: 'date-time', description: 'Optional transaction date' }
        },
        required: ['accountName', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: 'Create a new financial goal or emergency fund.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the goal/fund (e.g., Beli PS5)' },
          type: { type: 'string', enum: ['EMERGENCY', 'GOAL', 'INVESTMENT'], description: 'Goal type' },
          targetAmount: { type: 'number', description: 'Target budget amount' },
          targetDate: { type: 'string', format: 'date-time', description: 'Optional target completion date' }
        },
        required: ['name', 'type', 'targetAmount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_goal',
      description: 'Update the settings, target, or status of an existing goal/fund.',
      parameters: {
        type: 'object',
        properties: {
          goalName: { type: 'string', description: 'Current name of the goal to update' },
          newName: { type: 'string', description: 'New name for the goal' },
          type: { type: 'string', enum: ['EMERGENCY', 'GOAL', 'INVESTMENT'], description: 'New goal type' },
          targetAmount: { type: 'number', description: 'New target budget amount' },
          targetDate: { type: 'string', format: 'date-time', description: 'New target completion date' },
          status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], description: 'New status for the goal' }
        },
        required: ['goalName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_transaction',
      description: 'Update/correct the details of an existing transaction by its transactionId. Always search for the transaction first to get the correct transactionId.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'The unique ID of the transaction' },
          accountName: { type: 'string', description: 'New account name' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'], description: 'New transaction type' },
          amount: { type: 'number', description: 'New transaction amount' },
          categoryName: { type: 'string', description: 'New category name' },
          transferAccountName: { type: 'string', description: 'New destination account name (for transfers)' },
          note: { type: 'string', description: 'New description/notes' },
          transactionDate: { type: 'string', format: 'date-time', description: 'New transaction date' },
          isPrimarySalary: { type: 'boolean', description: 'Whether this is a primary salary transaction' },
          adminFee: { type: 'number', description: 'New admin fee amount' },
          adminFeeAccount: { type: 'string', enum: ['SOURCE', 'DESTINATION'], description: 'Where admin fee is charged' }
        },
        required: ['transactionId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_transaction',
      description: 'Delete/remove a transaction by its transactionId. Always search for the transaction first to get the correct transactionId.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'The unique ID of the transaction to delete' }
        },
        required: ['transactionId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_settings',
      description: 'Get the current user settings (such as autoAllocationPercentage for salaries).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_user_settings',
      description: 'Update the user settings (such as autoAllocationPercentage).',
      parameters: {
        type: 'object',
        properties: {
          autoAllocationPercentage: { type: 'number', description: 'Percentage of salary that will be auto-allocated to active goals (0 to 100)' }
        },
        required: ['autoAllocationPercentage']
      }
    }
  }
];



const executeTool = async (functionName, args, userId) => {
  // Validate userId format to avoid Mongoose CastError
  const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);
  if (!isValidObjectId(userId)) {
    return { error: 'Invalid userId format' };
  }
  // Normalize function name to handle possible suffixes like '__commentary'
  const baseName = functionName.split('__')[0];

  switch (baseName) {
    case 'search_transactions':
    {
      const { keyword, startDate, endDate, type, sortBy, limit = 20 } = args;
      const txs = await transactionService.getTransactions(userId, {
        limit,
        startDate,
        endDate,
        search: keyword || null,
        type: type || null,
        sortBy: sortBy || null,
        page: 1,
        accountId: null,
      });
      return {
        total: txs.total,
        showing: txs.transactions.length,
        transactions: txs.transactions.map(t => {
          const baseCurrency = t.baseCurrency || 'IDR';
          const assetCode = t.assetCode || 'IDR';
          const isBase = assetCode === baseCurrency;
          const formattedAmount = isBase 
            ? `${baseCurrency} ${t.amount.toLocaleString('id-ID')}` 
            : `${t.amount} ${assetCode} (setara ${baseCurrency} ${Math.round(t.baseAmount || t.amount * (t.conversionRate || 1)).toLocaleString('id-ID')})`;

          return {
            type: t.type,
            amount: t.amount,
            assetCode: assetCode,
            baseAmount: t.baseAmount || t.amount * (t.conversionRate || 1),
            baseCurrency: baseCurrency,
            formattedAmount,
            category: t.categoryId ? t.categoryId.name : 'Uncategorized',
            account: t.accountId ? t.accountId.name : 'Unknown',
            date: formatDateWIB(t.transactionDate),
            note: t.note,
            adminFee: t.adminFee || 0,
            adminFeeCurrency: t.adminFeeCurrency || assetCode,
            adminFeeBaseAmount: t.adminFeeBaseAmount || 0,
            adminFeeAccount: t.adminFeeAccount || 'SOURCE'
          };
        })
      };
    }

    case 'get_current_balance':
    {
      const summary = await dashboardService.getSummary(userId);
      return {
        availableMoney: summary.availableMoney,
        formattedAvailableMoney: formatCurrency(summary.availableMoney),
        allocatedFunds: summary.allocatedFunds,
        assetValue: summary.assetValue,
        netWorth: summary.netWorth,
        formattedNetWorth: formatCurrency(summary.netWorth),
        cycleIncome: summary.monthIncome,
        cycleExpense: summary.monthExpense
      };
    }

    case 'get_financial_overview':
    {
      const summary = await dashboardService.getSummary(userId);
      return {
        availableMoney: summary.availableMoney,
        formattedAvailableMoney: formatCurrency(summary.availableMoney),
        allocatedFunds: summary.allocatedFunds,
        formattedAllocatedFunds: formatCurrency(summary.allocatedFunds),
        assetValue: summary.assetValue,
        formattedAssetValue: formatCurrency(summary.assetValue),
        netWorth: summary.netWorth,
        formattedNetWorth: formatCurrency(summary.netWorth),
        cycleIncome: summary.monthIncome,
        formattedCycleIncome: formatCurrency(summary.monthIncome),
        cycleExpense: summary.monthExpense,
        formattedCycleExpense: formatCurrency(summary.monthExpense),
        savingRate: summary.monthIncome > 0 
          ? Math.round(((summary.monthIncome - summary.monthExpense) / summary.monthIncome) * 100) 
          : 0,
        activeCycle: summary.activeCycle,
        availableMoneyBreakdown: summary.availableMoneyBreakdown,
        allocatedFundsBreakdown: summary.allocatedFundsBreakdown,
        assetValueBreakdown: summary.assetValueBreakdown
      };
    }

    case 'get_active_salary_cycle':
    {
      const cycle = await salaryCycleService.getActiveCycle(userId);
      if (!cycle) return { message: 'No active cycle found.' };
      return {
        name: cycle.name,
        startDate: formatDateWIB(cycle.startDate),
        endDate: cycle.endDate ? formatDateWIB(cycle.endDate) : 'Masih aktif (sekarang)'
      };
    }

    case 'get_expense_by_category':
    {
      const charts = await dashboardService.getCharts(userId);
      return charts.expenseByCategory.map(c => ({
        ...c,
        formattedAmount: formatCurrency(c.totalAmount)
      }));
    }

    case 'search_goals':
    {
      // Simple fuzzy match on goal name (case‑insensitive includes)
      const allFundsGoals = await fundService.getFunds(userId);
      const goalQuery = args.name ? args.name.toLowerCase() : '';
      const limitGoals = args.limit || 5;
      const matchedGoals = allFundsGoals
        .filter(f => (f.type === 'GOAL' || f.type === 'EMERGENCY') && f.status !== 'ARCHIVED')
        .filter(f => f.name.toLowerCase().includes(goalQuery))
        .slice(0, limitGoals)
        .map(f => {
          const remaining = Math.max(0, f.targetAmount - f.currentAmount);
          const progress = f.targetAmount > 0 ? Math.round((f.currentAmount / f.targetAmount) * 100) : 0;
          const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
          let monthsActive = (Date.now() - new Date(f.createdAt).getTime()) / msPerMonth;
          if (monthsActive < 1) monthsActive = 1;
          const avgMonthly = Math.round(f.currentAmount / monthsActive);
          return {
            name: f.name,
            type: f.type,
            targetAmount: f.targetAmount,
            currentAmount: f.currentAmount,
            remainingAmount: remaining,
            progressPercent: progress,
            averageMonthlySaving: avgMonthly,
            formattedTarget: formatCurrency(f.targetAmount),
            formattedCurrent: formatCurrency(f.currentAmount),
            formattedRemaining: formatCurrency(remaining)
          };
        });
      return matchedGoals;
    }

    case 'forecast_goal_completion':
    {
      const allFundsFC = await fundService.getFunds(userId);
      const nameQuery = args.name ? args.name.toLowerCase() : '';
      const goal = allFundsFC
        .filter(f => (f.type === 'GOAL' || f.type === 'EMERGENCY') && f.status !== 'ARCHIVED')
        .find(g => g.name.toLowerCase().includes(nameQuery));
      if (!goal) {
        return { error: 'Goal not found' };
      }
      const msPerMonthFC = 1000 * 60 * 60 * 24 * 30.44;
      let monthsActiveFC = (Date.now() - new Date(goal.createdAt).getTime()) / msPerMonthFC;
      if (monthsActiveFC < 1) monthsActiveFC = 1;
      const avgSaving = Math.round(goal.currentAmount / monthsActiveFC);
      const remainingAmt = Math.max(0, goal.targetAmount - goal.currentAmount);
      let estMonths = null;
      if (remainingAmt === 0) {
        estMonths = 0;
      } else if (avgSaving > 0) {
        estMonths = Math.ceil(remainingAmt / avgSaving);
      }
      const confidence = avgSaving > 0 ? (monthsActiveFC >= 2 ? 'High' : 'Medium') : 'Low';
      return {
        goal: goal.name,
        currentAmount: formatCurrency(goal.currentAmount),
        targetAmount: formatCurrency(goal.targetAmount),
        remainingAmount: formatCurrency(remainingAmt),
        averageMonthlySaving: formatCurrency(avgSaving),
        estimatedMonthsToCompletion: estMonths,
        confidenceLevel: confidence,
        assumptions: `Mengasumsikan kamu terus menabung rata‑rata ${formatCurrency(avgSaving)} per bulan.`,
        explanation: `Data: sudah menabung ${formatCurrency(goal.currentAmount)} selama ${Math.round(monthsActiveFC)} bulan. Target ${formatCurrency(goal.targetAmount)}.`
      };
    }

    case 'get_recent_transactions':
    {
      const txs = await transactionService.getTransactions(userId, { limit: 5, page: 1 });
      return txs.transactions.map(t => {
        const baseCurrency = t.baseCurrency || 'IDR';
        const assetCode = t.assetCode || 'IDR';
        const isBase = assetCode === baseCurrency;
        const formattedAmount = isBase 
          ? `${baseCurrency} ${t.amount.toLocaleString('id-ID')}` 
          : `${t.amount} ${assetCode} (setara ${baseCurrency} ${Math.round(t.baseAmount || t.amount * (t.conversionRate || 1)).toLocaleString('id-ID')})`;

        return {
          type: t.type,
          amount: t.amount,
          assetCode: assetCode,
          baseAmount: t.baseAmount || t.amount * (t.conversionRate || 1),
          baseCurrency: baseCurrency,
          formattedAmount,
          category: t.categoryId ? t.categoryId.name : 'Uncategorized',
          account: t.accountId ? t.accountId.name : 'Unknown',
          date: formatDateWIB(t.transactionDate),
          note: t.note,
          adminFee: t.adminFee || 0,
          adminFeeCurrency: t.adminFeeCurrency || assetCode,
          adminFeeBaseAmount: t.adminFeeBaseAmount || 0,
          adminFeeAccount: t.adminFeeAccount || 'SOURCE'
        };
      });
    }

    case 'get_goals':
    {
      const fundsForGoals = await fundService.getFunds(userId);
      return fundsForGoals
        .filter(f => (f.type === 'GOAL' || f.type === 'EMERGENCY') && f.status !== 'ARCHIVED')
        .map(f => {
          const remainingAmount = Math.max(0, f.targetAmount - f.currentAmount);
          const progressPercent = f.targetAmount > 0 ? Math.min(100, Math.round((f.currentAmount / f.targetAmount) * 100)) : 0;
          return {
            name: f.name,
            type: f.type,
            status: f.status,
            targetAmount: f.targetAmount,
            currentAmount: f.currentAmount,
            remainingAmount,
            progressPercent,
            targetDate: f.targetDate ? formatDateWIB(f.targetDate) : null,
            formattedTarget: formatCurrency(f.targetAmount),
            formattedCurrent: formatCurrency(f.currentAmount)
          };
        });
    }

    case 'analyze_goal_progress':
    {
      const allFunds = await fundService.getFunds(userId);
      const activeGoals = allFunds.filter(f => (f.type === 'GOAL' || f.type === 'EMERGENCY') && f.status !== 'ARCHIVED');
      
      const analysis = activeGoals.map(f => {
        const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
        let monthsActive = (Date.now() - new Date(f.createdAt).getTime()) / msPerMonth;
        if (monthsActive < 1) monthsActive = 1;

        const averageMonthlySaving = Math.round(f.currentAmount / monthsActive);
        const remainingAmount = Math.max(0, f.targetAmount - f.currentAmount);
        
        let estimatedMonthsToCompletion = null;
        if (remainingAmount === 0) {
          estimatedMonthsToCompletion = 0;
        } else if (averageMonthlySaving > 0) {
          estimatedMonthsToCompletion = Math.ceil(remainingAmount / averageMonthlySaving);
        }

        const progressPercent = f.targetAmount > 0 ? Math.min(100, Math.round((f.currentAmount / f.targetAmount) * 100)) : 0;

        return {
          name: f.name,
          progressPercent,
          averageMonthlySaving,
          formattedAvgSaving: formatCurrency(averageMonthlySaving),
          estimatedMonthsToCompletion,
          estimatedCompletionInfo: estimatedMonthsToCompletion === null 
            ? "Belum bisa diestimasi (belum ada tabungan rata-rata)"
            : estimatedMonthsToCompletion === 0
            ? "Sudah tercapai! 🎉"
            : `Sekitar ${estimatedMonthsToCompletion} bulan lagi`
        };
      });

      // Sort by nearest completion (null goes last)
      analysis.sort((a, b) => {
        if (a.estimatedMonthsToCompletion === null) return 1;
        if (b.estimatedMonthsToCompletion === null) return -1;
        return a.estimatedMonthsToCompletion - b.estimatedMonthsToCompletion;
      });

      return {
        totalGoals: analysis.length,
        nearestGoal: analysis[0] || null,
        furthestGoal: analysis.filter(a => a.estimatedMonthsToCompletion !== null).pop() || null,
        details: analysis
      };
    }

    // === NEW TOOL IMPLEMENTATIONS ===

    case 'get_accounts':
    {
      const includeArchived = args.includeArchived ? 'true' : 'false';
      const accounts = await accountService.getAccounts(userId, includeArchived);
      return {
        totalAccounts: accounts.length,
        accounts: accounts.map(acc => ({
          name: acc.name,
          type: acc.type,
          assetClass: acc.assetClass,
          assetCode: acc.assetCode,
          unit: acc.unit,
          currentBalance: acc.currentBalance,
          formattedBalance: acc.assetCode === 'IDR' 
            ? formatCurrency(acc.currentBalance) 
            : `${acc.currentBalance} ${acc.unit || acc.assetCode}`,
          estimatedValueIDR: acc.estimatedValueIDR,
          formattedEstimatedIDR: formatCurrency(acc.estimatedValueIDR),
          isArchived: acc.isArchived || false
        }))
      };
    }

    case 'get_categories':
    {
      const categories = await categoryService.getCategories(userId);
      const incomeCategories = categories.filter(c => c.transactionType === 'INCOME');
      const expenseCategories = categories.filter(c => c.transactionType === 'EXPENSE');
      return {
        totalCategories: categories.length,
        incomeCategories: incomeCategories.map(c => ({ name: c.name, isDefault: c.isDefault })),
        expenseCategories: expenseCategories.map(c => ({ name: c.name, isDefault: c.isDefault }))
      };
    }

    case 'get_monthly_report':
    {
      const report = await reportService.getMonthlyReport(userId, args.year, args.month);
      return {
        period: report.period,
        summary: {
          totalIncome: report.summary.totalIncome,
          formattedIncome: formatCurrency(report.summary.totalIncome),
          totalExpense: report.summary.totalExpense,
          formattedExpense: formatCurrency(report.summary.totalExpense),
          netBalance: report.summary.netBalance,
          formattedNetBalance: formatCurrency(report.summary.netBalance),
          savingRate: report.summary.totalIncome > 0
            ? Math.round(((report.summary.totalIncome - report.summary.totalExpense) / report.summary.totalIncome) * 100)
            : 0
        },
        expenseByCategory: report.expenseByCategory.map(c => ({
          ...c,
          formattedAmount: formatCurrency(c.totalAmount || c.total)
        }))
      };
    }

    case 'get_yearly_report':
    {
      const report = await reportService.getYearlyReport(userId, args.year);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      return {
        year: report.year,
        summary: {
          totalIncome: report.summary.totalYearlyIncome,
          formattedIncome: formatCurrency(report.summary.totalYearlyIncome),
          totalExpense: report.summary.totalYearlyExpense,
          formattedExpense: formatCurrency(report.summary.totalYearlyExpense),
          netBalance: report.summary.netBalance,
          formattedNetBalance: formatCurrency(report.summary.netBalance),
          savingRate: report.summary.totalYearlyIncome > 0
            ? Math.round(((report.summary.totalYearlyIncome - report.summary.totalYearlyExpense) / report.summary.totalYearlyIncome) * 100)
            : 0
        },
        trends: report.trends.map(t => ({
          month: monthNames[t.month - 1],
          income: t.income,
          expense: t.expense,
          formattedIncome: formatCurrency(t.income),
          formattedExpense: formatCurrency(t.expense)
        }))
      };
    }

    case 'get_monthly_review':
    {
      const review = await dashboardService.getMonthlyReview(userId);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      return {
        period: 'Last 6 months',
        data: review.map(r => ({
          month: monthNames[r.month - 1],
          year: r.year,
          label: `${monthNames[r.month - 1]} ${r.year}`,
          income: r.income,
          expense: r.expense,
          formattedIncome: formatCurrency(r.income),
          formattedExpense: formatCurrency(r.expense),
          netBalance: r.income - r.expense,
          formattedNetBalance: formatCurrency(r.income - r.expense)
        }))
      };
    }

    case 'get_all_salary_cycles':
    {
      const cycles = await salaryCycleService.getAllCycles(userId);
      return {
        totalCycles: cycles.length,
        cycles: cycles.map(c => ({
          name: c.name,
          startDate: formatDateWIB(c.startDate),
          endDate: c.endDate ? formatDateWIB(c.endDate) : 'Masih aktif (sekarang)',
          isActive: !c.endDate
        }))
      };
    }

    case 'get_net_worth_breakdown':
    {
      const summary = await dashboardService.getSummary(userId);
      return {
        netWorth: summary.netWorth,
        formattedNetWorth: formatCurrency(summary.netWorth),
        components: {
          availableMoney: {
            total: summary.availableMoney,
            formatted: formatCurrency(summary.availableMoney),
            breakdown: summary.availableMoneyBreakdown.map(b => ({
              ...b,
              formattedAmount: formatCurrency(b.estimatedValueIDR || b.amount)
            }))
          },
          allocatedFunds: {
            total: summary.allocatedFunds,
            formatted: formatCurrency(summary.allocatedFunds),
            breakdown: summary.allocatedFundsBreakdown.map(b => ({
              ...b,
              formattedAmount: formatCurrency(b.amount)
            }))
          },
          assetValue: {
            total: summary.assetValue,
            formatted: formatCurrency(summary.assetValue),
            breakdown: summary.assetValueBreakdown.map(b => ({
              ...b,
              formattedAmount: formatCurrency(b.estimatedValueIDR || b.amount)
            }))
          }
        }
      };
    }

    case 'create_transaction':
    {
      const { accountName, type, amount, categoryName, transferAccountName, note, transactionDate, isPrimarySalary, adminFee, adminFeeAccount } = args;
      
      const account = await findAccountByName(userId, accountName);
      if (!account) {
        return { error: `Account "${accountName}" not found.` };
      }
      
      let categoryId = null;
      if (type === 'INCOME' || type === 'EXPENSE') {
        if (!categoryName) {
          return { error: `Category name is required for ${type} transactions.` };
        }
        const category = await findCategoryByName(userId, categoryName, type);
        if (!category) {
          return { error: `Category "${categoryName}" not found for type ${type}.` };
        }
        categoryId = category._id;
      }
      
      let transferAccountId = null;
      if (type === 'TRANSFER') {
        if (!transferAccountName) {
          return { error: `Transfer destination account name is required.` };
        }
        const transferAccount = await findAccountByName(userId, transferAccountName);
        if (!transferAccount) {
          return { error: `Transfer destination account "${transferAccountName}" not found.` };
        }
        transferAccountId = transferAccount._id;
      }
      
      const txDate = transactionDate ? new Date(transactionDate) : new Date();
      
      const newTx = await transactionService.createTransaction(userId, {
        accountId: account._id.toString(),
        type,
        amount,
        categoryId: categoryId ? categoryId.toString() : null,
        transferAccountId: transferAccountId ? transferAccountId.toString() : null,
        note: note || '',
        transactionDate: txDate,
        isPrimarySalary: isPrimarySalary || false,
        adminFee: adminFee || 0,
        adminFeeAccount: adminFeeAccount || 'SOURCE'
      });
      
      // Fetch populated details for cleaner response formatting
      const populatedTx = await Transaction.findById(newTx._id)
        .populate('accountId')
        .populate('categoryId')
        .populate('transferAccountId');
        
      return {
        success: true,
        message: `Transaksi ${type} berhasil dicatat!`,
        transaction: {
          id: populatedTx._id,
          type: populatedTx.type,
          amount: populatedTx.amount,
          formattedAmount: formatCurrency(populatedTx.amount),
          account: populatedTx.accountId.name,
          category: populatedTx.categoryId ? populatedTx.categoryId.name : null,
          transferAccount: populatedTx.transferAccountId ? populatedTx.transferAccountId.name : null,
          date: formatDateWIB(populatedTx.transactionDate),
          note: populatedTx.note
        }
      };
    }

    case 'allocate_to_goal':
    {
      const { goalName, amount, note } = args;
      const goal = await findGoalByName(userId, goalName);
      if (!goal) {
        return { error: `Goal "${goalName}" not found.` };
      }
      
      const result = await fundService.allocateFund(goal._id.toString(), userId, { amount, note });
      return {
        success: true,
        message: `Berhasil mengalokasikan ${formatCurrency(amount)} ke goal "${goal.name}".`,
        transaction: {
          id: result._id,
          type: result.type,
          amount: result.amount,
          formattedAmount: formatCurrency(result.amount),
          note: result.note
        }
      };
    }

    case 'withdraw_from_goal':
    {
      const { goalName, amount, note } = args;
      const goal = await findGoalByName(userId, goalName);
      if (!goal) {
        return { error: `Goal "${goalName}" not found.` };
      }
      
      const result = await fundService.withdrawFund(goal._id.toString(), userId, { amount, note });
      return {
        success: true,
        message: `Berhasil menarik ${formatCurrency(amount)} dari goal "${goal.name}".`,
        transaction: {
          id: result._id,
          type: result.type,
          amount: result.amount,
          formattedAmount: formatCurrency(result.amount),
          note: result.note
        }
      };
    }

    case 'transfer_between_goals':
    {
      const { sourceGoalName, destinationGoalName, amount, note } = args;
      const sourceGoal = await findGoalByName(userId, sourceGoalName);
      if (!sourceGoal) {
        return { error: `Source goal "${sourceGoalName}" not found.` };
      }
      const destinationGoal = await findGoalByName(userId, destinationGoalName);
      if (!destinationGoal) {
        return { error: `Destination goal "${destinationGoalName}" not found.` };
      }
      
      const result = await fundService.transferFund(userId, {
        sourceFundId: sourceGoal._id.toString(),
        destinationFundId: destinationGoal._id.toString(),
        amount,
        note
      });
      return {
        success: true,
        message: `Berhasil mentransfer ${formatCurrency(amount)} dari goal "${sourceGoal.name}" ke "${destinationGoal.name}".`,
        transaction: {
          id: result._id,
          type: result.type,
          amount: result.amount,
          formattedAmount: formatCurrency(result.amount),
          note: result.note
        }
      };
    }

    case 'get_fund_transaction_history':
    {
      const { goalName } = args;
      const goal = await findGoalByName(userId, goalName);
      if (!goal) {
        return { error: `Goal "${goalName}" not found.` };
      }
      
      const transactions = await fundService.getFundTransactions(goal._id.toString(), userId);
      return {
        goalName: goal.name,
        type: goal.type,
        targetAmount: goal.targetAmount,
        formattedTarget: formatCurrency(goal.targetAmount),
        transactions: transactions.map(t => ({
          type: t.type,
          amount: t.amount,
          formattedAmount: formatCurrency(t.amount),
          date: formatDateWIB(t.createdAt),
          note: t.note,
          transferGoalName: t.transferFundId ? t.transferFundId.name : null
        }))
      };
    }

    case 'get_salary_cycle_report':
    {
      const { cycleName } = args;
      const cycles = await salaryCycleService.getAllCycles(userId);
      let matchedCycle = null;
      if (cycleName) {
        matchedCycle = cycles.find(c => c.name.toLowerCase() === cycleName.toLowerCase());
        if (!matchedCycle) {
          matchedCycle = cycles.find(c => c.name.toLowerCase().includes(cycleName.toLowerCase()));
        }
      } else {
        matchedCycle = await salaryCycleService.getActiveCycle(userId);
      }
      
      if (!matchedCycle) {
        return { error: `Salary cycle "${cycleName || 'active'}" not found.` };
      }
      
      const startOfCycle = matchedCycle.startDate;
      const endOfCycle = matchedCycle.endDate || new Date(9999, 11, 31);
      
      const rates = await exchangeRateService.getExchangeRates();
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      const cycleStats = await dashboardRepository.getMonthIncomeExpenseByAsset(userObjectId, startOfCycle, endOfCycle);
      let cycleIncome = 0;
      let cycleExpense = 0;
      
      cycleStats.forEach(stat => {
        cycleIncome += exchangeRateService.calculateEstimatedIDR(stat._id, stat.monthIncome, rates);
        cycleExpense += exchangeRateService.calculateEstimatedIDR(stat._id, stat.monthExpense, rates);
      });
      
      const expenseByCategoryAsset = await dashboardRepository.getExpenseByCategoryByAsset(userObjectId, startOfCycle, endOfCycle);
      const grouped = {};
      expenseByCategoryAsset.forEach(item => {
        const key = item.categoryId ? item.categoryId.toString() : 'uncategorized';
        if (!grouped[key]) {
          grouped[key] = {
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            totalAmount: 0
          };
        }
        grouped[key].totalAmount += exchangeRateService.calculateEstimatedIDR(item.assetCode, item.totalAmount, rates);
      });
      
      const expenseByCategory = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
      
      return {
        cycleName: matchedCycle.name,
        startDate: formatDateWIB(matchedCycle.startDate),
        endDate: matchedCycle.endDate ? formatDateWIB(matchedCycle.endDate) : 'Masih aktif (sekarang)',
        isActive: !matchedCycle.endDate,
        summary: {
          totalIncome: cycleIncome,
          formattedIncome: formatCurrency(cycleIncome),
          totalExpense: cycleExpense,
          formattedExpense: formatCurrency(cycleExpense),
          netBalance: cycleIncome - cycleExpense,
          formattedNetBalance: formatCurrency(cycleIncome - cycleExpense),
          savingRate: cycleIncome > 0 ? Math.round(((cycleIncome - cycleExpense) / cycleIncome) * 100) : 0
        },
        expenseByCategory: expenseByCategory.map(c => ({
          ...c,
          formattedAmount: formatCurrency(c.totalAmount)
        }))
      };
    }

    case 'get_transaction_summary':
    {
      const { keyword, categoryName, startDate, endDate, type, accountName } = args;
      
      let query = { userId };
      if (type) query.type = type;
      if (startDate || endDate) {
        query.transactionDate = {};
        if (startDate) query.transactionDate.$gte = new Date(startDate);
        if (endDate) query.transactionDate.$lte = new Date(endDate);
      }
      
      if (accountName) {
        const account = await findAccountByName(userId, accountName);
        if (account) {
          query.accountId = account._id;
        } else {
          return { error: `Account "${accountName}" not found.` };
        }
      }
      
      if (categoryName) {
        const category = await findCategoryByName(userId, categoryName, type);
        if (category) {
          query.categoryId = category._id;
        } else {
          return { error: `Category "${categoryName}" not found.` };
        }
      }
      
      if (keyword) {
        const matchingCategories = await Category.find({
          $or: [ { userId }, { isDefault: true } ],
          name: { $regex: keyword, $options: 'i' }
        });
        const categoryIds = matchingCategories.map(c => c._id);
        query.$or = [
          { note: { $regex: keyword, $options: 'i' } },
          { categoryId: { $in: categoryIds } }
        ];
      }
      
      const transactions = await Transaction.find(query).populate('categoryId');
      const rates = await exchangeRateService.getExchangeRates();
      
      let totalAmountIDR = 0;
      let incomeAmountIDR = 0;
      let expenseAmountIDR = 0;
      const categorySummary = {};
      
      transactions.forEach(t => {
        const idrValue = exchangeRateService.calculateEstimatedIDR(t.assetCode, t.amount, rates);
        
        if (t.type === 'INCOME') {
          incomeAmountIDR += idrValue;
          totalAmountIDR += idrValue;
        } else if (t.type === 'EXPENSE') {
          expenseAmountIDR += idrValue;
          totalAmountIDR += idrValue;
        } else {
          totalAmountIDR += idrValue;
        }
        
        const catName = t.categoryId ? t.categoryId.name : 'Lain-lain / Uncategorized';
        if (!categorySummary[catName]) {
          categorySummary[catName] = 0;
        }
        categorySummary[catName] += idrValue;
      });
      
      const formattedCategoryBreakdown = Object.entries(categorySummary)
        .map(([name, amount]) => ({
          categoryName: name,
          totalAmount: amount,
          formattedAmount: formatCurrency(amount)
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);
        
      return {
        criteria: {
          keyword: keyword || null,
          categoryName: categoryName || null,
          accountName: accountName || null,
          type: type || null,
          startDate: startDate ? formatDateWIB(startDate) : null,
          endDate: endDate ? formatDateWIB(endDate) : null
        },
        totalCount: transactions.length,
        totalIncome: incomeAmountIDR,
        formattedIncome: formatCurrency(incomeAmountIDR),
        totalExpense: expenseAmountIDR,
        formattedExpense: formatCurrency(expenseAmountIDR),
        netBalance: incomeAmountIDR - expenseAmountIDR,
        formattedNetBalance: formatCurrency(incomeAmountIDR - expenseAmountIDR),
        categoryBreakdown: formattedCategoryBreakdown
      };
    }

    case 'create_category':
    {
      const { name, transactionType } = args;
      const category = await categoryService.createCategory(userId, { name, transactionType });
      return {
        success: true,
        message: `Kategori ${transactionType} "${category.name}" berhasil dibuat!`,
        category: {
          id: category._id,
          name: category.name,
          transactionType: category.transactionType
        }
      };
    }

    case 'update_category':
    {
      const { oldName, newName, transactionType } = args;
      const category = await findCategoryByName(userId, oldName);
      if (!category) {
        return { error: `Category "${oldName}" not found.` };
      }
      
      const result = await categoryService.updateCategory(category._id.toString(), userId, {
        name: newName,
        transactionType
      });
      
      return {
        success: true,
        message: `Kategori "${oldName}" berhasil diperbarui!`,
        category: {
          id: result._id,
          name: result.name,
          transactionType: result.transactionType
        }
      };
    }

    case 'delete_category':
    {
      const { name } = args;
      const category = await findCategoryByName(userId, name);
      if (!category) {
        return { error: `Category "${name}" not found.` };
      }
      
      await categoryService.deleteCategory(category._id.toString(), userId);
      return {
        success: true,
        message: `Kategori "${category.name}" berhasil dihapus!`
      };
    }

    case 'create_account':
    {
      const { name, type, assetClass, assetCode, unit, initialBalance } = args;
      const account = await accountService.createAccount(userId, {
        name,
        type,
        assetClass,
        assetCode,
        unit,
        initialBalance
      });
      return {
        success: true,
        message: `Akun "${account.name}" berhasil dibuat!`,
        account: {
          id: account._id,
          name: account.name,
          type: account.type,
          assetCode: account.assetCode,
          initialBalance: account.initialBalance
        }
      };
    }

    case 'update_account':
    {
      const { accountName, newName, type, isArchived, assetClass, assetCode, unit } = args;
      const account = await findAccountByName(userId, accountName);
      if (!account) {
        return { error: `Account "${accountName}" not found.` };
      }
      
      const result = await accountService.updateAccount(account._id.toString(), userId, {
        name: newName,
        type,
        isArchived,
        assetClass,
        assetCode,
        unit
      });
      
      return {
        success: true,
        message: `Akun "${account.name}" berhasil diperbarui!`,
        account: {
          id: result._id,
          name: result.name,
          type: result.type,
          isArchived: result.isArchived
        }
      };
    }

    case 'delete_account':
    {
      const { accountName } = args;
      const account = await findAccountByName(userId, accountName);
      if (!account) {
        return { error: `Account "${accountName}" not found.` };
      }
      
      await accountService.deleteAccount(account._id.toString(), userId);
      return {
        success: true,
        message: `Akun "${account.name}" beserta riwayat transaksinya berhasil dihapus!`
      };
    }

    case 'adjust_account_balance':
    {
      const { accountName, amount, note, transactionDate } = args;
      const account = await findAccountByName(userId, accountName);
      if (!account) {
        return { error: `Account "${accountName}" not found.` };
      }
      
      const result = await accountService.adjustBalance(account._id.toString(), userId, {
        amount,
        note,
        transactionDate
      });
      
      return {
        success: true,
        message: `Saldo akun "${account.name}" berhasil disesuaikan!`,
        transaction: {
          id: result._id,
          type: result.type,
          amount: result.amount,
          formattedAmount: formatCurrency(result.amount),
          date: formatDateWIB(result.transactionDate),
          note: result.note
        }
      };
    }

    case 'create_goal':
    {
      const { name, type, targetAmount, targetDate } = args;
      const goal = await fundService.createFund(userId, {
        name,
        type,
        targetAmount,
        targetDate
      });
      return {
        success: true,
        message: `Goal tabungan "${goal.name}" berhasil dibuat!`,
        goal: {
          id: goal._id,
          name: goal.name,
          type: goal.type,
          targetAmount: goal.targetAmount,
          formattedTarget: formatCurrency(goal.targetAmount)
        }
      };
    }

    case 'update_goal':
    {
      const { goalName, newName, type, targetAmount, targetDate, status } = args;
      const goal = await findGoalByName(userId, goalName);
      if (!goal) {
        return { error: `Goal "${goalName}" not found.` };
      }
      
      const result = await fundService.updateFund(goal._id.toString(), userId, {
        name: newName,
        type,
        targetAmount,
        targetDate,
        status
      });
      
      return {
        success: true,
        message: `Goal "${goal.name}" berhasil diperbarui!`,
        goal: {
          id: result._id,
          name: result.name,
          targetAmount: result.targetAmount,
          formattedTarget: formatCurrency(result.targetAmount),
          status: result.status
        }
      };
    }

    case 'update_transaction':
    {
      const { transactionId, accountName, type, amount, categoryName, transferAccountName, note, transactionDate, isPrimarySalary, adminFee, adminFeeAccount } = args;
      
      const updates = {};
      if (amount !== undefined) updates.amount = amount;
      if (note !== undefined) updates.note = note;
      if (transactionDate) updates.transactionDate = new Date(transactionDate);
      if (isPrimarySalary !== undefined) updates.isPrimarySalary = isPrimarySalary;
      if (adminFee !== undefined) updates.adminFee = adminFee;
      if (adminFeeAccount !== undefined) updates.adminFeeAccount = adminFeeAccount;
      if (type) updates.type = type;
      
      if (accountName) {
        const account = await findAccountByName(userId, accountName);
        if (!account) return { error: `Account "${accountName}" not found.` };
        updates.accountId = account._id.toString();
      }
      
      if (categoryName) {
        const category = await findCategoryByName(userId, categoryName, type);
        if (!category) return { error: `Category "${categoryName}" not found.` };
        updates.categoryId = category._id.toString();
      }
      
      if (transferAccountName) {
        const transferAccount = await findAccountByName(userId, transferAccountName);
        if (!transferAccount) return { error: `Transfer destination account "${transferAccountName}" not found.` };
        updates.transferAccountId = transferAccount._id.toString();
      }
      
      const result = await transactionService.updateTransaction(transactionId, userId, updates);
      
      const populatedTx = await Transaction.findById(result._id)
        .populate('accountId')
        .populate('categoryId')
        .populate('transferAccountId');
        
      return {
        success: true,
        message: `Transaksi berhasil diperbarui!`,
        transaction: {
          id: populatedTx._id,
          type: populatedTx.type,
          amount: populatedTx.amount,
          formattedAmount: formatCurrency(populatedTx.amount),
          account: populatedTx.accountId.name,
          category: populatedTx.categoryId ? populatedTx.categoryId.name : null,
          transferAccount: populatedTx.transferAccountId ? populatedTx.transferAccountId.name : null,
          date: formatDateWIB(populatedTx.transactionDate),
          note: populatedTx.note
        }
      };
    }

    case 'delete_transaction':
    {
      const { transactionId } = args;
      await transactionService.deleteTransaction(transactionId, userId);
      return {
        success: true,
        message: `Transaksi berhasil dihapus!`
      };
    }

    case 'get_user_settings':
    {
      const user = await User.findById(userId);
      if (!user) return { error: 'User not found' };
      return {
        username: user.username,
        name: user.name,
        autoAllocationPercentage: user.autoAllocationPercentage || 0
      };
    }

    case 'update_user_settings':
    {
      const { autoAllocationPercentage } = args;
      if (autoAllocationPercentage < 0 || autoAllocationPercentage > 100) {
        return { error: 'Persentase alokasi otomatis harus bernilai antara 0 hingga 100.' };
      }
      
      const user = await User.findById(userId);
      if (!user) return { error: 'User not found' };
      
      user.autoAllocationPercentage = autoAllocationPercentage;
      await user.save();
      
      return {
        success: true,
        message: `Pengaturan alokasi otomatis gaji berhasil diperbarui menjadi ${autoAllocationPercentage}%!`,
        settings: {
          autoAllocationPercentage: user.autoAllocationPercentage
        }
      };
    }

    case 'send_test_push_notification':
    {
      const { title, description, password } = args;
      const expectedPassword = process.env.DEVELOPER_PUSH_PASSWORD || 'Dearijik';
      if (!password || password !== expectedPassword) {
        return { success: false, error: 'Password pengembang tidak valid!' };
      }

      const user = await User.findById(userId);
      if (!user) return { error: 'User not found' };

      const subscriptions = user.pushSubscriptions || [];
      if (subscriptions.length === 0) {
        return {
          success: false,
          error: 'Kamu belum mengaktifkan Push Notification di perangkat ini. Aktifkan dulu di menu Profile / Settings!'
        };
      }

      const webpush = require('web-push');
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      if (!publicKey || !privateKey) {
        return { success: false, error: 'Kunci VAPID belum dikonfigurasi di server (.env).' };
      }

      webpush.setVapidDetails(
        'mailto:support@fintrack.com',
        publicKey,
        privateKey
      );

      let successCount = 0;
      let failCount = 0;
      let activeSubs = [...subscriptions];
      let isPruned = false;

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            },
            JSON.stringify({
              title: title || 'Test Notif',
              body: description || 'Ini adalah push notif uji coba'
            })
          );
          successCount++;
        } catch (err) {
          console.error(`[PushService Test] Failed:`, err.message);
          failCount++;
          if (err.statusCode === 410 || err.statusCode === 404) {
            activeSubs = activeSubs.filter(s => s.endpoint !== sub.endpoint);
            isPruned = true;
          }
        }
      }

      if (isPruned) {
        user.pushSubscriptions = activeSubs;
        await user.save();
      }

      if (successCount === 0) {
        return {
          success: false,
          error: 'Gagal mengirim push notification ke perangkat terdaftar. Pastikan izin notifikasi aktif.'
        };
      }

      return {
        success: true,
        message: `Berhasil mengirim test push notification ke ${successCount} perangkat terdaftar (Gagal: ${failCount}) tanpa batasan cooldown!`
      };
    }

    default:
      throw new Error(`Unknown tool: ${functionName}`);
  }
};


module.exports = {
  toolSchemas,
  executeTool
};
