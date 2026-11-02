@import "tailwindcss";

@layer base {
  body {
    background-color: #090d16;
    color: #f8fafc;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
}

.glass-card {
  background: rgba(18, 26, 43, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.glass-card-gold {
  background: radial-gradient(circle at top right, rgba(234, 179, 8, 0.15), rgba(30, 24, 15, 0.9));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1.5px solid rgba(234, 179, 8, 0.6);
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(234, 179, 8, 0.3), inset 0 0 15px rgba(234, 179, 8, 0.1);
  }
  50% {
    box-shadow: 0 0 40px rgba(234, 179, 8, 0.75), inset 0 0 25px rgba(234, 179, 8, 0.2);
  }
}

.animate-pulse-glow {
  animation: pulseGlow 2.5s infinite ease-in-out;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}
::-webkit-scrollbar-thumb {
  background: rgba(51, 65, 85, 0.8);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.25s ease-out;
}

