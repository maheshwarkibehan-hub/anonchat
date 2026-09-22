# 🎭 AnonChat - 100% Free Anonymous 1-on-1 Random Chat

A modern, minimalist, real-time anonymous random chat web application (Omegle-style).
Built with **Node.js**, **Express**, **Socket.io**, and an Apple/Google dark-mode aesthetic.

---

## ✨ Features

- **Instant Matchmaking**: Click "Start Chat" to automatically pair with the next available stranger in queue.
- **100% Ephemeral & Private**: Zero database, zero chat logs. Messages exist only in RAM while chatting. Once disconnected, everything is gone forever.
- **Zero Registration**: No signups, emails, or user profiles.
- **Next / Skip Controls**: Skip boring conversations instantly with the **"Next"** button or hit `Esc` on your keyboard.
- **Real-Time Indicators**:
  - Live online user counter (`● 24 online`).
  - Typing indicator (*"Stranger is typing..."*).
- **Lightweight Sound Chimes**: Built-in Web Audio API synthesizer for pleasant, subtle message and connection sounds (no external audio files needed, can be muted anytime).
- **Responsive Dark Design**: Optimized for mobile and desktop screens.

---

## 🚀 How to Run Locally

### 1. Install Dependencies
Open your terminal inside the project directory:
```bash
cd C:\Users\mahes\.gemini\antigravity\scratch\anon-chat
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Test with 2 Browser Tabs
1. Open your browser and go to `http://localhost:3000`.
2. Open a **second tab** (or Incognito window) and also open `http://localhost:3000`.
3. In both tabs, click **"Start Chat"**.
4. Both tabs will instantly connect to each other in a private room. You can chat, see typing indicators, and test the **"Next"** / **"Leave"** buttons!

---

## 🌐 100% FREE Deployment Guide (Render.com)

You can host this application completely free of charge with **Render**:

### Step 1: Push Code to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g., `anon-chat`).
2. In your local project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of AnonChat"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/anon-chat.git
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [Render.com](https://render.com/) and sign in (free).
2. Click **"New +"** -> **"Web Service"**.
3. Connect your GitHub repository (`anon-chat`).
4. Set the following settings:
   - **Name**: `anon-chat` (or whatever you like)
   - **Region**: Closest to you (e.g., Singapore or Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **"Deploy Web Service"**.

In about 1-2 minutes, Render will give you a live HTTPS link (e.g., `https://anon-chat.onrender.com`). You can share this link with your friends or classmates, and anyone who opens it can start chatting anonymously right away!
