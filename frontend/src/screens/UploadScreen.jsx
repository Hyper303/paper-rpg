import { useState, useRef } from 'react'

const S = {
  container: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '60px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
    color: '#ffd700',
    textShadow: '0 0 20px rgba(255,215,0,0.4)',
    margin: 0,
  },
  subtitle: {
    textAlign: 'center',
    color: '#a09080',
    fontSize: 14,
    margin: 0,
  },
  dropzone: (dragging) => ({
    border: `2px dashed ${dragging ? '#ffd700' : '#444'}`,
    borderRadius: 8,
    padding: 40,
    textAlign: 'center',
    cursor: 'pointer',
    background: dragging ? 'rgba(255,215,0,0.05)' : '#141414',
    transition: 'all 0.2s',
  }),
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    color: '#a09080',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#e8e0d0',
    fontSize: 14,
    appearance: 'none',
  },
  btn: (disabled) => ({
    padding: '14px 0',
    background: disabled ? '#333' : '#ffd700',
    color: disabled ? '#666' : '#0d0d0d',
    border: 'none',
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
  }),
}

const FIELD_OPTIONS = {
  background: [
    { value: 'novice', label: 'Novice — I\'m not familiar with this field' },
    { value: 'intermediate', label: 'Intermediate — I have some background' },
    { value: 'expert', label: 'Expert — I know this field well' },
  ],
  preference: [
    { value: 'guided', label: 'Guided — walk me through it step by step' },
    { value: 'self-directed', label: 'Self-directed — I\'ll explore on my own' },
  ],
  time: [
    { value: 'quick', label: 'Quick — under 30 minutes' },
    { value: 'normal', label: 'Normal — 1-2 hours' },
    { value: 'deep', label: 'Deep dive — 3+ hours' },
  ],
  goal: [
    { value: 'overview', label: 'Overview — get the big picture' },
    { value: 'deep-understanding', label: 'Deep understanding — master the details' },
    { value: 'paper-replication', label: 'Replicate the paper — implement it myself' },
  ],
}

export default function UploadScreen({ onStart }) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [q, setQ] = useState({
    background: 'intermediate',
    preference: 'guided',
    time: 'normal',
    goal: 'deep-understanding',
  })
  const inputRef = useRef()

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') setFile(f)
  }

  function handleFileInput(e) {
    const f = e.target.files[0]
    if (f) setFile(f)
  }

  function handleSubmit() {
    if (!file) return
    onStart(file, { ...q, visual_style: 'pixel_2d' })
  }

  return (
    <div style={S.container}>
      <div>
        <h1 style={S.title}>PAPER RPG</h1>
        <p style={S.subtitle}>Turn any paper into an explorable world</p>
      </div>

      <div
        style={S.dropzone(dragging)}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        {file ? (
          <div>
            <div style={{ fontSize: 28 }}>📄</div>
            <div style={{ marginTop: 8, color: '#ffd700' }}>{file.name}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⬆</div>
            <div>Click or drag a paper PDF here</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>PDF format only</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(FIELD_OPTIONS).map(([key, opts]) => (
          <div key={key}>
            <label style={S.label}>{
              { background: 'Your background', preference: 'Exploration preference', time: 'Available time', goal: 'Learning goal' }[key]
            }</label>
            <select
              style={S.select}
              value={q[key]}
              onChange={(e) => setQ(prev => ({ ...prev, [key]: e.target.value }))}
            >
              {opts.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button style={S.btn(!file)} disabled={!file} onClick={handleSubmit}>
        Generate World
      </button>
    </div>
  )
}
