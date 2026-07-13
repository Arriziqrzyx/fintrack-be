const axios = require('axios');
const ExchangeRate = require('../models/ExchangeRate');

// We use IDR as the ultimate base for all calculations in the app,
// but external APIs often use USD as base. We'll fetch rates against IDR.
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const fetchLiveRates = async () => {
  const rates = {};

  // 1. Fetch Crypto & Gold from CoinGecko
  try {
    const cgResponse = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,pax-gold&vs_currencies=idr'
    );
    
    if (cgResponse.data) {
      if (cgResponse.data.bitcoin?.idr) rates.BTC = cgResponse.data.bitcoin.idr;
      if (cgResponse.data.ethereum?.idr) rates.ETH = cgResponse.data.ethereum.idr;
      if (cgResponse.data.tether?.idr) rates.USDT = cgResponse.data.tether.idr;
      if (cgResponse.data['pax-gold']?.idr) rates.XAU_TROY_OUNCE = cgResponse.data['pax-gold'].idr;
    }
  } catch (error) {
    console.error('Error fetching crypto rates from CoinGecko:', error.message);
  }

  // 2. Fetch Fiat from Frankfurter
  try {
    const fiatResponse = await axios.get('https://api.frankfurter.app/latest?from=USD&to=IDR,EUR,SGD');
    
    if (fiatResponse.data && fiatResponse.data.rates) {
      const usdToIdr = fiatResponse.data.rates.IDR;
      rates.USD = usdToIdr;
      
      if (fiatResponse.data.rates.EUR) {
        rates.EUR = usdToIdr / fiatResponse.data.rates.EUR;
      }
      
      if (fiatResponse.data.rates.SGD) {
        rates.SGD = usdToIdr / fiatResponse.data.rates.SGD;
      }
    }
  } catch (error) {
    console.error('Error fetching fiat rates from Frankfurter:', error.message);
  }

  // Base IDR is always 1
  rates.IDR = 1;

  return rates;
};

const getExchangeRates = async () => {
  let record = await ExchangeRate.findOne({ baseCurrency: 'IDR' });

  // If no record exists or it's older than CACHE_TTL, fetch new rates
  if (!record || (Date.now() - record.lastUpdated.getTime() > CACHE_TTL)) {
    const liveRates = await fetchLiveRates();
    
    // Fallback to old rates if fetch fails partially
    const finalRates = { ...(record ? Object.fromEntries(record.rates) : {}), ...liveRates };

    if (!record) {
      record = new ExchangeRate({
        baseCurrency: 'IDR',
        rates: finalRates,
        lastUpdated: new Date()
      });
    } else {
      record.rates = finalRates;
      record.lastUpdated = new Date();
    }

    await record.save();
  }

  return Object.fromEntries(record.rates);
};

const calculateEstimatedIDR = (assetCode, balance, rates, unit = null) => {
  if (!balance) return 0;
  if (assetCode === 'IDR') return balance;

  const rate = rates[assetCode];
  
  if (['XAU', 'ANTAM', 'UBS'].includes(assetCode) && unit === 'GRAM') {
    const troyOunceRate = rates['XAU_TROY_OUNCE'];
    if (troyOunceRate) {
      // 1 Troy Ounce = 31.1034768 grams
      return balance * (troyOunceRate / 31.1034768);
    }
    return 0;
  }

  if (rate) {
    return balance * rate;
  }

  return 0; // Unknown asset or missing rate
};

module.exports = {
  getExchangeRates,
  calculateEstimatedIDR
};
