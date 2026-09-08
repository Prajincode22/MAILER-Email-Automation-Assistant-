# Mailer - AI-Powered Email Automation Assistant

An enterprise-grade, full-stack email automation and productivity assistant designed to streamline inbox management, drafting, scheduling, and planning. Built with a **Next.js** frontend, an **Express.js** backend, **MongoDB Atlas**, and secure **Google OAuth 2.0** integration.

---

## 🌟 Key Features

* **Secure Google OAuth 2.0 Authentication**: Seamlessly authenticate users and manage authorized sessions while adhering to secure token handling practices.
* **Automated Gmail Integration**: Direct interface with Gmail APIs to securely read, modify, and send emails on behalf of authenticated users.
* **AI-Driven Email Assistant**: Powered by advanced LLMs (via OpenRouter, Groq, and Gemini) to generate context-aware draft responses, summarize long threads, and prioritize incoming messages.
* **Smart Calendar Syncing**: Automatically extract scheduling details and manage calendar events through deep Google Calendar API integration.
* **Dashboard & Workflow Analytics**: A responsive, modern frontend built with Next.js and Tailwind CSS providing real-time tracking of automated tasks and user metrics.
* **Reliable Cloud Infrastructure**: Production-ready architecture deployed seamlessly across **Vercel** (Frontend) and **Render** (Backend), backed by **MongoDB Atlas** for data persistence.

---

## 🛠️ Tech Stack

### Frontend

* **Framework**: Next.js (App Router)
* **Styling**: Tailwind CSS
* **Language**: TypeScript / JavaScript

### Backend

* **Runtime**: Node.js & Express.js
* **Database**: MongoDB Atlas (Mongoose ORM)
* **Authentication**: Googleapis / OAuth 2.0
* **AI Integration**: OpenAI SDK / OpenRouter / Groq / Gemini APIs

---

## 🚀 Getting Started Locally

### Prerequisites

* Node.js (v18+ recommended)
* MongoDB Atlas connection URI
* Google Cloud Console Project (with Gmail and Calendar APIs enabled)

### Installation & Setup

1. **Clone the repository**
```bash
git clone https://github.com/Prajincode22/MAILER-Email-Automation-Assistant.git
cd MAILER-Email-Automation-Assistant

```


2. **Configure the Backend**
```bash
cd backend
npm install

```


Create a `.env` file inside the `backend` folder and add your credentials:
```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_uri
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
FRONTEND_URL=http://localhost:3000
OPENROUTER_API_KEY=your_openrouter_api_key

```


Start the backend server:
```bash
node server.js

```


3. **Configure the Frontend**
Open a new terminal window and navigate to the frontend directory:
```bash
cd frontend
npm install

```


Create a `.env.local` file inside the `frontend` folder:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000

```


Start the development server:
```bash
npm run dev

```



---

## 🌍 Deployment

* **Backend**: Hosted on **Render** with auto-deploy on commit and environment variables mapped to production values (`GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, database URIs, and API keys).
* **Frontend**: Hosted on **Vercel** with the `NEXT_PUBLIC_API_URL` environment variable pointing directly to the live Render backend URL.

---

## 📄 License

This project is open-source and available under the [MIT License](https://www.google.com/search?q=LICENSE).
