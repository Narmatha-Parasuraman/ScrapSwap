import { useState } from 'react';
import { api } from '../api.js';

const CATEGORIES = ['plastic', 'paper', 'metal', 'e_waste', 'glass', 'other'];

export default function PostItem() {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [weight, setWeight] = useState('');
  const [areaName, setAreaName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    try {
      const item = await api.postItem({ description, category, weight: Number(weight), areaName });
      if (item.warning) {
        setMessageType('warning');
        setMessage(item.warning);
      } else {
        setMessageType('info');
        setMessage('Item posted! Collectors in that area were just alerted.');
      }
      setDescription('');
      setWeight('');
      setAreaName('');
    } catch (err) {
      setMessageType('error');
      setMessage(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Post an item</h1>
        <p>Collectors covering the area you enter get a live alert the moment you submit.</p>
      </div>
      <form onSubmit={handleSubmit} className="card form">
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
        <div className="form-row">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" step="0.1" min="0.1" placeholder="Weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} required />
        </div>
        <input placeholder="Area name" value={areaName} onChange={(e) => setAreaName(e.target.value)} required />
        <button type="submit" className="btn btn-primary">Post item</button>
        {message && <p className={`${messageType}-text`}>{message}</p>}
      </form>
    </div>
  );
}
