# FoodDNA Frontend

Frontend web application for **FoodDNA – AI-Powered Food and Nutrition Analysis System**.

## Tech Stack
- **Framework:** React 19
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** CSS3 (Custom Responsive Wellness Theme)
- **Charts:** Chart.js & react-chartjs-2

## Features
- **Food Photo Upload:** Capture or select meal photos with instant client-side compression.
- **Nutrition Dashboard:** Interactive Chart.js charts (Macronutrient doughnut chart & Calorie bar chart).
- **Daily Journal:** Record, view, edit, and delete food entries.
- **AI Insights:** View dietary pattern insights based on your logged history.

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-frontend-repo-url>
   cd fooddna-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set `VITE_API_URL` to point to your backend (default: `http://localhost:5000`).

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Build for production:**
   ```bash
   npm run build
   ```
