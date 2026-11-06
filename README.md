# ZeroOut---Expense-Splitter




# Expense Splitter (Alta-Split)

A full-stack web application designed for friends, hostel mates, or trip groups to record shared expenses, split bills flexibly, and see who owes whom while simplifying group debts into the fewest possible payments.

## 🎯 Problem Statement

When friends, hostel mates, or travel groups share expenses over time, tracking who paid for what and calculating individual balances becomes confusing and error-prone. Manual tracking leads to calculation mistakes, awkward money reminders, and a complicated web of overlapping debts where everyone owes multiple people small amounts. A centralized system is needed to accurately record shared bills and simplify how the group settles up.

## 💡 Proposed Solution

**Expense Splitter** provides a shared group ledger where members can log expenses using equal, exact, or percentage splits and view real-time balances per person. To solve the problem of overlapping payments, the platform includes a **Debt Simplification** engine that applies Greedy and Heap concepts from Data Structures and Algorithms (DSA) to reduce many small debts in a group into the fewest possible direct payments.

## 👥 User Roles

- **Group Creator:** An authenticated user who creates expense groups, adds members to the group, records shared expenses, views simplified debts, and marks debts as settled.
- **Group Member:** An authenticated user who belongs to one or more groups, adds shared expenses (equal, exact, or percentage split), views group expense history, checks their personal balance, and settles debts.
- **Unauthenticated User (Guest):** A visitor who can access the signup and login screens to create an account and join the platform.

## ✨ Planned Features

### MVP Features

1. User signup and login with password hashing and JWT authentication.
2. Create groups and add members to shared expense groups.
3. Add expenses with **Equal**, **Exact**, or **Percentage** split options.
4. View real-time balance per person in each group.
5. View complete chronological expense history for each group.
6. Mark a debt as settled between group members.
7. **Heavy Feature – Debt Simplification:** Reduce the many small debts in a group to the fewest possible payments using Greedy and Heap algorithms.

### Future Improvements

- Category-wise expense filtering and monthly spending summaries.
- Group invite links for adding friends directly.
- Exportable group expense reports.
- Automated reminders for unsettled group balances.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python / JavaScript | Core programming languages for backend logic, applied DSA (Greedy, Heaps), and frontend logic |
| FastAPI / Node | Backend framework for REST APIs, authentication, money calculations, and debt simplification |
| PostgreSQL | Relational database for group data modelling, user accounts, expenses, and settlements |
| React | Frontend library for building the user interface, group dashboards, and expense split forms |
| JWT (JSON Web Tokens) | Securing authentication and protected backend routes |
| Git & GitHub | Version control |

## 🏗️ Project Architecture

The application follows a **3-Tier Client-Server Architecture** built around the core stack:

1. **Frontend (React):** Handles user interaction, routing, authentication forms, group dashboards, expense creation forms, and displays per-person balances and simplified settlement lists. It communicates with the backend via REST API requests.
2. **Backend (FastAPI / Node):** Processes all business logic, validates user inputs, handles JWT authentication middleware, performs exact money and split calculations, and runs the Greedy + Heap Debt Simplification algorithm.
3. **Database (PostgreSQL):** Stores relational data across users, groups, group memberships, expenses, individual splits, and settled payments with strict data integrity.

## 🗄️ Database Design

1. **`users` Table:**
   - Fields: `id` (PK), `name`, `email` (Unique), `password_hash`, `created_at`
   - Relationship: One user can belong to many groups and log many expenses.
2. **`groups` Table:**
   - Fields: `id` (PK), `name`, `created_by` (FK $\rightarrow$ `users.id`), `created_at`
   - Relationship: One group has many members, expenses, and settlements.
3. **`group_members` Table:**
   - Fields: `id` (PK), `group_id` (FK $\rightarrow$ `groups.id`), `user_id` (FK $\rightarrow$ `users.id`), `joined_at`
   - Relationship: Junction table connecting `users` and `groups`.
4. **`expenses` Table:**
   - Fields: `id` (PK), `group_id` (FK $\rightarrow$ `groups.id`), `paid_by` (FK $\rightarrow$ `users.id`), `description`, `amount` (`NUMERIC(10,2)`), `split_type` (`EQUAL`, `EXACT`, `PERCENTAGE`), `created_at`
   - Relationship: One expense belongs to one group and breaks down into multiple rows in `expense_splits`.
5. **`expense_splits` Table:**
   - Fields: `id` (PK), `expense_id` (FK $\rightarrow$ `expenses.id`), `user_id` (FK $\rightarrow$ `users.id`), `amount_owed` (`NUMERIC(10,2)`), `percentage` (`NUMERIC(5,2)`)
   - Relationship: Tracks how much each specific member owes for a given expense.
6. **`settlements` Table:**
   - Fields: `id` (PK), `group_id` (FK $\rightarrow$ `groups.id`), `paid_by` (FK $\rightarrow$ `users.id`), `paid_to` (FK $\rightarrow$ `users.id`), `amount` (`NUMERIC(10,2)`), `settled_at`
   - Relationship: Records settled debt payments between two members in a group.

## 🔄 Application Workflow

