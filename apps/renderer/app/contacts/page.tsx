'use client'

import type { Contact, ContactGroupsResponse } from '@murmur/types'
import { useEffect, useRef, useState } from 'react'

import { contacts as contactsApi } from '../../lib/api'

interface EditForm {
  name: string
  phone: string
  email: string
  tag: string
  birthday: string
}

const AVATAR_COLORS: [string, string][] = [
  ['#dbeafe', '#1d4ed8'],
  ['#dcfce7', '#15803d'],
  ['#fef9c3', '#a16207'],
  ['#fce7f3', '#be185d'],
  ['#ede9fe', '#6d28d9'],
  ['#ffedd5', '#c2410c'],
]
const AVATAR_FALLBACK: [string, string] = ['#e5e7eb', '#374151']

function getAvatarColors(name: string): [string, string] {
  const idx = (name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx] ?? AVATAR_FALLBACK
}

/** Capitalise first letter, lowercase the rest — e.g. "FaMilY" → "Family" */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

const SEL_KEY = 'murmur-selected-contacts'

function saveSelection(ids: number[]): void {
  sessionStorage.setItem(SEL_KEY, JSON.stringify(ids))
}

export default function ContactsPage() {
  const [groups, setGroups] = useState<ContactGroupsResponse>({ total: 0, groups: [] })
  const [list, setList] = useState<Contact[]>([])
  const [activeTag, setActiveTag] = useState('all')
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    phone: '',
    email: '',
    tag: '',
    birthday: '',
  })
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (tag = 'all') => {
    const [g, c] = await Promise.all([
      contactsApi.groups(),
      contactsApi.list(tag === 'all' ? undefined : tag),
    ])
    setGroups(g)
    setList(c)
  }

  useEffect(() => {
    void load()
    // Restore saved selection
    try {
      const raw = sessionStorage.getItem(SEL_KEY)
      if (raw) setSelectedIds(new Set(JSON.parse(raw) as number[]))
    } catch (_) {
      /* ignore */
    }
  }, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMsg('')
    setColumns([])
    try {
      const result = await contactsApi.upload(file, true)
      setColumns(result.columns)
      setMsg(
        `Imported ${result.imported} contacts.${result.skipped ? ` ${result.skipped} rows skipped (no name).` : ''}`,
      )
      void load(activeTag)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const switchTag = (tag: string) => {
    setActiveTag(tag)
    void load(tag)
  }

  const deleteAll = async () => {
    if (!confirm('Delete all contacts? This cannot be undone.')) return
    await contactsApi.deleteAll()
    setSelectedIds(new Set())
    saveSelection([])
    void load('all')
    setActiveTag('all')
    setColumns([])
    setMsg('')
  }

  const startEdit = (c: Contact) => {
    setEditingId(c.id)
    setEditForm({
      name: c.name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      tag: c.tag ?? '',
      birthday: c.birthday ?? '',
    })
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: number) => {
    setSaving(true)
    try {
      await contactsApi.updateOne(id, {
        name: editForm.name || undefined,
        phone: editForm.phone || null,
        email: editForm.email || null,
        tag: editForm.tag || null,
        birthday: editForm.birthday || null,
      })
      setEditingId(null)
      void load(activeTag)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteOne = async (id: number, name: string) => {
    if (!confirm(`Delete ${name}?`)) return
    await contactsApi.deleteOne(id)
    // Remove from selection too
    const next = new Set(selectedIds)
    next.delete(id)
    setSelectedIds(next)
    saveSelection([...next])
    void load(activeTag)
  }

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
    saveSelection([...next])
  }

  const toggleAll = () => {
    const visibleIds = list.slice(0, 200).map((c) => c.id)
    const allSelected = visibleIds.every((id) => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) {
      visibleIds.forEach((id) => next.delete(id))
    } else {
      visibleIds.forEach((id) => next.add(id))
    }
    setSelectedIds(next)
    saveSelection([...next])
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    saveSelection([])
  }

  const ef = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }))

  const isError = msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')
  const visibleIds = list.slice(0, 200).map((c) => c.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Contacts</h1>
        <p className="page-sub">
          Import a CSV with <code style={{ fontSize: 12 }}>name, phone, email, tag</code> columns.
          Any extra column becomes a <code style={{ fontSize: 12 }}>{'{{variable}}'}</code>.
        </p>
      </div>

      {/* CSV format reference */}
      <div className="card">
        <div className="card-title">CSV format</div>
        <div className="card-sub">All columns except name are optional.</div>
        <pre className="code">{`name,phone,email,tag,birthday
Ahmed Khan,+923001234567,ahmed@gmail.com,family,1990-03-15
Sara Ali,+923009876543,sara@email.com,client,
Bilal Rao,+923334455667,bilal@gmail.com,friend,1995-11-08`}</pre>
      </div>

      {/* Import */}
      <div className="card">
        <div className="card-title">Import CSV</div>
        <div className="card-sub">Replaces your existing contacts. Max 10,000 rows.</div>
        {msg && <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`}>{msg}</div>}
        {columns.length > 0 && (
          <div className="alert alert-info" style={{ marginBottom: 10 }}>
            Detected columns:{' '}
            {columns.map((c) => (
              <code key={c} style={{ marginRight: 6, fontSize: 11 }}>
                {c}
              </code>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => void handleFile(e)}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Choose CSV file'}
          </button>
          {groups.total > 0 && (
            <button className="btn btn-outline-danger" onClick={() => void deleteAll()}>
              Clear all ({groups.total})
            </button>
          )}
        </div>
      </div>

      {/* Filter by group */}
      {groups.total > 0 && (
        <div className="card">
          <div className="card-title">Filter by group</div>
          <div className="ch-group" style={{ marginTop: 8 }}>
            <button
              className={'ch-btn' + (activeTag === 'all' ? ' on' : '')}
              onClick={() => switchTag('all')}
            >
              All ({groups.total})
            </button>
            {groups.groups
              .filter((g) => g.tag !== 'all')
              .map((g) => (
                <button
                  key={g.tag}
                  className={'ch-btn' + (activeTag === g.tag ? ' on' : '')}
                  onClick={() => switchTag(g.tag)}
                >
                  {cap(g.tag)} ({g.count})
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Selection banner */}
      {someSelected && (
        <div
          style={{
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent)',
            borderRadius: 10,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14, flexShrink: 0 }}>
            <circle cx="8" cy="8" r="6.5" stroke="var(--accent)" strokeWidth="1.4" />
            <path
              d="M5 8l2 2 4-4"
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--accent-tx)' }}>
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            — go to Compose to send to this custom selection
          </span>
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={clearSelection}>
            Clear
          </button>
          <a href="/compose" className="btn btn-primary btn-sm">
            Compose →
          </a>
        </div>
      )}

      {/* Table */}
      {list.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              {list.length} contact{list.length !== 1 ? 's' : ''}
              {activeTag !== 'all' && (
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {cap(activeTag)}</span>
              )}
            </span>
            <span style={{ fontSize: 11, color: 'var(--hint)', fontWeight: 400 }}>
              ☑ Check to select · click row to edit
            </span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      title="Select all visible"
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Tag</th>
                  <th>Birthday</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 200).map((c) =>
                  editingId === c.id ? (
                    /* ── Edit row ── */
                    <tr key={c.id} style={{ background: 'var(--accent-bg)' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => {
                            /* handled below */
                          }}
                          onClick={(e) => toggleSelect(c.id, e)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ padding: '4px 7px', fontSize: 12 }}
                          value={editForm.name}
                          onChange={ef('name')}
                          autoFocus
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ padding: '4px 7px', fontSize: 12, fontFamily: 'monospace' }}
                          value={editForm.phone}
                          onChange={ef('phone')}
                          placeholder="+92..."
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ padding: '4px 7px', fontSize: 12 }}
                          value={editForm.email}
                          onChange={ef('email')}
                          type="email"
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ padding: '4px 7px', fontSize: 12 }}
                          value={editForm.tag}
                          onChange={ef('tag')}
                          placeholder="tag"
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ padding: '4px 7px', fontSize: 12 }}
                          value={editForm.birthday}
                          onChange={ef('birthday')}
                          placeholder="YYYY-MM-DD"
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => void saveEdit(c.id)}
                            disabled={saving || !editForm.name}
                          >
                            {saving ? '…' : 'Save'}
                          </button>
                          <button className="btn btn-sm" onClick={cancelEdit}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* ── Normal row ── */
                    <tr
                      key={c.id}
                      style={{
                        cursor: 'pointer',
                        background: selectedIds.has(c.id) ? 'var(--accent-bg)' : undefined,
                      }}
                      onClick={() => startEdit(c)}
                      title="Click to edit"
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => toggleSelect(c.id, e)}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => {
                            /* handled by td onClick */
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="avatar"
                            style={{
                              background: getAvatarColors(c.name ?? '?')[0],
                              color: getAvatarColors(c.name ?? '?')[1],
                            }}
                          >
                            {(c.name ?? '?').charAt(0)}
                          </span>
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                        {c.phone ?? '—'}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{c.email ?? '—'}</td>
                      <td>
                        {c.tag ? <span className="badge badge-blue">{cap(c.tag)}</span> : '—'}
                      </td>
                      <td style={{ color: 'var(--hint)', fontSize: 11 }}>{c.birthday ?? '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => void deleteOne(c.id, c.name ?? 'contact')}
                          title="Delete contact"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {list.length > 200 && (
              <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--muted)' }}>
                Showing first 200 of {list.length} contacts.
              </div>
            )}
          </div>
        </div>
      )}

      {groups.total === 0 && !importing && (
        <div
          style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}
        >
          No contacts yet. Upload a CSV to get started.
        </div>
      )}
    </>
  )
}
