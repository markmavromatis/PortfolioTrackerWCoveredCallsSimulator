import { daysBetween } from './format';

export interface CoveredCallMetrics {
  premiumCollected: number;
  cappedLimit: number;
  totalReturns: number;
  breakeven: number;
  maxProfit: number;
  maxProfitPercent: number;
  returnIfUnchanged: number;
  returnIfUnchangedPercent: number;
  downsideProtectionPercent: number;
  daysToExpiration: number;
  annualizedReturnPercent: number;
}

export function calculateCoveredCallMetrics(params: {
  costBasis: number;
  contracts: number;
  strikePrice: number;
  premium: number;
  openDate: string;
  expirationDate: string;
}): CoveredCallMetrics {
  const { costBasis, contracts, strikePrice, premium, openDate, expirationDate } = params;
  const shares = contracts * 100;
  const premiumCollected = premium * shares;
  const cappedLimit = strikePrice * shares;
  const totalReturns = premiumCollected + cappedLimit;
  const breakeven = costBasis - premium;
  const capitalAtRisk = costBasis * shares;

  const maxProfit = (strikePrice - costBasis) * shares + premiumCollected;
  const maxProfitPercent = capitalAtRisk !== 0 ? (maxProfit / capitalAtRisk) * 100 : 0;

  const returnIfUnchanged = premiumCollected;
  const returnIfUnchangedPercent = capitalAtRisk !== 0 ? (premiumCollected / capitalAtRisk) * 100 : 0;

  const downsideProtectionPercent = costBasis !== 0 ? (premium / costBasis) * 100 : 0;

  const daysToExpiration = Math.max(daysBetween(openDate, expirationDate), 0);
  const annualizedReturnPercent =
    daysToExpiration > 0 ? returnIfUnchangedPercent * (365 / daysToExpiration) : 0;

  return {
    premiumCollected,
    cappedLimit,
    totalReturns,
    breakeven,
    maxProfit,
    maxProfitPercent,
    returnIfUnchanged,
    returnIfUnchangedPercent,
    downsideProtectionPercent,
    daysToExpiration,
    annualizedReturnPercent,
  };
}
