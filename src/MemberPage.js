import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './App.css'; // 스타일 분리

function MemberPage() {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    phone: '',
    activityArea: '',
    residence: '',
    joinDate: '',
  });

  const fetchMembers = async () => {
    const snapshot = await getDocs(collection(db, 'members'));
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setMembers(data);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'members'), {
        ...form,
        exitDate: null,
        points: 0,
        createdAt: serverTimestamp(),
      });
      setForm({
        name: '',
        birthdate: '',
        phone: '',
        activityArea: '',
        residence: '',
        joinDate: '',
      });
      await fetchMembers();
    } catch (error) {
      console.error('등록 실패:', error);
    }
  };

  return (
    <div className="container">
      <h1>연명부 등록</h1>
      <form onSubmit={handleSubmit} className="form">
        <input name="name" value={form.name} onChange={handleChange} placeholder="이름" required />
        <input name="birthdate" type="date" value={form.birthdate} onChange={handleChange} required />
        <input name="phone" value={form.phone} onChange={handleChange} placeholder="전화번호" required />
        <input name="activityArea" value={form.activityArea} onChange={handleChange} placeholder="주 활동 지역" />
        <input name="residence" value={form.residence} onChange={handleChange} placeholder="거주 지역" />
        <input name="joinDate" type="date" value={form.joinDate} onChange={handleChange} required />
        <button type="submit">등록</button>
      </form>

      <h2>연명부 목록</h2>
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.id} className="member-item">
            <strong>{m.name}</strong>
            <br />
            생일: {m.birthdate} <br />
            입장일: {m.joinDate}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MemberPage;
