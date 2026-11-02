# 🏆 Topper promax - Global Real-time Scoreboard

> Sathyabama University Internal Marks Evaluator with Global Real-Time Cloud Synchronization & Host Authorization.

---

## 🌟 What's New? (Global Real-time Synchronization)
In this updated version:
- 🌐 **Global Public Scoreboard**: Whenever **any visitor** submits their marks, their calculated total and rank update **instantly across all devices** currently viewing the website via Firebase Cloud Database.
- 🥇 **Automated Comparison & Ranking**: All records submitted by all visitors are sorted dynamically from highest total score to lowest score.
- 👑 **Topper promax Champion**: The highest scoring student among all visitors is spotlighted at the top of the page.
- 🔒 **Host Password Guard (`Roni@15`)**: Only the website owner can delete records or clear the global leaderboard.

---

## ⚙️ Marks Calculation Logic
Calculates weighted Continuous Assessment (CAE I) marks from 50 raw subject marks:

$$	ext{Subject Score} = (	ext{Raw Mark} 	imes 2) 	imes 0.2$$

### Included Subjects (Total: 100 Marks):
1. **Mathematics** (Max 20 Marks)
2. **EEE** (Max 20 Marks)
3. **Physics** (Max 20 Marks)
4. **C Language** (Max 20 Marks)
5. **English** (Max 20 Marks)

---

## 🔑 Firebase Setup Instructions (Required for Cloud Sync)

To make the shared global scoreboard work across all internet users:

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a free project.
2. Select **Firestore Database** -> Click **Create Database** -> Choose **Start in test mode**.
3. Register a Web App in Firebase Settings to get your `firebaseConfig` keys.
4. Open `script.js` and replace lines `16-23` with your configuration keys:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_FIREBASE_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```

---

## 📁 Repository Files
```
Topper-promax/
├── index.html   # Main web page structure
├── style.css    # Glassmorphism dark mode styles & animations
├── script.js    # Firebase real-time sync, ranking logic, and host protection
└── README.md    # Documentation and setup instructions
```

---

## 🚀 Deploying to GitHub Pages
1. Push all 4 files (`index.html`, `style.css`, `script.js`, `README.md`) to your GitHub repository.
2. Navigate to **Settings > Pages** in your GitHub repository.
3. Under **Build and deployment**, set branch to `main` and folder to `/ (root)`.
4. Click **Save**. Your site will be published with live scores across all visitors!
