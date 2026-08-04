# Portfolio Tracker w/ Covered Call Simulator

A small React + Express app for tracking a stock portfolio and generating income from it with covered calls.

## Backstory

This project started as a personal tool when I was laid off from my full-time job. Rather than let a brokerage account sit idle during the job search, I wanted a simple way to track my holdings and sell covered calls to generate income. This app lets me track my holdings, model covered calls before placing orders, and monitoring the covered call positions after purchase.

## Features

- **Portfolio** — Track tickers, share quantity, and cost basis. Current price, day change, and market value are pulled live from Yahoo Finance, with a one-click refresh for all holdings.
- **Simulate Covered Calls** — Pick a holding, an expiration, and a strike from the live option chain, and preview premium collected, breakeven, max profit, downside protection, and annualized return before placing a real trade. A refresh button re-pulls both stock and option prices so simulations don't go stale.
- **Actual Covered Calls** — Record real covered call positions you've opened (or closed/assigned/expired) against your portfolio and track their outcomes.

All data is kept in the browser's `localStorage` — there's no database or account system.

## Tech Stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS
- A small Express proxy server (`server/`) that wraps [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2) for stock quotes and option chains

## Getting Started

```bash
npm install
npm run dev:all
```

`dev:all` runs the Vite dev server and the Express quote/options proxy together. The proxy listens on port `4000` by default (see `server/.env.example`); Vite proxies `/api/*` requests to it.

To run them separately:

```bash
npm run dev         # Vite dev server
npm run dev:server   # Express API proxy
```

## Other Scripts

- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run lint` — run Oxlint

## Disclaimer

This tool is for personal portfolio tracking and educational modeling only. It is not financial advice, and market data comes from an unofficial Yahoo Finance client with no uptime or accuracy guarantees.
