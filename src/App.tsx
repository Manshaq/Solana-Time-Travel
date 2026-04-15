import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard/:address" element={<Dashboard />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
