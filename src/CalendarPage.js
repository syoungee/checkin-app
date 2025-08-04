// src/pages/CalendarPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
// import 'react-calendar/dist/Calendar.css';
import './CalendarPage.css';

function CalendarPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDateChange = (date) => {
    setSelectedDate(date);
    // 추후: 해당 날짜 일정 보기 기능 가능
  };

  return (
    <div className="calendar-container">
      <h2 style={{ textAlign: 'center' }}>📅 일정 캘린더</h2>

      <Calendar onChange={handleDateChange} value={selectedDate} calendarType="gregory" locale="ko-KR" />

      <h3 style={{ marginTop: 24 }}>이번 달 일정</h3>
      {/* 향후 일정 리스트 표시 자리 */}

      <button className="fab" onClick={() => navigate('/create-event')}>
        +
      </button>
    </div>
  );
}

export default CalendarPage;
