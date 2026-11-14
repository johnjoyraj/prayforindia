# Daily Prayer Book for India | 31-Day Intercessory Guide

A comprehensive, trilingual (English, Hindi, Malayalam) 31-day Christian intercessory prayer guide for the nation of India, its 28 states, 8 Union Territories, national leadership, societal challenges, and the Church across India. Grounded in **1 Timothy 2:1–2**.

---

## 🌐 Live Deployments

- **Netlify**: [https://prayforindia.netlify.app/](https://prayforindia.netlify.app/)
- **GitHub Pages**: [https://johnjoyraj.github.io/prayforindia/](https://johnjoyraj.github.io/prayforindia/)
- **Firebase Realtime Database**: `https://adonaibroadcast-11095.firebaseio.com/prayforindia`

---

## 📁 Project Architecture

```
prayforindia/
├── index.html              # Main 31-Day Intercessory Guide & Public Prayer Wall (English default)
├── login.html              # Intercessor Portal (Registration, Cloud Login, Profile, Prayer Streak)
├── admin.html              # Admin Moderation Portal (Live Firebase Review, Urgent Toggle, Delete, Audit)
├── prayer-sync.js          # Core Firebase Realtime Database Client, BroadcastChannel & Offline Sync
├── prayers_seed.json       # Seed dataset for community prayer requests
├── favicon.ico             # Ministry application icon
├── server.py               # Local Python REST server & static test runner (port 5174)
├── OPEN_PRAY_FOR_INDIA.bat # One-click Windows desktop launcher
└── README.md               # Documentation
```

---

## 🚀 Portals & Access

| Portal | URL | Default Language | Key Features |
|---|---|---|---|
| **Main Prayer Guide** | `index.html` | English (`EN`) | 31-Day Guide, Demographics, Cabinet Directory, Public Prayer Wall, Scripture |
| **Intercessor Portal** | `login.html` | English (`EN`) | Firebase cloud registration, login, prayer streak, commitment tracking, online password update |
| **Admin Portal** | `admin.html` | English (`EN`) | Firebase admin login, lockout protection, moderation, urgent flags, answered marks, delete, audit logs |

---

## 🔒 Master Admin Credentials

- **Username**: `admin`
- **Password**: `IndiaPrayer@2026`
- **Brute-Force Protection**: 5 failed login attempts trigger an automated 5-minute lockout (tracked in Firebase and local session).

---

## ⚡ Trilingual Engine

- **Default Language**: Strictly English across all portals and forms.
- **Language Switcher**: Instant switching between **English (`EN`)**, **Hindi (`हिन्दी`)**, **Malayalam (`മലയാളം`)**, and **Parallel (`EN + हि + മല`)**.
- **Real-Time Dynamic Update**: All headings, descriptions, tables, filters, alerts, placeholders, and buttons dynamically translate without page reload.
