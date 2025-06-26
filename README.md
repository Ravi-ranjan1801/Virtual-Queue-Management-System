# 🚦 Virtual Queue Management System

A full-stack web app designed to streamline customer flow by allowing users to generate virtual tokens, check real-time queue status, and receive notifications. Administrators and staff can manage queues, monitor active tokens, and update statuses—all through a clean and responsive interface.

---

## 🎯 Features

- **Virtual Token Generation**: Customers get a unique token via web interface.
- **Real-Time Queue Updates**: Live queue display with token status (Active, Waiting, Completed).
- **Role-Based Access**:
  - **Customers**: Generate tokens, view queue position, and status.
  - **Staff/Admin**: Manage tokens, update statuses, call next token.
- **Responsive UI**: Works well on desktop and mobile.
- **Instant Notifications** (via WebSockets or polling).

---

## 🛠️ Tech Stack

- **Frontend**: React.js, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Real-Time**: Socket.IO (or alternative polling)
- **Database**: MongoDB (via Mongoose)
- **Auth**: JWT-based role authentication  
- **Tooling**: ESLint, Prettier, dotenv

---

## 🚀 Getting Started

1. **Clone the repo**  
   ```bash
   git clone https://github.com/Mohhit6075/Virtual-Queue-Management.git
   cd Virtual-Queue-Management
