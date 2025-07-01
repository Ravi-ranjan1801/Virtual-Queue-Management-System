# 🎯 Virtual Queue Management System

<div align="center">
  
  ![Queue Management](https://img.shields.io/badge/Queue-Management-blue?style=for-the-badge)
  ![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
  ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
  ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
  ![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)

  **A modern, full-stack web application designed to streamline customer flow through virtual token management**

  [🚀 Live Demo](#) | [📖 Documentation](#installation) | [🤝 Contributing](#contributing)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ Architecture](#️-architecture)
- [🚀 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [📱 Usage](#-usage)
- [🎨 Screenshots](#-screenshots)
- [🔄 API Endpoints](#-api-endpoints)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)

---

## ✨ Features

### 🎫 **For Customers**
- **Virtual Token Generation**: Get unique tokens instantly via web interface
- **Real-Time Queue Status**: Live updates on queue position and estimated wait time
- **Mobile Responsive**: Seamless experience across all devices
- **Push Notifications**: Instant alerts when your turn approaches

### 👨‍💼 **For Staff & Administrators**
- **Queue Management Dashboard**: Monitor and control active queues
- **Token Status Updates**: Mark tokens as Active, Waiting, or Completed
- **Call Next Token**: Efficiently manage customer flow
- **Analytics & Reporting**: Track queue performance and customer metrics

### 🔧 **System Features**
- **Role-Based Access Control**: Secure authentication with JWT
- **Real-Time Communication**: WebSocket integration for instant updates
- **Scalable Architecture**: Built to handle high traffic loads
- **Clean UI/UX**: Intuitive interface designed for all user types

---

## 🛠️ Tech Stack

### **Frontend**
- **React.js** - Modern UI library
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **Socket.IO Client** - Real-time communication

### **Backend**
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - Secure authentication

### **Database**
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB

### **Development Tools**
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **dotenv** - Environment variable management

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server │    │   MongoDB       │
│                 │    │                 │    │                 │
│  - Token Gen    │◄──►│  - API Routes   │◄──►│  - Users        │
│  - Queue Status │    │  - Socket.IO    │    │  - Tokens       │
│  - Real-time UI │    │  - Auth (JWT)   │    │  - Queues       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 Installation

### Prerequisites
- **Node.js** (v14 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn**

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ravi-ranjan1801/Virtual-Queue-Management-System.git
   cd Virtual-Queue-Management-System
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/queue-management
   JWT_SECRET=your-secret-key
   NODE_ENV=development
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the application**
   ```bash
   # Development mode (runs both frontend and backend)
   npm run dev
   
   # Or run separately
   npm run server    # Backend only
   npm run client    # Frontend only
   ```

6. **Open your browser**
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5000`

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/vqms` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRE` | JWT token expiration | `7d` |
| `NODE_ENV` | Environment mode | `development` |

### Database Schema

```javascript
// User Schema
{
  name: String,
  email: String,
  password: String,
  role: ['customer', 'staff', 'admin'],
  createdAt: Date
}

// Token Schema
{
  tokenNumber: String,
  userId: ObjectId,
  queueId: ObjectId,
  status: ['waiting', 'active', 'completed'],
  priority: Number,
  createdAt: Date,
  calledAt: Date,
  completedAt: Date
}

// Queue Schema
{
  name: String,
  description: String,
  isActive: Boolean,
  maxCapacity: Number,
  estimatedServiceTime: Number,
  createdBy: ObjectId,
  createdAt: Date
}
```

---

## 📱 Usage

### Customer Flow
1. **Register/Login** to the system
2. **Select a Queue** from available options
3. **Generate Token** and receive unique token number
4. **Monitor Queue Status** in real-time
5. **Receive Notifications** when turn approaches

### Staff/Admin Flow
1. **Login** with staff/admin credentials
2. **Access Dashboard** to view active queues
3. **Manage Tokens** - call next, mark complete
4. **Monitor Analytics** and queue performance
5. **Configure Settings** (admin only)

---

## 🎨 Screenshots

<div align="center">

### Customer Interface
![Customer Dashboard](https://via.placeholder.com/600x400/2563eb/ffffff?text=Customer+Dashboard)

### Staff Dashboard
![Staff Dashboard](https://via.placeholder.com/600x400/059669/ffffff?text=Staff+Dashboard)

### Real-time Queue Status
![Queue Status](https://via.placeholder.com/600x400/dc2626/ffffff?text=Real-time+Queue)

</div>

---

## 🔄 API Endpoints

### Authentication
```
POST   /api/auth/register     # Register new user
POST   /api/auth/login        # User login
GET    /api/auth/profile      # Get user profile
```

### Queue Management
```
GET    /api/queues            # Get all queues
POST   /api/queues            # Create new queue
GET    /api/queues/:id        # Get queue details
PUT    /api/queues/:id        # Update queue
DELETE /api/queues/:id        # Delete queue
```

### Token Management
```
POST   /api/tokens            # Generate new token
GET    /api/tokens/user/:id   # Get user tokens
PUT    /api/tokens/:id/status # Update token status
GET    /api/tokens/queue/:id  # Get queue tokens
```

### WebSocket Events
```
connection              # Client connection
join-queue             # Join specific queue room
token-generated        # New token created
token-called           # Token called for service
token-completed        # Token service completed
queue-updated          # Queue status changed
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add some amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Socket.IO** for real-time communication
- **MongoDB** for flexible data storage
- **React** community for excellent ecosystem
- **Tailwind CSS** for rapid UI development

---

## 📞 Support

If you have any questions or need help:

- **Email**: [raviranjan12059@gmail.com](mailto:raviranjan12059@gmail.com)
- **GitHub Issues**: [Create an issue](https://github.com/Ravi-ranjan1801/Virtual-Queue-Management-System/issues)
- **Discussions**: [Join the discussion](https://github.com/Ravi-ranjan1801/Virtual-Queue-Management-System/discussions)

---

<div align="center">

**Made with ❤️ by [Ravi Ranjan](https://github.com/Ravi-ranjan1801)**

[![GitHub Stars](https://img.shields.io/github/stars/Ravi-ranjan1801/Virtual-Queue-Management-System?style=social)](https://github.com/Ravi-ranjan1801/Virtual-Queue-Management-System/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Ravi-ranjan1801/Virtual-Queue-Management-System?style=social)](https://github.com/Ravi-ranjan1801/Virtual-Queue-Management-System/network/members)

</div>
