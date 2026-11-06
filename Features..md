# Expense Splitter – Features

## 1. Project Overview

**Expense Splitter (Alta-Split)** is a full-stack web application designed to help friends, hostel mates, and trip groups record shared expenses, split bills accurately, and track who owes whom.

The platform aims to eliminate manual calculation errors and complex webs of overlapping group debts by providing flexible bill-splitting options (equal, exact, and percentage) alongside a **Debt Simplification** engine powered by Greedy and Heap algorithms that reduces multiple group debts into the fewest possible payments.

## 2. User Roles

### 2.1 Group Creator

- Can create new shared expense groups (e.g., trips, hostels, apartments, or events).
- Can add registered users as members to the group.
- Can log shared expenses using equal, exact, or percentage splits and view group-wide balances.
- Can view simplified debt payment paths and mark debts as settled within the group.

### 2.2 Group Member

- Can view all groups they have been added to on their personal dashboard.
- Can add new shared expenses paid by them or other members using equal, exact, or percentage splits.
- Can view their real-time net balance (how much they owe or are owed) and browse the group's expense history.
- Can settle up pending debts with other group members and mark payments as settled.

### 2.3 Unauthenticated User (Guest)

- Can access the public landing, login, and signup pages.
- Can register a new account with input validation and secure password hashing.
- Can log in with valid credentials to receive an authentication token (JWT).
- Cannot view or modify any group, expense, or balance data until authenticated.

## 3. MVP Features

The following features will be implemented in the initial version.

| No. | Feature | Description |
|---|---|---|
| 1 | User Signup & Login | Allows users to register an account with hashed passwords and log in securely. |
| 2 | Protected Route Authentication | Uses JWT middleware to ensure only logged-in group members can access or modify group data. |
| 3 | Group Creation | Enables users to create dedicated groups for trips, hostels, or shared living expenses. |
| 4 | Add Group Members | Allows users to add friends or roommates to a group so they can participate in expense splitting. |
| 5 | Equal Expense Split | Divides a shared bill evenly among all selected group members while handling penny rounding accurately. |
| 6 | Exact Expense Split | Allows the payer to specify the exact monetary amount owed by each individual member for an expense. |
| 7 | Percentage Expense Split | Splits a bill across group members based on custom percentages that validate to $100\%$. |
| 8 | Per-Person Group Balances | Calculates and displays each member's real-time net balance (total paid minus total owed) within a group. |
| 9 | Expense History & Settle Up | Displays a chronological feed of all group expenses (with pagination/search) and lets users mark debts as settled. |
| 10 | Debt Simplification (Heavy Feature) | Uses Greedy and Heap DSA concepts to reduce multiple overlapping debts in a group to the fewest possible payments. |

## 4. Core Workflow

1. **Account Onboarding:** A user signs up, logs into the application, and lands on their main Groups Dashboard.
2. **Group Setup:** The user creates a new expense group and adds their friends or hostel mates as group members.
3. **Recording Expenses:** Whenever a member pays a shared bill, they log the expense amount, description, and choose an **Equal**, **Exact**, or **Percentage** split.
4. **Balance & Debt Simplification:** The backend updates every member's net balance and runs the Greedy + Heap algorithm to calculate the minimum number of transactions required to settle the group.
5. **Settling Debts:** Members review the simplified payment list, pay the designated person, and click **Mark as Settled** to bring the group balances back to zero.

## 5. Future Features

These features are outside the initial MVP scope and may be considered for future versions.

- Receipt image upload and OCR scanning to automatically extract bill items and totals.
- Multi-currency support with live exchange rate conversion for international trips.
- Category tags (Food, Travel, Rent, Utilities) and monthly visual spending charts.
- Automated email or push notifications reminding members of unsettled balances.
- Direct payment gateway or UPI link integration to pay friends inside the app.

## 6. Technology Stack

| Technology | Purpose |
|---|---|
| Python / JavaScript | Core programming languages for backend business logic, applied DSA (Greedy, Heaps), and frontend UI logic |
| FastAPI / Node | Backend framework for RESTful APIs, authentication, money calculations, and debt simplification |
| PostgreSQL | Relational database for storing users, groups, group memberships, expenses, splits, and settlements |
| React | Frontend library for building interactive user interfaces, forms, and balance dashboards |
| CSS | Styling the application interface, responsive layouts, and balance status indicators |
| JWT (JSON Web Tokens) | Stateless user authentication and securing protected backend API routes |
| Git & GitHub | Version control |

## 7. Project Scope

**Initial Goal:** Build and deploy a working full-stack Expense Splitter web application with user authentication, group management, equal/exact/percentage bill splitting, real-time balances, debt settlement, and a Greedy + Heap Debt Simplification engine.

**Development Duration:** 15 Days (ALTA Builder 30 – Track A).

**In Scope:**
- User authentication (Signup, Login, JWT middleware).
- Group creation and member management.
- Adding, editing, and viewing expenses with Equal, Exact, and Percentage splits.
- Real-time per-person balance calculations and chronological expense history.
- Marking debts as settled.
- Backend and frontend integration of the Greedy + Heap Debt Simplification algorithm.
- At least 5 automated API tests and full cloud deployment.

**Out of Scope:**
- Real-money bank transfers or live payment gateway processing.
- OCR receipt scanning and automated bill parsing.
- Multi-currency conversion.
- Native iOS or Android mobile applications.

---

*Part of ALTA Builder 30 – Track A (15-Day Full-Stack Product Track).*
