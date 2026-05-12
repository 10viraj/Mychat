# MyChat 🚀

A full-stack, real-time chat application featuring a robust Node.js/Express backend, a modern Vite/React web interface, and a high-performance cross-platform mobile application built with Expo.

---

## ✨ Features

- **Real-time Messaging**: Instant communication powered by Socket.io.
- **Cross-Platform**: Seamless experience across Web, Android, and iOS.
- **Authentication**: Secure JWT-based authentication with password hashing.
- **Media Support**: Image uploading and sharing.
- **Rich UI**: Interactive components, emoji picker, and premium design.
- **Global Search**: Find users and start conversations instantly.

---

## 🛠 Tech Stack

### Backend
- **Node.js & Express**: High-performance server architecture.
- **MongoDB & Mongoose**: Flexible NoSQL database for message and user storage.
- **Socket.io**: Real-time bi-directional event-based communication.
- **JWT & Bcrypt**: Secure user authentication and authorization.
- **Multer**: File upload handling.

### Web Client
- **React 19**: Modern component-based UI library.
- **Vite**: Ultra-fast build tool and dev server.
- **React Router 7**: Sophisticated client-side routing.
- **Axios**: Efficient HTTP client for API interactions.
- **Socket.io Client**: Real-time connectivity.

### Mobile Client
- **Expo 54**: Universal React framework for Android, iOS, and Web.
- **React Native**: Native mobile development.
- **Expo Router**: File-based routing for mobile.
- **Reanimated & Haptics**: Premium animations and tactile feedback.

---

## 📂 Project Structure

```text
MyChat/
├── backend/          # Express API & Socket.io Server
├── web-app/          # Vite + React Frontend
└── mobile-app/       # Expo + React Native Application
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Expo Go](https://expo.dev/client) app (for mobile testing)

### 1. Clone the repository
```bash
git clone <repository-url>
cd MyChat
```

### 2. Setup Backend
```bash
cd backend
npm install
# Create a .env file (see Environment Variables section)
npm start
```

### 3. Setup Web App
```bash
cd ../web-app
npm install
npm run dev
```

### 4. Setup Mobile App
```bash
cd ../mobile-app
npm install
npx expo start
```

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

---

## 📄 License

This project is licensed under the ISC License.
