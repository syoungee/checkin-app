// src/pages/CreateEventPage.js
import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useNavigate } from 'react-router-dom';

function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    date: '',
    time: '',
    location: '',
    host: '',
    attendees: [],
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events'), {
        ...form,
        attendees: [], // 나중에 실제 선택 UI 구현 시 채우기
      });
      navigate('/');
    } catch (err) {
      console.error('일정 등록 실패:', err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>일정 만들기</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input name="date" type="date" value={form.date} onChange={handleChange} required />
        <input name="time" type="time" value={form.time} onChange={handleChange} required />
        <input name="location" placeholder="장소" value={form.location} onChange={handleChange} required />
        <input name="host" placeholder="모임장" value={form.host} onChange={handleChange} required />
        <button type="submit">등록</button>
      </form>
    </div>
  );
}

export default CreateEventPage;
