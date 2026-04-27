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
    { value: 'novice', label: '新手 — 我对这个领域不熟悉' },
    { value: 'intermediate', label: '中级 — 我有一定基础' },
    { value: 'expert', label: '专家 — 我熟悉该领域' },
  ],
  preference: [
    { value: 'guided', label: '引导型 — 帮我一步步走' },
    { value: 'self-directed', label: '自由探索型 — 我自己来' },
  ],
  time: [
    { value: 'quick', label: '快速 — 30分钟以内' },
    { value: 'normal', label: '普通 — 1-2小时' },
    { value: 'deep', label: '深度 — 3小时以上' },
  ],
  goal: [
    { value: 'overview', label: '概览 — 了解大概' },
    { value: 'deep-understanding', label: '深度理解 — 掌握细节' },
    { value: 'paper-replication', label: '复现论文 — 动手实现' },
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
        <p style={S.subtitle}>将论文变成可探索的世界</p>
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
            <div>点击或拖入论文 PDF</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>仅支持 PDF 格式</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(FIELD_OPTIONS).map(([key, opts]) => (
          <div key={key}>
            <label style={S.label}>{
              { background: '你的领域背景', preference: '探索偏好', time: '可用时间', goal: '学习目标' }[key]
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
        开始生成世界
      </button>
    </div>
  )
}
