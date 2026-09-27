'use client'

import { useState } from 'react'
import { MessageSquare, Bug, Send, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'feedback' | 'bug'

const CATEGORIES = [
  { value: 'general',  label: 'General feedback' },
  { value: 'feature',  label: 'Feature request' },
  { value: 'other',    label: 'Other' },
]

export default function FeedbackPage() {
  const [tab, setTab] = useState<Tab>('feedback')

  // Feedback form
  const [category,  setCategory]  = useState('general')
  const [message,   setMessage]   = useState('')
  const [fbLoading, setFbLoading] = useState(false)
  const [fbDone,    setFbDone]    = useState(false)
  const [fbError,   setFbError]   = useState('')

  // Bug report form
  const [title,      setTitle]      = useState('')
  const [description,setDescription]= useState('')
  const [steps,      setSteps]      = useState('')
  const [bgLoading,  setBgLoading]  = useState(false)
  const [bgDone,     setBgDone]     = useState(false)
  const [bgError,    setBgError]    = useState('')

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault()
    setFbError('')
    setFbLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ category, message }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to submit')
      setFbDone(true)
      setMessage('')
    } catch (err) {
      setFbError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setFbLoading(false)
    }
  }

  async function submitBug(e: React.FormEvent) {
    e.preventDefault()
    setBgError('')
    setBgLoading(true)
    try {
      const res = await fetch('/api/bug-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, description, steps: steps || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to submit')
      setBgDone(true)
      setTitle('')
      setDescription('')
      setSteps('')
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBgLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 text-2xl font-bold text-white">Feedback &amp; Support</h1>
      <p className="mb-6 text-sm text-gray-400">
        Help us improve Architect Pay — share your thoughts or let us know about any issues.
      </p>

      {/* Tab toggle */}
      <div
        className="mb-6 flex gap-1 rounded-xl p-1"
        style={{ background: '#0d1926', border: '1px solid rgba(42,171,171,0.12)' }}
      >
        <button
          onClick={() => { setTab('feedback'); setFbDone(false) }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
            tab === 'feedback' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Send Feedback
        </button>
        <button
          onClick={() => { setTab('bug'); setBgDone(false) }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
            tab === 'bug' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Bug className="h-4 w-4" />
          Report a Bug
        </button>
      </div>

      {/* ── Feedback form ── */}
      {tab === 'feedback' && (
        <div className="card">
          {fbDone ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
              <p className="text-lg font-semibold text-white">Thanks for your feedback!</p>
              <p className="text-sm text-gray-400">We read every submission and use it to make Architect Pay better.</p>
              <button
                onClick={() => setFbDone(false)}
                className="mt-2 text-sm text-brand-400 hover:underline"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submitFeedback} className="space-y-4">
              {fbError && (
                <div className="rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{fbError}</div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-base appearance-none pr-9"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Your feedback
                  <span className="ml-2 text-xs font-normal text-gray-500">{message.length}/2000</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input-base min-h-[140px] resize-y"
                  placeholder="Tell us what you think, what you'd like to see, or anything on your mind..."
                  maxLength={2000}
                  required
                  minLength={10}
                />
              </div>

              <button
                type="submit"
                disabled={fbLoading || message.length < 10}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {fbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {fbLoading ? 'Sending...' : 'Send Feedback'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Bug report form ── */}
      {tab === 'bug' && (
        <div className="card">
          {bgDone ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
              <p className="text-lg font-semibold text-white">Bug report received!</p>
              <p className="text-sm text-gray-400">We&apos;ll investigate and fix it as soon as possible.</p>
              <button
                onClick={() => setBgDone(false)}
                className="mt-2 text-sm text-brand-400 hover:underline"
              >
                Report another
              </button>
            </div>
          ) : (
            <form onSubmit={submitBug} className="space-y-4">
              {bgError && (
                <div className="rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-400">{bgError}</div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">What went wrong?</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-base"
                  placeholder='e.g. "Payment stuck on Processing" or "Balance not updating"'
                  maxLength={150}
                  required
                  minLength={3}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Describe the issue
                  <span className="ml-2 text-xs font-normal text-gray-500">{description.length}/3000</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-base min-h-[120px] resize-y"
                  placeholder="What were you doing when it happened? What did you expect to happen?"
                  maxLength={3000}
                  required
                  minLength={10}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Steps to reproduce <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="input-base min-h-[90px] resize-y"
                  placeholder={'1. Go to Send Payment\n2. Enter amount\n3. Click Send\n4. ...'}
                  maxLength={2000}
                />
              </div>

              <button
                type="submit"
                disabled={bgLoading || title.length < 3 || description.length < 10}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {bgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                {bgLoading ? 'Submitting...' : 'Submit Bug Report'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
