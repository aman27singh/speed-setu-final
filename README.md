# 🚛 Speed Setu — Enterprise Logistics & Supply Chain Management System

A modern, high-performance, full-stack enterprise logistics solution for **Speed Setu**. Speed Setu combines a customer-facing public marketing portal, a feature-rich React Single Page Application (SPA) admin dashboard with Role-Based Access Control (RBAC), and a scalable Node.js + Express + MongoDB Atlas REST API server.

---

## 📋 Table of Contents
- [Project Overview](#-project-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
  - [1. Public Marketing Portal & Customer Tracking](#1-public-marketing-portal--customer-tracking)
  - [2. Multi-Role Admin & Operations Portal (RBAC)](#2-multi-role-admin--operations-portal-rbac)
  - [3. AI Document Extraction (OCR)](#3-ai-document-extraction-ocr)
  - [4. Shipment & Excel Bulk Import Management](#4-shipment--excel-bulk-import-management)
  - [5. Fleet, Transporter & Trip Dispatch Management](#5-fleet-transporter--trip-dispatch-management)
  - [6. Proof of Delivery (POD) Management](#6-proof-of-delivery-pod-management)
  - [7. Commercial & Financial Suite](#7-commercial--financial-suite)
  - [8. Executive Financial Analytics & MIS Reports](#8-executive-financial-analytics--mis-reports)
  - [9. Database Resilience & Health Monitoring](#9-database-resilience--health-monitoring)
- [Tech Stack](#-tech-stack)
- [Directory & File Structure](#-directory--file-structure)
- [Getting Started & Local Setup](#-getting-started--local-setup)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend API Setup](#2-backend-api-setup)
  - [3. Seed Database & Role Accounts](#3-seed-database--role-accounts)
  - [4. Admin Dashboard Setup](#4-admin-dashboard-setup)
  - [5. Public Landing Page Setup](#5-public-landing-page-setup)
- [🔑 Pre-Configured Demo Accounts](#-pre-configured-demo-accounts)
- [📡 API Endpoints Reference](#-api-endpoints-reference)
- [⚙️ Environment Variables](#️-environment-variables)
- [📦 Production Deployment](#-production-deployment)
- [📄 License & Maintenance](#-license--maintenance)

---

## 📋 Project Overview

**Speed Setu** is an end-to-end logistics operating system designed to handle full consignment lifecycles, complex multi-stop trip dispatching, fleet utilization, automated proof of delivery verification, freight invoicing, and executive profitability reporting.

The system bridges customer interaction with backend operations by providing:
1. **Public Web Portal**: For public service quotes, company details, contact channels, and guest shipment tracking without authentication.
2. **Operations & Admin Portal**: Tailored for Super Admins, Operations Managers, and Drivers with role-specific navigation, interactive charts, and real-time status management.
3. **Logistics Backend Server**: Express-based REST API connected to MongoDB Atlas Cloud, equipped with DB health monitoring, validation middleware, and automated seed tools.

---

## 🏗️ System Architecture

```
                               ┌────────────────────────────────────────┐
                               │       Speed Setu Ecosystem             │
                               └──────────────────┬─────────────────────┘
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         │                                        │                                        │
┌────────▼────────────────┐           ┌───────────▼────────────┐              ┌────────────▼───────────┐
│  Public Customer Site   │           │ React Admin Dashboard  │              │ Node.js / Express API  │
│  (HTML5, CSS3, JS)      │           │ (React 18, Vite, RBAC) │              │ (REST Backend Server)  │
│                         │           │                        │              │                        │
│  - Services Overview    │           │ - Executive Dashboard  │              │ - /api/auth            │
│  - Instant Freight Quote│           │ - Document Extraction  │              │ - /api/shipments       │
│  - Public Tracker       │           │ - Fleet & Trip Dispatch│              │ - /api/trips           │
│  - Contact & Booking    │           │ - Billing & Accounting │              │ - /api/reports         │
└─────────────────────────┘           └───────────┬────────────┘              └────────────┬───────────┘
                                                  │                                        │
                                                  └──────────────────┬─────────────────────┘
                                                                     │
                                                        ┌────────────▼───────────┐
                                                        │  MongoDB Atlas Cloud   │
                                                        │     (Database)         │
                                                        └────────────────────────┘
```

---

## ✨ Key Features

### 1. Public Marketing Portal & Customer Tracking
- **Conversion-Focused Landing Site**: Highlights company metrics, core services (Full Truckload, LTL Express, Cold Chain, Warehousing), and core values.
- **Interactive Freight Quote Request**: Client input calculator for weight, dimensions, origin, and destination.
- **Public Customer Tracking (`/track`)**: Allows end clients to track shipment status, timeline milestones, and delivery estimates using Consignment Note (CN) numbers without logging in.

### 2. Multi-Role Admin & Operations Portal (RBAC)
- **Super Admin**: Complete administrative control over executive reporting, MIS analytics, settings, financial profit margins, user role management, billing, and system configurations.
- **Operations Admin**: Fleet operations management, shipment booking, trip dispatching, quote generation, invoice processing, and POD review.
- **Driver**: Clean, mobile-first view restricted to assigned trips, trip milestone updates (Dispatch, In Transit, Delivered), and quick POD image uploads.

### 3. AI Document Extraction (OCR)
- Automatic scanning and extraction of shipping documents, Consignment Notes (CN), LRs, Invoices, and E-Way Bills.
- Side-by-side verification interface: Compare uploaded document visuals with extracted fields, confidence scores, and raw data.
- Direct conversion of extracted data into new official shipment records or updates to existing records with 1 click.

### 4. Shipment & Excel Bulk Import Management
- End-to-end shipment lifecycle states: `Booked`, `In Transit`, `Out for Delivery`, `Delivered`, `Cancelled`.
- **Bulk Excel/CSV Import (`.xlsx`)**: Import hundreds of shipments simultaneously with column mapping, status validation, and error feedback.
- Comprehensive shipment detail view with consignor/consignee details, invoice value, GSTINs, package count, weight, e-way bills, and linked POD documents.

### 5. Fleet, Transporter & Trip Dispatch Management
- Vendor & Transporter registry with partner performance tracking.
- Fleet vehicle records including registration number, vehicle type, weight capacity, insurance details, and fitness expiry alerts.
- Driver database with license numbers, phone contacts, assignment status, and branch tagging.
- Trip creation linking vehicle, driver, transporter, and multiple shipments into a single dispatch unit.

### 6. Proof of Delivery (POD) Management
- Dedicated POD management workspace for pending and verified PODs.
- High-resolution POD image preview, document verification, and status syncing with shipment records.

### 7. Commercial & Financial Suite
- **Quotation Generator**: Create formal quotes, apply line items and taxes, handle revision versions (`/new-version`), and track quotation acceptance.
- **Consolidated Billing & Invoices**: Generate GST-compliant invoices across multiple shipments, manage invoice statuses, and review line items before sending.
- **Receivables & Payments**: Record incoming payments, track partial vs. full payments, and view outstanding client balances.
- **Expenses & Payables**: Log trip-wise operational costs (fuel, tolls, driver allowance, maintenance) and manage vendor payouts.

### 8. Executive Financial Analytics & MIS Reports
- **Shipment Profitability**: Net profit and margin breakdown per shipment.
- **Trip Profitability**: Vehicle operating expense vs. freight revenue analysis.
- **Customer Profitability**: Revenue contribution and margin by client account.
- **Route Analysis**: Performance, transit times, and profitability across logistics corridors.
- **Monthly MIS Reports**: High-level executive summaries with exportable analytics.

### 9. Database Resilience & Health Monitoring
- Active MongoDB connection monitor (`/api/health`).
- Frontend status notifications notifying users if database connectivity drops or recovers.

---

## 🛠️ Tech Stack

### Frontend Applications
- **Admin Dashboard**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts, React Router v6, SheetJS (XLSX).
- **Public Customer Portal**: HTML5, Vanilla CSS3 (Custom Variables & Modern Layouts), ES6 JavaScript.

### Backend API Server
- **Runtime & Framework**: Node.js (v18+), Express.js.
- **Database & ORM**: MongoDB Atlas Cloud, Mongoose ORM.
- **Security & Utilities**: CORS, Dotenv, JWT Authentication.

---

## 📁 Directory & File Structure

```
speed-setu-final-main/
├── README.md                      # Complete Project Documentation
├── render.yaml                    # Production Render Deployment Spec
├── index.html                     # Public Customer Portal Landing Page
├── 404.html                       # SPA Fallback for GitHub Pages
├── CNAME                          # Custom Domain Setup
├── css/                           # Styling for Public Site
│   ├── styles.css                 # Global CSS variables & layout utilities
│   ├── home.css                   # Home page hero & feature styles
│   ├── services.css               # Logistics service cards
│   ├── about.css                  # Company overview & team styles
│   ├── tracking.css               # Public shipment tracker styles
│   ├── quote.css                  # Freight quote calculator styles
│   └── contact.css                # Contact form styles
├── js/                            # JavaScript for Public Site
│   ├── main.js                    # Global navigation & form interactions
│   ├── home.js                    # Home page sliders & scroll effects
│   └── tracking.js                # Public tracking logic
├── pages/                         # Public Site Static Subpages
│   ├── services.html              # Service details page
│   ├── about.html                 # About company page
│   ├── tracking.html              # Shipment tracking page
│   ├── quote.html                 # Freight quote form page
│   └── contact.html               # Contact us page
├── assets/                        # Public images, icons, and logos
│
├── admin/                         # React Admin Dashboard (SPA)
│   ├── package.json               # Admin frontend dependencies
│   ├── vite.config.js             # Vite build & server configuration
│   ├── tailwind.config.js         # Tailwind styling theme setup
│   ├── prebuild.js                # Build script restoring Vite dev index
│   ├── postbuild.js               # Post-build script syncing assets to admin/
│   └── src/
│       ├── App.jsx                # Main Application Routes & RBAC Guards
│       ├── main.jsx               # Entry point
│       ├── index.css              # Tailwind base imports
│       ├── components/            # Reusable UI components
│       │   ├── common/            # SearchBar, LoadingState, Modals
│       │   ├── layout/            # AdminLayout, Header, Sidebar
│       │   ├── shipment/          # Shipment list, BulkShipmentImportModal
│       │   ├── trip/              # Trip forms & timeline components
│       │   ├── billing/           # Invoice tables & billing review
│       │   ├── document/          # OCR extraction review components
│       │   └── pod/               # POD document view & upload components
│       ├── context/               # AuthContext (JWT & RBAC) & SearchContext
│       ├── pages/                 # 40+ Admin Dashboard Page Components
│       ├── services/              # API Client Adapters & Services
│       └── utils/                 # Validation & formatting helpers
│
└── server/                        # Express + MongoDB API Server
    ├── package.json               # Backend dependencies & scripts
    ├── index.js                   # Express server entry point & health check
    ├── .env.example               # Environment variables template
    ├── create_admin.js            # Script to seed default Super Admin
    ├── create_roles.js            # Script to seed all 3 RBAC role accounts
    ├── clear_db.js                # Utility script to clean DB collections
    ├── config/
    │   └── db.js                  # Mongoose MongoDB Atlas connection module
    ├── models/                    # Mongoose Data Schemas
    │   ├── User.js                # System users & RBAC roles
    │   ├── Company.js             # Client accounts & GST details
    │   ├── Shipment.js            # Core shipment records
    │   ├── Trip.js                # Vehicle & driver trip dispatches
    │   ├── Vehicle.js             # Fleet vehicle database
    │   ├── Driver.js              # Fleet driver database
    │   ├── Transporter.js         # Partner vendor database
    │   ├── Quotation.js           # Freight rate quotations
    │   ├── Invoice.js             # Billing invoices
    │   ├── Payment.js             # Customer payment logs
    │   ├── Expense.js             # Operational trip expenses
    │   ├── Payable.js             # Vendor payouts
    │   └── Counter.js             # Auto-incrementing sequence counters
    └── routes/                    # Express REST API Route Handlers
        ├── auth.js                # Authentication & login endpoint
        ├── users.js               # User management APIs
        ├── companies.js           # Client company endpoints
        ├── shipments.js           # Shipment CRUD & status updates
        ├── trips.js               # Trip management APIs
        ├── vehicles.js            # Vehicle endpoints
        ├── drivers.js             # Driver endpoints
        ├── transporters.js        # Transporter endpoints
        ├── quotations.js         # Quotation APIs
        ├── invoices.js            # Invoicing endpoints
        ├── payments.js            # Payment endpoints
        ├── expenses.js            # Expense endpoints
        ├── payables.js            # Payable endpoints
        └── reports.js             # Profitability & MIS reporting endpoints
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
Make sure you have the following installed on your development machine:
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **MongoDB Atlas Account** (or local MongoDB instance)
- **Git**

---

### 1. Clone Repository
```bash
git clone https://github.com/aman27singh/speed-setu-final.git
cd speed-setu-final-main
```

---

### 2. Backend API Setup

Navigate to the `server/` directory and install dependencies:
```bash
cd server
npm install
```

Create a `.env` file in `server/` based on `.env.example`:
```env
PORT=5050
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/speed_setu_db?retryWrites=true&w=majority
```

Start the Express backend server:
```bash
# Production / standard mode
npm start

# Development mode (auto-reload on changes)
npm run dev
```
The server will run at: `http://localhost:5050`

---

### 3. Seed Database & Role Accounts

To create the initial Super Admin and demo accounts for testing all 3 RBAC roles:
```bash
cd server
node create_roles.js
```

---

### 4. Admin Dashboard Setup

In a new terminal window, navigate to the `admin/` directory and install dependencies:
```bash
cd admin
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The admin dashboard will run at: `http://localhost:5173` (or the port allocated by Vite).

To build the Admin Single Page Application for production:
```bash
npm run build
```

---

### 5. Public Landing Page Setup

The public landing website consists of static HTML/CSS/JS. You can serve it using any simple local server:
```bash
# Using Python
python3 -m http.server 8000

# Using Node http-server
npx http-server -p 8000
```
Open `http://localhost:8000` in your browser.

---

## 🔑 Pre-Configured Demo Accounts

After running `node create_roles.js`, you can log into the Admin Dashboard (`http://localhost:5173/admin/login`) with any of the following pre-configured role accounts:

| Role | Username | Email | Password | Allowed Access Modules |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `Aman` | `aman@speedsetu.com` | `Aman@1234` | Full access across all modules, Financial Reports, MIS Analytics, Settings, Billing, and User Management. |
| **Operations Admin** | `OperationsAdmin` | `admin@speedsetu.com` | `Admin@1234` | Operations, Shipments, Document OCR, Fleet, Drivers, Transporters, PODs, Quotations, and Billing. |
| **Driver** | `RajeshDriver` | `driver@speedsetu.com` | `Driver@1234` | Mobile-optimized Driver interface, Assigned Trips view, Trip milestone updates, and POD uploads. |

---

## 📡 API Endpoints Reference

The Express backend provides RESTful JSON endpoints under `/api`:

### System & Auth
- `GET /api/health` — Returns backend health & MongoDB Atlas cloud connectivity status.
- `POST /api/auth/login` — User authentication returning JWT token & user profile.

### Operations & Fleet Management
- `GET /api/shipments` — Fetch shipments with status filtering & search.
- `POST /api/shipments` — Book a new shipment.
- `GET /api/shipments/:id` — Get shipment details by ID or Consignment Note number.
- `PUT /api/shipments/:id` — Update shipment details and milestone status.
- `GET /api/trips` — Fetch dispatch trips list.
- `POST /api/trips` — Dispatch a new trip (vehicle, driver, & shipment link).
- `PUT /api/trips/:id` — Update trip status (Dispatched, In Transit, Completed).
- `GET /api/vehicles` — Get fleet vehicle list.
- `GET /api/drivers` — Get registered driver list.
- `GET /api/transporters` — Get vendor transporters list.

### Commercial & Billing
- `GET /api/companies` — Get customer client accounts.
- `GET /api/quotations` — Fetch quotations list.
- `POST /api/quotations` — Generate new quotation.
- `GET /api/invoices` — Fetch customer invoices.
- `POST /api/invoices` — Create freight billing invoice.
- `GET /api/payments` — Fetch customer payment logs.
- `GET /api/expenses` — Fetch trip operational cost logs.
- `GET /api/payables` — Fetch vendor payables.

### Executive Reporting
- `GET /api/reports/profitability` — Fetch shipment profit breakdown.
- `GET /api/reports/trip-profitability` — Fetch trip-level margin metrics.
- `GET /api/reports/customer-profitability` — Fetch client account margin performance.
- `GET /api/reports/monthly-mis` — Fetch monthly executive MIS statistics.

---

## ⚙️ Environment Variables

### Backend (`server/.env`)
| Key | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5050` |
| `MONGO_URI` | MongoDB Atlas Cloud connection string | `mongodb+srv://<user>:<pass>@cluster0.mongodb.net/speed_setu_db` |

### Admin Frontend (`admin/.env`)
| Key | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base API URL for backend calls | `http://localhost:5050/api` |

---

## 📦 Production Deployment

### Backend Deployment (Render)
The repository includes a ready-to-use `render.yaml` configuration file for deploying the server on [Render](https://render.com):
1. Connect your repository to Render.
2. Select **New Web Service** and select `render.yaml`.
3. Set the `MONGO_URI` environment variable in the Render dashboard.

### Frontend Deployment (Vercel / Netlify / Static Host)
1. Build the admin dashboard:
   ```bash
   cd admin
   npm run build
   ```
2. The output in `admin/dist` and root static files can be deployed directly to Netlify, Vercel, or AWS S3 + CloudFront.

---

## 📄 License & Maintenance

This software ecosystem is built for **Speed Setu**. All rights reserved.

For technical assistance or system customisation, please contact the development team.
