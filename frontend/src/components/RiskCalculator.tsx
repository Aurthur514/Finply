import React, { useEffect, useMemo, useState } from 'react';

interface RiskCalculatorProps {
  accountBalance: number;
  marketPrice?: number;
}

const RiskCalculator: React.FC<RiskCalculatorProps> = ({ accountBalance, marketPrice = 100 }) => {
  const [riskPercentage, setRiskPercentage] = useState(1);
  const [entryPrice, setEntryPrice] = useState(marketPrice);
  const [stopLoss, setStopLoss] = useState(Math.max(1, Number((marketPrice * 0.03).toFixed(2))));

  useEffect(() => {
    setEntryPrice(marketPrice);
    setStopLoss(Math.max(1, Number((marketPrice * 0.97).toFixed(2))));
  }, [marketPrice]);

  const result = useMemo(() => {
    const riskAmount = accountBalance * (riskPercentage / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);
    if (riskAmount <= 0 || stopDistance <= 0) {
      return null;
    }

    const positionSize = Math.floor(riskAmount / stopDistance);
    const totalExposure = positionSize * entryPrice;
    return {
      positionSize,
      riskAmount,
      stopDistance,
      totalExposure,
    };
  }, [accountBalance, entryPrice, riskPercentage, stopLoss]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Position Size Calculator</h3>
        <p className="text-sm text-slate-500">Estimate a recommended size from account balance, risk, and stop loss.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Account Balance
          <input
            type="number"
            value={accountBalance}
            readOnly
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-500"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Risk %
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={riskPercentage}
            onChange={(event) => setRiskPercentage(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Entry Price
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={entryPrice}
            onChange={(event) => setEntryPrice(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Stop Loss
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={stopLoss}
          onChange={(event) => setStopLoss(Number(event.target.value))}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
        />
      </label>

      {result ? (
        <div className="mt-5 rounded-2xl bg-amber-50 p-5">
          <div className="text-sm font-medium text-amber-900">Recommended position size</div>
          <div className="mt-2 text-3xl font-semibold text-amber-950">{result.positionSize} units</div>
          <div className="mt-3 grid gap-2 text-sm text-amber-900 md:grid-cols-3">
            <div>Risk amount: ${result.riskAmount.toFixed(2)}</div>
            <div>Stop distance: ${result.stopDistance.toFixed(2)}</div>
            <div>Exposure: ${result.totalExposure.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Enter a valid stop loss below or above entry to calculate size.</div>
      )}
    </div>
  );
};

export default RiskCalculator;
