# 🍽️ UniBite

**Για φοιτητές, από φοιτητές** — *For students, by students.*

UniBite is a campus food-sharing web app. Students who cook too much can share their
extra portions; hungry students nearby can reserve a portion, pick it up, and rate it.
No money changes hands — the platform runs on a simple **credit (point) economy** that
keeps the community balanced: you earn points by sharing food and spend them when you take some.

> Built as a university project for the Web Development course (6th semester, University of Patras).

---

## ✨ Features

- **Two roles in one account** — every user can be both a *cook* (share food) and a *consumer* (request food).
- **Credit economy** — new users start with 5 credits. Picking up food costs 1 credit (and gives +1 to the cook). No-shows and not-rating get penalized so the system stays fair.
- **Listings (cook dashboard)** — create/edit/delete meal listings with title, photo, notes, allergens, number of portions, pickup location & time.
- **Feed (consumer view)** — browse active listings from the last 48 hours, see them on a map, and request a portion.
- **Requests & reservations** — cooks approve/reject requests and mark them as `picked_up` or `no_show`; portions are reserved/released automatically.
- **Ratings** — after pickup, consumers rate the meal 1–5. A rating ≥ 4 rewards the cook with a bonus credit.
- **Maps & geocoding** — pickup locations via [Leaflet](https://leafletjs.com/) + OpenStreetMap [Nominatim](https://nominatim.org/) search and GPS auto-detect.
- **Photo upload with moderation** — photos are taken/picked on mobile or desktop, compressed client-side, and screened with **NSFWJS + TensorFlow.js** before upload. Images are stored as files under `public/uploads/`.
- **Leaderboard & stats** — public leaderboard of top cooks and best-rated meals.
- **Admin portal** — admins get a dashboard with monthly stats, full listing management (including soft-delete), and a feed of recent requests.
- **Automated penalties** — a background scheduler deducts a credit from anyone who picked up food but didn't rate it within 48 hours.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, [Express 5](https://expressjs.com/) |
| Database | MySQL (via [`mysql2`](https://github.com/sidorares/node-mysql2)) |
| Auth | [`bcrypt`](https://github.com/kelektiv/node.bcrypt.js) password hashing |
| Config | [`dotenv`](https://github.com/motdotla/dotenv), [`cors`](https://github.com/expressjs/cors) |
| Frontend | Vanilla HTML / CSS / JavaScript (no framework) |
| Maps | Leaflet + OpenStreetMap Nominatim |
| Image moderation | NSFWJS + TensorFlow.js (client-side) |

The frontend is plain static files served directly by Express from the `public/` folder.

---

## 📁 Project Structure

```
unibite-app/
├── server.js                 # Express entry point — middleware, route mounting, server start
├── penaltyScheduler.js       # Hourly job: penalizes pickups left un-rated for 48h+
├── config/
│   └── db.js                 # MySQL connection pool (reads env vars)
├── routes/                   # Express routers (one per resource)
│   ├── authRoutes.js
│   ├── listingRoutes.js
│   ├── requestRoutes.js
│   ├── adminRoutes.js
│   └── statsRoutes.js
├── controllers/              # Request handlers / business logic
│   ├── authController.js     # register, login, get/update account
│   ├── listingController.js  # CRUD for meal listings + base64 photo handling
│   ├── requestController.js  # reservations, status changes, ratings, credit transfers
│   ├── adminController.js    # admin stats, listing management, recent requests
│   └── statsController.js    # public leaderboard
├── db/
│   ├── database.sql          # Schema (run this to create the database)
│   └── export.sql            # MySQL dump (sample/seed data)
└── public/                   # Static frontend
    ├── index.html            # Landing / role chooser
    ├── auth.html             # Login & register
    ├── cook.html             # Cook dashboard (create/manage listings)
    ├── feed.html             # Consumer feed (browse & request)
    ├── account.html          # Account settings
    ├── stats.html            # Public leaderboard
    ├── admin.html            # Admin portal
    ├── css/style.css
    ├── images/
    └── js/                   # Page scripts (auth, cook, feed, admin, stats, global)
```

---

## 🗄️ Database Schema

Three core tables (see [`db/database.sql`](db/database.sql)):

- **`users`** — `id`, `name`, `email` (unique), `password` (bcrypt hash), `role` (`student` | `admin`), `credits` (default 5), `created_at`.
- **`listings`** — `id`, `cook_id` → users, `title`, `photo_url`, `notes`, `allergens` (JSON), `total_portions`, `available_portions`, `pickup_location`, `pickup_time`, `latitude`, `longitude`, `status` (`active` | `inactive` | `deleted`), `created_at`.
- **`requests`** — `id`, `listing_id` → listings, `consumer_id` → users, `status` (`pending` | `approved` | `rejected` | `picked_up` | `no_show`), `rating` (1–5, `NULL` until rated, `-1` sentinel = penalized for not rating), `rating_time`, `created_at`.

Foreign keys cascade on delete.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- A running [MySQL](https://www.mysql.com/) server

### 1. Clone & install

```bash
git clone <repo-url>
cd unibite-app
npm install
```

### 2. Create the database

```bash
mysql -u root -p < db/database.sql
```

This creates the `unibite_db` database and all tables. Optionally load the sample dump:

```bash
mysql -u root -p unibite_db < db/export.sql
```

### 3. Configure environment variables

Create a `.env` file in the project root (it is git-ignored):

```env
# Server
PORT=3000

# MySQL connection
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=unibite_db

# Bcrypt cost factor (salt rounds)
HASH_LEVEL=10
```

### 4. Run the server

```bash
node server.js
```

You should see:

```
🚀 Ο Server τρέχει στο http://localhost:3000
🕐 No-Rating Penalty Scheduler ξεκίνησε (κάθε 1 ώρα)
```

Open **http://localhost:3000** in your browser. New visitors are redirected to the
login/register page; once signed in, you land on the role chooser.

> **Admin access:** set a user's `role` to `admin` directly in the database to unlock the Admin Portal.

---

## 🔌 API Overview

All endpoints are JSON over HTTP and mounted under `/api`.

### Auth — `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/register` | Register a new student |
| `POST` | `/login` | Log in |
| `GET`  | `/user/:id` | Get a user's profile |
| `PUT`  | `/update/:id` | Update name / email / password |

### Listings — `/api/listings`
| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/` | Active listings from the last 48h |
| `POST`   | `/` | Create a listing (photo as base64) |
| `PUT`    | `/:id` | Edit a listing |
| `DELETE` | `/:id` | Soft-delete a listing |

### Requests — `/api/requests`
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Reserve a portion |
| `GET`  | `/?cook_id=` / `?consumer_id=` | List requests for a cook or consumer |
| `PUT`  | `/:id/status` | Change status (approve / reject / picked_up / no_show) |
| `PUT`  | `/:id/rating` | Rate a picked-up meal (1–5) |

### Admin — `/api/admin`
| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/stats` | Monthly dashboard stats |
| `GET`    | `/listings` | All listings (with computed status) |
| `DELETE` | `/listings/:id` | Soft-delete a listing as admin |
| `GET`    | `/requests` | 50 most recent requests |

### Stats — `/api/stats`
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/leaderboard` | Public leaderboard (top cooks & meals) |

---

## 💡 How the Credit System Works

| Event | Cook | Consumer |
|-------|------|----------|
| Consumer picks up food (`picked_up`) | **+1** credit | **−1** credit |
| Consumer rates the meal ≥ 4 ⭐ | **+1** credit | — |
| Consumer is a no-show (`no_show`) | — | **−1** credit (portion returned to stock) |
| Consumer doesn't rate within 48h | — | **−1** credit (auto, via scheduler) |

You need at least **1 credit** to request food, so the only way to keep eating is to keep sharing. 🤝

---

## 📝 Notes

- Uploaded photos live in `public/uploads/` (git-ignored) — the folder is created automatically on first upload.
- Photos are compressed client-side to ~1200px / JPEG 0.7 before being sent, keeping payloads small.
- The app interface is in **Greek** 🇬🇷.
