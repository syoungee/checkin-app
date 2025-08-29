import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import MemberPage from './MemberPage';
import CalendarPage from './CalendarPage';
import CreateEventPage from './CreateEventPage';
import MemberDetailPage from './MemberDetailPage';
import EditEventPage from './EditEventPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* 메인 */}
        <Route path="/" element={<HomePage />} />

        {/* 기존 페이지들 */}
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/members" element={<MemberPage />} />
        <Route path="/member/:id" element={<MemberDetailPage />} />
        <Route path="/create-event" element={<CreateEventPage />} />
        <Route path="/event/:id" element={<EditEventPage />} />
      </Routes>
    </Router>
  );
}

export default App;