1. **Authentication:** A user creates an account on the Signup page and logs in to receive a JWT token.
2. **Group Creation:** The user creates a group (e.g., "Hostel Group" or "Goa Trip") and adds members to it.
3. **Logging an Expense:** When someone pays a bill, they enter the description, total amount, and select a split type (`Equal`, `Exact`, or `Percentage`).
4. **Money Calculation:** The backend validates the split math, calculates each member's share, and saves the records in PostgreSQL.
5. **Balance & Debt Simplification:** The system calculates each member's net balance in the group:
   $$\text{Net Balance} = \text{Total Paid} - \text{Total Owed}$$
   Using Greedy and Heap data structures, the backend matches the highest creditors with the highest debtors to output the fewest possible payments needed to clear all debts.
6. **Settlement:** Members pay their simplified amounts and click "Mark as Settled" to update the group balances and expense history.

## 📁 Project Structure

```text
expense-splitter/
├── backend/
│   ├── src/
│   │   ├── routes/          # Auth, groups, expenses, and settlement API endpoints
│   │   ├── controllers/     # Business logic and money split calculations
│   │   ├── middleware/      # JWT authentication and input validation middleware
│   │   ├── services/        # Greedy + Heap debt simplification logic
│   │   ├── db/              # PostgreSQL connection and schema queries
│   │   └── app              # Main FastAPI / Node server entry point with /health route
│   ├── tests/               # 5+ automated API tests
│   └── .env.example         # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI forms, balance cards, and history lists
│   │   ├── pages/           # Login, Signup, Groups Dashboard, and Group Detail screens
│   │   ├── services/        # Backend API integration calls
│   │   └── App.jsx          # Main React application and routing
│   └── package.json
├── FEATURES.md
└── README.md
```

## 📅 Development Roadmap

| Day | Task | Expected Outcome |
|---|---|---|
| Day 1 | Plan | Write problem statement, user roles and MVP list; create GitHub repo with `FEATURES.md` |
| Day 2 | Design | Design PostgreSQL database schema (tables, fields, relations) and 4 UI wireframes |
| Day 3 | Setup | Set up project structure, FastAPI/Node backend server, PostgreSQL DB connection and `/health` API |
| Day 4 | Auth | Build User model and signup API with input validation and password hashing |
| Day 5 | Auth | Build login API with JWT and auth middleware for protected routes; publish **LinkedIn Post #1** |
| Day 6 | Backend | Build CRUD APIs for groups, members, and expenses (protected by auth) |
| Day 7 | Backend | Add entity relations, split money calculations, balances, and pagination/search on list APIs |
| Day 8 | Frontend | Set up React frontend app, routing, and connect login and signup screens to backend |
| Day 9 | Frontend | Build main dashboard (groups list) and detail screen (expense history and balances) with live API data |
| Day 10 | Frontend | Add create, edit, and settle forms with loading states and error messages; publish **LinkedIn Post #2** |
| Day 11 | Heavy Feature | Build the backend logic for Debt Simplification using Greedy and Heap concepts |
| Day 12 | Heavy Feature | Connect Debt Simplification to the React frontend so it works end-to-end |
| Day 13 | Testing | Test main flows, fix currency rounding bugs, add input validation, and write at least 5 API tests |
| Day 14 | Deploy | Deploy React frontend, FastAPI/Node backend, and PostgreSQL DB; move all keys to env variables |
| Day 15 | Ship | Write final `README.md`, record 2-min demo video, and publish **LinkedIn Launch Post #3** |

## 🧪 Testing Strategy

- **Input & Split Validation:** Ensure exact splits equal the total bill amount, percentage splits equal $100\%$, and negative or invalid amounts are rejected.
- **Money & Rounding Checks:** Test splitting odd amounts (such as dividing $100$ among $3$ members) to ensure no pennies are lost during calculation.
- **Debt Simplification Testing:** Test overlapping and circular group debts to verify that the Greedy and Heap algorithm produces the minimum number of transactions while keeping net balances accurate.
- **Automated API Tests:** Write at least 5 automated API tests covering `/health`, user signup/login, group creation, expense splitting, and debt simplification endpoints.

## 🚀 Deployment Plan

- **Frontend:** Deploy the React application to cloud static/web hosting with environment variables pointing to the live backend API.
- **Backend:** Deploy the FastAPI/Node server to a cloud web service with production CORS settings and environment variables (`DATABASE_URL`, `JWT_SECRET`).
- **Database:** Host the PostgreSQL database on a managed cloud PostgreSQL provider and connect it securely to the backend server.

## 📌 Current Status

**Day 1 – Planning**

- Project selected.
- Problem statement defined.
- Proposed solution identified.
- User roles identified.
- MVP features planned.
- Technology stack selected.
- Initial architecture designed.

## 🎯 Project Goal

The goal of this project is to design, build, test, and deploy a complete Expense Splitter web application in 15 days using **React**, **FastAPI/Node**, and **PostgreSQL**. By completing this project, I will learn applied DSA (Greedy algorithms and Heaps in a real product), accurate money and split calculations, relational group data modelling, and end-to-end full-stack engineering.

---

*Built as part of ALTA Builder 30.*
